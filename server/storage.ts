// server/storage.ts
import crypto from "crypto";
import { 
  getUsersCollection, 
  getPublicKeysCollection, 
  getFilesCollection,
  getSessionsCollection,
  getWebAuthnCollection,
} from "./db";
import type { SessionDoc, WebAuthnCredentialDoc } from "./db";
import type { 
  User, 
  File, 
  PublicKey, 
  InsertUser, 
  InsertPublicKey, 
  InsertFile 
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: number, newPasswordHash: string): Promise<User>;
  updateQuota(userId: number, addedBytes: number): Promise<void>;
  setVucle(userId: number, vucle: boolean): Promise<void>;

  // Session methods (MongoDB TTL)
  createSession(userId: number): Promise<string>;      // retourne sessionId
  getSession(sessionId: string): Promise<SessionDoc | undefined>;
  deleteSession(sessionId: string): Promise<void>;
  deleteUserSessions(userId: number): Promise<void>;

  // Admin methods
  getAllUsers(): Promise<Omit<User, "passwordHash">[]>;
  deleteUser(userId: number): Promise<void>;
  setUserQuota(userId: number, quotaTotal: number): Promise<void>;
  getAllFiles(): Promise<Omit<File, "encryptedData">[]>;
  adminDeleteFile(fileId: number): Promise<void>;

  // Public Key methods (only)
  // Public Key methods (only)
