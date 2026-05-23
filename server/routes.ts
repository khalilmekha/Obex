import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { generateDeterministicKeys, encryptBuffer, decryptBuffer } from "./rsa";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const SESSION_COOKIE = "rsavault_sid";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Store temporaire des challenges (userId → challenge, TTL 5 minutes)
const challengeStore = new Map<number, { challenge: string; expiresAt: number }>();
function setChallenge(userId: number, challenge: string) {
  challengeStore.set(userId, { challenge, expiresAt: Date.now() + 5 * 60 * 1000 });
}
function getChallenge(userId: number): string | null {
  const entry = challengeStore.get(userId);
  if (!entry || entry.expiresAt < Date.now()) {
    challengeStore.delete(userId);
    return null;
  }
  challengeStore.delete(userId);
  return entry.challenge;
}

function normalizePem(pem: string): string {
  const trimmed = pem.trim();
  const headerMatch = trimmed.match(/^(-----BEGIN [^-]+-----)/);
  const footerMatch = trimmed.match(/(-----END [^-]+-----)$/);
  if (!headerMatch || !footerMatch) return trimmed;
  const header = headerMatch[1];
  const footer = footerMatch[1];
  const body = trimmed
    .slice(header.length, trimmed.length - footer.length)
    .replace(/\s+/g, "");
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `${header}\n${wrapped}\n${footer}`;
}

const upload = multer({ storage: multer.memoryStorage() });

async function getSessionUserId(req: any): Promise<number | null> {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (!sessionId) return null;
  const session = await storage.getSession(sessionId);
  return session ? session.userId : null;
}

