/**
 * Tests — document-signature-hash.ts
 *
 * Trois familles d'invariants, et les violer ne se voit pas en revue de diff :
 *
 *  1. **La forme canonique est FIGÉE.** Le vecteur d'or ci-dessous ne se « met
 *     pas à jour » : s'il tombe, une empreinte déjà émise vient de devenir
 *     irrecalculable. La bonne réaction est de restaurer le sérialiseur et de
 *     bumper `HASH_VERSION_DOCUMENT`, pas de recopier la nouvelle valeur.
 *  2. **Chaque champ scellé compte.** Un champ qu'on croit haché et qui ne l'est
 *     pas est une porte de falsification silencieuse — on le vérifie champ par
 *     champ plutôt que de faire confiance à la lecture du sérialiseur.
 *  3. **`ipHash` et `userAgentSha256` sont HORS tuple**, et doivent le rester :
 *     c'est ce qui rend l'effacement RGPD possible sans faire rendre
 *     `empreinte_invalide` à des pièces intactes.
 */

import { describe, it, expect } from "vitest";
import {
  tupleDocumentCanonique,
  calculerSelfHashDocument,
  maillonDocumentDepuisLigne,
  tupleDocumentDepuisLigne,
  versionDocumentRecalculable,
  HASH_VERSION_DOCUMENT,
  type LigneDocumentSignature,
  type PieceScellee,
  type TupleDocumentSignatureV1,
  type TupleDocumentSignatureV2,
} from "./document-signature-hash";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";

const DOC = "11111111-1111-4111-8111-111111111111";

const TUPLE: TupleDocumentSignatureV1 = {
  contexteType: "document_engagement",
  documentGenereId: DOC,
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

const PIECE: PieceScellee = {
  documentNumero: "AXI-CONV-2026-0042",
  documentType: "convention",
};

function ligne(over: Partial<LigneDocumentSignature> = {}): LigneDocumentSignature {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    documentGenereId: DOC,
    provider: "interne",
    providerSubmissionId: null,
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@example.test",
    signataireQualite: "Directrice des ressources humaines",
    documentHashSha256: "c".repeat(64),
    methode: "trace",
    signatureSha256: "a".repeat(64),
    mentionVersion: "doc-v1",
    consentementVersion: "doc-consent-v1",
    signeAt: new Date("2026-06-10T10:15:30.123Z"),
    prevHash: null,
    selfHash: calculerSelfHashDocument(TUPLE, 1),
    // Preuve de VERSION 1 : celles qui existent déjà et ne seront jamais réécrites.
    hashVersion: 1,
    facteurVerification: null,
    ...over,
  };
}

describe("forme canonique", () => {
  it("🔴 la forme canonique V1 est FIGÉE — clés triées, RFC 8785", () => {
    expect(tupleDocumentCanonique(TUPLE, 1)).toBe(
      '{"consentementVersion":"doc-consent-v1","contexteType":"document_engagement","documentGenereId":"11111111-1111-4111-8111-111111111111","documentHashSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","documentNumero":"AXI-CONV-2026-0042","documentType":"convention","mentionVersion":"doc-v1","methode":"trace","partie":"client","prevHash":null,"provider":"interne","providerSubmissionId":null,"signataireEmail":"camille@example.test","signataireNom":"Camille Durand","signataireQualite":"Directrice des ressources humaines","signatureSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","signeAt":"2026-06-10T10:15:30.123Z","v":1}',
    );
  });

  it("🔴 le vecteur d'or de l'empreinte est FIGÉ", () => {
    expect(calculerSelfHashDocument(TUPLE, 1)).toBe(
      "63898b6d0b0e4f2023f85efbaef1e1254bc5fb8cd17048b1af277ef63977af2e",
    );
  });

  it("refuse une version de tuple inconnue plutôt que de hacher n'importe quoi", () => {
    expect(() => tupleDocumentCanonique(TUPLE, 99)).toThrow(/Version de tuple inconnue/);
    expect(versionDocumentRecalculable(99)).toBe(false);
    expect(versionDocumentRecalculable(1)).toBe(true);
  });
});

