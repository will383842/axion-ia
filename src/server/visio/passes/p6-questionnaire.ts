/**
 * P6 — le QUESTIONNAIRE DE CADRAGE d'un projet, à la demande (chantier visio,
 * PR 7 ; `compte-rendu-et-extraction.md` §5.6 ; décision B8 : « à copier » en V1).
 *
 * L'entrée est construite par le CODE, jamais par l'IA :
 *
 *   · C… — ce qui est DÉJÀ CONNU et validé, pour le projet visé et pour
 *     l'entreprise (jamais un autre projet) : l'IA ne doit pas le redemander,
 *     même si c'est un collègue qui l'a dit ;
 *   · Q… — les questions restées ouvertes (`question_ouverte`, suivi
 *     « ouvert ») : une question RÉPONDUE n'y figure plus ;
 *   · T… — les rubriques jamais abordées pour le projet.
 *
 * Les types qu'un questionnaire ne touche JAMAIS (`objection`, `concurrent`,
 * `budget`, `prix_annonce_axion`) ne sont même pas envoyés.
 *
 * La sortie est vérifiée par le CODE (`verifierQuestionnaire`) : une question
 * sans source, ou qui s'appuie sur un fait déjà connu, ou qui porte un prix
 * (G14), une adresse (G15), ou un sujet interdit, est RETIRÉE ; 12 questions au
 * plus. Rien n'est corrigé en silence.
 *
 * Module PUR.
 */

import type { FaitStatut, FaitSuivi, FaitType } from "../../../../prisma/generated/client";
import type { QuestionnaireV1 } from "../schemas/autres";
import { LIBELLE_RUBRIQUE } from "@/features/dossier-client/libelles";
import { RUBRIQUE_PAR_NUMERO, type RubriqueCouverture } from "../schemas/communs";
import { neutraliserDonnees, repeteUnCollegue } from "../verification/regles";
import { contientUneAdresse, contientUnPrix } from "./gardes-texte";

/** Types JAMAIS envoyés à P6 ni visés par une question. */
export const TYPES_INTERDITS_QUESTIONNAIRE: ReadonlySet<FaitType> = new Set([
  "objection",
  "concurrent",
  "budget",
  "prix_annonce_axion",
]);

/** Rubriques qu'un questionnaire n'aborde jamais. */
export const RUBRIQUES_INTERDITES_QUESTIONNAIRE: ReadonlySet<RubriqueCouverture> = new Set([
  "objections_concurrence",
]);

export const MAX_QUESTIONS = 12;

/** Le type de fait qu'une question d'une rubrique cherche à établir. */
export const TYPE_VISE_PAR_RUBRIQUE: Readonly<Record<RubriqueCouverture, FaitType | null>> = {
  entreprise: "info_societe",
  decision: "decideur",
  problemes: "probleme",
  besoins: "besoin",
  perimetre: "nb_participants",
  budget_financement: "financement",
  calendrier: "echeance",
  objections_concurrence: null,
  engagements: "engagement_client",
  offres: "offre_envisagee",
  questions_ouvertes: "autre",
  prochaine_etape: "prochaine_etape",
};

/**
 * Le libellé d'une rubrique envoyé à P6 : la table UNIQUE `LIBELLE_RUBRIQUE`
 * du dossier client, lue par SON numéro. Une seule surcharge, voulue : la
 * rubrique 6 se dit « Financement », car le budget n'est jamais demandé par
 * un questionnaire (`TYPES_INTERDITS_QUESTIONNAIRE`).
 */
const SURCHARGE_LIBELLE_P6: Readonly<Record<number, string>> = { 6: "Financement" };

function libelleRubriqueP6(numero: number): string {
  return SURCHARGE_LIBELLE_P6[numero] ?? LIBELLE_RUBRIQUE[numero] ?? String(numero);
}

export interface FaitPourQuestionnaire {
  readonly id: string;
  readonly type: FaitType;
  readonly portee: "entreprise" | "projet" | "a_ranger";
  readonly projetId: string | null;
  readonly statut: FaitStatut;
  readonly suivi: FaitSuivi | null;
  /** Énoncé DÉCHIFFRÉ. */
  readonly enonce: string;
  /** La personne du client qui l'a dit (G15), ou `null` (Williams, inconnu). */
  readonly contactLocuteurId?: string | null;
}

