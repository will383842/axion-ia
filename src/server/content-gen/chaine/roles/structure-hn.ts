/**
 * Règles pures de structure et de longueur (addendum « structure Hn, intention, longueur 2027 »).
 * Aucune entrée-sortie. Les seuils de titres et de longueur sont des règles de qualité et de
 * lisibilité de la MAISON, vérifiables par le code ; ce ne sont pas des « facteurs de classement ».
 *
 *  - un seul façon de compter les mots (`compterMotsContenu`), des deux côtés (pages lues, article) ;
 *  - fourchette de longueur calculée par le code à partir des pages lues (§ 7.3) ;
 *  - contrôle d'un plan de titres : H1 (H-2 à H-4), H2 (H-6 à H-8, H-11).
 */

export const GABARITS = [
  "analyse",
  "guide",
  "comparatif",
  "selection",
  "cas",
  "definition",
  "faq",
  "chiffres",
  "actualite",
  "guide-pilier",
] as const;
export type Gabarit = (typeof GABARITS)[number];

export const FORMATS_OBSERVES = [
  "definition",
  "guide-etapes",
  "liste-classement",
  "comparatif-tableau",
  "analyse",
  "faq",
  "chiffres",
  "actualite",
  "page-offre",
  "forum",
  "video",
  "autre",
] as const;
export type FormatObserve = (typeof FORMATS_OBSERVES)[number];

export interface ReglesGabarit {
  readonly h2Min: number;
  readonly h2Max: number;
  /** Part de H2 en question visée (H-10). */
  readonly partQuestion: number;
  readonly motsMin: number;
  readonly motsMax: number;
  readonly repliMin: number;
  readonly repliMax: number;
  readonly formatsCompatibles: ReadonlyArray<FormatObserve>;
}

/** Bornes de départ (hypothèses calibrées sur le plan 365, § 10) ; la mesure décide ensuite. */
export const GABARITS_REGLES: Readonly<Record<Gabarit, ReglesGabarit>> = {
  analyse: {
    h2Min: 4,
    h2Max: 8,
    partQuestion: 0.5,
    motsMin: 800,
    motsMax: 2200,
    repliMin: 1100,
    repliMax: 1500,
    formatsCompatibles: ["analyse", "guide-etapes", "actualite"],
  },
  guide: {
    h2Min: 3,
    h2Max: 10,
    partQuestion: 0.5,
    motsMin: 800,
    motsMax: 2200,
    repliMin: 1200,
    repliMax: 1800,
    formatsCompatibles: ["guide-etapes", "analyse"],
  },
  comparatif: {
    h2Min: 4,
    h2Max: 8,
    partQuestion: 0.5,
    motsMin: 1000,
    motsMax: 2400,
    repliMin: 1400,
    repliMax: 1800,
    formatsCompatibles: ["comparatif-tableau", "analyse", "liste-classement"],
  },
  selection: {
    h2Min: 3,
    h2Max: 8,
    partQuestion: 0.5,
    motsMin: 1000,
    motsMax: 2400,
    repliMin: 1300,
    repliMax: 1700,
    formatsCompatibles: ["liste-classement", "comparatif-tableau"],
  },
  cas: {
    h2Min: 4,
    h2Max: 7,
    partQuestion: 0.5,
    motsMin: 700,
    motsMax: 1800,
    repliMin: 900,
    repliMax: 1400,
    formatsCompatibles: ["analyse", "guide-etapes"],
  },
  definition: {
    h2Min: 3,
    h2Max: 6,
    partQuestion: 0.3,
    motsMin: 500,
    motsMax: 1300,
    repliMin: 700,
    repliMax: 1000,
    formatsCompatibles: ["definition", "analyse", "faq"],
  },
  faq: {
    h2Min: 0,
    h2Max: 2,
    partQuestion: 1,
    motsMin: 600,
    motsMax: 1800,
    repliMin: 800,
    repliMax: 1200,
    formatsCompatibles: ["faq", "definition", "analyse"],
  },
  chiffres: {
    h2Min: 3,
    h2Max: 7,
    partQuestion: 0.3,
    motsMin: 700,
    motsMax: 1700,
    repliMin: 1000,
    repliMax: 1400,
    formatsCompatibles: ["chiffres", "analyse", "actualite"],
  },
  actualite: {
    h2Min: 3,
    h2Max: 6,
    partQuestion: 0.5,
    motsMin: 400,
    motsMax: 1300,
    repliMin: 700,
    repliMax: 1100,
    formatsCompatibles: ["actualite", "analyse"],
  },
  "guide-pilier": {
    h2Min: 5,
    h2Max: 9,
    partQuestion: 0.5,
    motsMin: 1800,
    motsMax: 4500,
    repliMin: 2000,
    repliMax: 2800,
    formatsCompatibles: ["guide-etapes", "analyse", "liste-classement"],
  },
};

