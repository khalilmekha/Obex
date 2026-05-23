import { z } from "zod";

export const biometricLoginSchema = z.object({
  email: z.string().email("Format d'email invalide"),
  assertion: z.object({
    id: z.string(),
    type: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      authenticatorData: z.string(),
      signature: z.string(),
      userHandle: z.string().nullable(),
    }),
  }),
});

export const biometricRegisterSchema = z.object({
  credential: z.object({
    id: z.string(),
    type: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
    }),
  }),
});

export type BiometricLoginInput = z.infer<typeof biometricLoginSchema>;
export type BiometricRegisterInput = z.infer<typeof biometricRegisterSchema>;
