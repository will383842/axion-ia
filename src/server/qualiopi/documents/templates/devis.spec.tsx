/**
 * Tests CONTENU + RENDU — devis (CRM).
 *
 * Comme facture.spec.tsx : la PRÉSENCE des mentions est vérifiée via
 * l'extraction de texte de l'arbre React (collect-pdf-text), plus un test de
 * rendu binaire (%PDF) — timeout généreux, @react-pdf/renderer est lent.
 */

import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { DevisPdf } from "./devis";
import type { DevisData } from "./devis";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "../organisme";

// Filet de sécurité polices PDF (fallback built-in si vraies polices absentes).
beforeAll(() => {
  registerPdfTestFontsFallback();
});

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

function makeDevis(overrides: Partial<DevisData> = {}): DevisData {
  return {
    numero: "AXI-DEV-2026-001",
    dateEmission: "06/06/2026",
    dateValidite: "06/07/2026",
    refClient: "BC-2026-042",
    identite: IDENTITE,
    client: {
      raisonSociale: "Acme SAS",
      siret: "98765432100011",
      adresse: "10 avenue des Champs, 75008 Paris",
      email: "achats@acme.fr",
    },
    lignes: [
      { designation: "Formation IA appliquée — 2 jours", quantite: 1, prixUnitaireHtCents: 280000 },
    ],
    regimeTva: "exoneration_261",
    ...overrides,
  };
}

function devisText(data: DevisData): string {
  return collectPdfTextNormalized(React.createElement(DevisPdf, { data }));
}

describe("DevisPdf — rendu binaire", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    const result = await renderPdfToBuffer(React.createElement(DevisPdf, { data: makeDevis() }));
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.byteLength).toBeGreaterThan(100);
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
  }, 30_000);
});

describe("DevisPdf — mentions obligatoires", () => {
  const text = devisText(makeDevis());

  it("affiche l'identité + l'adresse du siège de l'émetteur", () => {
    expect(text).toContain("Axion-IA SAS");
    expect(text).toContain("1 rue de la Paix, 75001 Paris");
  });

  it("affiche SIRET et NDA de l'organisme", () => {
    expect(text).toContain("12345678901234");
    expect(text).toContain("84691234567");
  });

  it("affiche le n° de devis, la date d'émission, la validité et la réf client", () => {
    expect(text).toContain("AXI-DEV-2026-001");
    expect(text).toContain("06/06/2026");
    expect(text).toContain("06/07/2026");
    expect(text).toContain("BC-2026-042");
  });

  it("porte la mention « Devis gratuit, valable jusqu'au … »", () => {
    expect(text).toContain("Devis gratuit, valable jusqu'au 06/07/2026");
  });

  it("porte la mention d'exonération TVA (régime exoneration_261)", () => {
    expect(text).toContain(LEGAL_MENTIONS.factureExonerationTva);
  });

  it("porte le bloc signature « Bon pour accord », avec identité et date à remplir", () => {
    // ⚠️ Ce test portait sur les libellés EXACTS de l'ancien bloc au stylo
    // (« Nom et fonction du signataire », « Date : », « Signature : »). La
    // bascule du 2026-07-30 vers `SignatureZone` les a remplacés — mais il avait
    // raison sur le FOND, et il a rattrapé une vraie régression : la première
    // version de la zone avait perdu l'emplacement de DATE.
    //
    // 🔴 Sur une pièce contractuelle, la date n'est pas décorative : c'est elle
    // qui prouve QUAND l'engagement a été pris, et l'art. L.6353-1 exige que la
    // convention soit conclue AVANT le début de l'action. Le test vérifie donc
    // désormais la SUBSTANCE — le chemin papier reste intégralement praticable —
    // plutôt que la formulation.
    expect(text).toContain("Bon pour accord");
    // Les deux parties du circuit (SSOT `parties-requises.ts`), l'organisme
    // concluant en dernier.
    expect(text).toContain("Pour le client");
    expect(text).toContain("Pour l'organisme");
    // De quoi dater et signer à la main.
    expect(text).toContain("Fait à");
    expect(text).toMatch(/Nom, qualité, signature/);
    // Tant que rien n'est signé, la zone invite à signer — elle n'affirme pas
    // qu'une signature existe.
    expect(text).toContain("Lu et approuvé");
  });

  it("🔴 n'affirme AUCUNE signature tant qu'aucune preuve n'existe", () => {
    // Le défaut que ce chantier retire partout : une case « signé » posée sans
    // signataire, sans image et sans empreinte, pendant que le PDF rend
    // « signé ». Un devis non signé ne doit porter ni horodatage ni empreinte.
    expect(text).not.toContain("Signé le");
    expect(text).not.toContain("Empreinte :");
  });
});

describe("DevisPdf — totaux TVA mixte (formation 0 % + conseil 20 %)", () => {
  const text = devisText(
    makeDevis({
      regimeTva: "exoneration_261",
      lignes: [
        { designation: "Formation IA — 2 jours", quantite: 1, prixUnitaireHtCents: 200000 },
        {
          designation: "Audit IA (conseil)",
          quantite: 1,
          prixUnitaireHtCents: 100000,
          tauxTvaPercent: 20,
        },
      ],
    }),
  );

  it("ventile les 2 taux (0 % et 20 %)", () => {
    expect(text).toContain("0 %");
    expect(text).toContain("20 %");
  });

  it("totalise HT 3 000, TVA 200 et TTC 3 200", () => {
    expect(text.replace(/ | /g, " ")).toContain("3 000,00"); // Total HT
    expect(text.replace(/ | /g, " ")).toContain("200,00"); // TVA 20 % sur 1 000
    expect(text.replace(/ | /g, " ")).toContain("3 200,00"); // Total TTC
  });
});

