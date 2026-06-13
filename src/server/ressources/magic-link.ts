/**
 * Espace ressources — lien magique passwordless à usage unique (2026-06-13).
 * Ancré sur DocumentRecipient (la liste de diffusion = la liste de comptes).
 * Même double sécurité que formateur : HMAC signé + hash one-shot en base.
 */

import { prisma } from "@/lib/prisma";
import { signMagicToken, verifyMagicToken } from "@/lib/magic-token";

const LINK_TTL_MS = 15 * 60 * 1000;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Crée un lien magique pour un destinataire ; retourne le token en clair. */
export async function createRessourcesMagicLink(
  recipientId: string,
  createdIp?: string | null,
): Promise<string> {
  const token = await signMagicToken({ scope: "ressources_login", resourceId: recipientId });
  const tokenHash = await sha256Hex(token);
  await prisma.ressourcesMagicLink.create({
    data: {
      recipientId,
      tokenHash,
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
      createdIp: createdIp ?? null,
    },
  });
  return token;
}

/** Consomme un lien (signature + expiration + usage unique atomique). */
export async function consumeRessourcesMagicLink(token: string): Promise<string | null> {
  const verified = await verifyMagicToken(token, { scope: "ressources_login" });
  if (!verified.ok) return null;
  const tokenHash = await sha256Hex(token);
  const result = await prisma.ressourcesMagicLink.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (result.count === 0) return null;
  return verified.resourceId;
}
