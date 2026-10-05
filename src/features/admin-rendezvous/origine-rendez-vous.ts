// « Rendez-vous par origine » — l'agrégation PURE (2026-10-05).
//
// Will veut savoir D'OÙ VIENNENT ceux qui prennent rendez-vous, pour régler
// ses pubs. La question « Comment nous avez-vous connu ? » est posée chez
// Calendly sur les quatre types ; sa réponse est dans les questions/réponses
// de la réservation (`raw_payload`). AUCUNE colonne ajoutée : on la LIT.
//
// Règles :
//   · le libellé de la question est reconnu sans tenir compte de la casse ni des
//     accents, et par son sens (« comment… connu ») plutôt que mot pour mot ;
//   · une réponse reconnue va dans sa source ; une réponse inconnue va dans
//     « Autre / non classé » — jamais d'erreur, jamais de perte ;
//   · pas de réponse du tout (réservations d'avant la question obligatoire) :
//     « Sans réponse », compté à part ;
//   · le type est celui de `typeEffectif` ; les UTM viennent des colonnes.
//
// Module PUR : la lecture bornée vit dans `origine-rendez-vous-queries.ts`.

import { typeEffectif } from "@/server/calendly/type-effectif";
import { TYPES_RENDEZ_VOUS, type TypeRendezVous } from "@/server/calendly/type-rendez-vous";

export const SOURCES = [
  "instagram",
  "linkedin",
  "facebook",
  "google",
  "bouche_a_oreille",
  "apporteur",
  "ia",
  "email",
  "autre",
] as const;
export type Source = (typeof SOURCES)[number];
export type Origine = Source | "sans_reponse";

export const LIBELLE_SOURCE: Readonly<Record<Origine, string>> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  google: "Recherche Google",
  bouche_a_oreille: "Bouche-à-oreille",
  apporteur: "Un apporteur d'affaires",
  ia: "ChatGPT ou une autre IA",
  email: "E-mail reçu",
  autre: "Autre / non classé",
  sans_reponse: "Sans réponse",
};

/** Minuscules, sans accents, espaces simples. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** La question « Comment nous avez-vous connu ? », même reformulée. */
export function estQuestionOrigine(question: string): boolean {
  return /comment.*(connu|connaiss|decouvert|entendu)/.test(normaliser(question));
}

/** Classe UNE réponse. Inconnue → « autre ». Ne lève jamais. */
export function classerReponse(reponse: string): Source {
  const r = normaliser(reponse);
  if (/apporteur/.test(r)) return "apporteur";
  if (/instagram/.test(r)) return "instagram";
  if (/linkedin/.test(r)) return "linkedin";
  if (/facebook|\bmeta\b/.test(r)) return "facebook";
  if (/chatgpt|\bgpt\b|\bia\b|\bai\b|intelligence artificielle|claude|gemini|perplexity/.test(r))
    return "ia";
  if (/e-?mail|\bmail\b|newsletter|courriel/.test(r)) return "email";
  if (/google|recherche|moteur/.test(r)) return "google";
  if (/bouche|recommand|collegue|\bamis?\b/.test(r)) return "bouche_a_oreille";
  return "autre";
}

/**
 * L'origine déclarée dans les questions/réponses brutes de Calendly
 * (`[{ question, answer }]`). Rien d'exploitable → « sans_reponse ».
 */
export function lireOrigine(questionsReponses: unknown): Origine {
  if (!Array.isArray(questionsReponses)) return "sans_reponse";
  for (const qa of questionsReponses) {
    if (typeof qa !== "object" || qa === null) continue;
    const { question, answer } = qa as { question?: unknown; answer?: unknown };
    if (typeof question !== "string" || !estQuestionOrigine(question)) continue;
    if (typeof answer !== "string" || !answer.trim()) return "sans_reponse";
    return classerReponse(answer);
  }
  return "sans_reponse";
}

/** Une réservation lue (champs minimaux). */
export interface LigneOrigineBrute {
  readonly typeRendezVous: string | null;
  readonly eventTypeName: string | null;
  readonly capturedAt: Date | string;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  /** `questions_and_answers` du payload, tel quel (peut être n'importe quoi). */
  readonly qa: unknown;
}

export type Compteurs = Record<Origine, number>;