// ── Comptage ────────────────────────────────────────────────────────────────

/** Compte les mots d'un texte SANS balises ; ignore les jetons sans lettre ni chiffre. */
export function compterMotsContenu(texte: string): number {
  return texte.split(/[\s  ]+/u).filter((j) => /[\p{L}\p{N}]/u.test(j)).length;
}

const MOTS_VIDES_FR = new Set([
  "les",
  "des",
  "une",
  "aux",
  "ces",
  "ses",
  "mes",
  "tes",
  "nos",
  "vos",
  "leurs",
  "leur",
  "dans",
  "sur",
  "sous",
  "avec",
  "sans",
  "pour",
  "par",
  "chez",
  "vers",
  "entre",
  "dont",
  "que",
  "qui",
  "quoi",
  "quel",
  "quels",
  "quelle",
  "quelles",
  "est",
  "sont",
  "etre",
  "avoir",
  "ont",
  "fait",
  "faire",
  "peut",
  "peuvent",
  "comment",
  "pourquoi",
  "quand",
  "elle",
  "elles",
  "ils",
  "nous",
  "vous",
  "cette",
  "cet",
  "son",
  "sa",
  "mon",
  "ton",
  "pas",
  "plus",
  "tout",
  "tous",
  "toute",
  "toutes",
  "aussi",
  "mais",
  "donc",
  "car",
  "ainsi",
  "etc",
  "the",
  "and",
]);

/** Minuscules, sans accents ni ponctuation (l'apostrophe sépare les mots). */
export function normaliserTitre(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function racineSimple(mot: string): string {
  return mot.length > 3 ? mot.replace(/[sx]$/, "") : mot;
}

/** Mots de 3 lettres ou plus plus « IA », hors mots vides, ramenés à leur racine simple. */
export function motsSignificatifs(texte: string): string[] {
  return normaliserTitre(texte)
    .split(" ")
    .filter((m) => (m.length >= 3 || m === "ia") && !MOTS_VIDES_FR.has(m))
    .map(racineSimple);
}

// ── Format dominant et fourchette ───────────────────────────────────────────

export interface PageLue {
  readonly url: string;
  readonly format: string;
  /** Mots comptés PAR LE CODE (0 = page illisible). */
  readonly mots: number;
}

/** Format d'au moins 60 % des pages lisibles, sinon « mixte ». */
export function formatDominant(pages: ReadonlyArray<PageLue>): string {
  const lisibles = pages.filter((p) => p.mots > 0);
  if (lisibles.length === 0) return "mixte";
  const comptes = new Map<string, number>();
  for (const p of lisibles) comptes.set(p.format, (comptes.get(p.format) ?? 0) + 1);
  for (const [format, n] of comptes) {
    if (n / lisibles.length >= 0.6) return format;
  }
  return "mixte";
}

const arrondir50 = (n: number) => Math.round(n / 50) * 50;
const mediane = (v: number[]) => {
  const t = [...v].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m]! : (t[m - 1]! + t[m]!) / 2;
};

export interface EntreeFourchette {
  readonly gabarit: Gabarit;
  readonly pagesLues: ReadonlyArray<PageLue>;
  readonly nbH2: number;
  /** Gabarit Questions-réponses : nombre de questions. */
  readonly nbQuestions?: number;
}

export type ResultatFourchette =
  | {
      readonly ok: true;
      readonly min: number;
      readonly max: number;
      readonly methode: "mesure" | "repli-gabarit";
      readonly mediane: number | null;
      readonly pagesRetenues: number;
    }
  | { readonly ok: false; readonly raison: "plan_trop_long_pour_le_gabarit" };

