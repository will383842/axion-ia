/**
 * Tests — TOUT template signable rend RÉELLEMENT la preuve qu'on lui passe.
 *
 * ## Pourquoi ce fichier existe
 *
 * 🔴 Défaut trouvé en vérification E2E le 2026-07-30, et il était SYSTÉMIQUE.
 * Le socle `DocumentSignature` (PR 411/413/415) écrivait la preuve en base, et
 * sur les onze templates appelant `SignatureZone`, **AUCUN** ne passait de prop
 * `signature`. `SignatureApposee` n'était atteignable que depuis son propre
 * test : le signataire signait, la preuve entrait au registre, et la pièce qu'on
 * lui remettait affichait encore des cadres vides.
 *
 * ## Ce que ce test garde, et qu'aucun autre ne verrait
 *
 * Un test qui passe une preuve et vérifie qu'elle s'affiche ne détecte PAS le
 * défaut : il suffit de câbler le template pour qu'il passe, même si aucun
 * producteur ne fournit jamais rien. Celui-ci vérifie l'INVERSE — que la sortie
 * DIFFÈRE selon qu'on fournit une preuve ou non. Débrancher un template fait
 * tomber le test correspondant.
 *
 * ⚠️ La liste est EXHAUSTIVE et vérifiée contre le SSOT : un nouveau circuit
 * signable qui oublierait de rendre sa preuve fait échouer le dernier test.
 */

import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import type { PreuveSignature } from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "../organisme";
import { TYPES_SIGNABLES } from "@/server/qualiopi/documents/signature/parties-requises";

import { DevisPdf } from "./devis";
import { ConventionPdf } from "./convention";
import { ConventionTripartitePdf } from "./convention-tripartite";
import { ContratFormationPdf } from "./contrat-formation";
import { ContratSousTraitancePdf } from "./contrat-sous-traitance";
import { ProtocoleAfestPdf } from "./protocole-afest";

beforeAll(() => registerPdfTestFontsFallback());

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

const NOM = "Camille Durand";
const EMPREINTE = "f".repeat(64);

const PREUVE: PreuveSignature = {
  signataireNom: NOM,
  signataireQualite: "Directrice des ressources humaines",
  signeAtLisible: "30/07/2026 14:32",
  empreinte: EMPREINTE,
  methode: "trace",
  imageSrc: "data:image/png;base64,AAAA",
};

/**
 * Un jeu de données MINIMAL par template — assez pour rendre, pas plus.
 *
 * ⚠️ Volontairement pauvre : ce test ne vérifie pas le contenu des pièces (leurs
 * propres specs le font), seulement que la preuve traverse.
 */
const CAS: ReadonlyArray<{
  type: string;
  Composant: ComposantTest;
  /** Partie dont on injecte la preuve. */
  partie: string;
  data: Record<string, unknown>;
  /**
   * 🔴 Quatre templates sur six prennent `identite` en prop SÉPARÉE
   * (`ConventionPdf`, `ConventionTripartitePdf`, `ContratFormationPdf`,
   * `ContratSousTraitancePdf`) ; `DevisPdf` et `ProtocoleAfestPdf` la portent
   * DANS `data`. Les formes de props ne sont pas uniformes — c'est exactement le
   * piège qui a fait planter la première version de ce test, et celui que
   * l'instantané de `generateDocument` doit capturer.
   */
  identiteEnProp?: boolean;
}> = [
  {
    type: "devis",
    Composant: DevisPdf as unknown as ComposantTest,
    partie: "client",
    data: {
      numero: "AXI-DEV-2026-001",
      dateEmission: "06/06/2026",
      dateValidite: "06/07/2026",
      identite: IDENTITE,
      client: { raisonSociale: "Acme SAS" },
      lignes: [{ designation: "Formation", quantite: 1, prixUnitaireHtCents: 280000 }],
      regimeTva: "exoneration_261",
    },
  },
  {
    type: "convention",
    Composant: ConventionPdf as unknown as ComposantTest,
    partie: "client",
    identiteEnProp: true,
    data: {
      numero: "AXI-CONV-2026-001",
      client: {
        raisonSociale: "Acme SAS",
        siret: "98765432100011",
        adresse: "10 av.",
        contact: "Jean",
      },
      intitule: "IA appliquée",
      objectifs: ["Objectif A"],
      publicVise: "Salariés",
      dureeHeures: 14,
      dateDebut: "01/06/2026",
      dateFin: "02/06/2026",
      modalite: "Présentiel",
      lieu: "Paris",
      effectif: 8,
      prixHt: 2900,
      acomptePercent: 30,
      dateConvention: "01/06/2026",
    },
  },
  {
    type: "convention_tripartite",
    Composant: ConventionTripartitePdf as unknown as ComposantTest,
    partie: "client",
    identiteEnProp: true,
    data: {
      numero: "AXI-CONVT-2026-001",
      client: {
        raisonSociale: "Acme SAS",
        siret: "98765432100011",
        adresse: "10 av.",
        contact: "Jean",
      },
      opco: { nom: "OPCO Atlas", numeroPriseEnCharge: "ATLAS-123" },
      intitule: "IA appliquée",
      objectifs: ["Objectif A"],
      publicVise: "Salariés",
      dureeHeures: 14,
      dateDebut: "01/06/2026",
      dateFin: "02/06/2026",
      modalite: "Mixte",
      lieu: "Lyon",
      effectif: 8,
      prixHt: 4200,
      montantPrisEnCharge: 3000,
      resteAChargeClient: 1200,
      dateConvention: "01/06/2026",
    },
  },
  {
    type: "contrat",
    Composant: ContratFormationPdf as unknown as ComposantTest,
    partie: "beneficiaire",
    identiteEnProp: true,
    data: {
      numero: "AXI-CTR-2026-001",
      stagiaire: { nomPrenom: NOM },
      intitule: "IA appliquée",
      objectifs: ["Objectif A"],
      dureeHeures: 14,
      dateDebut: "01/06/2026",
      dateFin: "02/06/2026",
      modalite: "Distanciel",
      lieu: "Distanciel",
      prixNet: 1500,
      dateContrat: "01/06/2026",
    },
  },
  {
    type: "contrat_sous_traitance",
    Composant: ContratSousTraitancePdf as unknown as ComposantTest,
    partie: "sous_traitant",
    identiteEnProp: true,
    data: {
      numero: "AXI-CTRST-2026-001",
      sousTraitant: {
        nom: "Prestataire SARL",
        siret: "11122233344400",
        nda: "44000000044",
        adresse: "5 chemin",
        email: "p@p.fr",
      },
      missions: ["Animer les modules IA."],
      dateDebut: "01/09/2026",
      dateFin: "31/12/2026",
      remuneration: "850 € HT / jour",
      conformiteVerifieeAt: "20/08/2026",
      dateContrat: "25/08/2026",
    },
  },
  {
    type: "protocole_afest",
    Composant: ProtocoleAfestPdf as unknown as ComposantTest,
    partie: "beneficiaire",
    data: {
      numero: "AXI-PROT-2026-001",
      dateEmission: "06/06/2026",
      identite: IDENTITE,
      intitule: "AFEST IA",
      beneficiaire: { nom: "Durand", prenom: "Camille" },
      formateurAfest: { nom: "Jullin Williams" },
      analyseActivite: "Analyse",
      objectifs: ["Objectif A"],
      misesEnSituation: ["Situation A"],
      phasesReflexives: "Débriefs",
      modalitesEvaluation: "Grille",
      dureePrevueHeures: 14,
      dateDebut: "01/06/2026",
      dateFin: "02/06/2026",
    },
  },
];

