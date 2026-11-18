/**
 * Factures types partagées par les tests de la facture v1 (archive) et v2 (charte 2027).
 * Données de test uniquement : aucun montant de production.
 */
import type { FactureData } from "../facture";
import type { OrganismeIdentite } from "../../organisme";

export const IDENTITE_FACTURE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84421234567",
  qualiopi: "",
  siret: "12345678901234",
  siren: "123456789",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://www.axion-ia.com",
  formeJuridique: "SAS",
  capitalSocial: "10 000 €",
  rcsVille: "Saint-Étienne",
  tvaIntracom: "FR12123456789",
};

const BASE: FactureData = {
  numero: "AXI-FACT-2026-014",
  dateEmission: "05/11/2026",
  dateEcheance: "05/12/2026",
  periodePrestation: "du 02/11/2026 au 03/11/2026",
  identite: IDENTITE_FACTURE,
  client: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client, 75008 Paris",
    email: "compta@invest-sun.example",
  },
  lignes: [{ designation: "Atelier IA — 2 jours", quantite: 1, prixUnitaireHtCents: 280000 }],
  regimeTva: "assujetti",
  tauxTvaStandardPercent: 20,
};

export const CAS_FACTURE: ReadonlyArray<readonly [string, FactureData]> = [
  ["une ligne, TVA 20 %", BASE],
  [
    "plusieurs taux de TVA (20 %, 5,5 %, 10 %) avec RIB",
    {
      ...BASE,
      numero: "AXI-FACT-2026-015",
      lignes: [
        { designation: "Atelier", quantite: 1, prixUnitaireHtCents: 100000, tauxTvaPercent: 20 },
        { designation: "Support", quantite: 3, prixUnitaireHtCents: 5000, tauxTvaPercent: 5.5 },
        { designation: "Livre", quantite: 2, prixUnitaireHtCents: 2000, tauxTvaPercent: 10 },
      ],
      rib: {
        iban: "FR76 3000 6000 0112 3456 7890 189",
        bic: "AGRIFRPP",
        titulaire: "Axion-IA SAS",
        banque: "Banque test",
      },
    },
  ],
  [
    "remise (ligne négative) et référence client",
    {
      ...BASE,
      numero: "AXI-FACT-2026-016",
      refClient: "BC-2026-77",
      lignes: [
        { designation: "Audit de maturité IA", quantite: 2, prixUnitaireHtCents: 90000 },
        { designation: "Remise commerciale 10 %", quantite: 1, prixUnitaireHtCents: -18000 },
      ],
    },
  ],
  [
    "avoir sur facture (montants négatifs)",
    {
      ...BASE,
      numero: "AXI-AVOIR-2026-002",
      estAvoir: true,
      avoirSurNumero: "AXI-FACT-2026-014",
      motifAvoir: "Annulation d'une journée",
      lignes: [
        { designation: "Atelier IA — 1 jour annulé", quantite: 1, prixUnitaireHtCents: -140000 },
      ],
    },
  ],
  [
    "exonération de TVA (régime 261) avec subrogation OPCO",
    {
      ...BASE,
      numero: "AXI-FACT-2026-017",
      regimeTva: "exoneration_261",
      lignes: [{ designation: "Formation IA — 3 jours", quantite: 3, prixUnitaireHtCents: 120000 }],
      subrogationOpco: { nomOpco: "OPCO Test", numeroDossier: "DOS-12345" },
    },
  ],
  [
    "particulier (sans mentions entre professionnels), copie",
    {
      ...BASE,
      numero: "AXI-FACT-2026-018",
      estCopie: true,
      client: {
        raisonSociale: "Jeanne Martin",
        adresse: "3 rue des Lilas, 42100 Saint-Étienne",
        estPersonnePhysique: true,
      },
      lignes: [{ designation: "Formation IA — 1 jour", quantite: 1, prixUnitaireHtCents: 95000 }],
    },
  ],
  [
    "arrondi limite : 3 × 3,33 € à 20 %",
    {
      ...BASE,
      numero: "AXI-FACT-2026-019",
      lignes: [{ designation: "Fascicule", quantite: 3, prixUnitaireHtCents: 333 }],
    },
  ],
];
