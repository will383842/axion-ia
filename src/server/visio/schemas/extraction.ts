/**
 * `extraction.v1` — sortie de P1 (`compte-rendu-et-extraction.md` §3.2).
 *
 * Les identifiants manipulés par l'IA sont COURTS et locaux à l'appel
 * (`S0042` segment du jour, `F07` fait extrait, `P2` personne, `J1` projet
 * évoqué, `H013` fait déjà connu, `C3` contact connu, `PRJ-2` projet connu) :
 * le code SEUL les traduit en identifiants de base. Un identifiant inconnu =
 * rejet (G2).
 */

import { z } from "zod";

import {
  activite,
  confiance,
  preuve,
  RUBRIQUES_COUVERTURE,
  statutRubrique,
  TYPES_FAITS_SCHEMA,
} from "./communs";

export const VERSION_EXTRACTION = 1;

const rubrique = z.object({
  statut: statutRubrique,
  faits_refs: z.array(z.string()),
  remarque: z.string().nullable(),
});

const valeur = z.object({
  montant_min_cents: z.number().int().nullable(),
  montant_max_cents: z.number().int().nullable(),
  base_montant: z.enum(["ht", "ttc", "non_precise"]).nullable(),
  periode_montant: z
    .enum(["total", "par_an", "par_mois", "par_personne", "non_precise"])
    .nullable(),
  date_cible: z.string().nullable(),
  precision_date: z
    .enum(["jour", "semaine", "mois", "trimestre", "annee", "avant_le", "apres_le"])
    .nullable(),
  expression_temporelle: z.string().nullable(),
  quantite: z.number().int().nullable(),
  unite: z
    .enum([
      "personnes",
      "groupes",
      "jours",
      "heures",
      "demi_journees",
      "mois",
      "sessions",
      "salaries",
    ])
    .nullable(),
  ref_catalogue: z.string().nullable(),
  texte_court: z.string().nullable(),
});
export type ValeurExtraite = z.infer<typeof valeur>;

export const faitExtrait = z.object({
  ref: z.string(),
  type: z.enum(TYPES_FAITS_SCHEMA),
  cle: z.string(),
  enonce: z.string(),
  valeur,
  certitude: z.enum(["dit_explicitement", "deduit"]),
  confiance,
  locuteur_declare: z.enum(["client", "axion"]),
  preuves: z.array(preuve),
  confirmation_client: preuve.nullable(),
  portee: z.enum(["entreprise", "projet"]),
  projet_ref: z.string().nullable(),
  personne_sujet_ref: z.string().nullable(),
  ambiguite: z.string().nullable(),
});
export type FaitExtrait = z.infer<typeof faitExtrait>;

const couverture = z.object(
  Object.fromEntries(RUBRIQUES_COUVERTURE.map((r) => [r, rubrique])) as Record<
    (typeof RUBRIQUES_COUVERTURE)[number],
    typeof rubrique
  >,
);

export const extractionV1 = z.object({
  version_schema: z.literal("extraction.v1"),
  nature_echange: z.object({
    nature: z.enum([
      "echange_complet",
      "echange_partiel",
      "echange_interrompu",
      "pas_un_rendez_vous_client",
      "inexploitable",
    ]),
    explication: z.string(),
  }),
  consentement: preuve.nullable(),
  demande_arret_enregistrement: preuve.nullable(),
  participants: z.array(z.object({ etiquette: z.string(), personne_ref: z.string().nullable() })),
  personnes: z.array(
    z.object({
      ref: z.string(),
      nom_dit: z.string().nullable(),
      fonction_dite: z.string().nullable(),
      entreprise_dite: z.string().nullable(),
      presente: z.boolean(),
      contact_connu_ref: z.string().nullable(),
      statut_dit: z.enum(["en_poste", "partie", "arrivee_recemment", "non_precise"]),
      preuves: z.array(preuve),
    }),
  ),
  projets_evoques: z.array(
    z.object({
      ref: z.string(),
      intitule: z.string(),
      activite: activite.nullable(),
      projet_connu_ref: z.string().nullable(),
      preuves: z.array(preuve),
    }),
  ),
  faits: z.array(faitExtrait),
  suivi_du_connu: z.array(
    z.object({
      connu_ref: z.string(),
      statut: z.enum(["tenu", "repondu", "en_cours", "abandonne"]),
      preuve,
    }),
  ),
  couverture,
  passages_ecartes: z.array(
    z.object({
      motif: z.enum(["donnee_sensible", "appreciation_personne", "vie_privee_hors_sujet"]),
      segment_ids: z.array(z.string()),
    }),
  ),
});
export type ExtractionV1 = z.infer<typeof extractionV1>;
