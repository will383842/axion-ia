/**
 * Tests de SCÉNARIOS — les propriétés du système de preuve, bout en bout.
 *
 * ## Pourquoi ce fichier existe, alors qu'il y a déjà ~200 specs de signature
 *
 * Les specs existantes vérifient chacune UNE fonction. Elles ne disent rien de
 * ce qui arrive quand on enchaîne les gestes réels d'un dossier : signer,
 * révoquer, re-signer, purger une image, présenter le tout à un auditeur.
 *
 * Or c'est précisément là que vivent les propriétés qui comptent, et elles sont
 * TRANSVERSES : aucune fonction prise isolément ne peut les garantir.
 *
 * ⚠️ Ces tests portent sur le CŒUR CRYPTO, pur et sans Prisma. C'est délibéré :
 * ils décrivent des invariants mathématiques du registre, pas le comportement
 * d'une couche d'accès aux données. Un test qui mocke tout ne prouve rien de la
 * chaîne ; celui-ci la calcule vraiment.
 */

import { describe, it, expect } from "vitest";
import {
  calculerSelfHashDocument,
  maillonDocumentDepuisLigne,
  HASH_VERSION_DOCUMENT,
  type LigneDocumentSignature,
  type PartieSignataire,
  type PieceScellee,
  type TupleDocumentSignatureV1,
} from "./document-signature-hash";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";
import { calculerSelfHash, type TupleSignatureV1 } from "@/server/qualiopi/emargement/hash";
import {
  calculerSelfHashSeance,
  type TupleSeanceSignatureV1,
} from "@/server/qualiopi/coaching-afest/signature/seance-signature-hash";
import { partiesRequisesPour } from "./parties-requises";

const PIECE: PieceScellee = {
  documentNumero: "AXI-DOC-2026-0042",
  documentType: "protocole_afest",
};
const DOC = "11111111-1111-4111-8111-111111111111";

/** Fabrique une ligne de signature cohérente : son `selfHash` est VRAIMENT calculé. */
function signer(
  partie: PartieSignataire,
  nom: string,
  prevHash: string | null,
  over: Partial<LigneDocumentSignature> = {},
): LigneDocumentSignature {
  const base = {
    documentGenereId: DOC,
    provider: "interne" as const,
    providerSubmissionId: null,
    partie,
    signataireNom: nom,
    signataireEmail: `${nom.toLowerCase().replace(/\s/g, ".")}@example.test`,
    signataireQualite: null,
    documentHashSha256: "c".repeat(64),
    methode: "trace" as const,
    signatureSha256: "a".repeat(64),
    mentionVersion: "doc-v1",
    consentementVersion: "doc-consent-v1",
    signeAt: new Date("2026-06-10T10:00:00.000Z"),
    prevHash,
    hashVersion: HASH_VERSION_DOCUMENT,
    ...over,
  };
  const tuple: TupleDocumentSignatureV1 = {
    contexteType: "document_engagement",
    documentGenereId: base.documentGenereId,
    documentNumero: PIECE.documentNumero,
    documentType: PIECE.documentType,
    documentHashSha256: base.documentHashSha256,
    partie: base.partie,
    provider: base.provider,
    providerSubmissionId: base.providerSubmissionId,
    signataireNom: base.signataireNom,
    signataireEmail: base.signataireEmail,
    signataireQualite: base.signataireQualite,
    methode: base.methode,
    signatureSha256: base.signatureSha256,
    mentionVersion: base.mentionVersion,
    consentementVersion: base.consentementVersion,
    signeAtIso: base.signeAt.toISOString(),
    prevHash: base.prevHash,
  };
  return { id: `sig-${partie}-${nom}`, ...base, selfHash: calculerSelfHashDocument(tuple) };
}

/** Vérifie une chaîne dans l'ordre d'insertion, comme le fait le registre. */
function verifier(lignes: LigneDocumentSignature[], piece: PieceScellee = PIECE) {
  return verifierChaine(lignes.map((l) => maillonDocumentDepuisLigne(l, piece)));
}

// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 SCÉNARIO — un protocole AFEST signé par ses TROIS parties", () => {
  // Le circuit réel : organisme → entreprise → bénéficiaire (SSOT).
  const [p1, p2, p3] = partiesRequisesPour("protocole_afest")!;

  const s1 = signer(p1!, "Williams Jullin", null);
  const s2 = signer(p2!, "ACME SAS", s1.selfHash);
  const s3 = signer(p3!, "Camille Durand", s2.selfHash);

  it("la chaîne complète est valide", () => {
    expect(verifier([s1, s2, s3])).toStrictEqual({
      valide: true,
      anomalies: [],
      nbVerifies: 3,
    });
  });

  it("l'ordre du SSOT est bien organisme → entreprise → bénéficiaire", () => {
    // L'organisme signe EN PREMIER ici : c'est lui qui propose le cadrage
    // D.6313-3-1. C'est l'exception documentée à la règle « axionia contresigne ».
    expect([p1, p2, p3]).toStrictEqual(["axionia", "client", "beneficiaire"]);
  });

  it("🔴 retirer le maillon du MILIEU est détecté — c'est tout l'objet de la chaîne", () => {
    // Le scénario que redoute un auditeur : une signature intermédiaire
    // supprimée d'un dossier pour faire disparaître une partie.
    const rapport = verifier([s1, s3]);
    expect(rapport.valide).toBe(false);
    expect(rapport.anomalies.map((a) => a.type)).toContain("rupture_chainage");
  });

  it("🔴 réordonner les signatures est détecté", () => {
    // Présenter le bénéficiaire comme premier signataire changerait le sens du
    // dossier : il aurait accepté avant que l'organisme ne propose.
    const rapport = verifier([s3, s2, s1]);
    expect(rapport.valide).toBe(false);
  });
});

