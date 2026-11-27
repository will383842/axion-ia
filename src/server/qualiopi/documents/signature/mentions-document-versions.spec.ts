// @vitest-environment node

/**
 * Mentions affichées au signataire : « doc-v1 » reste intact, « doc-v2 » corrige l'accord
 * (« du devis n° … établi par … », « de la convention … établie par … »).
 *
 * ## Pourquoi c'est sûr
 *
 * Le TEXTE affiché n'est stocké nulle part : seule sa version (`mentionVersion`) est scellée,
 * dans le tuple haché. La vérification d'une signature lit la version portée par LA LIGNE, jamais
 * la constante courante. Les goldens ci-dessous ont été relevés sur `main` AVANT la retouche : le
 * texte « doc-v1 » est conservé mot pour mot (y compris l'accord fautif sur un nom masculin),
 * pour qu'on puisse toujours dire CE QU'UNE SIGNATURE « doc-v1 » AVAIT À L'ÉCRAN.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MENTION_VERSION_DOCUMENT,
  mentionAttestationDocument,
  mentionAttestationDocumentV1,
  mentionAttestationDocumentV2,
  mentionCompleteDocument,
} from "./mentions-document";
import {
  calculerSelfHashDocument,
  type PartieSignataire,
  type TupleDocumentSignatureV1,
} from "./document-signature-hash";

const PARTIES: readonly PartieSignataire[] = [
  "client",
  "beneficiaire",
  "financeur",
  "formateur",
  "sous_traitant",
  "tuteur",
  "responsable_pedagogique",
  "axionia",
];

/** Relevé sur `main` (0c8cbdee3), pièce féminine : « convention de formation ». */
const GOLDEN_V1_CONVENTION: Record<string, string> = {
  client:
    "J'ai pris connaissance de la convention de formation n° AXI-DOC-2026-039 établie par Axion-IA SAS et je l'accepte, au nom et pour le compte de la structure que je représente.",
  beneficiaire:
    "J'ai pris connaissance de la convention de formation n° AXI-DOC-2026-039 établie par Axion-IA SAS et je l'accepte.",
  financeur:
    "En qualité de financeur, j'accepte la convention de formation n° AXI-DOC-2026-039 établie par Axion-IA SAS et la prise en charge qu'elle prévoit. Cette acceptation ne vaut pas engagement de suivre l'action de formation.",
  formateur:
    "En qualité de formateur, j'accepte la convention de formation n° AXI-DOC-2026-039 établie par Axion-IA SAS et les missions qu'elle me confie.",
  sous_traitant:
    "En qualité de prestataire, j'accepte la convention de formation n° AXI-DOC-2026-039 établie par Axion-IA SAS et je m'engage à respecter les exigences du référentiel national qualité qu'elle rappelle.",
  tuteur:
    "En qualité de tuteur en entreprise, j'ai pris connaissance de la convention de formation n° AXI-DOC-2026-039 établie par Axion-IA SAS et j'accepte le rôle d'accompagnement qu'elle me confie.",
  responsable_pedagogique:
    "En qualité de responsable pédagogique, j'atteste l'exactitude de la convention de formation n° AXI-DOC-2026-039 établie par Axion-IA SAS.",
  axionia:
    "Pour Axion-IA SAS, j'accepte la convention de formation n° AXI-DOC-2026-039 établie par Axion-IA SAS et je la conclus.",
};

const P_CONVENTION = {
  pieceLibelle: "convention de formation",
  pieceNumero: "AXI-DOC-2026-039",
  organisme: "Axion-IA SAS",
};
const P_DEVIS = {
  pieceLibelle: "devis",
  pieceNumero: "AXI-DEV-2026-014",
  organisme: "Axion-IA SAS",
};

