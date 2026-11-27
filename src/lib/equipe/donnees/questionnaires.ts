/**
 * Questionnaires v1 des fiches collaborateurs : questions communes + questions propres à chaque catégorie,
 * et schémas Zod stricts (longueurs bornées, aucun HTML, URL https seulement, LinkedIn limité à linkedin.com).
 *
 * Une version publiée n'est jamais modifiée : on ajoute `v2`. Chaque question dit si elle compte pour la
 * règle d'indexation (`indexabilite`), pour que la personne sache pourquoi la remplir.
 * Aucune question ne demande de montant, de commission, de prix, de nom de famille ni d'adresse.
 */
import { z } from "zod";
import type { TeamCategory } from "./categories";

export const QUESTIONNAIRE_VERSION_COURANTE = "v1";

export type QuestionIndexabilite = "exemple" | "parcours";

export interface Question {
  readonly id: string;
  readonly libelle: string;
  readonly obligatoire: boolean;
  readonly max: number;
  /** Phrase de terrain : citée mot pour mot, jamais réécrite. */
  readonly terrain?: boolean;
  /** Compte pour l'élément « exemple concret » ou « parcours » de la règle d'indexation. */
  readonly indexabilite?: QuestionIndexabilite;
}

const q = (
  id: string,
  libelle: string,
  obligatoire: boolean,
  options: Partial<Pick<Question, "max" | "terrain" | "indexabilite">> = {},
): Question => ({ id, libelle, obligatoire, max: options.max ?? 600, ...options });

export const QUESTIONS_COMMUNES_V1 = {
  presentationMin: 300,
  presentationMax: 800,
  libelles: {
    prenom: "Votre prénom, tel que vous voulez le voir affiché",
    lieu: "Votre ville ou votre département (jamais d'adresse)",
    intitule: "Votre rôle en une phrase simple",
    presentation: "Présentez-vous (300 à 800 caractères)",
    apport: "Ce que vous apportez concrètement aux dirigeants, avec un exemple",
    langues: "Langues parlées",
    linkedin: "Votre profil LinkedIn (facultatif)",
    souhaitCarte: "Je souhaite apparaître sur la carte",
  },
} as const;

