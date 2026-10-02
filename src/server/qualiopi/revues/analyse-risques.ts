/**
 * Indicateur 32 (grille 2026) — l'analyse des risques sur la qualité des
 * formations délivrées : forme d'une entrée, cotation, datation, résumé.
 *
 * Module PUR : aucun import Prisma, Next ou serveur. L'écran de la revue de
 * direction (client), l'action serveur, le moteur de conformité et le registre
 * PDF le lisent tous ; aucun ne réécrit sa propre lecture.
 *
 * ## La cotation : simple et lisible
 *
 * Gravité 1 à 4 × probabilité 1 à 4 = criticité 1 à 16. Une entrée sans l'une
 * des deux notes est « non cotée » : elle reste un risque analysé (intitulé +
 * mesure de maîtrise, cf. `compterRisquesExploitables`), mais l'écran et
 * l'export le disent.
 *
 * ## La date : celle de la saisie réelle, jamais celle de la revue
 *
 * Chaque entrée porte `misAJourLe` (instant ISO), posé par le SERVEUR au moment
 * où l'entrée est créée ou modifiée (`horodaterRisques`). Une entrée qui ne
 * change pas garde son objet d'origine, octet pour octet — y compris l'absence
 * de date des risques saisis avant cette fonctionnalité : on ne leur attribue
 * ni la date de la revue (ce serait antidater), ni la date du jour (ce serait
 * inventer). Ils restent « non datés » jusqu'à ce que quelqu'un les complète.
 */

export const COTES = [1, 2, 3, 4] as const;
export type Cote = (typeof COTES)[number];

export const LIBELLES_GRAVITE: Readonly<Record<Cote, string>> = {
  1: "Mineure",
  2: "Significative",
  3: "Grave",
  4: "Critique",
};

export const LIBELLES_PROBABILITE: Readonly<Record<Cote, string>> = {
  1: "Rare",
  2: "Possible",
  3: "Probable",
  4: "Quasi certaine",
};

/** Une entrée de l'analyse, lue sous une forme stable. */
export interface RisqueQualite {
  intitule: string;
  cause: string;
  gravite: Cote | null;
  probabilite: Cote | null;
  maitrise: string;
  responsable: string;
  /** « AAAA-MM-JJ » ou null. */
  echeance: string | null;
  /** Instant ISO de la dernière saisie réelle, ou null (non daté). */
  misAJourLe: string | null;
}

function texte(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function cote(v: unknown): Cote | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && (COTES as readonly number[]).includes(n) ? (n as Cote) : null;
}

function jour(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
}

function instant(v: unknown): string | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Lit une entrée brute. `null` si ce n'est pas un objet. */
export function normaliserRisque(brut: unknown): RisqueQualite | null {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  return {
    intitule: texte(o["intitule"]),
    cause: texte(o["cause"]),
    gravite: cote(o["gravite"]),
    probabilite: cote(o["probabilite"]),
    maitrise: texte(o["maitrise"]),
    responsable: texte(o["responsable"]),
    echeance: jour(o["echeance"]),
    misAJourLe: instant(o["misAJourLe"]),
  };
}

/** Les entrées lisibles qui portent un intitulé, dans l'ordre. */
export function normaliserRisques(brut: unknown): RisqueQualite[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .map(normaliserRisque)
    .filter((r): r is RisqueQualite => r !== null && r.intitule !== "");
}

/** Criticité = gravité × probabilité, ou null si l'une manque. */
export function criticite(r: Pick<RisqueQualite, "gravite" | "probabilite">): number | null {
  return r.gravite === null || r.probabilite === null ? null : r.gravite * r.probabilite;
}

/** Niveau lisible d'une criticité 1-16. */
export function niveauCriticite(c: number): "faible" | "modérée" | "élevée" | "critique" {
  if (c >= 12) return "critique";
  if (c >= 8) return "élevée";
  if (c >= 4) return "modérée";
  return "faible";
}

/** « 9 (élevée) », ou « non coté ». */
export function libelleCriticite(r: Pick<RisqueQualite, "gravite" | "probabilite">): string {
  const c = criticite(r);
  return c === null ? "non coté" : `${c} (${niveauCriticite(c)})`;
}

/** Un risque est ANALYSÉ s'il porte un intitulé ET une mesure de maîtrise. */
export function estRisqueAnalyse(r: RisqueQualite): boolean {
  return r.intitule !== "" && r.maitrise !== "";
}

