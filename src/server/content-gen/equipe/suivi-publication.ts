/**
 * Suivi après publication (équipe éditoriale, PR 14).
 *
 * Règles PURES (jalons, déclencheurs de mise à jour) + une orchestration dont
 * toutes les dépendances (API Google, mémoire des jalons faits, quota) sont
 * injectées : aucun accès base, réseau ni Redis ici.
 *
 * Éteint par défaut : seul `CONTENT_EQUIPE_EDITORIALE=true` remplace la règle
 * fixe de 14 jours. Éteint, `choisirCandidatsMiseAJour` applique 14 jours.
 */

import type { Cannibalisation } from "../strategie/carte-requetes";
import { normaliserUrl } from "../strategie/carte-requetes";
import { equipeEditorialeActive, filtrerLiensMaillage } from "./maillage";

const JOUR_MS = 86_400_000;

/** Quota URL Inspection : 2 000/jour côté Google ; on n'en réserve qu'une part. */
export const QUOTA_INSPECTIONS_JOUR = 200;
/** Seuls les articles publiés depuis moins de ce nombre de jours sont inspectés. */
export const FENETRE_NOUVEAU_JOURS = 14;
export const REFRESH_FIXE_JOURS = 14;
export const SEUIL_BAISSE_POSITION = 3;
export const AGE_MAX_FILET_JOURS = 180;
export const ESSAIS_MAX = 3;
/** Impressions minimales sur 28 jours pour qu'une baisse de position compte. */
export const PLANCHER_IMPRESSIONS_BAISSE = 100;

export type Jalon = "inspection-j3" | "inspection-j7" | "positions-j28" | "positions-j90";

const JALONS: ReadonlyArray<{ jalon: Jalon; jours: number }> = [
  { jalon: "inspection-j3", jours: 3 },
  { jalon: "inspection-j7", jours: 7 },
  { jalon: "positions-j28", jours: 28 },
  { jalon: "positions-j90", jours: 90 },
];

/** Jalons échus pour un article (les inspections seulement pour un NOUVEL article). */
export function jalonsDus(publieLe: Date, maintenant: Date): Jalon[] {
  const age = (maintenant.getTime() - publieLe.getTime()) / JOUR_MS;
  return JALONS.filter(({ jalon, jours }) => {
    if (age < jours) return false;
    if (jalon.startsWith("inspection") && age >= FENETRE_NOUVEAU_JOURS) return false;
    return true;
  }).map((j) => j.jalon);
}

export interface ArticleSuivi {
  readonly id: string;
  readonly url: string;
  readonly publieLe: Date;
}

export interface MagasinSuivi {
  dejaFait(cle: string): Promise<boolean>;
  marquer(cle: string): Promise<void>;
  /** Réserve jusqu'à `n` appels sous le plafond `max` du jour ; rend le nombre accordé. */
  reserverQuota(n: number, max: number): Promise<number>;
  lirePositions(articleId: string): Promise<{ j28: number | null; j90: number | null }>;
  /** Compte un échec d'appel pour ce jalon ; rend le total d'échecs. */
  compterEchec(cle: string): Promise<number>;
  ecrirePosition(articleId: string, jalon: Jalon, position: number): Promise<void>;
}

export interface DepsSuivi {
  readonly magasin: MagasinSuivi;
  readonly inspecter: (url: string) => Promise<unknown | null>;
  readonly positions: (
    url: string,
    jours: number,
  ) => Promise<{ position: number; impressions: number } | null>;
  readonly maintenant: Date;
  readonly quotaMax?: number;
}

export interface ResultatSuivi {
  inspections: number;
  positionsReleves: number;
  reportes: number;
  echecs: number;
}

export async function suivreArticles(
  articles: readonly ArticleSuivi[],
  deps: DepsSuivi,
): Promise<ResultatSuivi> {
  const r: ResultatSuivi = { inspections: 0, positionsReleves: 0, reportes: 0, echecs: 0 };
  const max = deps.quotaMax ?? QUOTA_INSPECTIONS_JOUR;
  for (const a of articles) {
    for (const jalon of jalonsDus(a.publieLe, deps.maintenant)) {
      const cle = `${a.id}:${jalon}`;
      if (await deps.magasin.dejaFait(cle)) continue;
      if (jalon.startsWith("inspection")) {
        if ((await deps.magasin.reserverQuota(1, max)) < 1) {
          r.reportes++;
          continue;
        }
        const res = await deps.inspecter(a.url).catch(() => null);
        if (res === null) {
          r.echecs++;
          if ((await deps.magasin.compterEchec(cle)) >= ESSAIS_MAX) await deps.magasin.marquer(cle);
          continue;
        }
        await deps.magasin.marquer(cle);
        r.inspections++;
      } else {
        const res = await deps.positions(a.url, 28).catch(() => null);
        if (res === null) {
          r.echecs++;
          if ((await deps.magasin.compterEchec(cle)) >= ESSAIS_MAX) await deps.magasin.marquer(cle);
          continue;
        }
        await deps.magasin.ecrirePosition(a.id, jalon, res.position);
        await deps.magasin.marquer(cle);
        r.positionsReleves++;
      }
    }
  }
  return r;
}

