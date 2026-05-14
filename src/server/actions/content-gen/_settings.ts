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
  await prisma.contentGenConfig.upsert({
    where: { key },
    create: {
      key,
      value: value as never,
      description: description ?? null,
      updatedBy,
    },
    update: {
      value: value as never,
      ...(description !== undefined ? { description } : {}),
      updatedBy,
    },
  });
}

export async function listContentGenConfig(): Promise<
  ReadonlyArray<{ key: string; value: unknown; description: string | null; updatedAt: Date }>
> {
  const rows = await prisma.contentGenConfig.findMany({ orderBy: { key: "asc" } });
  return rows.map((r) => ({
    key: r.key,
    value: r.value as unknown,
    description: r.description,
    updatedAt: r.updatedAt,
  }));
}