describe("🔴 SCÉNARIO — révoquer puis re-signer, la seule correction possible", () => {
  const s1 = signer("axionia", "Williams Jullin", null);
  const s2 = signer("client", "ACME SAS", s1.selfHash);

  it("après révocation du DERNIER maillon, la chaîne restante reste valide", () => {
    // La relecture filtre `revoked_at IS NULL` : révoquer la queue laisse une
    // chaîne d'un seul maillon, parfaitement cohérente.
    expect(verifier([s1])).toStrictEqual({ valide: true, anomalies: [], nbVerifies: 1 });
  });

  it("🔴 révoquer un maillon INTERNE romprait la chaîne — d'où le refus du service", () => {
    // C'est la justification du refus `revocation_maillon_interne_interdite` :
    // si on retirait `s1`, le `prevHash` de `s2` pointerait dans le vide et le
    // registre paraîtrait FALSIFIÉ sur une correction pourtant légitime.
    const rapport = verifier([s2]);
    expect(rapport.valide).toBe(false);
    expect(rapport.anomalies.map((a) => a.type)).toContain("premier_maillon_chaine");
  });

  it("re-signer après révocation produit une chaîne saine", () => {
    // Le cycle complet : s2 révoquée, une nouvelle signature de la même partie
    // reprend le fil depuis s1. C'est ce que l'index unique PARTIEL autorise.
    const s2bis = signer("client", "ACME SAS", s1.selfHash, {
      signeAt: new Date("2026-06-12T09:00:00.000Z"),
    });
    expect(s2bis.selfHash).not.toBe(s2.selfHash); // horodatage différent → empreinte différente
    expect(verifier([s1, s2bis])).toStrictEqual({ valide: true, anomalies: [], nbVerifies: 2 });
  });
});

describe("🔴 SCÉNARIO — falsifications, une par une", () => {
  const s1 = signer("client", "ACME SAS", null);

  it("changer le NOM du signataire après coup est détecté", () => {
    const falsifie = { ...s1, signataireNom: "AUTRE SAS" };
    expect(verifier([falsifie]).valide).toBe(false);
  });

  it("changer le MONTANT signé — via l'empreinte du PDF — est détecté", () => {
    const falsifie = { ...s1, documentHashSha256: "d".repeat(64) };
    expect(verifier([falsifie]).valide).toBe(false);
  });

  it("🔴 transformer une confirmation accessible en tracé manuscrit est détecté", () => {
    // Falsification de la NATURE de la preuve : sans `methode` dans le tuple,
    // un simple UPDATE ferait passer une confirmation nominative pour une
    // signature manuscrite, et rien ne le verrait.
    const falsifie = { ...s1, methode: "confirmation_accessible" as const };
    expect(verifier([falsifie]).valide).toBe(false);
  });

  it("🔴 fabriquer un certificat de tiers inexistant est détecté", () => {
    // `provider` et `providerSubmissionId` sont scellés : on ne peut pas
    // requalifier après coup une signature maison en signature certifiée.
    const falsifie = { ...s1, provider: "docuseal" as const, providerSubmissionId: "sub_inv" };
    expect(verifier([falsifie]).valide).toBe(false);
  });

  it("🔴 RENUMÉROTER la pièce invalide ses signatures — et c'est le bon verdict", () => {
    // Le numéro est scellé mais porté par `DocumentGenere`. Une renumérotation
    // après signature EST une altération de ce qui a été signé.
    const rapport = verifier([s1], { ...PIECE, documentNumero: "AXI-DOC-2026-9999" });
    expect(rapport.valide).toBe(false);
    expect(rapport.anomalies[0]?.type).toBe("empreinte_invalide");
  });

  it("changer le TYPE de la pièce est détecté", () => {
    expect(verifier([s1], { ...PIECE, documentType: "convention" }).valide).toBe(false);
  });
});