export interface EntreeP6 {
  readonly projet: { readonly id: string; readonly titre: string };
  /** Tous les faits du client : la fonction ne garde que ce qui doit partir. */
  readonly faits: ReadonlyArray<FaitPourQuestionnaire>;
  /** Rubriques jamais abordées pour ce projet (`consoliderFaits`). */
  readonly trous: ReadonlyArray<number>;
}

export type RefP6 =
  | {
      readonly nature: "connu";
      readonly faitId: string;
      readonly enonce: string;
      readonly ditPar: string | null;
    }
  | { readonly nature: "question"; readonly faitId: string }
  | { readonly nature: "trou"; readonly rubrique: RubriqueCouverture };

/** Le fait relève-t-il de CE projet ou de l'entreprise (jamais d'un autre projet) ? */
function dansLePerimetre(f: FaitPourQuestionnaire, projetId: string): boolean {
  return f.portee === "entreprise" || (f.portee === "projet" && f.projetId === projetId);
}

/** G17 (règle commune) : une donnée ne peut pas fermer la balise qui la contient. */
function neutraliser(texte: string): string {
  return neutraliserDonnees(texte).replace(/\s+/g, " ").trim();
}

/** Construit l'entrée de P6 et la table de ses références. */
export function construireEntreeP6(e: EntreeP6): {
  entree: string;
  refs: Map<string, RefP6>;
} {
  const refs = new Map<string, RefP6>();
  const valides = e.faits.filter((f) => f.statut === "valide" && dansLePerimetre(f, e.projet.id));

  const connus = valides.filter(
    (f) => f.type !== "question_ouverte" && !TYPES_INTERDITS_QUESTIONNAIRE.has(f.type),
  );
  const ouvertes = valides.filter((f) => f.type === "question_ouverte" && f.suivi === "ouvert");
  // Les trous sont des NUMÉROS de rubrique du gabarit : on les garde tels quels.
  const trous = e.trous.flatMap((n) => {
    const r = RUBRIQUE_PAR_NUMERO[n];
    return r !== undefined && !RUBRIQUES_INTERDITES_QUESTIONNAIRE.has(r)
      ? [{ numero: n, rubrique: r }]
      : [];
  });

  const lignesConnues = connus.map((f, i) => {
    const ref = `C${String(i + 1).padStart(3, "0")}`;
    refs.set(ref, {
      nature: "connu",
      faitId: f.id,
      enonce: f.enonce,
      ditPar: f.contactLocuteurId ?? null,
    });
    return `${ref} | ${f.type} | ${neutraliser(f.enonce)}`;
  });
  const lignesOuvertes = ouvertes.map((f, i) => {
    const ref = `Q${String(i + 1).padStart(3, "0")}`;
    refs.set(ref, { nature: "question", faitId: f.id });
    return `${ref} | ${neutraliser(f.enonce)}`;
  });
  const lignesTrous = trous.map(({ numero, rubrique }) => {
    const ref = `T${String(numero).padStart(2, "0")}`;
    refs.set(ref, { nature: "trou", rubrique });
    return `${ref} | ${rubrique} | ${libelleRubriqueP6(numero)}`;
  });

  const entree = [
    `<projet>${neutraliser(e.projet.titre)}</projet>`,
    "<deja_connu>",
    ...(lignesConnues.length ? lignesConnues : ["(rien)"]),
    "</deja_connu>",
    "<questions_ouvertes>",
    ...(lignesOuvertes.length ? lignesOuvertes : ["(aucune)"]),
    "</questions_ouvertes>",
    "<rubriques_jamais_abordees>",
    ...(lignesTrous.length ? lignesTrous : ["(aucune)"]),
    "</rubriques_jamais_abordees>",
  ].join("\n");
  return { entree, refs };
}

export type MotifRetrait =
  | "sans_source"
  | "source_inconnue"
  | "deja_connu"
  | "sujet_interdit"
  | "repete_un_collegue"
  | "prix"
  | "adresse"
  | "trop_de_questions";

