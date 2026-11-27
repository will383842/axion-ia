/**
 * Tests — mentions de la page publique de signature d'un DEVIS signé par le CLIENT (`devis-v1`).
 *
 * Les textes sont comparés au caractère près : toute retouche = nouvelle version.
 */
import { describe, it, expect } from "vitest";
import {
  CONSENTEMENT_VERSION_DEVIS,
  CONSENTEMENT_VERSION_DEVIS_CODE,
  CONTACT_PAR_DEFAUT,
  MENTION_VERSION_DEVIS,
  consentementVersionDevis,
  estSignatureClientDevis,
  mentionCompleteDevisV1,
} from "./mentions-devis";
import { calculerSelfHashDocument, type TupleDocumentSignatureV3 } from "./document-signature-hash";

const P = {
  numeroDevis: "AXI-DEV-2026-001",
  prestataire: "Axion-IA SAS",
  contact: "contact@axion-ia.com",
};

const ATTESTATION =
  "J'ai pris connaissance du devis n° AXI-DEV-2026-001 établi par Axion-IA SAS et je l'accepte, au nom et pour le compte de la structure que je représente.";
const VALEUR =
  "Vous signez par une signature électronique simple, au sens du règlement (UE) n° 910/2014 dit « eIDAS » et de l'article 1367 du Code civil : ce n'est ni une signature avancée, ni une signature qualifiée. Le devis ainsi signé est un écrit électronique au sens de l'article 1366 du Code civil. La signature est horodatée et liée au devis par une empreinte numérique, qui permet de déceler toute modification ultérieure. La preuve contraire reste possible par tout moyen.";
const QUI =
  "Cette signature est recueillie et conservée par Axion-IA SAS, avec son propre outil, et non par un prestataire de services de confiance qualifié. Sa valeur repose sur les enregistrements que Axion-IA SAS conserve avec la signature.";
const CONSENT_1_SANS_CODE = "J'accepte de signer ce devis par voie électronique.";
const CONSENT_1_AVEC_CODE =
  "J'accepte de signer ce devis par voie électronique, en saisissant le code à usage unique reçu à mon adresse électronique.";
const CONSENT_2 =
  "J'ai pu lire le devis et les conditions générales de vente en entier avant de signer. Je recevrai par courriel un exemplaire du devis signé par les deux parties, dans un format que je peux conserver.";
const RGPD = [
  "Responsable du traitement : Axion-IA SAS, dont l'adresse figure sur le devis, joignable à contact@axion-ia.com.",
  "Données enregistrées : votre nom, votre adresse électronique et votre qualité ; lorsqu'ils vous sont demandés, votre fonction, votre déclaration de pouvoir d'engager la structure et la preuve de la saisie du code à usage unique ; l'image de votre signature lorsqu'elle est tracée ; la date et l'heure de la signature ; une empreinte de votre adresse IP et une empreinte de votre navigateur (votre adresse IP elle-même n'est pas conservée).",
  "Seul le tracé de votre signature est conservé, sous forme d'image : aucune donnée sur la façon de tracer (pression, vitesse, inclinaison) n'est enregistrée.",
  "Finalité : conserver la preuve de la signature du devis et du contrat qu'il forme, et pouvoir la produire en cas de désaccord.",
  "Bases légales : l'intérêt légitime de Axion-IA SAS et de la structure que vous représentez à pouvoir prouver le contrat (article 6.1.f du RGPD) ; le respect des obligations légales de conservation de Axion-IA SAS (article 6.1.c du RGPD).",
  "Destinataires : les personnes habilitées de Axion-IA SAS et ses prestataires techniques (hébergement, envoi des courriels, horodatage), qui n'agissent que sur ses instructions ; leur liste, et les garanties prévues lorsque l'un d'eux est situé hors de l'Union européenne, figurent sur la page « Sous-processeurs » du site. Le service d'horodatage ne reçoit qu'une empreinte numérique, jamais votre nom ni vos coordonnées.",
  "Durée de conservation : pendant le contrat, puis 5 ans, durée de la prescription de droit commun (article 2224 du Code civil et article L.110-4 du Code de commerce) ; jusqu'à 10 ans lorsque le devis signé sert de pièce justificative comptable (article L.123-22 du Code de commerce).",
  "Vous pouvez demander l'accès à ces données, leur rectification, leur effacement ou la limitation de leur traitement, et vous opposer à leur traitement pour des raisons tenant à votre situation particulière, en écrivant à contact@axion-ia.com. L'effacement et l'opposition ne peuvent pas porter sur ce que la loi oblige à conserver ni sur ce qui est nécessaire à la constatation, à l'exercice ou à la défense de droits en justice (articles 17.3, b et e, et 21.1 du RGPD) : votre nom, votre fonction, votre déclaration et le devis signé sont conservés ; l'image de votre signature et les empreintes de votre adresse IP et de votre navigateur peuvent être supprimées sur demande. Vous pouvez adresser une réclamation à la CNIL (www.cnil.fr).",
  "Ces données sont nécessaires pour signer en ligne. Si vous préférez signer sur papier, écrivez-nous à contact@axion-ia.com : nous vous adressons le devis, vous nous le retournez signé par courrier et nous conservons l'original papier.",
];

