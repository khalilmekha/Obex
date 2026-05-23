import { z } from 'zod';
import { registerRequestSchema, loginRequestSchema, downloadRequestSchema, updatePasswordSchema } from './schema';
import type { User, File } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  unauthorized: z.object({ message: z.string() }),
  forbidden: z.object({ message: z.string() }),
  notFound: z.object({ message: z.string() }),
  insufficientStorage: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

// Define types for responses
export type UserWithoutPassword = Omit<User, "passwordHash">;

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: registerRequestSchema,
      responses: {
        201: z.object({ 
          message: z.string(), 
          privateKey: z.string(), 
          user: z.custom<UserWithoutPassword>() 
        }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: loginRequestSchema,
      responses: {
        200: z.object({ 
          message: z.string(), 
          user: z.custom<UserWithoutPassword>() 
        }),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.object({ message: z.string() }),
      }
    },
    profile: {
      method: 'GET' as const,
      path: '/api/auth/profile' as const,
      responses: {
        200: z.custom<UserWithoutPassword | null>(),
      }
    },
    updatePassword: {
      method: 'PUT' as const,
      path: '/api/auth/password' as const,
      input: updatePasswordSchema,
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    }
  },
  files: {
    upload: {
      method: 'POST' as const,
      path: '/api/files/upload' as const,
      responses: {
        201: z.custom<File>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        507: errorSchemas.insufficientStorage,
      }
    },
    list: {
      method: 'GET' as const,
      path: '/api/files' as const,
      responses: {
        200: z.array(z.custom<File>()),
        401: errorSchemas.unauthorized,
      }
    },
    download: {
      method: 'POST' as const,
      path: '/api/files/:id/download' as const,
      input: downloadRequestSchema,
      responses: {
        200: z.any(),
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
        400: errorSchemas.validation,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/files/:id' as const,
      responses: {
        200: z.object({ message: z.string() }),
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}