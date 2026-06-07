/**
 * Qualiopi — Seed du référentiel (offres_site + config SiteSetting + grilles qualité).
 *
 * LOGIQUE UNIQUE réutilisée par :
 *   1. le démarrage serveur (`src/instrumentation.ts`) — seed AUTOMATIQUE au boot ;
 *   2. la console d'admin (`reseedReferenceDataAction` → page /qualiopi/config) — seed MANUEL piloté.
 *
 * Réutilise les fonctions de seed canoniques de `prisma/seeds/qualiopi/**` (mêmes
 * données que `pnpm qualiopi:seed`, zéro divergence). 100 % idempotent et non
 * destructif : crée ce qui manque, préserve l'existant (valeurs légales saisies par
 * Will, éditions admin). Protégé par un verrou applicatif Postgres pour éviter toute
 * course entre instances/processus concurrents.
 *
 * Contrat build : ne JAMAIS être exécuté quand DATABASE_URL contient "stub.invalid"
 * (cf. ADR 0026). Les appelants doivent garder ce check ; `seedQualiopiReferenceData`
 * le re-vérifie par sécurité.
 */

import type { PrismaClient, Prisma } from "../../../../prisma/generated/client";
import {
  QUALIOPI_CONFIG_REGISTRY,
  QUALIOPI_CONFIG_KEY_PREFIX,
} from "@/server/qualiopi/config/registry";
import { seedOffresSite } from "../../../../prisma/seeds/qualiopi/offres";
import { seedGrilleQualite } from "../../../../prisma/seeds/qualiopi/grille";
import { seedGrilleV2 } from "../../../../prisma/seeds/qualiopi/grille-v2";

/** Clé du verrou consultatif Postgres (paire arbitraire stable, propre à ce seed). */
const ADVISORY_LOCK_KEY: readonly [number, number] = [4242, 1];

export interface QualiopiReferenceDataReport {
  /** Le seed a-t-il réellement tourné (true) ou été ignoré car verrou non acquis (false) ? */
  readonly ran: boolean;
  /** Nombre d'offres présentes après seed. */
  readonly offresCount: number;
  /** Nombre de clés de config qualiopi présentes après seed. */
  readonly configKeysSet: number;
  /** Nombre total de clés de config attendues (registre). */
  readonly configKeysTotal: number;
  /** Clé de la grille qualité active (ou null si aucune). */
  readonly grilleActiveCle: string | null;
}

function isStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}

/** Seed idempotent de la config qualiopi (préserve les valeurs existantes). */
async function seedQualiopiConfig(client: PrismaClient): Promise<void> {
  const keys = Object.keys(QUALIOPI_CONFIG_REGISTRY) as (keyof typeof QUALIOPI_CONFIG_REGISTRY)[];
  for (const key of keys) {
    const entry = QUALIOPI_CONFIG_REGISTRY[key];
    const fullKey = `${QUALIOPI_CONFIG_KEY_PREFIX}${key}`;
    const existing = await client.siteSetting.findUnique({ where: { key: fullKey } });
    if (existing) {
      // Préserver la valeur — synchroniser seulement description/catégorie.
      await client.siteSetting.update({
        where: { key: fullKey },
        data: { description: entry.description, category: "qualiopi" },
      });
    } else {
      await client.siteSetting.create({
        data: {
          key: fullKey,
          value: entry.default as Prisma.InputJsonValue,
          description: entry.description,
          category: "qualiopi",
        },
      });
    }
  }
}

/** Compte l'état courant du référentiel (pour affichage admin / rapport). */
export async function getQualiopiReferenceDataStatus(
  client: PrismaClient,
): Promise<Omit<QualiopiReferenceDataReport, "ran">> {
  const configKeysTotal = Object.keys(QUALIOPI_CONFIG_REGISTRY).length;
  const [offresCount, configKeysSet, grilleActive] = await Promise.all([
    client.offreSite.count(),
    client.siteSetting.count({ where: { category: "qualiopi" } }),
    client.grilleQualiteConfig.findFirst({
      where: { actif: true },
      orderBy: { createdAt: "desc" },
      select: { cleUnique: true },
    }),
  ]);
  return {
    offresCount,
    configKeysSet,
    configKeysTotal,
    grilleActiveCle: grilleActive?.cleUnique ?? null,
  };
}

/**
 * Seed complet du référentiel qualiopi, protégé par un verrou Postgres.
 *
 * Acquiert `pg_try_advisory_lock` : si une autre instance seed déjà, on n'attend
 * pas et on retourne `{ ran: false }` (l'autre instance s'en charge). Sinon on
 * exécute config + offres + grille v1 + grille v2 (tous idempotents), puis on
 * libère le verrou. Ne throw jamais pour cause de verrou ; relaie les erreurs de
 * seed réelles à l'appelant.
 */
export async function seedQualiopiReferenceData(
  client: PrismaClient,
): Promise<QualiopiReferenceDataReport> {
  if (isStub()) {
    // Contexte build (stub.invalid) : ne rien muter.
    return {
      ran: false,
      offresCount: 0,
      configKeysSet: 0,
      configKeysTotal: Object.keys(QUALIOPI_CONFIG_REGISTRY).length,
      grilleActiveCle: null,
    };
  }

  // ⚠️ Postgres n'expose `pg_try_advisory_lock` qu'en deux signatures :
  // `(bigint)` ou `(int4, int4)`. Prisma binde les nombres JS en `bigint`, donc
  // la forme deux-arguments DOIT caster explicitement en `int4`, sinon Postgres
  // throw `42883 function pg_try_advisory_lock(bigint, bigint) does not exist`.
  const [lock] = await client.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY[0]}::int4, ${ADVISORY_LOCK_KEY[1]}::int4) AS locked
  `;
  if (!lock?.locked) {
    const status = await getQualiopiReferenceDataStatus(client);
    return { ran: false, ...status };
  }

  try {
    await seedQualiopiConfig(client);
    await seedOffresSite(client);
    await seedGrilleQualite(client);
    await seedGrilleV2(client);
    const status = await getQualiopiReferenceDataStatus(client);
    return { ran: true, ...status };
  } finally {
    await client.$queryRaw`
      SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY[0]}::int4, ${ADVISORY_LOCK_KEY[1]}::int4)
    `;
  }
}
