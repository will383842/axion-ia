/**
 * Espace formateur — lien magique passwordless à usage unique (2026-06-13).
 *
 * Deux couches de sécurité combinées :
 *   1. Intégrité : magic-token HMAC signé (src/lib/magic-token.ts, scope
 *      `formateur_login`, TTL 15 min). Un attaquant ne peut pas forger un lien.
 *   2. Usage unique + révocation : la table `FormateurMagicLink` stocke le
 *      HASH SHA-256 du token (jamais le token en clair) + `usedAt`. La
 *      consommation est atomique (`updateMany` conditionnel) → un lien déjà
 *      cliqué (ou expiré) est rejeté, même si le HMAC est encore valide.
 *
 * Node runtime uniquement (accès Prisma).
 */

import { prisma } from "@/lib/prisma";
import { signMagicToken, verifyMagicToken } from "@/lib/magic-token";

/** Durée de validité d'un lien de connexion (alignée sur le TTL du magic-token). */
const LINK_TTL_MS = 15 * 60 * 1000;

/** SHA-256 hex (64 chars) via Web Crypto — pas de dépendance Node-only. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Crée un lien magique pour un formateur : signe un token + enregistre son hash
 * (usage unique) en base. Retourne le token EN CLAIR (à insérer dans l'URL e-mail).
 */
export async function createFormateurMagicLink(
  trainerId: string,
  createdIp?: string | null,
): Promise<string> {
  const token = await signMagicToken({ scope: "formateur_login", resourceId: trainerId });
  const tokenHash = await sha256Hex(token);
  // Purge opportuniste des liens consommés/expirés de ce formateur (borne la
  // croissance de la table sans tâche planifiée).
  await prisma.formateurMagicLink.deleteMany({
    where: { trainerId, OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date() } }] },
  });
  await prisma.formateurMagicLink.create({
    data: {
      trainerId,
      tokenHash,
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
      createdIp: createdIp ?? null,
    },
  });
  return token;
}

/**
 * Consomme un lien magique : vérifie la signature, l'expiration et l'usage
 * unique de façon atomique. Retourne le `trainerId` si valide, sinon `null`.
 *
 * NE vérifie PAS `Trainer.actif` ici (responsabilité de l'appelant après
 * consommation) — mais l'usage unique est garanti par l'`updateMany` conditionnel.
 */
export async function consumeFormateurMagicLink(token: string): Promise<string | null> {
  const verified = await verifyMagicToken(token, { scope: "formateur_login" });
  if (!verified.ok) return null;

  const tokenHash = await sha256Hex(token);
  // Atomique : ne consomme que si non utilisé ET non expiré. updateMany retourne
  // le nombre de lignes touchées → 0 = lien inconnu / déjà consommé / expiré.
  const result = await prisma.formateurMagicLink.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (result.count === 0) return null;

  return verified.resourceId;
}