describe("🔴 chaque champ scellé change réellement l'empreinte", () => {
  // Une liste, pas dix-sept tests copiés : le jour où le tuple gagne un champ,
  // l'ajouter ici coûte une ligne — et l'oublier se voit.
  const VARIANTES: Array<[string, Partial<TupleDocumentSignatureV1>]> = [
    ["documentGenereId", { documentGenereId: "99999999-9999-4999-8999-999999999999" }],
    ["documentNumero", { documentNumero: "AXI-CONV-2026-0043" }],
    ["documentType", { documentType: "contrat" }],
    ["documentHashSha256", { documentHashSha256: "d".repeat(64) }],
    ["partie", { partie: "financeur" }],
    ["provider", { provider: "docuseal" }],
    ["providerSubmissionId", { providerSubmissionId: "sub_1" }],
    ["signataireNom", { signataireNom: "Camille Durant" }],
    ["signataireEmail", { signataireEmail: "autre@example.test" }],
    ["signataireQualite", { signataireQualite: "Gérante" }],
    ["methode", { methode: "confirmation_accessible" }],
    ["signatureSha256", { signatureSha256: "b".repeat(64) }],
    ["mentionVersion", { mentionVersion: "doc-v2" }],
    ["consentementVersion", { consentementVersion: "doc-consent-v2" }],
    ["signeAtIso", { signeAtIso: "2026-06-10T10:15:30.124Z" }],
    ["prevHash", { prevHash: "e".repeat(64) }],
  ];

  const reference = calculerSelfHashDocument(TUPLE, 1);

  it.each(VARIANTES)("modifier %s change l'empreinte", (_champ, patch) => {
    expect(calculerSelfHashDocument({ ...TUPLE, ...patch }, 1)).not.toBe(reference);
  });

  it("🔴 `null` et absence ne se confondent pas", () => {
    // Un e-mail nul et un e-mail vide sont deux faits différents ; les
    // canonicaliser pareil permettrait de passer de l'un à l'autre sans trace.
    expect(calculerSelfHashDocument({ ...TUPLE, signataireEmail: null }, 1)).not.toBe(
      calculerSelfHashDocument({ ...TUPLE, signataireEmail: "" }, 1),
    );
  });
});

describe("reconstruction depuis la ligne", () => {
  it("recalcule à l'identique le tuple d'origine", () => {
    expect(tupleDocumentDepuisLigne(ligne(), PIECE)).toStrictEqual(TUPLE);
  });

  it("🔴 `ipHash` et `userAgentSha256` n'entrent PAS dans le tuple", () => {
    // C'est LA propriété qui rend l'effacement RGPD possible. Côté collectif ces
    // colonnes sont scellées, et leur mise à `null` faisait rendre
    // `empreinte_invalide` à chaque signature du stagiaire — « ces pièces ont
    // été modifiées après coup », sur des pièces intactes.
    const reconstruit = tupleDocumentDepuisLigne(ligne(), PIECE);
    expect(Object.keys(reconstruit ?? {})).not.toContain("ipHash");
    expect(Object.keys(reconstruit ?? {})).not.toContain("userAgentSha256");
  });

  it("🔴 `signatureKey` non plus — la purge de l'image ne doit rien invalider", () => {
    expect(Object.keys(tupleDocumentDepuisLigne(ligne(), PIECE) ?? {})).not.toContain(
      "signatureKey",
    );
  });

  it("rend `null` — donc `tuple_irrecalculable` — sur une version inconnue", () => {
    expect(tupleDocumentDepuisLigne(ligne({ hashVersion: 99 }), PIECE)).toBeNull();
  });

  it("🔴 renuméroter une pièce déjà signée INVALIDE son empreinte", () => {
    // Verdict VOULU : le numéro est scellé, et une renumérotation après signature
    // est une altération de ce qui a été signé. Ne pas « réparer » en cherchant
    // l'ancien numéro — il n'existe nulle part, et c'est le point.
    const rapport = verifierChaine([
      maillonDocumentDepuisLigne(ligne(), { ...PIECE, documentNumero: "AXI-CONV-2026-9999" }),
    ]);
    expect(rapport.valide).toBe(false);
    expect(rapport.anomalies[0]?.type).toBe("empreinte_invalide");
  });
});

