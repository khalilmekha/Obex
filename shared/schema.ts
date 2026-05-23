// shared/schema.ts
import { z } from "zod";

// User type for MongoDB
export interface User {
  id: number;
  email: string;
  passwordHash: string;
  quotaTotal: number;
  quotaUsed: number;
  isAdmin: boolean;
  createdAt: Date;
}

// Public Key type (only)
export interface PublicKey {
  id: number;
  userId: number;
  keyId: string;
  key: string;
  keySalt: string;  // hex-encoded salt used for deterministic key generation
  createdAt: Date;
}

// File type for MongoDB
export interface File {
  id: number;
  userId: number;
  originalName: string;
  storedUuid: string;
  sizeBytes: number;
  encryptedData: Buffer;
  keyId: string;  // Identifiant de la clé publique utilisée pour chiffrer
  uploadDate: Date;
}

// Validation schemas
export const registerRequestSchema = z.object({
  email: z.string().email("Format d'email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export const loginRequestSchema = z.object({
  email: z.string().email("Format d'email invalide"),
  password: z.string(),
});

export const downloadRequestSchema = z.object({
  privateKey: z.string().min(1, "La clé privée est requise"),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Le mot de passe actuel est requis"),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
});

export type UserWithoutPassword = Omit<User, "passwordHash">;

export const insertUserSchema = z.object({
  email: z.string().email(),
  passwordHash: z.string(),
  quotaTotal: z.number().default(524288000),
  isAdmin: z.boolean().default(false),
});

export const insertPublicKeySchema = z.object({
  userId: z.number(),
  keyId: z.string(),
  key: z.string(),
  keySalt: z.string(),
});

export const insertFileSchema = z.object({
  userId: z.number(),
  originalName: z.string(),
  storedUuid: z.string(),
  sizeBytes: z.number(),
  keyId: z.string(),
  encryptedData: z.any(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPublicKey = z.infer<typeof insertPublicKeySchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;

export const users = {
  id: { name: 'id' },
  email: { name: 'email' },
  passwordHash: { name: 'passwordHash' },
  quotaTotal: { name: 'quotaTotal' },
  quotaUsed: { name: 'quotaUsed' },
  isAdmin: { name: 'isAdmin' },
  createdAt: { name: 'createdAt' }
};

export const files = {
  id: { name: 'id' },
  userId: { name: 'userId' },
  originalName: { name: 'originalName' },
  storedUuid: { name: 'storedUuid' },
  sizeBytes: { name: 'sizeBytes' },
  keyId: { name: 'keyId' },
  encryptedData: { name: 'encryptedData' },
  uploadDate: { name: 'uploadDate' }
};