async function startSession(res: any, userId: number): Promise<void> {
  const sessionId = await storage.createSession(userId);
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Parser les cookies
  app.use((req: any, _res: any, next: any) => {
    const cookieHeader = req.headers.cookie || "";
    req.cookies = Object.fromEntries(
      cookieHeader.split(";").filter(Boolean).map((c: string) => {
        const [k, ...v] = c.trim().split("=");
        return [k.trim(), decodeURIComponent(v.join("="))];
      })
    );
    next();
  });

  const requireAuth = async (req: any, res: any, next: any) => {
    const userId = await getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Non autorisé" });
    req.userId = userId;
    next();
  };

  // -------------------- Auth --------------------

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const data = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ message: "Cet email est déjà utilisé" });
      }

      const passwordHash = await bcrypt.hash(data.password, 12);
      const keySalt = crypto.randomBytes(32);
      const { publicKey, privateKey } = generateDeterministicKeys(data.password, keySalt);
      const keyId = crypto.randomUUID();

      const user = await storage.createUser({
        email: data.email,
        passwordHash,
        quotaTotal: 524288000,
      });

      await storage.createPublicKey({ userId: user.id, keyId, key: publicKey, keySalt: keySalt.toString("hex") });
      await startSession(res, user.id);

      const { passwordHash: _, ...userWithoutHash } = user;
      res.status(201).json({
        message: "Inscription réussie",
        privateKey,
        keyId,
        user: userWithoutHash,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const data = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      const valid = await bcrypt.compare(data.password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      await startSession(res, user.id);

      const { passwordHash: _, ...userWithoutHash } = user;
      res.status(200).json({
        message: "Connexion réussie",
        user: userWithoutHash,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post(api.auth.logout.path, async (req: any, res) => {
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (sessionId) await storage.deleteSession(sessionId);
    res.clearCookie(SESSION_COOKIE);
    res.status(200).json({ message: "Déconnecté" });
  });

  app.get(api.auth.profile.path, async (req: any, res) => {
    const userId = await getSessionUserId(req);
    if (!userId) return res.status(200).json(null);
    const user = await storage.getUser(userId);
    if (!user) return res.status(200).json(null);
    const { passwordHash: _, ...userWithoutHash } = user;
    res.status(200).json(userWithoutHash);
  });

  app.put(api.auth.updatePassword.path, requireAuth, async (req, res) => {
  try {
    const data = api.auth.updatePassword.input.parse(req.body);

    const user = await storage.getUser(req.userId);
    if (!user) {
      return res.status(401).json({ message: "Non autorisé" });
    }

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Mot de passe actuel incorrect" });
    }

    // 1) Nouveau hash du mot de passe
    const newPasswordHash = await bcrypt.hash(data.newPassword, 12);

    // 2) Nouvelle paire RSA liée au nouveau mot de passe
    const newKeySalt = crypto.randomBytes(32);

    const { publicKey, privateKey } = generateDeterministicKeys(
      data.newPassword,
      newKeySalt
    );

    const newKeyId = crypto.randomUUID();

    // 3) Mise à jour du mot de passe dans users
    await storage.updateUserPassword(user.id, newPasswordHash);

    // 4) Mise à jour de la clé publique utilisée pour les futurs uploads
    await storage.updatePublicKey(
      user.id,
      newKeyId,
      publicKey,
      newKeySalt.toString("hex")
    );

    // 5) Optionnel : supprimer les anciennes sessions et recréer une session propre
    await storage.deleteUserSessions(user.id);
    await startSession(res, user.id);

    // 6) Retourner la nouvelle clé privée au client
    res.status(200).json({
      message: "Mot de passe et clé RSA mis à jour avec succès",
      privateKey,
      keyId: newKeyId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }

    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

  // POST /api/auth/private-key — regenerate private key after password verification
  app.post("/api/auth/private-key", requireAuth, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ message: "Mot de passe requis" });

      const user = await storage.getUser(req.userId);
      if (!user) return res.status(401).json({ message: "Non autorisé" });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Mot de passe incorrect" });

      const publicKeyRecord = await storage.getPublicKey(user.id);
      if (!publicKeyRecord?.keySalt) {
        return res.status(404).json({ message: "Clé introuvable. Les comptes créés avant cette mise à jour ne peuvent pas récupérer leur clé." });
      }

      const keySalt = Buffer.from(publicKeyRecord.keySalt, "hex");
      const { privateKey } = generateDeterministicKeys(password, keySalt);

      res.status(200).json({ privateKey });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // -------------------- Fichiers --------------------

  app.post(api.files.upload.path, requireAuth, upload.single("file"), async (req, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) return res.status(401).json({ message: "Non autorisé" });

      const publicKeyRecord = await storage.getPublicKey(user.id);
      if (!publicKeyRecord) {
        return res.status(500).json({ message: "Clé publique non trouvée" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier fourni" });
      }

      const fileSize = req.file.size;
      if (user.quotaUsed + fileSize > user.quotaTotal) {
        return res.status(507).json({ message: "Espace de stockage insuffisant" });
      }

      const encryptedBuffer = encryptBuffer(req.file.buffer, publicKeyRecord.key);
      const uuid = crypto.randomUUID();

      const fileRecord = await storage.createFile({
        userId: user.id,
        originalName: req.file.originalname,
        storedUuid: uuid,
        sizeBytes: fileSize,
        keyId: publicKeyRecord.keyId,
        encryptedData: encryptedBuffer,
      });

      await storage.updateQuota(user.id, fileSize);

      const { encryptedData: _, ...fileWithoutData } = fileRecord;
      res.status(201).json(fileWithoutData);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de l'upload" });
    }
  });

  app.get(api.files.list.path, requireAuth, async (req, res) => {
    try {
      console.log("📂 getUserFiles pour userId:", req.userId, "type:", typeof req.userId);
      const [files, publicKey] = await Promise.all([
        storage.getUserFiles(req.userId),
        storage.getPublicKey(req.userId),
      ]);
      console.log("📂 fichiers trouvés:", files.length, files.map((f: any) => ({ id: f.id, userId: f.userId })));
      res.status(200).json({ files, currentKeyId: publicKey?.keyId ?? null });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post(api.files.download.path, requireAuth, async (req, res) => {
    try {
      const data = api.files.download.input.parse(req.body);
      const fileId = parseInt(req.params.id);

      const file = await storage.getFile(fileId);
      if (!file) return res.status(404).json({ message: "Fichier non trouvé" });
      if (file.userId !== req.userId) return res.status(403).json({ message: "Accès refusé" });

      const encryptedBuffer = Buffer.isBuffer(file.encryptedData)
        ? file.encryptedData
        : Buffer.from((file.encryptedData as any).buffer ?? file.encryptedData);

      const normalizedKey = normalizePem(data.privateKey.trim());

      let decryptedBuffer: Buffer;
      try {
        decryptedBuffer = decryptBuffer(encryptedBuffer, normalizedKey);
      } catch (err: any) {
        console.error("Decrypt error:", err?.message);
        return res.status(400).json({ message: "Clé privée invalide ou fichier corrompu" });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      res.status(200).send(decryptedBuffer);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Erreur lors du téléchargement" });
    }
  });

  app.delete(api.files.delete.path, requireAuth, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);
      if (!file) return res.status(404).json({ message: "Fichier non trouvé" });
      if (file.userId !== req.userId) return res.status(403).json({ message: "Accès refusé" });

      await storage.deleteFile(fileId);
      await storage.updateQuota(file.userId, -file.sizeBytes);
      res.status(200).json({ message: "Fichier supprimé" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // -------------------- WebAuthn --------------------
  const RP_NAME = "RSAVault";
  const getWebAuthnConfig = (req: any) => {
    const host = req.headers.host || "localhost:3000"; // e.g. "localhost:3000" or "127.0.0.1:3000"
    const rpID = host.split(":")[0];                  // strip port → "localhost" or "127.0.0.1"
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const origin = `${protocol}://${host}`;
    return { rpID, origin };
  };

  // GET /api/auth/webauthn/register-options
  app.get("/api/auth/webauthn/register-options", requireAuth, async (req, res) => {
    try {
      const { rpID } = getWebAuthnConfig(req);
      const user = await storage.getUser(req.userId);
      if (!user) return res.status(401).json({ message: "Non autorisé" });

      const existingCredentials = await storage.getWebAuthnCredentials(user.id);

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userID: new TextEncoder().encode(String(user.id)),
        userName: user.email,
        userDisplayName: user.email,
        attestationType: "none",
        excludeCredentials: existingCredentials.map(c => ({
          id: c.id,
          type: "public-key" as const,
        })),
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred",
        },
      });

      setChallenge(user.id, options.challenge);
      res.status(200).json(options);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/auth/webauthn/register
  app.post("/api/auth/webauthn/register", requireAuth, async (req, res) => {
    try {
      const { rpID, origin } = getWebAuthnConfig(req);
      const user = await storage.getUser(req.userId);
      if (!user) return res.status(401).json({ message: "Non autorisé" });

      const expectedChallenge = getChallenge(user.id);
      if (!expectedChallenge) {
        return res.status(400).json({ message: "Challenge expiré, recommencez" });
      }

      const verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ message: "Vérification biométrique échouée" });
      }

      const { credential } = verification.registrationInfo;

      await storage.saveWebAuthnCredential({
        id: credential.id,
        userId: user.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        createdAt: new Date(),
      });

      res.status(200).json({ message: "Biométrie enregistrée avec succès" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de l'enregistrement biométrique" });
    }
  });

  // POST /api/auth/webauthn/auth-options
  app.post("/api/auth/webauthn/auth-options", async (req, res) => {
    try {
      const { rpID } = getWebAuthnConfig(req);
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const credentials = await storage.getWebAuthnCredentials(user.id);
      if (credentials.length === 0) {
        return res.status(404).json({ message: "Aucune biométrie enregistrée pour ce compte" });
      }

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: credentials.map(c => ({
          id: c.id,
          type: "public-key" as const,
        })),
        userVerification: "preferred",
      });

      setChallenge(user.id, options.challenge);
      res.status(200).json({ ...options, userId: user.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/auth/webauthn/authenticate
  app.post("/api/auth/webauthn/authenticate", async (req, res) => {
    try {
      const { rpID, origin } = getWebAuthnConfig(req);
      const { userId, assertion } = req.body;
      if (!userId || !assertion) {
        return res.status(400).json({ message: "Données manquantes" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Utilisateur non trouvé" });

      const expectedChallenge = getChallenge(user.id);
      if (!expectedChallenge) {
        return res.status(400).json({ message: "Challenge expiré, recommencez" });
      }

      const credential = await storage.getWebAuthnCredentialById(assertion.id);
      if (!credential || credential.userId !== user.id) {
        return res.status(401).json({ message: "Credential non reconnu" });
      }

      const verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.id,
          publicKey: Buffer.from(credential.publicKey, "base64url"),
          counter: credential.counter,
        },
      });

      if (!verification.verified) {
        return res.status(401).json({ message: "Authentification biométrique échouée" });
      }

      await storage.updateWebAuthnCounter(credential.id, verification.authenticationInfo.newCounter);
      await startSession(res, user.id);

      const { passwordHash: _, ...userWithoutHash } = user;
      res.status(200).json({ message: "Authentification biométrique réussie", user: userWithoutHash });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur lors de l'authentification biométrique" });
    }
  });

  // -------------------- Admin --------------------

  const requireAdmin = async (req: any, res: any, next: any) => {
    const userId = await getSessionUserId(req);
    if (!userId) return res.status(401).json({ message: "Non autorisé" });
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) return res.status(403).json({ message: "Accès réservé aux administrateurs" });
    req.userId = userId;
    next();
  };

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      res.status(200).json(await storage.getAllUsers());
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const targetId = parseInt(req.params.id);
      if (targetId === req.userId) {
        return res.status(400).json({ message: "Impossible de supprimer votre propre compte" });
      }
      await storage.deleteUser(targetId);
      res.status(200).json({ message: "Utilisateur supprimé avec succès" });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.put("/api/admin/users/:id/quota", requireAdmin, async (req, res) => {
    try {
      const targetId = parseInt(req.params.id);
      const { quotaTotal } = req.body;
      if (typeof quotaTotal !== "number" || quotaTotal <= 0) {
        return res.status(400).json({ message: "Quota invalide" });
      }
      await storage.setUserQuota(targetId, quotaTotal);
      res.status(200).json({ message: "Quota mis à jour" });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/admin/files", requireAdmin, async (req, res) => {
    try {
      res.status(200).json(await storage.getAllFiles());
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/admin/files/:id", requireAdmin, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      await storage.adminDeleteFile(fileId);
      res.status(200).json({ message: "Fichier supprimé avec succès" });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  return httpServer;
}