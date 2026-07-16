/**
 * Content Generator — Helpers Setting/ContentGenConfig partagés.
 *
 * V1 stocke la majorité des réglages content-gen dans la table existante
 * `ContentGenConfig` (key/value Json). Quelques réglages globaux non-content-gen
 * (ex. flags admin) restent dans `Setting`. Le namespace `content_gen_*` est
 * réservé pour ce module (cf. § 12.5 master prompt).
 *
 * Pattern lecture : `readContentGenConfig<T>(key, defaultValue)`. La valeur
 * brute est sérialisée JSON Prisma — pas de validation Zod ici (les pages
 * d'édition valident en input avant écriture).
 */

"use server";

import { prisma } from "@/lib/prisma";
import { persistContentGenConfig } from "@/server/content-gen/config-store";
import { requireAdmin, requireAdminWriteRateLimited } from "./_auth";

/**
 * `readContentGenConfig` est volontairement **non-guardé** par requireAdmin.
 * Raison : appelée massivement depuis les workers BullMQ background (sans
 * session HTTP — content-gen-worker, content-orchestrator-worker,
 * content-news-lifecycle-worker, content-quality-improver-worker,
 * content-rss-fetch-worker). Ajouter requireAdmin ici casserait toute
 * l'orchestration content-gen. Les pages admin qui l'appellent (settings,
 * onboarding, rss, landing-variants) sont déjà protégées par le middleware
 * admin (cf. middleware.ts + layout admin requireSuperAdmin). Le risque
 * d'exposition publique reste théorique : la valeur retournée n'est
 * exploitable que si le client connaît la clé exacte.
 */
export async function readContentGenConfig<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const row = await prisma.contentGenConfig.findUnique({ where: { key } });
    if (!row) return defaultValue;
    return row.value as unknown as T;
  } catch {
    return defaultValue;
  }
}

export async function writeContentGenConfig(
  key: string,
  value: unknown,
  updatedBy: string,
  description?: string,
): Promise<void> {
  // Pass B fix P0-4 — défense en profondeur (auth admin).
  // City Domination 2026-05-18 P1-30 (audit A10) — rate-limit 60 writes/min/admin
  // sur le chokepoint settings. `key` est inclus dans actionId pour permettre
  // qu'un admin écrive sur plusieurs settings différents en parallèle sans se
  // bloquer (60/min PAR setting), tout en cappant les abus boucle script-like
  // sur un seul setting.
  const session = await requireAdminWriteRateLimited(`writeContentGenConfig:${key}`);

  // City Domination 2026-05-18 P1-9 (audit A10) — SOC2 audit trail diff.
  // L'upsert + l'audit trail vivent dans `config-store` (module serveur nu) : les
  // workers BullMQ écrivent via ce même chemin sans passer par le guard admin
  // ci-dessus, qui throw hors requête HTTP (cf. en-tête de config-store.ts).
  await persistContentGenConfig(key, value, updatedBy, description, {
    userId: session.userId,
    email: session.email,
  });
}

export async function listContentGenConfig(): Promise<
  ReadonlyArray<{ key: string; value: unknown; description: string | null; updatedAt: Date }>
> {
  await requireAdmin(); // Pass B fix P0-4 — défense en profondeur
  const rows = await prisma.contentGenConfig.findMany({ orderBy: { key: "asc" } });
  return rows.map((r) => ({
    key: r.key,
    value: r.value as unknown,
    description: r.description,
    updatedAt: r.updatedAt,
  }));
}