describe("chaînage", () => {
  it("valide une chaîne de deux parties sur la même pièce", () => {
    const premiere = ligne();
    const tupleSecond: TupleDocumentSignatureV1 = {
      ...TUPLE,
      partie: "axionia",
      signataireNom: "Williams Jullin",
      signataireEmail: "w@axion.test",
      signataireQualite: null,
      prevHash: premiere.selfHash,
    };
    const seconde = ligne({
      id: "33333333-3333-4333-8333-333333333333",
      partie: "axionia",
      signataireNom: "Williams Jullin",
      signataireEmail: "w@axion.test",
      signataireQualite: null,
      prevHash: premiere.selfHash,
      selfHash: calculerSelfHashDocument(tupleSecond, 1),
    });

    const rapport = verifierChaine([
      maillonDocumentDepuisLigne(premiere, PIECE),
      maillonDocumentDepuisLigne(seconde, PIECE),
    ]);
    expect(rapport).toStrictEqual({ valide: true, anomalies: [], nbVerifies: 2 });
  });

  it("🔴 détecte le retrait d'un maillon — `rupture_chainage`", () => {
    // C'est exactement le scénario que la chaîne existe pour voir : une signature
    // intermédiaire supprimée d'un dossier.
    const premiere = ligne();
    const seconde = ligne({
      id: "33333333-3333-4333-8333-333333333333",
      partie: "axionia",
      prevHash: "f".repeat(64),
    });
    const rapport = verifierChaine([
      maillonDocumentDepuisLigne(premiere, PIECE),
      maillonDocumentDepuisLigne(seconde, PIECE),
    ]);
    expect(rapport.valide).toBe(false);
    expect(rapport.anomalies.map((a) => a.type)).toContain("rupture_chainage");
  });
});

describe("🔴 version 2 — le facteur de vérification est scellé (V1-A-7)", () => {
  const TUPLE_V2: TupleDocumentSignatureV2 = {
    ...TUPLE,
    methode: "confirmation_accessible",
    signatureSha256: null,
    consentementVersion: "doc-consent-code-v1",
    facteurVerification: "code_email",
  };

  it("la version courante est 2, et la version 1 reste recalculable", () => {
    expect(HASH_VERSION_DOCUMENT).toBe(2);
    expect(versionDocumentRecalculable(1)).toBe(true);
    expect(versionDocumentRecalculable(2)).toBe(true);
  });

  it("la forme v2 porte `facteurVerification` et `v: 2`", () => {
    const canon = tupleDocumentCanonique(TUPLE_V2);
    expect(canon).toContain('"facteurVerification":"code_email"');
    expect(canon).toContain('"v":2');
  });

  it("modifier le facteur change l'empreinte ; nul et `code_email` ne se confondent pas", () => {
    expect(calculerSelfHashDocument(TUPLE_V2)).not.toBe(
      calculerSelfHashDocument({ ...TUPLE_V2, facteurVerification: null }),
    );
  });

  it("un tuple v2 SANS facteur ne se hache pas (absent n'est pas nul)", () => {
    expect(() => calculerSelfHashDocument(TUPLE)).toThrow(/sans facteurVerification/);
  });

  it("la v1 ignore le facteur : une preuve existante garde son empreinte", () => {
    expect(calculerSelfHashDocument(TUPLE_V2, 1)).toBe(
      calculerSelfHashDocument({ ...TUPLE_V2, facteurVerification: null }, 1),
    );
  });

  it("une ligne v2 se reconstruit et se vérifie, facteur compris", () => {
    const l = ligne({
      methode: "confirmation_accessible",
      signatureSha256: null,
      consentementVersion: "doc-consent-code-v1",
      hashVersion: 2,
      facteurVerification: "code_email",
      selfHash: calculerSelfHashDocument(TUPLE_V2),
    });
    expect(tupleDocumentDepuisLigne(l, PIECE)).toStrictEqual(TUPLE_V2);
    expect(verifierChaine([maillonDocumentDepuisLigne(l, PIECE)]).valide).toBe(true);
    // Le facteur retiré après coup : la preuve le dit.
    const falsifiee = verifierChaine([
      maillonDocumentDepuisLigne({ ...l, facteurVerification: null }, PIECE),
    ]);
    expect(falsifiee.valide).toBe(false);
  });

  it("une ligne v1 qui porte un facteur a été écrite après coup : irrecalculable", () => {
    expect(
      tupleDocumentDepuisLigne(ligne({ facteurVerification: "code_email" }), PIECE),
    ).toBeNull();
  });
});