/** Calcul par le code de la fourchette de longueur (addendum § 7.3). */
export function calculerFourchetteMots(e: EntreeFourchette): ResultatFourchette {
  const r = GABARITS_REGLES[e.gabarit];
  const retenues = e.pagesLues.filter(
    (p) => p.mots > 0 && (r.formatsCompatibles as ReadonlyArray<string>).includes(p.format),
  );
  let min: number;
  let max: number;
  let methode: "mesure" | "repli-gabarit";
  let med: number | null = null;
  if (retenues.length >= 3) {
    med = mediane(retenues.map((p) => p.mots));
    min = arrondir50(0.75 * med);
    max = arrondir50(1.25 * med);
    methode = "mesure";
  } else {
    min = r.repliMin;
    max = r.repliMax;
    methode = "repli-gabarit";
  }

  const plancher = e.gabarit === "faq" ? 60 + (e.nbQuestions ?? 0) * 60 : 60 + e.nbH2 * 100;
  min = Math.max(min, plancher);
  if (plancher > r.motsMax) return { ok: false, raison: "plan_trop_long_pour_le_gabarit" };

  if (min > r.motsMax || (min >= r.motsMax && max > r.motsMax)) {
    max = r.motsMax;
    min = Math.max(r.motsMin, plancher, r.motsMax - 200);
  } else if (max < r.motsMin) {
    min = r.motsMin;
    max = Math.min(r.motsMax, r.motsMin + 200);
  } else {
    min = Math.max(min, r.motsMin);
    max = Math.min(max, r.motsMax);
  }
  if (max - min < 200) {
    max = Math.min(r.motsMax, min + 200);
    if (max - min < 200) min = Math.max(Math.max(r.motsMin, plancher), max - 200);
  }
  return { ok: true, min, max, methode, mediane: med, pagesRetenues: retenues.length };
}

// ── Plan de titres ──────────────────────────────────────────────────────────

export const TYPES_SECTION = ["informatif", "etape", "phase", "groupe"] as const;
export type TypeSection = (typeof TYPES_SECTION)[number];

export interface SectionPlan {
  readonly type: TypeSection;
  readonly intitule: string;
  /** Index dans `brief.questions`, ou null. */
  readonly question: number | null;
  readonly blocAttendu: string | null;
}

/** H-8 : titres génériques interdits (seuls ou suivis d'un deux-points). */
export const TITRES_GENERIQUES: ReadonlyArray<string> = [
  "introduction",
  "conclusion",
  "en resume",
  "pour aller plus loin",
  "contexte",
  "definition",
  "avantages",
  "inconvenients",
  "les enjeux",
  "notre avis",
];

export type ProblemeTitre =
  | "h1_longueur"
  | "h1_sans_mot_cle"
  | "h1_marque_ou_separateur"
  | "h2_nombre"
  | "h2_longueur"
  | "h2_generique"
  | "h2_doublon"
  | "h2_egal_h1"
  | "motcle_exact_trop_present";

export interface EntreeTitres {
  readonly h1: string;
  readonly motCle: string;
  readonly plan: ReadonlyArray<SectionPlan>;
  readonly gabarit: Gabarit;
}

const MARQUE = /axion[\s-]?ia|\|/i;

/** Vérifie le H1 et les H2 d'un plan (H-2 à H-4, H-6 à H-8, H-11). Liste vide = conforme. */
export function verifierTitres(e: EntreeTitres): ProblemeTitre[] {
  const pb = new Set<ProblemeTitre>();
  const h1 = e.h1.trim();
  const motsH1 = h1.split(/\s+/).filter(Boolean).length;
  if (h1.length < 20 || h1.length > 120 || motsH1 > 20) pb.add("h1_longueur");
  if (MARQUE.test(h1)) pb.add("h1_marque_ou_separateur");
  const cle = new Set(motsSignificatifs(e.motCle));
  if (cle.size > 0 && !motsSignificatifs(h1).some((m) => cle.has(m))) pb.add("h1_sans_mot_cle");

  const r = GABARITS_REGLES[e.gabarit];
  if (e.plan.length < r.h2Min || e.plan.length > r.h2Max) pb.add("h2_nombre");

  const vus = new Set<string>();
  const h1Norm = normaliserTitre(h1);
  const motCleNorm = normaliserTitre(e.motCle);
  let avecMotCle = 0;
  for (const s of e.plan) {
    const t = s.intitule.trim();
    const norme = normaliserTitre(t);
    const mots = t.split(/\s+/).filter(Boolean).length;
    if (mots < 3 || mots > 14 || t.length > 90) pb.add("h2_longueur");
    const sansDeuxPoints = norme.replace(/\s*:.*$/, "").trim();
    if (TITRES_GENERIQUES.includes(norme) || TITRES_GENERIQUES.includes(sansDeuxPoints)) {
      pb.add("h2_generique");
    }
    if (vus.has(norme)) pb.add("h2_doublon");
    vus.add(norme);
    if (norme === h1Norm) pb.add("h2_egal_h1");
    if (motCleNorm && norme.includes(motCleNorm)) avecMotCle++;
  }
  if (avecMotCle > 2) pb.add("motcle_exact_trop_present");
  return [...pb];
}