describe("doc-v1 — texte conservé tel quel", () => {
  it("la version courante est doc-v2 ; la v1 reste une fonction à part", () => {
    expect(MENTION_VERSION_DOCUMENT).toBe("doc-v2");
  });

  it.each(PARTIES)("v1 %s : identique au texte relevé avant la retouche", (partie) => {
    expect(mentionAttestationDocumentV1(partie, P_CONVENTION)).toBe(GOLDEN_V1_CONVENTION[partie]);
    expect(mentionAttestationDocument(partie, P_CONVENTION, "doc-v1")).toBe(
      GOLDEN_V1_CONVENTION[partie],
    );
  });

  it("v1 garde l'accord fautif sur un nom masculin (c'est ce qui était à l'écran)", () => {
    expect(mentionAttestationDocumentV1("client", P_DEVIS)).toContain(
      "de la devis n° AXI-DEV-2026-014 établie par Axion-IA SAS",
    );
  });

  it("le bloc complet « doc-v1 » est inchangé (attestation + valeur juridique + canal + consentement + RGPD)", () => {
    const v1 = mentionCompleteDocument("client", P_DEVIS, true, false, "doc-v1");
    expect(v1[0]).toBe(
      "J'ai pris connaissance de la devis n° AXI-DEV-2026-014 établie par Axion-IA SAS et je l'accepte, au nom et pour le compte de la structure que je représente.",
    );
    expect(v1.slice(1)).toEqual(
      mentionCompleteDocument("client", P_DEVIS, true, false, "doc-v2").slice(1),
    );
    expect(v1.slice(1)).toEqual([
      "Cette signature électronique vaut signature au sens de l'article 1366 du Code civil : elle identifie son auteur et garantit l'intégrité de ce qui est signé. Elle est horodatée, scellée par une empreinte cryptographique de la pièce signée, et chaînée à la signature précédente apposée sur cette même pièce.",
      "Cette signature est recueillie et conservée par l'organisme de formation. Elle ne s'accompagne pas d'un certificat délivré par un prestataire de services de confiance : sa force probante repose sur le registre scellé de l'organisme, dont une copie vous est remise sur simple demande.",
      "J'accepte de signer cette pièce par voie électronique.",
      "J'ai pu prendre connaissance de la pièce dans son intégralité avant de signer, et j'en recevrai un exemplaire.",
      "Données enregistrées : votre nom, le cas échéant votre adresse électronique et votre qualité, l'image de votre signature lorsqu'elle est tracée, la date et l'heure exactes, ainsi qu'une empreinte non réversible de votre adresse IP et de votre navigateur.",
      "Seul le tracé de votre signature est conservé, sous forme d'image. Aucune donnée de dynamique de tracé — pression, vitesse, inclinaison — n'est enregistrée ni transmise.",
      "Finalité : établir et conserver la preuve des engagements contractuels de l'action de formation, obligation légale de l'organisme (articles L.6353-1 et L.6362-5 du Code du travail).",
      "Conservation : 5 ans, conformément aux conditions particulières applicables aux organismes de formation.",
      "Vos droits d'accès, de rectification et d'effacement s'exercent auprès de l'organisme. L'effacement ne peut toutefois pas porter sur les éléments nécessaires à la constatation d'un droit en justice (article 17.3.b du RGPD) : votre nom et la pièce signée sont conservés ; l'image de votre signature, votre adresse IP et votre navigateur sont supprimables.",
    ]);
  });
});