export function compteursVides(): Compteurs {
  const c = { sans_reponse: 0 } as Compteurs;
  for (const s of SOURCES) c[s] = 0;
  return c;
}

export function total(c: Compteurs): number {
  return Object.values(c).reduce((a, b) => a + b, 0);
}

/** Part en pourcentage entier (0 si rien). */
export function part(n: number, sur: number): number {
  return sur > 0 ? Math.round((n / sur) * 100) : 0;
}

export interface LigneUtm {
  readonly source: string;
  readonly medium: string;
  readonly campagne: string;
  readonly n: number;
  /** Ce que ces personnes ont répondu à « Comment nous avez-vous connu ? ». */
  readonly origines: Compteurs;
}

export interface SemaineOrigine {
  /** Lundi de la semaine, `AAAA-MM-JJ` (heure de Paris). */
  readonly lundi: string;
  readonly compteurs: Compteurs;
}

export interface BilanOrigine {
  readonly total: Compteurs;
  readonly parType: ReadonlyArray<{ type: TypeRendezVous; compteurs: Compteurs }>;
  /** Du plus ancien au plus récent, toutes les semaines de la période (même vides). */
  readonly semaines: readonly SemaineOrigine[];
  /** Les combinaisons d'UTM les plus fréquentes ; `sansUtm` = réservations sans aucune UTM. */
  readonly utm: readonly LigneUtm[];
  readonly sansUtm: number;
}

/** Nombre de combinaisons d'UTM affichées. */
export const UTM_MAX = 10;

const FORMAT_PARIS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Lundi (heure de Paris) de la semaine d'une date, `AAAA-MM-JJ`. */
export function lundiDe(date: Date): string {
  const jour = FORMAT_PARIS.format(date); // AAAA-MM-JJ
  const d = new Date(`${jour}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function nettoyerUtm(v: string | null): string {
  const t = v?.trim().toLowerCase();
  return t ? t : "";
}

export function agregerOrigines(
  lignes: readonly LigneOrigineBrute[],
  jours: number,
  maintenant: Date = new Date(),
): BilanOrigine {
  const totalC = compteursVides();
  const parType = new Map<TypeRendezVous, Compteurs>();
  const semaines = new Map<string, Compteurs>();
  // Toutes les semaines de la période, même vides : un trou se voit.
  const debut = new Date(maintenant.getTime() - jours * 86_400_000);
  const derniere = lundiDe(maintenant);
  for (
    const d = new Date(`${lundiDe(debut)}T12:00:00Z`);
    d.toISOString().slice(0, 10) <= derniere;
    d.setUTCDate(d.getUTCDate() + 7)
  ) {
    semaines.set(d.toISOString().slice(0, 10), compteursVides());
  }
  const utm = new Map<
    string,
    { ligne: Omit<LigneUtm, "n" | "origines">; n: number; o: Compteurs }
  >();
  let sansUtm = 0;

  for (const l of lignes) {
    const origine = lireOrigine(l.qa);
    totalC[origine] += 1;
    const type = typeEffectif(l);
    const ct = parType.get(type) ?? compteursVides();
    ct[origine] += 1;
    parType.set(type, ct);

    const quand = new Date(l.capturedAt);
    if (!Number.isNaN(quand.getTime())) {
      const cs = semaines.get(lundiDe(quand));
      if (cs) cs[origine] += 1;
    }

    const source = nettoyerUtm(l.utmSource);
    const medium = nettoyerUtm(l.utmMedium);
    const campagne = nettoyerUtm(l.utmCampaign);
    if (!source && !medium && !campagne) {
      sansUtm += 1;
      continue;
    }
    const cle = `${source}\u0000${medium}\u0000${campagne}`;
    const e = utm.get(cle) ?? { ligne: { source, medium, campagne }, n: 0, o: compteursVides() };
    e.n += 1;
    e.o[origine] += 1;
    utm.set(cle, e);
  }

  return {
    total: totalC,
    parType: TYPES_RENDEZ_VOUS.filter((t) => parType.has(t)).map((t) => ({
      type: t,
      compteurs: parType.get(t) as Compteurs,
    })),
    semaines: [...semaines.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([lundi, compteurs]) => ({ lundi, compteurs })),
    utm: [...utm.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, UTM_MAX)
      .map((e) => ({ ...e.ligne, n: e.n, origines: e.o })),
    sansUtm,
  };
}
