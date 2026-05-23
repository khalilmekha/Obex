import { MongoClient, Db, Collection } from "mongodb";
import { config } from "dotenv";
import { User, File, PublicKey } from "../shared/schema";

export interface WebAuthnCredentialDoc {
  id: string;          // credential id (base64url)
  userId: number;
  publicKey: string;   // base64url encoded
  counter: number;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date;
}

config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB_NAME || "file-storage-app";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI must be set in environment variables");
}

export interface SessionDoc {
  _id: string;        // sessionId
  userId: number;
  createdAt: Date;
  expiresAt: Date;    // TTL index sur ce champ
}

class MongoDBConnection {
  private static instance: MongoDBConnection;
  private client: MongoClient;
  private db: Db | null = null;

  private constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  public static getInstance(): MongoDBConnection {
    if (!MongoDBConnection.instance) {
      MongoDBConnection.instance = new MongoDBConnection();
    }
    return MongoDBConnection.instance;
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      console.log("✅ Connected to MongoDB");

      // Create indexes
      await this.createIndexes();
    } catch (error) {
      console.error("❌ MongoDB connection error:", error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error("Database not connected");

    try {
      // Users collection indexes
      await this.db.collection("users").createIndex({ email: 1 }, { unique: true });
      await this.db.collection("users").createIndex({ id: 1 }, { unique: true });

      // Public keys collection indexes (only)
      await this.db.collection("public_keys").createIndex({ userId: 1 }, { unique: true });
      await this.db.collection("public_keys").createIndex({ id: 1 }, { unique: true });
      await this.db.collection("public_keys").createIndex({ keyId: 1 }, { unique: true });

      // Files collection indexes
      await this.db.collection("files").createIndex({ userId: 1 });
      await this.db.collection("files").createIndex({ storedUuid: 1 }, { unique: true });
      await this.db.collection("files").createIndex({ uploadDate: -1 });
      await this.db.collection("files").createIndex({ id: 1 }, { unique: true });
      await this.db.collection("files").createIndex({ keyId: 1 });

      // Sessions collection — TTL index : expiration automatique après 7 jours
      await this.db.collection("sessions").createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 }
      );
      await this.db.collection("sessions").createIndex({ userId: 1 });

      // WebAuthn credentials collection
      await this.db.collection("webauthn_credentials").createIndex({ id: 1 }, { unique: true });
      await this.db.collection("webauthn_credentials").createIndex({ userId: 1 });

      console.log("✅ Indexes created/verified");
    } catch (error) {
      console.error("⚠️ Index creation error (non-fatal):", error);
    }
  }

  getDb(): Db {
    if (!this.db) throw new Error("Database not connected. Call connect() first.");
    return this.db;
  }

  getCollection<T>(name: string): Collection<T> {
    return this.getDb().collection<T>(name);
  }

  async close(): Promise<void> {
    await this.client.close();
    console.log("🔌 Disconnected from MongoDB");
  }
}

const mongoConnection = MongoDBConnection.getInstance();

export const getUsersCollection    = () => mongoConnection.getCollection<User>("users");
export const getPublicKeysCollection = () => mongoConnection.getCollection<PublicKey>("public_keys");
export const getFilesCollection    = () => mongoConnection.getCollection<File>("files");
export const getSessionsCollection = () => mongoConnection.getCollection<SessionDoc>("sessions");
export const getWebAuthnCollection = () => mongoConnection.getCollection<WebAuthnCredentialDoc>("webauthn_credentials");
export const connectDB = () => mongoConnection.connect();
export const closeDB   = () => mongoConnection.close();

export default mongoConnection;