describe("doc-v2 — accord correct", () => {
  it("devis (masculin) : « du devis … établi par … »", () => {
    expect(mentionAttestationDocumentV2("client", P_DEVIS)).toBe(
      "J'ai pris connaissance du devis n° AXI-DEV-2026-014 établi par Axion-IA SAS et je l'accepte, au nom et pour le compte de la structure que je représente.",
    );
    expect(mentionAttestationDocumentV2("axionia", P_DEVIS)).toBe(
      "Pour Axion-IA SAS, j'accepte le devis n° AXI-DEV-2026-014 établi par Axion-IA SAS et je le conclus.",
    );
  });

  it("convention (féminin) : « de la convention … établie par … »", () => {
    expect(mentionAttestationDocumentV2("client", P_CONVENTION)).toBe(
      "J'ai pris connaissance de la convention de formation n° AXI-DOC-2026-039 établie par Axion-IA SAS et je l'accepte, au nom et pour le compte de la structure que je représente.",
    );
  });

  it("pour une pièce féminine, la v2 reproduit la v1 mot pour mot (rien n'est réécrit sans nécessité)", () => {
    for (const partie of PARTIES) {
      expect(mentionAttestationDocumentV2(partie, P_CONVENTION), partie).toBe(
        GOLDEN_V1_CONVENTION[partie],
      );
    }
  });

  it("autorisation de captation : « de l'autorisation … établie par … »", () => {
    const t = mentionAttestationDocumentV2("beneficiaire", {
      pieceLibelle: "autorisation de captation",
      pieceNumero: "AXI-DOC-2026-050",
      organisme: "Axion-IA SAS",
    });
    expect(t).toBe(
      "J'ai pris connaissance de l'autorisation de captation n° AXI-DOC-2026-050 établie par Axion-IA SAS et je l'accepte.",
    );
  });

  it.each([
    ["relevé de connexion", "du relevé de connexion n° X établi par"],
    ["contrat de travail", "du contrat de travail n° X établi par"],
    ["contrat de formation", "du contrat de formation n° X établi par"],
    ["lettre de mission", "de la lettre de mission n° X établie par"],
  ])("%s", (libelle, attendu) => {
    const t = mentionAttestationDocumentV2("client", {
      pieceLibelle: libelle,
      pieceNumero: "X",
      organisme: "O",
    });
    expect(t).toContain(attendu);
  });

  it("aucune pièce signable ne produit plus « de la » devant un nom masculin", () => {
    for (const libelle of ["devis", "relevé de connexion", "contrat de travail"]) {
      for (const partie of PARTIES) {
        const t = mentionAttestationDocumentV2(partie, {
          pieceLibelle: libelle,
          pieceNumero: "X",
          organisme: "O",
        });
        expect(t, `${libelle}/${partie}`).not.toMatch(new RegExp(`la ${libelle}`));
        expect(t, `${libelle}/${partie}`).not.toMatch(/établie par/);
      }
    }
  });

  it("libellé inconnu : repli sur le texte de la v1 plutôt qu'un texte inventé", () => {
    const t = mentionAttestationDocumentV2("client", {
      pieceLibelle: "pièce inconnue",
      pieceNumero: "X",
      organisme: "O",
    });
    expect(t).toBe(
      mentionAttestationDocumentV1("client", {
        pieceLibelle: "pièce inconnue",
        pieceNumero: "X",
        organisme: "O",
      }),
    );
  });

  it("la valeur par défaut est la version courante", () => {
    expect(mentionAttestationDocument("client", P_DEVIS)).toBe(
      mentionAttestationDocumentV2("client", P_DEVIS),
    );
    expect(mentionCompleteDocument("client", P_DEVIS, true)[0]).toContain("du devis n°");
  });
});

describe("une signature « doc-v1 » existante se revérifie à l'identique", () => {
  const tuple: TupleDocumentSignatureV1 = {
    contexteType: "document_engagement",
    documentGenereId: "11111111-1111-4111-8111-111111111111",
    documentNumero: "AXI-CONV-2026-0042",
    documentType: "convention",
    documentHashSha256: "c".repeat(64),
    partie: "client",
    provider: "interne",
    providerSubmissionId: null,
    signataireNom: "Camille Durand",
    signataireEmail: "camille@example.test",
    signataireQualite: "Directrice des ressources humaines",
    methode: "trace",
    signatureSha256: "a".repeat(64),
    mentionVersion: "doc-v1",
    consentementVersion: "doc-consent-v1",
    signeAtIso: "2026-06-10T10:15:30.123Z",
    prevHash: null,
  };

  it("le sceau d'une ligne « doc-v1 » ne dépend pas de la version courante", () => {
    // Même tuple, version lue sur la ligne : le calcul est celui d'avant, que la constante
    // courante soit v1 ou v2.
    const a = calculerSelfHashDocument(tuple, 1);
    const b = calculerSelfHashDocument({ ...tuple, mentionVersion: "doc-v1" }, 1);
    expect(a).toBe(b);
    expect(calculerSelfHashDocument({ ...tuple, mentionVersion: "doc-v2" }, 1)).not.toBe(a);
  });

  it("ni le calcul du sceau ni la reconstruction n'importent le module des mentions", () => {
    for (const f of ["document-signature-hash.ts", "document-reconstruction.ts"]) {
      const src = readFileSync(
        join(process.cwd(), "src/server/qualiopi/documents/signature", f),
        "utf8",
      );
      expect(src, f).not.toMatch(/from "\.\/mentions-document"/);
      expect(src, f).not.toContain("MENTION_VERSION_DOCUMENT");
    }
  });

  it("seul le service de signature pose la version courante, sur les NOUVELLES lignes", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/qualiopi/documents/signature/document-signature-service.ts"),
      "utf8",
    );
    // Lot I3 (D1) : la version est choisie UNE fois, selon le canal (papier : version papier
    // imposée), puis posée dans le tuple scellé et dans la ligne écrite.
    expect(
      src.match(
        /const mentionVersion = papier\s+\? MENTION_VERSION_PAPIER\s+: \(input\.mentionVersion \?\? MENTION_VERSION_DOCUMENT\);/g,
      )?.length,
    ).toBe(1);
    expect(src.match(/^\s+mentionVersion,$/gm)?.length).toBe(2);
  });
});
