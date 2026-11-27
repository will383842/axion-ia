/**
 * R2 · Stratège de brief (conception § 3, addendum § 8.1 ; PR C6). Modèle : Opus + web.
 *
 * Le brief est le contrat de tout le reste. Le modèle propose (angle unique, lacunes des
 * concurrents, plan adapté) ; le CODE valide et calcule : jamais le modèle pour
 *  - la page propriétaire d'une intention refusée (lue dans la carte des requêtes) ;
 *  - le nombre de mots des pages lues et le format dominant ;
 *  - l'origine des questions (une question sans origine réelle est écartée, jamais inventée) ;
 *  - la fourchette de longueur, les titres (H1/H2), la couverture des questions (L-4), les apports (B07).
 *
 * Verdicts : `pas_d_angle`, `pas_de_matiere` (aucune note de terrain réelle, ou apports B07
 * insuffisants), `intention_hors_article` (transactionnelle, locale, navigation : une page existe),
 * `deja_couvert` (une requête = une URL). Premier filtre qualité et le moins cher : les cas sans
 * matière ou déjà couverts ne coûtent aucun appel.
 *
 * Module sans entrée-sortie : appel au modèle, carte des requêtes et pages propriétaires sont injectés.
 */

import { z } from "zod";
import { slugify } from "@/lib/slug";
import { ORIGINES_QUESTION, briefSchema, type Brief, type Question } from "../../equipe/brief";
import type { CodeRefus } from "../codes-refus";
import {
  CONSIGNE_DONNEES,
  REGLES_MARQUE_PROMPT,
  appelerRole,
  encadrerDonnees,
  lireJson,
  verifierReglesMarque,
  type AppelModele,
  type CompteurCout,
} from "./commun";
import {
  FORMATS_OBSERVES,
  GABARITS,
  GABARITS_REGLES,
  TYPES_SECTION,
  calculerFourchetteMots,
  compterMotsContenu,
  formatDominant,
  normaliserTitre,
  verifierTitres,
  type Gabarit,
  type PageLue,
  type ProblemeTitre,
} from "./structure-hn";

export const NOTE_TERRAIN_MIN_CARACTERES = 40;
export const QUESTIONS_FAQ_MIN = 6;

export const INTENTIONS_RECHERCHE = [
  "informational",
  "commercial_investigation",
  "transactional",
  "navigational",
  "local",
] as const;
export const BESOINS_SOUS_INTENTION = ["comparaison", "decision"] as const;
export const TYPES_APPORT = ["A", "B", "C", "D"] as const;
export const APPELS_ACTION = ["diagnostic", "journee-ia"] as const;

const texte = (max: number) => z.string().trim().min(1).max(max);

