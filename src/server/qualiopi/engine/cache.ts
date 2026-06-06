/**
 * Qualiopi — Formation Engine T4 : Cache des appels IA (table `cache_ia`).
 *
 * Clé = SHA-256(prompt + promptVersion + langue) → string hex 64 chars.
 * Stub-aware : toutes les opérations sont fail-soft (no-op si erreur/stub).
 * Import Prisma via singleton `@/lib/prisma`.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../prisma/generated/client";

// ── Clé de cache ──────────────────────────────────────────────────────────────

/**
 * Calcule une clé SHA-256 hex déterministe.
 * Encode : `prompt|promptVersion|langue` (séparateur `|` peu probable dans les textes).
 */
export function buildCacheKey(prompt: string, promptVersion: number, langue: string): string {
  // Séparateur \x00 (null byte) — n'apparaît jamais dans un prompt ou une langue.
  // Évite les collisions de type "a|1" + 0 + "fr" = "a" + 1 + "0|fr".
  return createHash("sha256").update(`${prompt}\x00${promptVersion}\x00${langue}`).digest("hex");
}

// ── Lecture ───────────────────────────────────────────────────────────────────

/**
 * Retourne la valeur mise en cache pour cette clé, ou `null` si absente /
 * expirée. Stub-aware : retourne `null` en cas d'erreur.
 */
export async function getCachedIa(
  cle: string,
): Promise<{ valeur: unknown; modele: string } | null> {
  try {
    const row = await prisma.cacheIa.findUnique({
      where: { cle },
      select: { valeur: true, modele: true, expiresAt: true },
    });
    if (!row) return null;
    // Vérification expiration
    if (row.expiresAt !== null && row.expiresAt <= new Date()) return null;
    return { valeur: row.valeur, modele: row.modele };
  } catch {
    return null;
  }
}

// ── Écriture ──────────────────────────────────────────────────────────────────

export interface SetCachedIaInput {
  cle: string;
  valeur: unknown;
  modele: string;
  tokensIn: number;
  tokensOut: number;
  coutUsd: number;
  promptVersion: number;
  /** Si absent, pas d'expiration (cache permanent). */
  ttlSeconds?: number;
}

/**
 * Upsert d'une entrée cache. Fail-soft : log warning + no-op si erreur.
 * `expiresAt = now + ttlSeconds` si fourni, sinon null (permanent).
 */
export async function setCachedIa(input: SetCachedIaInput): Promise<void> {
  try {
    const expiresAt =
      input.ttlSeconds !== undefined ? new Date(Date.now() + input.ttlSeconds * 1_000) : null;

    const data = {
      valeur: input.valeur as Prisma.InputJsonValue,
      modele: input.modele,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      coutUsd: input.coutUsd,
      promptVersion: input.promptVersion,
      ...(expiresAt !== null ? { expiresAt } : {}),
    };

    await prisma.cacheIa.upsert({
      where: { cle: input.cle },
      create: { cle: input.cle, ...data },
      update: data,
    });
  } catch (err) {
    console.warn(
      "[qualiopi:cache] setCachedIa fail-soft:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
