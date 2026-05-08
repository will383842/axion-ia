// 2FA TOTP helpers (Sprint 15 / M8 — otplib v13 functional API).
//
// otplib v13+ a casse l'API v12 (`authenticator`) au profit d'une API
// fonctionnelle plus tree-shakeable. On wrappe ici pour exposer une surface
// stable au reste du codebase (Auth.js callbacks, Server Actions, tests).
//
// Standard : TOTP RFC 6238, SHA-1, periode 30s, 6 digits — compatible
// Google Authenticator, Authy, 1Password, Bitwarden, Microsoft Authenticator.

import { generateSecret, generateURI, generateSync, verifySync } from "otplib";

/** Tolerance en secondes (epochTolerance) — accepte le code precedent + courant. */
const EPOCH_TOLERANCE = 30;

/**
 * Genere un secret TOTP base32 (160 bits, recommande RFC 6238).
 * Retourne le secret + l'URI otpauth a encoder en QR code.
 */
export function generate2FASecret(
  account: string,
  issuer = "Axion-IA",
): {
  secret: string;
  otpauthUrl: string;
} {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer, label: account, secret });
  return { secret, otpauthUrl };
}

/**
 * Valide un code TOTP 6 digits contre le secret stocke.
 * Comparaison constant-time + tolerance ±30s pour absorber le clock-skew.
 */
export function verify2FACode(code: string, secret: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    const result = verifySync({ secret, token: code, epochTolerance: EPOCH_TOLERANCE });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Genere un code TOTP courant (utile pour seed dev / tests).
 */
export function current2FACode(secret: string): string {
  return generateSync({ secret });
}