export interface QuestionRetenue {
  readonly ordre: number;
  readonly texte: string;
  readonly typeVise: FaitType;
  readonly faitSourceId: string | null;
}

export interface BilanQuestionnaire {
  readonly questions: ReadonlyArray<QuestionRetenue>;
  readonly retirees: ReadonlyArray<{ readonly id: string; readonly motif: MotifRetrait }>;
}

/** Le texte d'une question tel qu'il sera copié (choix proposés entre parenthèses). */
function texteDeLaQuestion(q: QuestionnaireV1["questions"][number]): string {
  const choix = q.choix.map((c) => c.trim()).filter(Boolean);
  const base = q.texte.trim();
  return choix.length > 0 ? `${base} (${choix.join(" / ")})` : base;
}

/** Vérifie la sortie de P6 : rend les questions retenues et les motifs de retrait. */
export function verifierQuestionnaire(
  sortie: QuestionnaireV1,
  refs: ReadonlyMap<string, RefP6>,
  /** Le destinataire choisi (G15 : ce qu'IL a dit peut être repris), ou `null`. */
  destinataireId: string | null = null,
): BilanQuestionnaire {
  // G15 (règle commune `repeteUnCollegue`) : les valeurs dites par une AUTRE
  // personne du client ne se reprennent pas, même sans être citées en source.
  const valeursDites = [...refs.values()].flatMap((r) =>
    r.nature === "connu" ? [{ texte: r.enonce, ditParContactId: r.ditPar }] : [],
  );
  const questions: QuestionRetenue[] = [];
  const retirees: Array<{ id: string; motif: MotifRetrait }> = [];
  for (const q of sortie.questions) {
    const retirer = (motif: MotifRetrait): void => void retirees.push({ id: q.id, motif });
    if (q.sources.length === 0) {
      retirer("sans_source");
      continue;
    }
    const sources = q.sources.map((s) => refs.get(s.trim()));
    if (sources.some((s) => s === undefined)) {
      retirer("source_inconnue");
      continue;
    }
    if (sources.some((s) => s?.nature === "connu")) {
      retirer("deja_connu");
      continue;
    }
    const typeVise = TYPE_VISE_PAR_RUBRIQUE[q.rubrique];
    if (typeVise === null || TYPES_INTERDITS_QUESTIONNAIRE.has(typeVise)) {
      retirer("sujet_interdit");
      continue;
    }
    const texte = texteDeLaQuestion(q);
    const toutLeTexte = `${texte} ${q.aide ?? ""}`;
    if (contientUnPrix(toutLeTexte)) {
      retirer("prix");
      continue;
    }
    if (contientUneAdresse(toutLeTexte)) {
      retirer("adresse");
      continue;
    }
    if (repeteUnCollegue(texte, destinataireId ?? "", valeursDites)) {
      retirer("repete_un_collegue");
      continue;
    }
    if (questions.length >= MAX_QUESTIONS) {
      retirer("trop_de_questions");
      continue;
    }
    const question = sources.find((s) => s?.nature === "question");
    questions.push({
      ordre: questions.length + 1,
      texte,
      typeVise,
      faitSourceId: question?.nature === "question" ? question.faitId : null,
    });
  }
  return { questions, retirees };
}

/**
 * Le texte que Will COPIE dans son e-mail : formules fixes du site, questions
 * numérotées. Les questions posées de vive voix n'y figurent pas.
 */
export function texteACopier(
  questions: ReadonlyArray<{ readonly texte: string; readonly poseeDeViveVoix: boolean }>,
): string {
  const aEnvoyer = questions.filter((q) => !q.poseeDeViveVoix);
  return [
    "Bonjour,",
    "",
    "Pour préparer au mieux notre proposition, pourriez-vous répondre aux questions ci-dessous ? Une réponse courte sous chaque question suffit.",
    "",
    ...aEnvoyer.map((q, i) => `${i + 1}. ${q.texte}`),
    "",
    "Merci d'avance, et à bientôt,",
    "Williams Jullin",
  ].join("\n");
}
