/**
 * Qualiopi — Accès DB aux paramètres métier via `SiteSetting` (cat. `qualiopi`).
 *
 * Le registre (clés + schémas Zod + défauts) est dans `registry.ts` (module
 * pur). Ici : lecture/écriture Prisma + audit. PAS de table `config_systeme`.
 */

import { prisma } from "@/lib/prisma";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import {
  QUALIOPI_CONFIG_REGISTRY,
  QUALIOPI_CONFIG_KEY_PREFIX,
  type QualiopiConfigKey,
  type QualiopiConfigValue,
} from "@/server/qualiopi/config/registry";

export { QUALIOPI_CONFIG_REGISTRY };
export type { QualiopiConfigKey, QualiopiConfigValue };

/**
 * Lit un paramètre Qualiopi. Renvoie la valeur stockée (validée) ou le défaut
 * du registre si absente/invalide. Stub-aware : au build `stub.invalid`,
 * `findUnique` renvoie `null` → défaut (jamais de `*OrThrow`).
 */
export async function getQualiopiConfig<K extends QualiopiConfigKey>(
  key: K,
): Promise<QualiopiConfigValue<K>> {
  const entry = QUALIOPI_CONFIG_REGISTRY[key];
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: `${QUALIOPI_CONFIG_KEY_PREFIX}${key}` },
    });
    if (row == null) return entry.default as QualiopiConfigValue<K>;
    const parsed = entry.schema.safeParse(row.value);
    return (parsed.success ? parsed.data : entry.default) as QualiopiConfigValue<K>;
  } catch {
    return entry.default as QualiopiConfigValue<K>;
  }
}

/** Lit tout le bloc de config (seeds, dashboard, kits). */
export async function getAllQualiopiConfig(): Promise<{
  [K in QualiopiConfigKey]: QualiopiConfigValue<K>;
}> {
  const keys = Object.keys(QUALIOPI_CONFIG_REGISTRY) as QualiopiConfigKey[];
  const entries = await Promise.all(
    keys.map(async (k) => [k, await getQualiopiConfig(k)] as const),
  );
  return Object.fromEntries(entries) as { [K in QualiopiConfigKey]: QualiopiConfigValue<K> };
}

/**
 * Écrit un paramètre Qualiopi (upsert + audit). Valide via le schéma Zod du
 * registre ; lève si invalide. Trace dans ActivityLog.
 */
export async function setQualiopiConfig<K extends QualiopiConfigKey>(
  key: K,
  value: QualiopiConfigValue<K>,
  session: AdminSession,
): Promise<void> {
  const entry = QUALIOPI_CONFIG_REGISTRY[key];
  const validated = entry.schema.parse(value);
  const fullKey = `${QUALIOPI_CONFIG_KEY_PREFIX}${key}`;
  await prisma.siteSetting.upsert({
    where: { key: fullKey },
    create: {
      key: fullKey,
      value: validated as never,
      description: entry.description,
      category: "qualiopi",
      updatedByAdminId: session.userId,
    },
    update: {
      value: validated as never,
      description: entry.description,
      category: "qualiopi",
      updatedByAdminId: session.userId,
    },
  });
  await logQualiopiActivity({
    action: "qualiopi.config.set",
    targetType: "SiteSetting",
    targetId: fullKey,
    changes: { key, value: validated },
    session,
  });
}
