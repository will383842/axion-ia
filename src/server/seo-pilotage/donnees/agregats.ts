/**
 * Agrégats Search Console. Module PUR.
 *
 * On stocke `positionSum = position × impressions` : la somme de plusieurs jours reste
 * exacte, et la position moyenne pondérée se relit en divisant par les impressions.
 */

function positif(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

export function positionSum(position: number, impressions: number): number {
  if (!positif(position) || !positif(impressions)) return 0;
  return position * impressions;
}

/** Position moyenne pondérée ; `null` sans impression (jamais 0, qui serait « première »). */
export function positionMoyenne(somme: number, impressions: number): number | null {
  if (!Number.isFinite(somme) || !Number.isFinite(impressions) || impressions <= 0) return null;
  if (somme < 0) return null;
  return somme / impressions;
}

/**
 * Part des impressions d'une page non rattachées à une requête (requêtes anonymisées par
 * Google) : (total page − détail par requête) / total page, bornée dans [0, 1].
 */
export function partAnonymisee(impressionsPage: number, impressionsDetail: number): number | null {
  if (!Number.isFinite(impressionsPage) || impressionsPage <= 0) return null;
  const detail = Number.isFinite(impressionsDetail) ? impressionsDetail : 0;
  const part = (impressionsPage - detail) / impressionsPage;
  return Math.min(1, Math.max(0, part));
}

export interface SemaineIso {
  readonly annee: number;
  readonly semaine: number;
  /** `2026-W48` */
  readonly cle: string;
  /** Lundi de la semaine, `YYYY-MM-DD`. */
  readonly debut: string;
}

const RE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const JOUR_MS = 86_400_000;

function enUtc(date: string): number {
  const m = RE_DATE.exec(date);
  if (!m) throw new Error(`date attendue au format YYYY-MM-DD : « ${date} »`);
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(a, mo - 1, j);
  const d = new Date(t);
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) {
    throw new Error(`date impossible : « ${date} »`);
  }
  return t;
}

function iso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Semaine ISO 8601 (lundi → dimanche ; la semaine 1 contient le premier jeudi de l'année). */
export function semaineIso(date: string): SemaineIso {
  const t = enUtc(date);
  const jourSemaine = (new Date(t).getUTCDay() + 6) % 7; // lundi = 0
  const debutT = t - jourSemaine * JOUR_MS;
  const jeudi = new Date(debutT + 3 * JOUR_MS);
  const annee = jeudi.getUTCFullYear();
  const jan1 = Date.UTC(annee, 0, 1);
  const semaine = Math.floor((jeudi.getTime() - jan1) / JOUR_MS / 7) + 1;
  return {
    annee,
    semaine,
    cle: `${annee}-W${String(semaine).padStart(2, "0")}`,
    debut: iso(debutT),
  };
}

export interface LigneJour {
  readonly date: string;
  /** Page, requête… : ce par quoi on regroupe. */
  readonly cle: string;
  readonly clics: number;
  readonly impressions: number;
  readonly positionSum: number;
}

export interface LigneSemaine {
  readonly semaine: string;
  readonly debut: string;
  readonly cle: string;
  readonly clics: number;
  readonly impressions: number;
  readonly positionSum: number;
  readonly position: number | null;
  /** Nombre de lignes journalières cumulées. */
  readonly jours: number;
}

/** Cumul par (semaine ISO, clé) ; tri par semaine puis par clé. N'altère pas l'entrée. */
export function cumulerParSemaineIso(lignes: ReadonlyArray<LigneJour>): LigneSemaine[] {
  const acc = new Map<string, Omit<LigneSemaine, "position">>();
  for (const brute of lignes) {
    const l = {
      ...brute,
      clics: positif(brute.clics) ? brute.clics : 0,
      impressions: positif(brute.impressions) ? brute.impressions : 0,
      positionSum: positif(brute.positionSum) ? brute.positionSum : 0,
    };
    const s = semaineIso(l.date);
    const k = `${s.cle}\u0000${l.cle}`;
    const cur = acc.get(k);
    if (cur) {
      acc.set(k, {
        ...cur,
        clics: cur.clics + l.clics,
        impressions: cur.impressions + l.impressions,
        positionSum: cur.positionSum + l.positionSum,
        jours: cur.jours + 1,
      });
    } else {
      acc.set(k, {
        semaine: s.cle,
        debut: s.debut,
        cle: l.cle,
        clics: l.clics,
        impressions: l.impressions,
        positionSum: l.positionSum,
        jours: 1,
      });
    }
  }
  return [...acc.values()]
    .map((l) => ({ ...l, position: positionMoyenne(l.positionSum, l.impressions) }))
    .sort((a, b) =>
      a.semaine === b.semaine
        ? a.cle < b.cle
          ? -1
          : a.cle > b.cle
            ? 1
            : 0
        : a.semaine < b.semaine
          ? -1
          : 1,
    );
}