const QUESTIONS_CATEGORIE_V1: Record<TeamCategory, readonly Question[]> = {
  direction: [
    q("perimetre", "Votre périmètre de responsabilité", true),
    q("parcours_etapes", "Votre parcours en trois étapes clés", true, { indexabilite: "parcours" }),
    q("decisions_clients", "Les décisions que vous prenez pour les clients", true, {
      indexabilite: "exemple",
    }),
    q("chemin_ia", "Ce qui vous a amené à l'IA", false),
  ],
  apporteur: [
    q(
      "metier_precedent",
      "Le métier que vous exercez ou avez exercé avant (secteur, durée)",
      true,
      {
        indexabilite: "parcours",
      },
    ),
    q(
      "entreprises_connues",
      "Les types d'entreprises que vous connaissez le mieux (secteurs, tailles)",
      true,
    ),
    q("pourquoi_axion", "Pourquoi présentez-vous Axion IA aux dirigeants ?", true),
    q("premier_echange", "Comment se passe un premier échange avec vous, concrètement ?", true, {
      indexabilite: "exemple",
    }),
    q("promesse", "Ce que vous promettez à un dirigeant que vous rencontrez", true),
    q(
      "terrain_phrase",
      "Quelle phrase entendez-vous le plus souvent chez les dirigeants quand vous parlez d'IA ?",
      false,
      {
        terrain: true,
      },
    ),
    q(
      "terrain_temps_perdu",
      "Quelle tâche voyez-vous le plus souvent faire perdre du temps aux entreprises ?",
      false,
      {
        terrain: true,
      },
    ),
    q(
      "terrain_comprendre",
      "Qu'aimeriez-vous qu'un dirigeant comprenne en une phrase sur l'IA ?",
      false,
      {
        terrain: true,
      },
    ),
    q(
      "reseaux",
      "Associations, clubs ou réseaux d'entreprises dont vous faites partie (facultatif)",
      false,
    ),
  ],
  developpeur: [
    q(
      "construit",
      "Ce que vous construisez pour les entreprises clientes, en mots de tous les jours",
      true,
    ),
    q(
      "technologies",
      "Les technologies que vous maîtrisez vraiment (langages, outils d'IA, bases de données)",
      true,
    ),
    q("experiences", "Vos expériences avant Axion IA (postes, durées)", false, {
      indexabilite: "parcours",
    }),
    q(
      "diplomes",
      "Diplômes et certifications réellement obtenus (intitulé, organisme, année)",
      false,
      {
        indexabilite: "parcours",
      },
    ),
    q(
      "protection_donnees",
      "Comment vous protégez les données d'une entreprise quand vous travaillez sur ses outils",
      true,
    ),
    q("projet_fier", "Un type de projet dont vous êtes fier, sans nom de client", true, {
      indexabilite: "exemple",
    }),
    q(
      "expliquer",
      "Comment vous expliquez votre travail à un dirigeant qui n'est pas technicien",
      false,
    ),
    q(
      "terrain_erreur",
      "L'erreur la plus fréquente quand une entreprise installe un outil d'IA",
      false,
      {
        terrain: true,
      },
    ),
    q(
      "terrain_surmesure",
      "Ce qu'un outil sur mesure change par rapport à un logiciel acheté sur étagère",
      false,
      {
        terrain: true,
      },
    ),
    q(
      "terrain_automatiser",
      "La tâche que vous automatiseriez en premier dans n'importe quelle PME, et pourquoi",
      false,
      {
        terrain: true,
      },
    ),
    q("publications", "Articles, conférences ou projets publics (liens, facultatif)", false),
  ],
  specialiste_ia: [
    q("formations", "Les formations ou accompagnements que vous animez (intitulés simples)", true),
    q("secteurs", "Les métiers et secteurs que vous connaissez le mieux", true),
    q("parcours", "Votre parcours avant Axion IA (postes, durées, secteurs)", false, {
      indexabilite: "parcours",
    }),
    q(
      "diplomes",
      "Diplômes, certifications ou attestations réellement obtenus (intitulé, organisme, année)",
      false,
      {
        indexabilite: "parcours",
      },
    ),
    q("deroule_seance", "Comment se déroule une séance avec vous, du début à la fin", true, {
      indexabilite: "exemple",
    }),
    q(
      "dossiers_participants",
      "Comment vous faites travailler les participants sur leurs propres dossiers",
      false,
    ),
    q("apres_seance", "Ce qu'un participant sait faire en sortant, dès le lendemain", false),
    q("rassurer", "Comment vous rassurez quelqu'un qui a peur de l'IA", false),
    q("terrain_question", "La question qu'on vous pose le plus souvent en formation", false, {
      terrain: true,
    }),
    q(
      "terrain_compris",
      "Le moment où vous voyez qu'une équipe a compris : que se passe-t-il ?",
      false,
      {
        terrain: true,
      },
    ),
    q(
      "terrain_conseil",
      "Le conseil que vous donneriez à un dirigeant qui veut former ses équipes à l'IA",
      false,
      {
        terrain: true,
      },
    ),
  ],
  partenaire: [
    q(
      "structure",
      "Votre structure et son métier en une phrase (le nom n'est affiché qu'avec votre accord)",
      true,
    ),
    q("apport", "Ce que vous apportez de complémentaire aux missions d'Axion IA", true),
    q(
      "collaboration",
      "Depuis quand et comment vous travaillez avec l'équipe Axion IA (qui fait quoi)",
      true,
    ),
    q("secteurs", "Les secteurs ou types d'entreprises que vous connaissez le mieux", false),
    q(
      "references",
      "Vos références publiques ou certifications réellement obtenues (facultatif)",
      false,
      {
        indexabilite: "parcours",
      },
    ),
    q(
      "donnees_clients",
      "Avez-vous accès aux données des entreprises clientes ? Si oui, avec quelles protections ?",
      true,
    ),
    q("interlocuteur", "Qui est l'interlocuteur du client pendant une mission commune ?", false),
    q(
      "terrain_probleme",
      "Le problème que vous résolvez le plus souvent pour les entreprises",
      true,
      {
        indexabilite: "exemple",
      },
    ),
    q(
      "terrain_reussite",
      "Ce qui fait réussir un projet d'IA dans une PME, selon votre expérience",
      false,
      {
        terrain: true,
      },
    ),
    q("terrain_hesitation", "Ce que vous diriez à un dirigeant qui hésite à se lancer", false, {
      terrain: true,
    }),
  ],
  autres: [],
};