const MOTS_INTERDITS =
  /qualiopi|\bopco\b|financ|prise en charge|certifi|\bcpf\b|\bformation|organisme|grenoble|code du travail|horodatage qualifi|portabilit|17\.3\.b\b/i;

describe("mentionCompleteDevisV1 — textes au caractère près", () => {
  it("sans code : 14 éléments exacts, dans l'ordre", () => {
    expect(mentionCompleteDevisV1(P, false)).toStrictEqual([
      ATTESTATION,
      VALEUR,
      QUI,
      CONSENT_1_SANS_CODE,
      CONSENT_2,
      ...RGPD,
    ]);
  });

  it("avec code : 14 éléments exacts, seule la phrase 1 du consentement change", () => {
    expect(mentionCompleteDevisV1(P, true)).toStrictEqual([
      ATTESTATION,
      VALEUR,
      QUI,
      CONSENT_1_AVEC_CODE,
      CONSENT_2,
      ...RGPD,
    ]);
  });

  it("`avecCode` ne change QUE l'élément d'index 3", () => {
    const sans = mentionCompleteDevisV1(P, false);
    const avec = mentionCompleteDevisV1(P, true);
    expect(sans).toHaveLength(14);
    expect(avec).toHaveLength(14);
    const differences = sans.flatMap((t, i) => (t === avec[i] ? [] : [i]));
    expect(differences).toStrictEqual([3]);
  });

  it("aucun mot interdit, avec ou sans code", () => {
    expect(mentionCompleteDevisV1(P, false).join("\n")).not.toMatch(MOTS_INTERDITS);
    expect(mentionCompleteDevisV1(P, true).join("\n")).not.toMatch(MOTS_INTERDITS);
  });

  it("« 17.3, b et e » et « information » ne déclenchent pas la liste", () => {
    expect("articles 17.3, b et e").not.toMatch(MOTS_INTERDITS);
    expect("information").not.toMatch(MOTS_INTERDITS);
    expect("17.3.b").toMatch(MOTS_INTERDITS);
  });
});

describe("versions et aiguillage", () => {
  it("les trois chaînes de version tiennent dans VARCHAR(20)", () => {
    expect(MENTION_VERSION_DEVIS).toBe("devis-v1");
    expect(CONSENTEMENT_VERSION_DEVIS).toBe("devis-consent-v1");
    expect(CONSENTEMENT_VERSION_DEVIS_CODE).toBe("devis-consent-c-v1");
    for (const v of [
      MENTION_VERSION_DEVIS,
      CONSENTEMENT_VERSION_DEVIS,
      CONSENTEMENT_VERSION_DEVIS_CODE,
    ]) {
      expect(v.length).toBeLessThanOrEqual(20);
    }
  });

  it("consentementVersionDevis suit la présence du code", () => {
    expect(consentementVersionDevis(false)).toBe("devis-consent-v1");
    expect(consentementVersionDevis(true)).toBe("devis-consent-c-v1");
  });

  it("contact par défaut", () => {
    expect(CONTACT_PAR_DEFAUT).toBe("contact@axion-ia.com");
  });

  it("estSignatureClientDevis : seulement devis + client", () => {
    expect(estSignatureClientDevis("devis", "client")).toBe(true);
    expect(estSignatureClientDevis("devis", "axionia")).toBe(false);
    expect(estSignatureClientDevis("convention", "client")).toBe(false);
  });
});

describe("la version entre dans le sceau", () => {
  it("l'empreinte d'un même tuple diffère entre doc-v2 et devis-v1", () => {
    const base: TupleDocumentSignatureV3 = {
      contexteType: "document_engagement",
      documentGenereId: "11111111-1111-4111-8111-111111111111",
      documentNumero: "AXI-DEV-2026-001",
      documentType: "devis",
      documentHashSha256: "c".repeat(64),
      partie: "client",
      provider: "interne",
      providerSubmissionId: null,
      signataireNom: "Camille Durand",
      signataireEmail: "camille@example.test",
      signataireQualite: "Gérante",
      methode: "trace",
      signatureSha256: "a".repeat(64),
      mentionVersion: "doc-v2",
      consentementVersion: "doc-consent-v1",
      signeAtIso: "2026-11-10T10:00:00.123Z",
      prevHash: null,
      facteurVerification: null,
      cgvVersion: "2026-10-04",
    };
    const ancien = calculerSelfHashDocument(base, 3);
    const nouveau = calculerSelfHashDocument({ ...base, mentionVersion: "devis-v1" }, 3);
    expect(nouveau).not.toBe(ancien);
  });
});
