// Zod schemas pour Auth.js v5 + 2FA TOTP (Sprint 15 / M8).
//
// signInSchema   : payload Credentials provider (login + password + 2fa optionnel)
// setup2FASchema : verification du code 2FA lors du setup initial
// disable2FASchema : verification du code 2FA + password pour desactiver

import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Email invalide."),
  password: z.string().min(8, "Mot de passe trop court."),
  totp: z
    .string()
    .regex(/^\d{6}$/, "Code 2FA invalide.")
    .optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const setup2FASchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code 2FA invalide."),
});
export type Setup2FAInput = z.infer<typeof setup2FASchema>;

export const disable2FASchema = z.object({
  password: z.string().min(8),
  code: z.string().regex(/^\d{6}$/, "Code 2FA invalide."),
});
export type Disable2FAInput = z.infer<typeof disable2FASchema>;
