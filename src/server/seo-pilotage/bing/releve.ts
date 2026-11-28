/**
 * Relevé hebdomadaire Bing Webmaster Tools (P17) : impressions, clics et position par page et par
 * semaine, dans `BingPageSemaine`.
 *
 * ÉTEINT PAR DÉFAUT : sans `BING_RELEVE_ENABLED="true"` exact, la tâche saute AVANT toute lecture
 * de la clé et tout appel réseau. Clé absente (`BING_WMT_API_KEY`, lue seulement dans
 * `process.env`) : la tâche saute avec le motif « clé Bing absente du worker ».
 * La clé n'apparaît jamais dans un journal, un motif ou une erreur : seuls des nombres et des
 * motifs fixes sortent d'ici.
 */
import type { PrismaClient } from "../../../../prisma/generated/client";

export interface LignePageBing {
  readonly page: string;
  readonly date: Date;
  readonly clics: number;
  readonly impressions: number;
  readonly position: number;
}

export interface SemainePageBing {
  readonly semaine: string; // AAAA-MM-JJ (lundi)
  readonly page: string; // chemin, sans domaine
  readonly clics: number;
  readonly impressions: number;
  readonly positionSum: number;
}

export type IssueBingReleve =
  | { readonly issue: "saute"; readonly motif: string }
  | { readonly issue: "fait"; readonly pages: number; readonly semaines: number };

export const MOTIF_CLE_ABSENTE = "clé Bing absente du worker";
/** Semaines relues à chaque passage (les plus récentes) : borne le nombre d'écritures. */
const SEMAINES_RELUES = 12;
const PAGES_MAX = 5000;

export function bingReleveActif(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env["BING_RELEVE_ENABLED"] === "true";
}

/** Les dates de l'API Bing sont de la forme `/Date(1764288000000)/` (parfois avec un fuseau). */
export function analyserDateBing(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^\/Date\((-?\d{1,15})(?:[+-]\d{4})?\)\/$/.exec(v);
  if (!m?.[1]) return null;
  const d = new Date(Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function lundiDe(d: Date): string {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const decalage = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - decalage * 86_400_000).toISOString().slice(0, 10);
}

function cheminDe(page: string): string {
  try {
    const u = new URL(page);
    return (u.pathname || "/").slice(0, 500);
  } catch {
    return page.slice(0, 500);
  }
}

export function agregerParSemaine(lignes: ReadonlyArray<LignePageBing>): SemainePageBing[] {
  const cumul = new Map<string, { s: string; p: string; c: number; i: number; pos: number }>();
  for (const l of lignes) {
    const s = lundiDe(l.date);
    const p = cheminDe(l.page);
    const k = `${s}|${p}`;
    const a = cumul.get(k) ?? { s, p, c: 0, i: 0, pos: 0 };
    a.c += l.clics;
    a.i += l.impressions;
    a.pos += l.position * l.impressions;
    cumul.set(k, a);
  }
  return [...cumul.values()].map((a) => ({
    semaine: a.s,
    page: a.p,
    clics: a.c,
    impressions: a.i,
    positionSum: a.pos,
  }));
}

export interface DepsBingReleve {
  readonly prisma: Pick<PrismaClient, "bingPageSemaine" | "$transaction">;
  /** Lecture injectée : `bingWmtGetPageStats` en production. `null` = indisponible. */
  readonly lirePages: () => Promise<ReadonlyArray<LignePageBing> | null>;
}

export async function tacheBingReleve(deps: DepsBingReleve): Promise<IssueBingReleve> {
  if (!bingReleveActif()) return { issue: "saute", motif: "bing_releve_eteint" };
  if (!process.env["BING_WMT_API_KEY"]) return { issue: "saute", motif: MOTIF_CLE_ABSENTE };

  const lignes = await deps.lirePages();
  if (lignes === null) return { issue: "saute", motif: "lecture Bing indisponible" };

  const toutes = agregerParSemaine(lignes);
  const semaines = [...new Set(toutes.map((x) => x.semaine))].sort().slice(-SEMAINES_RELUES);
  const gardees = toutes.filter((x) => semaines.includes(x.semaine)).slice(0, PAGES_MAX);

  await deps.prisma.$transaction(
    gardees.map((x) =>
      deps.prisma.bingPageSemaine.upsert({
        where: { semaine_page: { semaine: new Date(`${x.semaine}T00:00:00Z`), page: x.page } },
        create: {
          semaine: new Date(`${x.semaine}T00:00:00Z`),
          page: x.page,
          clics: x.clics,
          impressions: x.impressions,
          positionSum: x.positionSum,
        },
        update: { clics: x.clics, impressions: x.impressions, positionSum: x.positionSum },
      }),
    ),
  );
  return {
    issue: "fait",
    pages: new Set(gardees.map((x) => x.page)).size,
    semaines: semaines.length,
  };
}