const sortieSchema = z
  .object({
    verdict: z.enum(["brief", "pas_d_angle", "intention_hors_article"]),
    raison: texte(500).optional(),
    intention: z.enum(INTENTIONS_RECHERCHE).optional(),
    sousIntention: z.enum(BESOINS_SOUS_INTENTION).optional(),
    /** Toléré mais IGNORÉ : la page propriétaire est lue par le code, jamais saisie par le modèle. */
    pageProprietaire: z.string().optional(),
    gabaritCible: z.enum(GABARITS).optional(),
    ecartFormat: texte(300).optional(),
    motCle: texte(200).optional(),
    h1: texte(200).optional(),
    lecteur: z
      .object({ profil: z.enum(["pme", "tpe"]), metier: texte(200) })
      .strict()
      .optional(),
    angleUnique: texte(500).optional(),
    lacunesConcurrents: z.array(texte(300)).max(10).optional(),
    pagesLues: z
      .array(z.object({ url: texte(1000), format: z.string() }).strict())
      .max(5)
      .optional(),
    questions: z
      .array(
        z
          .object({
            question: texte(300),
            origine: z.enum(ORIGINES_QUESTION),
            reference: texte(300),
            principale: z.boolean().optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    faitsACollecter: z.array(texte(300)).max(20).optional(),
    planHn: z
      .array(
        z
          .object({
            type: z.enum(TYPES_SECTION),
            intitule: texte(200),
            question: z.number().int().min(0).nullable(),
            blocAttendu: texte(100).nullable(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    faqPrevue: z.array(z.number().int().min(0)).max(20).optional(),
    apportsReserves: z
      .array(z.object({ type: z.enum(TYPES_APPORT), description: texte(300) }).strict())
      .max(8)
      .optional(),
    appelAction: z.enum(APPELS_ACTION).optional(),
    liensInternes: z.array(texte(300)).max(10).optional(),
    cluster: texte(200).optional(),
    requetesSecondaires: z.array(texte(200)).max(20).optional(),
    champSemantique: z.array(texte(100)).max(40).optional(),
    entites: z.array(texte(100)).max(30).optional(),
  })
  .strict();

type Sortie = z.infer<typeof sortieSchema>;

export interface EntreeStrateg {
  readonly besoin: Question;
  /** Note de terrain réelle ou constat anonymisé fourni par Will ; sans elle, pas de contenu. */
  readonly noteTerrain: string | null;
  /** Questions réelles disponibles (réserve de besoins, Search Console, plan éditorial). */
  readonly questionsConnues: ReadonlyArray<Question>;
  /** Carte des requêtes : URL qui couvre déjà cette requête, ou null. */
  readonly urlCouvrante: (requete: string) => string | null;
  /** Page qui sert une intention refusée (registre de la porte, sinon carte), ou null. */
  readonly pageProprietaire: (requete: string) => string | null;
  /** Une donnée réelle et agrégée d'Axion-IA existe (type D) ; sinon D est indisponible. */
  readonly donneePropreDisponible: boolean;
  readonly urlSite: string;
}

export interface StructureBrief {
  readonly versionStructure: 1;
  readonly intention: (typeof INTENTIONS_RECHERCHE)[number];
  readonly gabaritCible: Gabarit;
  readonly h1: string;
  readonly lecteur: { readonly profil: "pme" | "tpe"; readonly metier: string };
  readonly angleUnique: string;
  readonly lacunesConcurrents: ReadonlyArray<string>;
  readonly pagesLues: ReadonlyArray<PageLue>;
  readonly formatDominant: string;
  readonly ecartFormat: string | null;
  readonly questionPrincipale: number;
  readonly questionsEcartees: ReadonlyArray<{ question: string; motif: string }>;
  readonly faitsACollecter: ReadonlyArray<string>;
  readonly planHn: ReadonlyArray<{
    readonly type: (typeof TYPES_SECTION)[number];
    readonly intitule: string;
    readonly question: number | null;
    readonly blocAttendu: string | null;
  }>;
  readonly faqPrevue: ReadonlyArray<number>;
  readonly apportsReserves: ReadonlyArray<{
    readonly type: (typeof TYPES_APPORT)[number];
    readonly description: string;
  }>;
  readonly appelAction: (typeof APPELS_ACTION)[number];
  readonly liensInternes: ReadonlyArray<string>;
  readonly fourchetteMots: {
    readonly min: number;
    readonly max: number;
    readonly methode: "mesure" | "repli-gabarit";
    readonly mediane: number | null;
    readonly pagesRetenues: number;
  };
}

/**
 * `intention_hors_article` et `deja_couvert` sont deux VERDICTS distincts ; le code de refus enregistré
 * est `intention_couverte` (la liste fermée de C4 n'a pas de code propre : à ajouter à C4 si la console
 * doit les distinguer, décision à prendre avec la porte).
 * Codes de la liste fermée de C4 : le compilateur refuse tout autre nom. */
export type CodeRefusStrateg = Extract<
  CodeRefus,
  "pas_d_angle" | "pas_de_matiere" | "intention_couverte"
>;

export type ResultatStrateg =
  | {
      readonly verdict: "brief_pret";
      readonly brief: Brief;
      readonly structure: StructureBrief;
      /** Appel Journée IA : relecture humaine obligatoire (règle existante). */
      readonly relectureHumaineObligatoire: boolean;
    }
  | {
      readonly verdict: "pas_de_matiere";
      readonly raison: string;
      readonly codeRefus: "pas_de_matiere";
    }
  | { readonly verdict: "pas_d_angle"; readonly raison: string; readonly codeRefus: "pas_d_angle" }
  | {
      readonly verdict: "deja_couvert";
      readonly raison: string;
      readonly urlCouvrante: string;
      readonly codeRefus: "intention_couverte";
    }
  | {
      readonly verdict: "intention_hors_article";
      readonly raison: string;
      /** Lue par le code, jamais saisie par le modèle. */
      readonly pageProprietaire: string | null;
      /** Sans page existante : signalement à Will, jamais un article de remplacement. */
      readonly signaler: boolean;
      readonly codeRefus: "intention_couverte";
    }
  | { readonly verdict: "brief_invalide"; readonly raison: string; readonly problemes: string[] }
  | { readonly verdict: "illisible"; readonly raison: string };

const SYSTEM = [
  "Tu es le stratège de brief d'une équipe éditoriale qui écrit pour des DIRIGEANTS DE PME (environ 80 % des lecteurs) et de TPE (environ 20 %). Ce sont de vraies questions de dirigeants : concrètes, décisionnelles, sans jargon.",
  "Lis avec web_search puis web_fetch les 5 premières pages de résultats pour la question. Note pour chacune son format : " +
    FORMATS_OBSERVES.join(", ") +
    ". Tu ne comptes ni mots ni URL : le code le fait.",
  "Cherche l'ANGLE UNIQUE : ce que cette page dira que les concurrentes ne disent pas (chiffre absent, étape sautée, erreur courante). Sans angle, réponds verdict « pas_d_angle ». Si l'intention est transactionnelle (demande de prix incluse), locale ou de navigation, réponds « intention_hors_article » : une page existante la sert.",
  "Plan adapté au sujet (pas de plan fixe) : H2 surtout en vraies questions, 3 à 14 mots, jamais « Introduction », « Conclusion », « En résumé ». Chaque question du plan renvoie à l'index d'une question du brief. N'invente AUCUNE question : n'utilise que celles fournies ou lues dans une page (origine autre-source, référence = URL lue). La question principale est celle du H1 (principale: true).",
  "Réserve dès le brief au moins 2 apports originaux distincts parmi : A exemple type étiqueté (jamais un client réel), B chiffre sourcé, C angle PME française (droit, obligations, calendrier), D donnée propre Axion-IA (seulement si fournie).",
  "Règles de marque :\n- " + REGLES_MARQUE_PROMPT,
  CONSIGNE_DONNEES,
  'Réponds uniquement par un objet JSON (verdict "brief", "pas_d_angle" ou "intention_hors_article" ; champs intention, sousIntention, gabaritCible, motCle, h1, lecteur, angleUnique, lacunesConcurrents, pagesLues[{url,format}], questions[{question,origine,reference,principale}], faitsACollecter, planHn[{type,intitule,question,blocAttendu}], faqPrevue, apportsReserves[{type,description}], appelAction "diagnostic" ou "journee-ia", liensInternes, cluster, requetesSecondaires, champSemantique, entites).',
].join("\n\n");

const norme = (s: string) =>
  s
    .replace(/[\s  ]+/g, " ")
    .trim()
    .toLowerCase();

function construireUser(e: EntreeStrateg): string {
  const connues = e.questionsConnues
    .map((q, i) => `${i}. ${q.question} [${q.origine} : ${q.reference}]`)
    .join("\n");
  return [
    encadrerDonnees("question-a-traiter", e.besoin.question),
    encadrerDonnees("note-de-terrain", e.noteTerrain ?? ""),
    encadrerDonnees("questions-connues", connues),
    `Donnée propre Axion-IA (type D) disponible : ${e.donneePropreDisponible ? "oui" : "non"}.`,
  ].join("\n\n");
}

function texteCompletDe(s: Sortie): string {
  return [
    s.motCle,
    s.h1,
    s.angleUnique,
    ...(s.lacunesConcurrents ?? []),
    ...(s.faitsACollecter ?? []),
    ...(s.planHn ?? []).map((p) => p.intitule),
    ...(s.apportsReserves ?? []).map((a) => a.description),
    ...(s.liensInternes ?? []),
    s.cluster,
    ...(s.requetesSecondaires ?? []),
    ...(s.entites ?? []),
    ...(s.champSemantique ?? []),
    ...(s.questions ?? []).map((q) => q.question),
    s.lecteur?.metier,
    s.ecartFormat,
    s.raison,
  ]
    .filter((x): x is string => typeof x === "string")
    .join("\n");
}

export async function strategeBrief(
  e: EntreeStrateg,
  appel: AppelModele,
  compteur: CompteurCout,
): Promise<ResultatStrateg> {
  // Filtres sans appel : les moins chers.
  if (!e.noteTerrain || e.noteTerrain.trim().length < NOTE_TERRAIN_MIN_CARACTERES) {
    return {
      verdict: "pas_de_matiere",
      raison: "Aucune note de terrain réelle ni constat anonymisé pour ce sujet.",
      codeRefus: "pas_de_matiere",
    };
  }
  const deja = e.urlCouvrante(e.besoin.question);
  if (deja) {
    return {
      verdict: "deja_couvert",
      raison: "Une requête = une URL : cette question est déjà couverte.",
      urlCouvrante: deja,
      codeRefus: "intention_couverte",
    };
  }

  const reponse = await appelerRole(appel, compteur, "strateg", {
    system: SYSTEM,
    user: construireUser(e),
    maxTokens: 6000,
    outils: ["web_search", "web_fetch"],
    maxRecherches: 5,
    maxLectures: 5,
  });
  const lu = lireJson(reponse.texte, sortieSchema);
  if (!lu.ok) return { verdict: "illisible", raison: `Brief illisible (${lu.raison})` };
  const s = lu.valeur;

  if (s.verdict === "pas_d_angle") {
    return {
      verdict: "pas_d_angle",
      raison: s.raison ?? "Aucun angle que les concurrents ne disent pas.",
      codeRefus: "pas_d_angle",
    };
  }
  const intention = s.intention;
  if (s.verdict === "brief" && intention === undefined) {
    return {
      verdict: "brief_invalide",
      raison: "Intention de recherche absente du brief.",
      problemes: ["intention_absente"],
    };
  }
  if (
    s.verdict === "intention_hors_article" ||
    (intention !== "informational" && intention !== "commercial_investigation")
  ) {
    const page = e.pageProprietaire(e.besoin.question);
    return {
      verdict: "intention_hors_article",
      raison: s.raison ?? "Cette intention est servie par une page existante, pas par un article.",
      pageProprietaire: page,
      signaler: page === null,
      codeRefus: "intention_couverte",
    };
  }
  return valider(e, s, intention, reponse.sources ?? []);
}

function valider(
  e: EntreeStrateg,
  s: Sortie,
  intention: "informational" | "commercial_investigation",
  sourcesLues: ReadonlyArray<{ url: string; texte?: string }>,
): ResultatStrateg {
  const problemes: string[] = [];
  const invalide = (raison: string): ResultatStrateg => ({
    verdict: "brief_invalide",
    raison,
    problemes: [...new Set(problemes)],
  });

  const requis = [s.gabaritCible, s.motCle, s.h1, s.lecteur, s.angleUnique, s.planHn, s.questions];
  if (requis.some((v) => v === undefined)) {
    problemes.push("champs_manquants");
    return invalide("Brief incomplet : champs obligatoires absents.");
  }
  const gabarit = s.gabaritCible as Gabarit;
  const motCle = s.motCle as string;
  const h1 = s.h1 as string;
  const plan = s.planHn!;

  // Règles de marque, par le code.
  const marque = verifierReglesMarque(texteCompletDe(s));
  if (marque.length > 0) {
    problemes.push(...marque.map((m) => `marque_${m}`));
    return invalide(`Règle de marque violée : ${marque.join(", ")}.`);
  }

  // Pages lues : URL réellement lues, mots comptés par le code.
  const lues = new Map(sourcesLues.map((p) => [p.url, p.texte ?? ""]));
  // Toutes les pages réellement lues (sans doublon) : le modèle ne fournit que le format par URL.
  const formats = new Map((s.pagesLues ?? []).map((p) => [p.url, p.format]));
  const pagesLues: PageLue[] = [];
  for (const [url, contenu] of lues) {
    const brut = formats.get(url) ?? "autre";
    const format = (FORMATS_OBSERVES as ReadonlyArray<string>).includes(brut) ? brut : "autre";
    pagesLues.push({ url, format, mots: compterMotsContenu(contenu) });
  }
  if (pagesLues.length > 5) pagesLues.length = 5;
  const dominant = formatDominant(pagesLues);
  const regles = GABARITS_REGLES[gabarit];
  const compatible =
    dominant === "mixte" || (regles.formatsCompatibles as ReadonlyArray<string>).includes(dominant);
  if (!compatible && !s.ecartFormat) problemes.push("ecart_format_non_justifie");

  // Questions : jamais sans origine réelle.
  const questionsEcartees: Array<{ question: string; motif: string }> = [];
  const gardees: Question[] = [];
  const ancienVersNouveau = new Map<number, number>();
  let principale = -1;
  const connues = new Set(
    [e.besoin, ...e.questionsConnues].map((q) => `${q.origine}|${norme(q.question)}`),
  );
  (s.questions ?? []).forEach((q, i) => {
    const reelle =
      q.origine === "autre-source"
        ? normaliserTitre(lues.get(q.reference) ?? "").includes(normaliserTitre(q.question))
        : connues.has(`${q.origine}|${norme(q.question)}`);
    if (!reelle) {
      questionsEcartees.push({ question: q.question, motif: "sans_origine_reelle" });
      return;
    }
    ancienVersNouveau.set(i, gardees.length);
    if (q.principale) principale = gardees.length;
    gardees.push({ question: q.question, origine: q.origine, reference: q.reference });
  });
  if (gardees.length === 0 || principale < 0) problemes.push("question_principale_absente");

  // Plan : réindexation, titres, couverture (L-4).
  const planRemappe = plan.map((p) => ({
    ...p,
    question: p.question === null ? null : (ancienVersNouveau.get(p.question) ?? null),
  }));
  const faqPrevue = (s.faqPrevue ?? [])
    .map((i) => ancienVersNouveau.get(i))
    .filter((i): i is number => i !== undefined);
  const couvertes = new Set<number>([
    ...planRemappe.map((p) => p.question).filter((q): q is number => q !== null),
    ...faqPrevue,
  ]);
  gardees.forEach((_, i) => {
    if (i !== principale && !couvertes.has(i)) problemes.push("question_non_couverte");
  });
  for (const p of planRemappe) {
    if (p.question !== null && p.question >= gardees.length) problemes.push("question_inconnue");
  }
  if (gabarit === "faq" && gardees.length - 1 < QUESTIONS_FAQ_MIN) {
    problemes.push("faq_questions_insuffisantes");
  }

  const titres: ProblemeTitre[] = verifierTitres({ h1, motCle, plan: planRemappe, gabarit });
  problemes.push(...titres);

  // Apports originaux (B07), réservés dès le brief.
  const apports = (s.apportsReserves ?? []).filter(
    (a) => a.type !== "D" || e.donneePropreDisponible,
  );
  const types = new Set(apports.map((a) => a.type));
  if (types.size < 2 || (!types.has("B") && !types.has("C"))) {
    return {
      verdict: "pas_de_matiere",
      raison:
        "Moins de 2 apports originaux distincts, ou aucun chiffre sourcé ni angle PME française disponible.",
      codeRefus: "pas_de_matiere",
    };
  }

  // Appel à l'action et liens : jamais /appel, jamais de réservation.
  const appelAction = s.appelAction ?? "diagnostic";

  // Longueur.
  const fourchette = calculerFourchetteMots({
    gabarit,
    pagesLues,
    nbH2: planRemappe.length,
    nbQuestions: gardees.length - 1,
  });
  if (!fourchette.ok) problemes.push(fourchette.raison);

  if (problemes.length > 0 || !fourchette.ok) {
    return invalide(`Brief refusé par le code : ${[...new Set(problemes)].join(", ")}.`);
  }

  const intentionBrief: Brief["intention"] =
    intention === "informational" ? "information" : (s.sousIntention ?? "comparaison");
  const brief = briefSchema.safeParse({
    motCle,
    intention: intentionBrief,
    requetesSecondaires: s.requetesSecondaires ?? [],
    champSemantique: s.champSemantique ?? [],
    entites: s.entites ?? [],
    questions: gardees,
    urlCible: `${e.urlSite.replace(/\/+$/, "")}/fr/blog/${slugify(motCle)}`,
    cluster: s.cluster ?? "sans-rattachement",
    type: "neuf",
    planTitres: [
      { niveau: 1, titre: h1 },
      ...planRemappe.map((p) => ({ niveau: 2 as const, titre: p.intitule })),
    ],
    longueurMinMots: fourchette.min,
    longueurMaxMots: fourchette.max,
  });
  if (!brief.success) {
    problemes.push("brief_schema");
    return invalide("Le brief ne passe pas le schéma de brief existant.");
  }

  const structure: StructureBrief = {
    versionStructure: 1,
    intention,
    gabaritCible: gabarit,
    h1,
    lecteur: s.lecteur!,
    angleUnique: s.angleUnique!,
    lacunesConcurrents: s.lacunesConcurrents ?? [],
    pagesLues,
    formatDominant: dominant,
    ecartFormat: s.ecartFormat ?? null,
    questionPrincipale: principale,
    questionsEcartees,
    faitsACollecter: s.faitsACollecter ?? [],
    planHn: planRemappe,
    faqPrevue,
    apportsReserves: apports,
    appelAction,
    liensInternes: s.liensInternes ?? [],
    fourchetteMots: {
      min: fourchette.min,
      max: fourchette.max,
      methode: fourchette.methode,
      mediane: fourchette.mediane,
      pagesRetenues: fourchette.pagesRetenues,
    },
  };
  return {
    verdict: "brief_pret",
    brief: brief.data,
    structure,
    relectureHumaineObligatoire: appelAction === "journee-ia",
  };
}