describe("🔴 SCÉNARIO — purge RGPD : l'effacement ne casse AUCUNE preuve", () => {
  it("effacer ipHash, userAgent et la clé R2 laisse la chaîne intacte", () => {
    // C'est LA propriété qui a coûté un bug au flux collectif : là-bas ces
    // colonnes SONT scellées, si bien que toute demande d'article 17 faisait
    // rendre `empreinte_invalide` sur des pièces intactes — le verdict « ces
    // feuilles ont été modifiées après coup », dans un dossier de contrôle.
    const s1 = signer("client", "ACME SAS", null);

    // Ces champs n'existent même pas sur la ligne scellée : leur absence du
    // tuple est structurelle, pas une convention qu'on pourrait oublier.
    expect(Object.keys(s1)).not.toContain("ipHash");
    expect(Object.keys(s1)).not.toContain("signatureKey");

    expect(verifier([s1]).valide).toBe(true);
  });

  it("🔴 en revanche, effacer le NOM du signataire casse la preuve — et c'est voulu", () => {
    // `signataireNom` est le cœur de l'art. 1366 : une signature sans signataire
    // identifié ne prouve rien. Il est donc acté NON EFFAÇABLE, et la mitigation
    // offerte est la purge de l'IMAGE seule.
    const s1 = signer("client", "ACME SAS", null);
    expect(verifier([{ ...s1, signataireNom: "" }]).valide).toBe(false);
  });
});

describe("🔴 SCÉNARIO — les trois familles de preuve ne se confondent jamais", () => {
  it("un même contenu produit TROIS empreintes différentes selon le registre", () => {
    // Collectif, AFEST et document partagent le cœur crypto mais ont chacun
    // leur tuple et leur discriminant. Deux tuples de forme différente qui
    // produiraient la même empreinte seraient une collision exploitable — et
    // une simple copie de fichier suffirait à l'introduire.
    const commun = {
      signataireNom: "Camille Durand",
      signataireEmail: "camille@example.test",
      signeAtIso: "2026-06-10T10:15:30.123Z",
      prevHash: null,
      mentionVersion: "v1",
    };

    const collectif: TupleSignatureV1 = {
      contexteType: "collectif",
      enrollmentId: DOC,
      creneauId: "22222222-2222-4222-8222-222222222222",
      coachingId: null,
      date: "2026-06-10",
      demiJournee: "matin",
      heureDebut: "09:00",
      heureFin: "12:30",
      formationIntitule: "Bien démarrer avec l'IA",
      modules: ["Module 1"],
      formateurNom: "Williams Jullin",
      methode: "canvas",
      signatureSha256: "a".repeat(64),
      ipHash: "0123456789abcdef",
      userAgentSha256: "b".repeat(64),
      ...commun,
    };

    const seance: TupleSeanceSignatureV1 = {
      contexteType: "afest_seance",
      coachingId: DOC,
      compteRenduSeanceId: "33333333-3333-4333-8333-333333333333",
      role: "beneficiaire",
      seanceDate: "2026-06-10",
      heureDebut: "09:00",
      heureFin: "12:30",
      formationIntitule: "Bien démarrer avec l'IA",
      modules: ["Module 1"],
      formateurNom: "Williams Jullin",
      methode: "trace",
      signatureSha256: "a".repeat(64),
      ...commun,
    };

    const document: TupleDocumentSignatureV1 = {
      contexteType: "document_engagement",
      documentGenereId: DOC,
      documentNumero: PIECE.documentNumero,
      documentType: PIECE.documentType,
      documentHashSha256: "c".repeat(64),
      partie: "beneficiaire",
      provider: "interne",
      providerSubmissionId: null,
      signataireQualite: null,
      methode: "trace",
      signatureSha256: "a".repeat(64),
      consentementVersion: "doc-consent-v1",
      ...commun,
    };

    const empreintes = new Set([
      calculerSelfHash(collectif),
      calculerSelfHashSeance(seance),
      calculerSelfHashDocument(document),
    ]);
    expect(empreintes.size).toBe(3);
  });
});

describe("🔴 SCÉNARIO — le SSOT couvre les activités contractuelles d'Axion-IA", () => {
  it("les pièces contractuelles déclarent toutes un circuit", () => {
    // Un type de pièce sans circuit ne peut PAS être signé : le service refuse
    // une liste de parties vide. Ce test empêche qu'on ajoute un type de pièce
    // contractuelle en oubliant de le déclarer.
    for (const type of [
      "devis",
      "convention",
      "convention_tripartite",
      "contrat",
      "contrat_sous_traitance",
      "protocole_afest",
      "lettre_mission",
      "releve_connexion",
    ] as const) {
      const parties = partiesRequisesPour(type);
      expect(parties, `circuit manquant pour ${type}`).not.toBeNull();
      expect(parties!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("🔴 les pièces ÉMISES n'ont pas de circuit — et ne doivent pas en avoir", () => {
    // Une attestation, un certificat ou une facture sont des pièces émises
    // unilatéralement, pas des engagements négociés. Leur donner un circuit
    // ferait apparaître des « signatures manquantes » sur des dossiers sains.
    for (const type of [
      "attestation",
      "certificat_realisation",
      "facture",
      "convocation",
      "emargement",
    ] as const) {
      expect(partiesRequisesPour(type), `circuit inattendu sur ${type}`).toBeNull();
    }
  });
});