export interface Questionnaire {
  readonly version: string;
  readonly categorie: TeamCategory;
  readonly questions: readonly Question[];
}

function questionnairesV1(categorie: TeamCategory): Record<string, Questionnaire> {
  return { v1: { version: "v1", categorie, questions: QUESTIONS_CATEGORIE_V1[categorie] } };
}

export const QUESTIONNAIRES: Record<TeamCategory, Record<string, Questionnaire>> = {
  direction: questionnairesV1("direction"),
  apporteur: questionnairesV1("apporteur"),
  developpeur: questionnairesV1("developpeur"),
  specialiste_ia: questionnairesV1("specialiste_ia"),
  partenaire: questionnairesV1("partenaire"),
  autres: questionnairesV1("autres"),
};

/** Le questionnaire d'une catégorie et d'une version, ou `null` si la version est inconnue. */
export function getQuestionnaire(categorie: TeamCategory, version: string): Questionnaire | null {
  return QUESTIONNAIRES[categorie]?.[version] ?? null;
}

// ─── Schémas Zod ────────────────────────────────────────────────────────────────

/** Texte brut : pas de balise HTML, pas de caractère de contrôle (sauf retour à la ligne). */
const SANS_HTML = /^[^<>]*$/;
const SANS_CONTROLE = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/;

function texte(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .regex(SANS_HTML, "Pas de balise HTML")
    .regex(SANS_CONTROLE, "Caractère non autorisé");
}

function urlHttps(domaine?: string) {
  return z
    .string()
    .trim()
    .max(512)
    .refine((v) => {
      try {
        const u = new URL(v);
        if (u.protocol !== "https:" || u.username !== "" || u.password !== "") return false;
        if (domaine === undefined) return true;
        return u.hostname === domaine || u.hostname.endsWith(`.${domaine}`);
      } catch {
        return false;
      }
    }, "Adresse https valide requise");
}

const PRENOM = /^[\p{L}][\p{L}' -]*$/u;

export const schemaCommunV1 = z
  .object({
    prenom: texte(1, 80).regex(PRENOM, "Prénom seul, sans chiffre"),
    lieu: texte(1, 120),
    intitule: texte(1, 120),
    presentation: texte(
      QUESTIONS_COMMUNES_V1.presentationMin,
      QUESTIONS_COMMUNES_V1.presentationMax,
    ),
    apport: texte(1, 800),
    langues: z.array(texte(1, 40)).max(8).default([]),
    linkedin: urlHttps("linkedin.com").optional(),
    souhaitCarte: z.boolean().default(false),
  })
  .strict();

/** Les trois accords sont séparés. Sans accord de publication, il n'y a pas de réponse à enregistrer. */
export const schemaConsentementsV1 = z
  .object({
    publication: z.literal(true),
    photo: z.boolean(),
    linkedin: z.boolean(),
  })
  .strict();

function schemaCategorie(questions: readonly Question[]) {
  const forme: Record<string, z.ZodTypeAny> = {};
  for (const question of questions) {
    forme[question.id] = question.obligatoire
      ? texte(1, question.max)
      : texte(0, question.max).optional();
  }
  return z.object(forme).strict();
}

/** Schéma complet d'une réponse, ou `null` si la catégorie ou la version est inconnue. */
export function schemaReponse(categorie: TeamCategory, version: string) {
  const questionnaire = getQuestionnaire(categorie, version);
  if (questionnaire === null) return null;
  return z
    .object({
      commun: schemaCommunV1,
      categorie: schemaCategorie(questionnaire.questions),
      consentements: schemaConsentementsV1,
    })
    .strict();
}
