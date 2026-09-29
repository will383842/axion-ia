/**
 * Schémas de sortie des passes P2 à P6, de la lecture des réponses et de
 * l'e-mail de suivi (`compte-rendu-et-extraction.md` §5.3 à §5.7 ; ADR 0055).
 *
 * Mêmes règles que `extraction.ts` : tout requis, `null` explicite, aucune
 * borne (le code contrôle), JSON Schema figé.
 */

import { z } from "zod";

import { activite, confiance, paragraphe, RUBRIQUES_COUVERTURE, statutRubrique } from "./communs";

// ── P2 — rattachement ────────────────────────────────────────────────────────

export const rattachementV1 = z.object({
  decisions: z.array(
    z.object({
      projet_evoque_ref: z.string(),
      decision: z.enum(["projet_existant", "nouveau_projet", "pas_un_projet", "incertain"]),
      projet_connu_ref: z.string().nullable(),
      titre_propose: z.string().nullable(),
      activite_proposee: activite.nullable(),
      faits_refs: z.array(z.string()),
      confiance,
      explication: z.string(),
    }),
  ),
  projet_principal_ref: z.string().nullable(),
  portees_a_corriger: z.array(
    z.object({
      fait_ref: z.string(),
      portee_proposee: z.enum(["entreprise", "projet"]),
      projet_evoque_ref: z.string().nullable(),
      explication: z.string(),
    }),
  ),
});
export type RattachementV1 = z.infer<typeof rattachementV1>;

// ── P3 — consolidation ───────────────────────────────────────────────────────

export const consolidationV1 = z.object({
  relations: z.array(
    z.object({
      fait_du_jour_ref: z.string(),
      relation: z.enum(["nouveau", "confirme", "precise", "change", "contredit", "remet_en_cause"]),
      fait_existant_ref: z.string().nullable(),
      plus_recent_ref: z.string().nullable(),
      explication: z.string(),
    }),
  ),
  ce_qui_a_change: z.array(paragraphe),
});
export type ConsolidationV1 = z.infer<typeof consolidationV1>;

// ── P4 — ébauche de devis (SANS prix : G14) ──────────────────────────────────

export const ebaucheV1 = z.object({
  lignes: z.array(
    z.object({
      ref_catalogue: z.string(),
      quantite: z.number().int(),
      unite: z.enum(["groupes", "jours", "mois", "sessions", "forfait", "personnes"]),
      faits_refs: z.array(z.string()),
      justification: z.string(),
    }),
  ),
  sans_reference: z.array(z.string()),
  activite: activite.nullable(),
  financement_suggere: z.enum(["direct", "opco", "france_travail"]).nullable(),
  nb_participants: z.number().int().nullable(),
  duree_heures: z.number().nullable(),
  modalite_opco: z.enum(["intra", "inter_presentiel", "inter_distanciel"]).nullable(),
  ref_client: z.string().nullable(),
  hypotheses: z.array(z.string()),
  alternatives: z.array(z.string()),
  manquant_pour_chiffrer: z.array(z.string()),
  personnalisation_formation: z
    .object({
      niveau: z.enum(["debutant", "intermediaire", "avance", "tous_niveaux"]).nullable(),
      prerequis: z.string().nullable(),
      secteur_cible: z.string().nullable(),
      outils_client: z.string().nullable(),
      faits_refs: z.array(z.string()),
    })
    .nullable(),
});
export type EbaucheV1 = z.infer<typeof ebaucheV1>;

// ── P5 — compte rendu ────────────────────────────────────────────────────────

const rubriqueRedigee = z.object({ statut: statutRubrique, paragraphes: z.array(paragraphe) });

export const compteRenduV1 = z.object({
  en_bref: z.array(paragraphe),
  ce_qui_a_change: z.array(paragraphe),
  rubriques: z.object(
    Object.fromEntries(RUBRIQUES_COUVERTURE.map((r) => [r, rubriqueRedigee])) as Record<
      (typeof RUBRIQUES_COUVERTURE)[number],
      typeof rubriqueRedigee
    >,
  ),
  besoins_detectes: z.array(
    z.object({ hypothese: z.string(), question: z.string(), faits_refs: z.array(z.string()) }),
  ),
  prochaine_etape_texte: paragraphe,
});
export type CompteRenduV1 = z.infer<typeof compteRenduV1>;

// ── P6 — questionnaire de cadrage (PR 7) ─────────────────────────────────────

export const questionnaireV1 = z.object({
  introduction: z.string(),
  questions: z.array(
    z.object({
      id: z.string(),
      texte: z.string(),
      type_reponse: z.enum([
        "oui_non",
        "choix_unique",
        "choix_multiple",
        "nombre",
        "date",
        "texte_court",
        "texte_long",
      ]),
      choix: z.array(z.string()),
      aide: z.string().nullable(),
      facultative: z.boolean(),
      rubrique: z.enum(RUBRIQUES_COUVERTURE),
      sources: z.array(z.string()),
      utilite_pour_williams: z.string(),
    }),
  ),
  conclusion: z.string(),
});
export type QuestionnaireV1 = z.infer<typeof questionnaireV1>;

// ── Lecture des réponses collées par Will (PR 7) ─────────────────────────────

export const lectureReponsesV1 = z.object({
  reponses: z.array(
    z.object({
      question_id: z.string(),
      reponse_citee: z.string(),
      valeur_texte: z.string().nullable(),
      valeur_nombre: z.number().nullable(),
      valeur_date: z.string().nullable(),
      confiance,
    }),
  ),
  questions_sans_reponse: z.array(z.string()),
});
export type LectureReponsesV1 = z.infer<typeof lectureReponsesV1>;

// ── E-mail de suivi (PR 7) ───────────────────────────────────────────────────

export const emailSuiviV1 = z.object({
  objet: z.string(),
  paragraphes: z.array(paragraphe),
  formule_de_fin: z.string(),
});
export type EmailSuiviV1 = z.infer<typeof emailSuiviV1>;
