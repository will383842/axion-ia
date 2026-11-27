/**
 * Interrupteurs du robot « pilotage SEO » (P4). ÉTEINT par défaut.
 *
 * - `CONTENT_PILOTAGE_SEO` : seul `"true"` EXACT allume la file `seo-pilotage` (rien d'autre :
 *   ni « 1 », ni « TRUE », ni « true » entouré d'espaces). Lu à l'exécution, jamais figé au build.
 * - Mode : clé `pilotage_seo` de `ContentGenConfig` (`{ mode }`). `observation` par défaut ;
 *   toute valeur absente ou inconnue retombe sur `observation` (le mode le plus prudent).
 *   P4 ne lit le mode que pour le journal : la collecte est la même dans les trois modes.
 */
import type { PrismaClient } from "../../../prisma/generated/client";

export const MODES_PILOTAGE = ["observation", "proposition", "auto_borne"] as const;
export type ModePilotage = (typeof MODES_PILOTAGE)[number];

export const CLE_CONFIG_PILOTAGE = "pilotage_seo";

export function pilotageSeoActif(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env["CONTENT_PILOTAGE_SEO"] === "true";
}

/** Au build GitHub Actions, la base est un stub : aucune collecte, aucune écriture. */
export function buildStub(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}

export function modeDepuisValeur(valeur: unknown): ModePilotage {
  const brut =
    typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
      ? (valeur as Record<string, unknown>)["mode"]
      : undefined;
  return (MODES_PILOTAGE as ReadonlyArray<unknown>).includes(brut)
    ? (brut as ModePilotage)
    : "observation";
}

/** Lit le mode. Une panne de lecture tombe sur `observation` : jamais sur un mode plus permissif. */
export async function lireModePilotage(
  prisma: Pick<PrismaClient, "contentGenConfig">,
): Promise<ModePilotage> {
  try {
    const ligne = await prisma.contentGenConfig.findUnique({
      where: { key: CLE_CONFIG_PILOTAGE },
    });
    return modeDepuisValeur(ligne?.value);
  } catch {
    return "observation";
  }
}

/**
 * Erreur Prisma « table (P2021) ou colonne (P2022) absente » : fenêtre où le worker, déployé
 * avant l'app, tourne avant que la migration de P2 soit passée.
 */
export function estTableAbsente(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === "P2021" || code === "P2022";
}