export interface ResumeAnalyseRisques {
  /** Risques analysés (intitulé + mesure de maîtrise). */
  analyses: number;
  /** Parmi eux, ceux qui portent gravité ET probabilité. */
  cotes: number;
  /** Parmi eux, ceux qui portent une date de mise à jour. */
  dates: number;
  /** Instant ISO de la mise à jour la plus récente, ou null. */
  derniereMiseAJour: string | null;
}

export function resumerAnalyseRisques(brut: unknown): ResumeAnalyseRisques {
  const analyses = normaliserRisques(brut).filter(estRisqueAnalyse);
  const dates = analyses
    .map((r) => r.misAJourLe)
    .filter((d): d is string => d !== null)
    .sort();
  return {
    analyses: analyses.length,
    cotes: analyses.filter((r) => criticite(r) !== null).length,
    dates: dates.length,
    derniereMiseAJour: dates.length > 0 ? (dates[dates.length - 1] as string) : null,
  };
}

/** JJ/MM/AAAA du jour de PARIS d'un instant ISO. */
export function jourFrParis(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

/**
 * La phrase que lit l'auditeur : « N risques analysés, dont N cotés, mis à jour
 * le … ». Elle dit aussi ce qui n'est pas daté, plutôt que de le taire.
 */
export function phraseAnalyseRisques(resume: ResumeAnalyseRisques): string {
  const n = resume.analyses;
  const s = n > 1 ? "s" : "";
  const debut = `${n} risque${s} analysé${s}, dont ${resume.cotes} coté${resume.cotes > 1 ? "s" : ""} (gravité × probabilité)`;
  if (resume.derniereMiseAJour === null) {
    return `${debut}, date de mise à jour non renseignée (risques saisis avant la datation par risque)`;
  }
  const nonDates = n - resume.dates;
  return (
    `${debut}, mis à jour le ${jourFrParis(resume.derniereMiseAJour)}` +
    (nonDates > 0
      ? ` (${nonDates} risque${nonDates > 1 ? "s" : ""} non daté${nonDates > 1 ? "s" : ""})`
      : "")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Datation à l'écriture — côté serveur
// ─────────────────────────────────────────────────────────────────────────────

/** Le contenu d'une entrée, sans sa date : ce qui décide si elle a changé. */
function signature(r: RisqueQualite): string {
  return JSON.stringify([
    r.intitule,
    r.cause,
    r.gravite,
    r.probabilite,
    r.maitrise,
    r.responsable,
    r.echeance,
  ]);
}

/**
 * Prépare la liste à écrire : une entrée dont le CONTENU existe déjà en base est
 * rendue telle qu'elle y est (objet d'origine, date d'origine ou absence de
 * date) ; une entrée nouvelle ou modifiée reçoit `misAJourLe = maintenant`.
 *
 * 🔑 La date vient du serveur, jamais du navigateur : une date envoyée par
 * l'écran est ignorée. C'est ce qui rend la date opposable — elle dit quand la
 * saisie a eu lieu, pas ce que quelqu'un a voulu écrire.
 *
 * Les entrées sans intitulé sont écartées : une ligne qu'on vient d'ajouter et
 * qu'on n'a pas remplie n'est pas un risque.
 */
export function horodaterRisques(
  entrants: readonly unknown[],
  stockes: unknown,
  maintenant: Date,
): unknown[] {
  const disponibles: { signature: string; objet: unknown }[] = (
    Array.isArray(stockes) ? stockes : []
  ).flatMap((objet: unknown) => {
    const r = normaliserRisque(objet);
    return r === null || r.intitule === "" ? [] : [{ signature: signature(r), objet }];
  });

  const sortie: unknown[] = [];
  for (const brut of entrants) {
    const r = normaliserRisque(brut);
    if (r === null || r.intitule === "") continue;
    const sig = signature(r);
    const i = disponibles.findIndex((d) => d.signature === sig);
    if (i !== -1) {
      // Inchangé : l'objet stocké, tel quel (ses clés inconnues comprises).
      sortie.push((disponibles.splice(i, 1)[0] as { objet: unknown }).objet);
      continue;
    }
    // Nouveau ou modifié : les champs CONNUS seulement, sous leur forme lue
    // (cote 1-4 ou null), et la date du serveur. Rien d'autre de l'objet reçu
    // n'est recopié — ni une clé inconnue, ni une cote hors échelle, ni la date
    // qu'il prétendait porter (relecture PR #1268).
    sortie.push({
      intitule: r.intitule,
      cause: r.cause,
      gravite: r.gravite,
      probabilite: r.probabilite,
      maitrise: r.maitrise,
      responsable: r.responsable,
      echeance: r.echeance,
      misAJourLe: maintenant.toISOString(),
    });
  }
  return sortie;
}