export type Raison =
  "age-maximum" | "baisse-position" | "preuve-expiree" | "lien-casse" | "cannibalisation";

export interface SignauxArticle {
  readonly id: string;
  readonly ageJours: number;
  readonly positionActuelle: number | null;
  readonly positionReference: number | null;
  readonly preuveExpireLe: Date | null;
  readonly liensCasses: number;
  readonly cannibalisation: boolean;
  /** Impressions de la page sur 28 jours ; absent ou null = baisse de position ignorée. */
  readonly impressions28j?: number | null;
}

/** Règles pures de déclenchement d'une mise à jour. */
export function declencheursMiseAJour(s: Omit<SignauxArticle, "id">, maintenant: Date): Raison[] {
  const raisons: Raison[] = [];
  if (
    s.impressions28j != null &&
    s.impressions28j >= PLANCHER_IMPRESSIONS_BAISSE &&
    s.positionActuelle !== null &&
    s.positionReference !== null &&
    s.positionActuelle > 0 &&
    s.positionReference > 0 &&
    s.positionActuelle - s.positionReference >= SEUIL_BAISSE_POSITION
  ) {
    raisons.push("baisse-position");
  }
  if (s.preuveExpireLe !== null && s.preuveExpireLe.getTime() <= maintenant.getTime()) {
    raisons.push("preuve-expiree");
  }
  if (s.ageJours >= AGE_MAX_FILET_JOURS) raisons.push("age-maximum");
  if (s.liensCasses > 0) raisons.push("lien-casse");
  if (s.cannibalisation) raisons.push("cannibalisation");
  return raisons;
}

export interface CandidatMiseAJour {
  readonly id: string;
  readonly raisons: readonly (Raison | "age-14-jours")[];
}

/**
 * Interrupteur éteint : règle fixe d'avant (âge ≥ 14 jours).
 * Allumé : les règles ci-dessus remplacent le déclencheur fixe.
 */
export function choisirCandidatsMiseAJour(
  articles: readonly SignauxArticle[],
  maintenant: Date,
  env: Record<string, string | undefined> = process.env,
): CandidatMiseAJour[] {
  if (!equipeEditorialeActive(env)) {
    return articles
      .filter((a) => a.ageJours >= REFRESH_FIXE_JOURS)
      .map((a) => ({ id: a.id, raisons: ["age-14-jours"] as const }));
  }
  return articles
    .map((a) => ({ id: a.id, raisons: declencheursMiseAJour(a, maintenant) }))
    .filter((c) => c.raisons.length > 0);
}

/** Vrai si l'URL de l'article figure dans une cannibalisation de la carte. */
export function estCannibalise(url: string, cannibalisations: readonly Cannibalisation[]): boolean {
  const u = normaliserUrl(url);
  return u !== "" && cannibalisations.some((c) => c.urls.includes(u));
}

/** Liens (href) uniques d'un corps HTML, hors ancres, mailto et tel. */
export function extraireLiens(html: string): string[] {
  const vus = new Set<string>();
  for (const m of html.matchAll(/<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const h = (m[1] ?? m[2] ?? "").trim();
    if (!h || h.startsWith("#") || /^(mailto|tel|javascript):/i.test(h)) continue;
    vus.add(h);
  }
  return [...vus];
}

/**
 * Contrôle hebdomadaire des liens (maillage vérifié) : écrit, par article, le
 * nombre de liens refusés, et rend le total d'articles ayant au moins un lien cassé.
 */
export async function controlerLiensArticles(
  articles: ReadonlyArray<{ id: string; corps: string }>,
  ecrire: (id: string, nbCasses: number) => Promise<void>,
  filtrer: typeof filtrerLiensMaillage = filtrerLiensMaillage,
): Promise<number> {
  let articlesCasses = 0;
  for (const a of articles) {
    const liens = extraireLiens(a.corps)
      .filter((u) => u.startsWith("/") || /^https?:\/\//i.test(u))
      .map((url) => ({ url }));
    if (liens.length === 0) continue;
    const nb = (await filtrer(liens)).filter((l) => !l.verdict.ok).length;
    await ecrire(a.id, nb);
    if (nb > 0) articlesCasses++;
  }
  return articlesCasses;
}
