/**
 * Les 7 SORTIES PIÉGÉES de la CI (`compte-rendu-et-extraction.md` §6.8) :
 * des sorties d'extraction écrites à la main, fautives, que la vérification
 * (V1) doit TOUTES rejeter — chacune avec le BON motif. Scénario fictif
 * « Menuiserie ».
 */

import type { FaitExtrait } from "@/server/visio/schemas/extraction";
import { FAITS, fait } from "../../scenario-menuiserie";

export interface Piege {
  readonly nom: string;
  readonly fait: FaitExtrait;
  readonly motif: string;
}

const base = FAITS[0]!;

export const PIEGES: readonly Piege[] = [
  {
    nom: "citation reformulée (« 12 » au lieu de « douze »)",
    fait: {
      ...base,
      preuves: [{ segment_ids: ["S0004"], citation: "On serait 12 commerciaux à former" }],
    },
    motif: "citation_introuvable",
  },
  {
    nom: "citation de deux mots",
    fait: { ...base, preuves: [{ segment_ids: ["S0004"], citation: "douze commerciaux" }] },
    motif: "citation_trop_courte",
  },
  {
    nom: "preuve tirée de l'historique",
    fait: {
      ...base,
      preuves: [{ segment_ids: ["H001"], citation: "On serait douze commerciaux à former" }],
    },
    motif: "preuve_historique",
  },
  {
    nom: "segments non consécutifs",
    fait: {
      ...base,
      preuves: [
        { segment_ids: ["S0004", "S0009"], citation: "On serait douze commerciaux à former" },
      ],
    },
    motif: "segment_inconnu",
  },
  {
    nom: "budget dit par Williams",
    fait: fait({
      ref: "F01",
      type: "budget",
      enonce: "Budget.",
      locuteur_declare: "axion",
      preuves: [{ segment_ids: ["S0005"], citation: "Et côté budget, vous aviez une idée" }],
    }),
    motif: "locuteur_non_admis",
  },
  {
    nom: "montant absent de la citation",
    fait: {
      ...FAITS[1]!,
      ref: "F01",
      valeur: { ...FAITS[1]!.valeur, montant_min_cents: 450000, montant_max_cents: 450000 },
    },
    motif: "valeur_non_prouvee",
  },
  {
    nom: "décideur déduit",
    fait: fait({
      ref: "F01",
      type: "decideur",
      enonce: "La gérante décide.",
      certitude: "deduit",
      preuves: [{ segment_ids: ["S0004"], citation: "On serait douze commerciaux à former" }],
    }),
    motif: "deduction_interdite",
  },
];