type ComposantTest = React.ComponentType<{ data: never; identite?: never }>;

function texte(cas: (typeof CAS)[number], data: unknown): string {
  return collectPdfTextNormalized(
    React.createElement(cas.Composant, {
      data: data as never,
      ...(cas.identiteEnProp === true ? { identite: IDENTITE as never } : {}),
    }),
  );
}

describe("🔴 chaque template signable CONSOMME la preuve qu'on lui passe", () => {
  for (const cas of CAS) {
    it(`${cas.type} — le rendu DIFFÈRE selon qu'une preuve est fournie`, () => {
      const sans = texte(cas, cas.data);
      const avec = texte(cas, { ...cas.data, signatures: { [cas.partie]: PREUVE } });

      // 🔴 Le cœur du test : débrancher le template rend ces deux sorties
      // identiques, et c'est exactement le défaut qu'on empêche de revenir.
      expect(avec).not.toStrictEqual(sans);
      expect(avec).toContain("Signé le 30/07/2026 14:32");
      // L'empreinte EN ENTIER : une empreinte tronquée ne se vérifie pas.
      expect(avec).toContain(`Empreinte : ${EMPREINTE}`);
      expect(sans).not.toContain("Empreinte :");
    });
  }

  it("⚠️ une image PURGÉE (art. 17) est dite, jamais laissée en blanc", () => {
    // Un blanc silencieux se lirait « pas signé », et transformerait un droit
    // exercé en apparence de manquement.
    const cas = CAS[1]!;
    const avec = texte(cas, {
      ...cas.data,
      signatures: { [cas.partie]: { ...PREUVE, imageSrc: null, imagePurgee: true } },
    });
    expect(avec).toContain("supprimée à la demande du signataire");
    expect(avec).toContain("reste établie");
  });

  it("🔴 tout circuit signable du SSOT est couvert ici, ou explicitement écarté", () => {
    // Un nouveau circuit qui oublierait de rendre sa preuve reproduirait le
    // défaut systémique. On l'apprend ICI, pas à l'audit.
    //
    // ⚠️ Les deux écartés sont NOMMÉS, pas devinés : leurs templates n'ont pas
    // encore de prop `signatures`, et `exemplaire-signe.ts` les refuse
    // explicitement (`type_non_rendu`) au lieu de rendre un document identique à
    // l'original, qui se lirait « pas signé ».
    const ECARTES = new Set(["releve_connexion", "lettre_mission"]);
    const couverts = new Set(CAS.map((c) => c.type));
    const oublies = [...TYPES_SIGNABLES].filter((t) => !couverts.has(t) && !ECARTES.has(t));
    expect(oublies).toStrictEqual([]);
  });
});
