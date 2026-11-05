/**
 * Fixture de test : une offre FICTIVE (montants inventés). Hors production —
 * aucun fichier de code ne l'importe.
 */
import type { OffreDevisV1 } from "./offre-devis";

export function offreFictive(): OffreDevisV1 {
  return {
    v: 1,
    client: "professionnel",
    formulesProposees: ["achat", "abonnement"],
    automatisations: [
      {
        code: "auto1",
        libelle: "Automatisation un",
        facultative: true,
        dependDe: [],
        prixHtCents: 5000,
        tauxTvaBps: 2000,
        modeIA: "client_direct",
      },
    ],
    achat: {
      lignes: [
        { libelle: "Ligne A", quantite: 1, prixHtCents: 100000, tauxTvaBps: 2000 },
        { libelle: "Ligne B", quantite: 2, prixHtCents: 10000, tauxTvaBps: 2500 },
      ],
      phases: [{ rang: 1, libelle: "Solde", pourcentage: 100, declencheur: "signature" }],
      hebergement: "client",
      maintenance: {
        regle: "facultative",
        moisOfferts: 0,
        mensuelHtCents: 4000,
        periodesMois: [1, 12],
      },
    },
    abonnement: {
      miseEnServiceLignes: [
        { libelle: "Mise en service", quantite: 1, prixHtCents: 30000, tauxTvaBps: 2000 },
      ],
      phases: [{ rang: 1, libelle: "Solde", pourcentage: 100, declencheur: "signature" }],
      mensuelCatalogueHtCents: 9000,
      tauxTvaBps: 2000,
      terme: "a_echoir",
      modeAvance: "premiere_periode_seulement",
      periodes: [{ mois: 1, remiseBps: 0 }],
      engagementMois: 12,
      reconduction: "mensuelle",
      preavisMois: 1,
      indemniteSortieTauxBps: 5000,
    },
    servicesTiers: [],
    plafondAConfirmer: null,
    garantie: { jours: 30 },
    textes: [],
  };
}
