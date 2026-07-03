/**
 * Prospection — Accès DB aux paramètres via `SiteSetting` (cat. `prospection`).
 *
 * Le registre (clés + schémas Zod + défauts) est dans `registry.ts` (module pur).
 * Ici : lecture Prisma stub-aware. Au build `stub.invalid`, `findUnique` renvoie
 * `null` → défaut du registre (jamais de `*OrThrow`, jamais d'appel qui casse le
 * SSG). L'écriture (upsert + audit) est ajoutée en T7 (page Réglages) une fois
 * le modèle `ProspectionEvent` disponible.
 */

import { prisma } from "@/lib/prisma";
import {
  PROSPECTION_CONFIG_REGISTRY,
  PROSPECTION_CONFIG_KEY_PREFIX,
  type ProspectionConfigKey,
  type ProspectionConfigValue,
} from "@/server/prospection/config/registry";

export { PROSPECTION_CONFIG_REGISTRY, PROSPECTION_CONFIG_KEY_PREFIX };
export type { ProspectionConfigKey, ProspectionConfigValue };

/**
 * Lit un paramètre. Renvoie la valeur stockée (validée par le schéma Zod) ou le
 * défaut du registre si absente/invalide. Stub-aware + fail-soft (jamais throw).
 */
export async function getProspectionConfig<K extends ProspectionConfigKey>(
  key: K,
): Promise<ProspectionConfigValue<K>> {
  const entry = PROSPECTION_CONFIG_REGISTRY[key];
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: `${PROSPECTION_CONFIG_KEY_PREFIX}${key}` },
    });
    if (row == null) return entry.default as ProspectionConfigValue<K>;
    const parsed = entry.schema.safeParse(row.value);
    return (parsed.success ? parsed.data : entry.default) as ProspectionConfigValue<K>;
  } catch {
    return entry.default as ProspectionConfigValue<K>;
  }
}

/** Lit tout le bloc de config (workers + dashboard + réglages). */
export async function getAllProspectionConfig(): Promise<{
  [K in ProspectionConfigKey]: ProspectionConfigValue<K>;
}> {
  const keys = Object.keys(PROSPECTION_CONFIG_REGISTRY) as ProspectionConfigKey[];
  const entries = await Promise.all(
    keys.map(async (k) => [k, await getProspectionConfig(k)] as const),
  );
  return Object.fromEntries(entries) as { [K in ProspectionConfigKey]: ProspectionConfigValue<K> };
}
