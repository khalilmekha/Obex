import crypto from "crypto";
import forge from "node-forge";

const ENCRYPTED_KEY_SIZE = 256;
const NONCE_SIZE         = 12;
const TAG_SIZE           = 16;
const AES_KEY_SIZE       = 32;

const OFFSET_ENCRYPTED_KEY = 0;
const OFFSET_NONCE         = ENCRYPTED_KEY_SIZE;
const OFFSET_TAG           = ENCRYPTED_KEY_SIZE + NONCE_SIZE;
const OFFSET_DATA          = ENCRYPTED_KEY_SIZE + NONCE_SIZE + TAG_SIZE;

// ──────────────────────────────────────────────────────────
// GÉNÉRATION DÉTERMINISTE — même password+salt → même paire
// ──────────────────────────────────────────────────────────

export function generateDeterministicKeys(password: string, salt: Buffer): { publicKey: string; privateKey: string } {
  // 1. Derive 64 bytes of key material
  const masterSeed = crypto.pbkdf2Sync(password, salt, 300_000, 64, "sha512");

  // 2. Build an AES-256-CTR stream as a seeded CSPRNG
  const aesKey = masterSeed.subarray(0, 32);
  const ctr    = Buffer.from(masterSeed.subarray(32, 48)); // 16-byte counter block
  let remainder = Buffer.alloc(0);

  function nextBytes(n: number): string {
    while (remainder.length < n) {
      // Increment counter (big-endian)
      for (let i = 15; i >= 0; i--) {
        ctr[i]++;
        if (ctr[i] !== 0) break;
      }
      const cipher = crypto.createCipheriv("aes-256-ecb", aesKey, null as any);
      cipher.setAutoPadding(false);
      remainder = Buffer.concat([remainder, cipher.update(ctr), cipher.final()]);
    }
    const chunk = remainder.subarray(0, n).toString("binary");
    remainder = remainder.subarray(n);
    return chunk;
  }

  // 3. Plug our PRNG into forge and generate 2048-bit RSA
  const prng = { getBytesSync: nextBytes };
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001, prng });

  // 4. Export as PEM (PKCS#8 / SPKI to match Node crypto format)
  const publicKey  = forge.pki.publicKeyToPem(keypair.publicKey);
  const privateKey = forge.pki.privateKeyToPem(keypair.privateKey);

  return { publicKey, privateKey };
}

// Keep the old random generator for any legacy usage
export function generateKeys() {
  return generateDeterministicKeys(
    crypto.randomBytes(32).toString("hex"),
    crypto.randomBytes(32)
  );
}

// ──────────────────────────────────────────────────────────
// CHIFFREMENT — Hybride RSA+AES-GCM
// ──────────────────────────────────────────────────────────

export function encryptBuffer(buffer: Buffer, publicKeyPem: string): Buffer {
  const aesKey = crypto.randomBytes(AES_KEY_SIZE);
  const nonce  = crypto.randomBytes(NONCE_SIZE);

  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, nonce);
  const encryptedData = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  const encryptedAesKey = crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    aesKey
  );

  return Buffer.concat([encryptedAesKey, nonce, tag, encryptedData]);
}

// ──────────────────────────────────────────────────────────
// DÉCHIFFREMENT — Hybride RSA+AES-GCM
// ──────────────────────────────────────────────────────────

export function decryptBuffer(buffer: Buffer, privateKeyPem: string): Buffer {
  const MIN_SIZE = OFFSET_DATA;
  if (buffer.length < MIN_SIZE) {
    throw new Error(`Fichier corrompu : taille ${buffer.length} octets (minimum attendu : ${MIN_SIZE})`);
  }

  const encryptedAesKey = buffer.subarray(OFFSET_ENCRYPTED_KEY, OFFSET_NONCE);
  let aesKey: Buffer;
  try {
    aesKey = crypto.privateDecrypt(
      { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      encryptedAesKey
    ) as Buffer;
  } catch {
    throw new Error("Clé privée invalide ou fichier corrompu.");
  }

  const nonce         = buffer.subarray(OFFSET_NONCE, OFFSET_TAG);
  const tag           = buffer.subarray(OFFSET_TAG, OFFSET_DATA);
  const encryptedData = buffer.subarray(OFFSET_DATA);

  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, nonce);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  } catch {
    throw new Error("Déchiffrement impossible : fichier modifié ou clé privée incorrecte.");
  }
}