describe("DevisPdf — estimation de financement", () => {
  it("affiche prise en charge OPCO + reste à charge quand présents", () => {
    const text = devisText(
      makeDevis({
        financementSuggere: "OPCO",
        montantOpcoEstimeCents: 150000,
        resteAChargeCents: 130000,
      }),
    );
    expect(text).toContain("Estimation de financement");
    expect(text.replace(/ | /g, " ")).toContain("1 500,00");
    expect(text.replace(/ | /g, " ")).toContain("1 300,00");
    expect(text).toContain("non contractuelle");
  });

  it("masque le bloc estimation quand aucun montant n'est fourni", () => {
    const text = devisText(makeDevis());
    expect(text).not.toContain("Estimation de financement");
  });
});

describe("DevisPdf — identifiants émetteur manquants signalés (jamais masqués)", () => {
  it("SIRET vide → « Non renseigné » apparaît au lieu de disparaître", () => {
    const text = devisText(makeDevis({ identite: { ...IDENTITE, siret: "" } }));
    expect(text).toContain("Non renseigné");
    expect(text).toContain("SIRET de l'organisme");
  });
});

describe("🔴 DevisPdf — le devis SIGNÉ porte la preuve, sous les totaux", () => {
  // C'est la raison d'être de la bascule du 2026-07-30 : le client doit signer
  // LA PIÈCE QU'IL LIT. Avant, il recevait ce PDF détaillé par e-mail et signait
  // dans DocuSeal un document séparé à trois champs, qui ne désignait pas son
  // objet. Ces tests garantissent que la preuve atterrit bien SUR ce document.
  const text = devisText(
    makeDevis({
      signatures: {
        client: {
          signataireNom: "Camille Durand",
          signataireQualite: "Directrice des ressources humaines",
          signeAtLisible: "30/07/2026 à 14:32 (heure de Paris)",
          empreinte: "f".repeat(64),
          methode: "trace",
          imageSrc: "data:image/png;base64,AAAA",
        },
      },
    }),
  );

  it("rend l'identité FIGÉE du signataire, sa qualité et l'horodatage", () => {
    expect(text).toContain("Camille Durand");
    expect(text).toContain("Directrice des ressources humaines");
    expect(text).toContain("Signé le 30/07/2026 à 14:32 (heure de Paris)");
  });

  it("🔴 affiche l'empreinte EN ENTIER — une empreinte tronquée ne se vérifie pas", () => {
    expect(text).toContain(`Empreinte : ${"f".repeat(64)}`);
  });

  it("retire l'invitation à signer de la partie qui a signé", () => {
    // Laisser « Lu et approuvé » sous une signature apposée ferait cohabiter une
    // preuve et un cadre vide sur la même partie.
    expect(text).toContain("Pour le client");
    expect(text).not.toContain("Fait à");
  });

  it("⚠️ laisse le cadre de l'organisme OUVERT tant qu'il n'a pas contresigné", () => {
    // Le devis n'est pas conclu par la seule signature du client : le SSOT
    // déclare deux parties, et le PDF ne doit pas laisser croire l'inverse.
    expect(text).toContain("Pour l'organisme");
    expect(text).toContain("Lu et approuvé");
  });
});

describe("🔴 DevisPdf — le PARAMÈTRE `signatures` doit rester CONSOMMÉ", () => {
  // Ce test existe à cause d'un défaut réel, trouvé en vérification E2E le
  // 2026-07-30 : `devis.tsx` avait été câblé pour rendre une preuve, et AUCUN
  // producteur ne lui en passait jamais. Le paramètre était mort, la signature
  // n'existait qu'en base, et le PDF remis au client montrait des cadres vides.
  //
  // Un test sur le rendu ne l'aurait pas vu — il passe une preuve à la main.
  // Celui-ci vérifie l'inverse : que la sortie DIFFÈRE selon qu'on en passe une.
  // Si quelqu'un retire le branchement, deux rendus deviennent identiques et ce
  // test tombe.
  it("le rendu diffère RÉELLEMENT selon qu'une preuve est fournie", () => {
    const sans = devisText(makeDevis());
    const avec = devisText(
      makeDevis({
        signatures: {
          client: {
            signataireNom: "Camille Durand",
            signeAtLisible: "30/07/2026 14:32",
            empreinte: "b".repeat(64),
            methode: "trace",
            imageSrc: "data:image/png;base64,AAAA",
          },
        },
      }),
    );
    expect(avec).not.toStrictEqual(sans);
    expect(avec).toContain("Camille Durand");
    expect(sans).not.toContain("Camille Durand");
  });

  it("rend une image PURGÉE (art. 17) pour ce qu'elle est, pas comme un blanc", () => {
    // Un blanc silencieux se lirait « pas signé », et transformerait un droit
    // exercé en apparence de manquement.
    const text = devisText(
      makeDevis({
        signatures: {
          client: {
            signataireNom: "Camille Durand",
            signeAtLisible: "30/07/2026 14:32",
            empreinte: "c".repeat(64),
            methode: "trace",
            imageSrc: null,
            imagePurgee: true,
          },
        },
      }),
    );
    expect(text).toContain("supprimée à la demande du signataire");
    expect(text).toContain("reste établie");
  });
});