createPublicKey(key: InsertPublicKey): Promise<PublicKey>;
getPublicKey(userId: number): Promise<PublicKey | undefined>;
updatePublicKey(
  userId: number,
  keyId: string,
  key: string,
  keySalt: string
): Promise<PublicKey>;
deletePublicKey(userId: number): Promise<void>;

  // File methods
  createFile(file: InsertFile): Promise<File>;
  getFile(id: number): Promise<File | undefined>;
  deleteFile(id: number): Promise<void>;
  getUserFiles(userId: number): Promise<Omit<File, "encryptedData">[]>;
  getUserFilesWithData(userId: number): Promise<File[]>;
  updateFileEncryptedData(fileId: number, encryptedData: Buffer): Promise<void>;

  // WebAuthn credential methods
  saveWebAuthnCredential(cred: WebAuthnCredentialDoc): Promise<void>;
  getWebAuthnCredentials(userId: number): Promise<WebAuthnCredentialDoc[]>;
  getWebAuthnCredentialById(id: string): Promise<WebAuthnCredentialDoc | undefined>;
  updateWebAuthnCounter(id: string, newCounter: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // -------------------- Users --------------------
  async getUser(id: number): Promise<User | undefined> {
    try {
      const collection = getUsersCollection();
      const user = await collection.findOne({ id });
      return user || undefined;
    } catch (error) {
      console.error("❌ getUser error:", error);
      throw new Error("Database error while fetching user");
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const collection = getUsersCollection();
      const user = await collection.findOne({ email });
      return user || undefined;
    } catch (error) {
      console.error("❌ getUserByEmail error:", error);
      throw new Error("Database error while fetching user by email");
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const collection = getUsersCollection();

      // Get next available ID
      const lastUser = await collection.find().sort({ id: -1 }).limit(1).toArray();
      const newId = lastUser.length > 0 ? lastUser[0].id + 1 : 1;
      console.log("🔢 Generated new user ID:", newId);

      const userData: User = {
        ...insertUser,
        id: newId,
        createdAt: new Date(),
        quotaUsed: 0,
        isAdmin: insertUser.isAdmin ?? false,
        vucle: false,
      };

      const result = await collection.insertOne(userData);
      if (!result.acknowledged) {
        throw new Error("Insert operation was not acknowledged by MongoDB");
      }

      console.log("✅ User inserted with _id:", result.insertedId);
      return userData;
    } catch (error) {
      console.error("❌ createUser error:", error);
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateUserPassword(userId: number, newPasswordHash: string): Promise<User> {
    try {
      const collection = getUsersCollection();
      const result = await collection.updateOne(
        { id: userId },
        { $set: { passwordHash: newPasswordHash } }
      );

      if (result.matchedCount === 0) {
        throw new Error(`User with id ${userId} not found`);
      }

      const updated = await collection.findOne({ id: userId });
      if (!updated) throw new Error("User not found after update");
      return updated;
    } catch (error) {
      console.error("❌ updateUserPassword error:", error);
      throw error;
    }
  }

  async updateQuota(userId: number, addedBytes: number): Promise<void> {
    try {
      const collection = getUsersCollection();
      const result = await collection.updateOne(
        { id: userId },
        { $inc: { quotaUsed: addedBytes } }
      );

      if (result.matchedCount === 0) {
        throw new Error(`User with id ${userId} not found for quota update`);
      }
    } catch (error) {
      console.error("❌ updateQuota error:", error);
      throw error;
    }
  }

  async setVucle(userId: number, vucle: boolean): Promise<void> {
    try {
      const collection = getUsersCollection();
      await collection.updateOne({ id: userId }, { $set: { vucle } });
    } catch (error) {
      console.error("❌ setVucle error:", error);
      throw error;
    }
  }

  // -------------------- Sessions (MongoDB TTL 7 jours) --------------------
  async createSession(userId: number): Promise<string> {
    try {
      const collection = getSessionsCollection();
      const sessionId = crypto.randomBytes(32).toString("hex");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 jours

      await collection.insertOne({
        _id: sessionId as any,
        userId,
        createdAt: now,
        expiresAt,
      });

      // Mémoriser la date d'expiration sur le user pour la détecter au prochain login
      await getUsersCollection().updateOne(
        { id: userId },
        { $set: { lastSessionExpiresAt: expiresAt } }
      );

      console.log(`✅ Session créée pour user ${userId}, expire le ${expiresAt.toISOString()}`);
      return sessionId;
    } catch (error) {
      console.error("❌ createSession error:", error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<SessionDoc | undefined> {
    try {
      const collection = getSessionsCollection();
      const session = await collection.findOne({ _id: sessionId as any });
      if (!session) return undefined;
      // Double vérification côté app (le TTL MongoDB peut avoir un délai de ~60s)
      if (session.expiresAt < new Date()) {
        await collection.deleteOne({ _id: sessionId as any });
        return undefined;
      }
      return session;
    } catch (error) {
      console.error("❌ getSession error:", error);
      return undefined;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await getSessionsCollection().deleteOne({ _id: sessionId as any });
    } catch (error) {
      console.error("❌ deleteSession error:", error);
    }
  }

  async deleteUserSessions(userId: number): Promise<void> {
    try {
      await getSessionsCollection().deleteMany({ userId });
      console.log(`✅ Toutes les sessions supprimées pour user ${userId}`);
    } catch (error) {
      console.error("❌ deleteUserSessions error:", error);
    }
  }

  // -------------------- Admin --------------------
  async getAllUsers(): Promise<Omit<User, "passwordHash">[]> {
    try {
      const collection = getUsersCollection();
      return await collection
        .find({}, { projection: { passwordHash: 0 } })
        .sort({ createdAt: -1 })
        .toArray() as Omit<User, "passwordHash">[];
    } catch (error) {
      console.error("❌ getAllUsers error:", error);
      throw error;
    }
  }

  async deleteUser(userId: number): Promise<void> {
    try {
      // Supprimer tous les fichiers, clés et l'utilisateur en cascade
      await getFilesCollection().deleteMany({ userId });
      await getPublicKeysCollection().deleteOne({ userId });
      const result = await getUsersCollection().deleteOne({ id: userId });
      if (result.deletedCount === 0) throw new Error(`User ${userId} not found`);
      console.log("✅ User deleted (cascade):", userId);
    } catch (error) {
      console.error("❌ deleteUser error:", error);
      throw error;
    }
  }

  async setUserQuota(userId: number, quotaTotal: number): Promise<void> {
    try {
      const collection = getUsersCollection();
      const result = await collection.updateOne(
        { id: userId },
        { $set: { quotaTotal } }
      );
      if (result.matchedCount === 0) throw new Error(`User ${userId} not found`);
    } catch (error) {
      console.error("❌ setUserQuota error:", error);
      throw error;
    }
  }

  async getAllFiles(): Promise<Omit<File, "encryptedData">[]> {
    try {
      const collection = getFilesCollection();
      return await collection
        .find({}, { projection: { encryptedData: 0 } })
        .sort({ uploadDate: -1 })
        .toArray() as Omit<File, "encryptedData">[];
    } catch (error) {
      console.error("❌ getAllFiles error:", error);
      throw error;
    }
  }

  async adminDeleteFile(fileId: number): Promise<void> {
    try {
      const collection = getFilesCollection();
      const file = await collection.findOne({ id: fileId });
      if (!file) throw new Error(`File ${fileId} not found`);
      await collection.deleteOne({ id: fileId });
      // Mettre à jour le quota de l'utilisateur
      await this.updateQuota(file.userId, -file.sizeBytes);
      console.log("✅ Admin deleted file:", fileId);
    } catch (error) {
      console.error("❌ adminDeleteFile error:", error);
      throw error;
    }
  }

  // -------------------- Public Keys (only) --------------------
  async createPublicKey(insertKey: InsertPublicKey): Promise<PublicKey> {
    try {
      const collection = getPublicKeysCollection();

      // Get next available ID
      const lastKey = await collection.find().sort({ id: -1 }).limit(1).toArray();
      const newId = lastKey.length > 0 ? lastKey[0].id + 1 : 1;

      const keyData: PublicKey = {
        ...insertKey,
        id: newId,
        createdAt: new Date(),
      };

      const result = await collection.insertOne(keyData);
      if (!result.acknowledged) {
        throw new Error("Public key insert was not acknowledged");
      }

      console.log("✅ Public key created for user:", insertKey.userId);
      return keyData;
    } catch (error) {
      console.error("❌ createPublicKey error:", error);
      throw new Error(`Failed to create public key: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPublicKey(userId: number): Promise<PublicKey | undefined> {
    try {
      const collection = getPublicKeysCollection();
      const key = await collection.findOne({ userId });
      return key || undefined;
    } catch (error) {
      console.error("❌ getPublicKey error:", error);
      throw error;
    }
  }
  async updatePublicKey(
  userId: number,
  keyId: string,
  key: string,
  keySalt: string
): Promise<PublicKey> {
  try {
    const collection = getPublicKeysCollection();

    const result = await collection.updateOne(
      { userId },
      {
        $set: {
          keyId,
          key,
          keySalt,
          createdAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Public key for user ${userId} not found`);
    }

    const updated = await collection.findOne({ userId });
    if (!updated) {
      throw new Error("Public key not found after update");
    }

    console.log("✅ Public key updated for user:", userId);
    return updated;
  } catch (error) {
    console.error("❌ updatePublicKey error:", error);
    throw error;
  }
}

  async deletePublicKey(userId: number): Promise<void> {
    try {
      const collection = getPublicKeysCollection();
      await collection.deleteOne({ userId });
      console.log("✅ Public key deleted for user:", userId);
    } catch (error) {
      console.error("❌ deletePublicKey error:", error);
      throw error;
    }
  }

  // -------------------- Files --------------------
  async createFile(insertFile: InsertFile): Promise<File> {
    try {
      const collection = getFilesCollection();

      const lastFile = await collection.find().sort({ id: -1 }).limit(1).toArray();
      const newId = lastFile.length > 0 ? lastFile[0].id + 1 : 1;

      const fileData: File = {
        ...insertFile,
        id: newId,
        uploadDate: new Date(),
      };

      const result = await collection.insertOne(fileData);
      if (!result.acknowledged) {
        throw new Error("File insert was not acknowledged");
      }

      return fileData;
    } catch (error) {
      console.error("❌ createFile error:", error);
      throw new Error(`Failed to create file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getFile(id: number): Promise<File | undefined> {
    try {
      const collection = getFilesCollection();
      const file = await collection.findOne({ id });
      return file || undefined;
    } catch (error) {
      console.error("❌ getFile error:", error);
      throw error;
    }
  }

  async deleteFile(id: number): Promise<void> {
    try {
      const collection = getFilesCollection();
      const result = await collection.deleteOne({ id });
      if (result.deletedCount === 0) {
        console.warn(`File with id ${id} not found for deletion`);
      }
    } catch (error) {
      console.error("❌ deleteFile error:", error);
      throw error;
    }
  }

  async getUserFiles(userId: number): Promise<Omit<File, "encryptedData">[]> {
    try {
      const collection = getFilesCollection();
      return await collection
        .find({ userId }, { projection: { encryptedData: 0 } })
        .sort({ uploadDate: -1 })
        .toArray() as Omit<File, "encryptedData">[];
    } catch (error) {
      console.error("❌ getUserFiles error:", error);
      throw error;
    }
  }

  async getUserFilesWithData(userId: number): Promise<File[]> {
    try {
      const collection = getFilesCollection();
      return await collection
        .find({ userId })
        .toArray() as File[];
    } catch (error) {
      console.error("❌ getUserFilesWithData error:", error);
      throw error;
    }
  }

  async updateFileEncryptedData(fileId: number, encryptedData: Buffer): Promise<void> {
    try {
      const collection = getFilesCollection();
      await collection.updateOne(
        { id: fileId },
        { $set: { encryptedData } }
      );
    } catch (error) {
      console.error("❌ updateFileEncryptedData error:", error);
      throw error;
    }
  }

  // -------------------- WebAuthn Credentials --------------------
  async saveWebAuthnCredential(cred: WebAuthnCredentialDoc): Promise<void> {
    try {
      await getWebAuthnCollection().insertOne(cred);
      console.log("✅ WebAuthn credential saved for user:", cred.userId);
    } catch (error) {
      console.error("❌ saveWebAuthnCredential error:", error);
      throw error;
    }
  }

  async getWebAuthnCredentials(userId: number): Promise<WebAuthnCredentialDoc[]> {
    try {
      return await getWebAuthnCollection().find({ userId }).toArray();
    } catch (error) {
      console.error("❌ getWebAuthnCredentials error:", error);
      throw error;
    }
  }

  async getWebAuthnCredentialById(id: string): Promise<WebAuthnCredentialDoc | undefined> {
    try {
      const cred = await getWebAuthnCollection().findOne({ id });
      return cred || undefined;
    } catch (error) {
      console.error("❌ getWebAuthnCredentialById error:", error);
      throw error;
    }
  }

  async updateWebAuthnCounter(id: string, newCounter: number): Promise<void> {
    try {
      await getWebAuthnCollection().updateOne({ id }, { $set: { counter: newCounter } });
    } catch (error) {
      console.error("❌ updateWebAuthnCounter error:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();