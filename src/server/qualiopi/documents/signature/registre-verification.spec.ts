/**
 * Tests — registre-verification.ts
 *
 * Ce module ne produit rien d'autre qu'un VERDICT. Un verdict faux est pire
 * qu'une absence de verdict : il est cru. Quatre familles d'invariants, dont
 * aucune ne se voit en revue de diff.
 *
 *  1. **Les vraies chaînes passent, les fausses tombent.** Empreinte altérée,
 *     maillon retiré, version qu'on ne sait plus recalculer — chacun a son
 *     verdict, et ce verdict est celui de `verifierChaine`, pas une réécriture.
 *  2. **Le recoupement PDF.** Une chaîne peut être parfaitement intacte pendant
 *     que le PDF servi n'est plus celui qui a été signé. C'est le trou que ce
 *     module ferme ; s'il se rebouchait, tout le reste continuerait de passer au
 *     vert et personne ne le verrait.
 *  3. **Le cache n'est pas la source.** `statutSignature` est REMONTÉ quand il
 *     diverge, jamais corrigé — et surtout, il ne doit pas crier sur les états
 *     légitimes, sans quoi le registre cesse d'être lu.
 *  4. **LECTURE SEULE.** Aucun `create`/`update`/`delete`, y compris sur une
 *     pièce dont on vient de constater l'anomalie.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    documentSignature: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  calculerSelfHashDocument,
  HASH_VERSION_DOCUMENT,
  type LigneDocumentSignature,
  type PartieSignataire,
  type TupleDocumentSignatureV1,
} from "./document-signature-hash";
import {
  construireRapportPiece,
  listerRegistreSignatures,
  rapportSignatureDocument,
  verifierChaineDocument,
  type PieceAVerifier,
} from "./registre-verification";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: {
    findUnique: Mock;
    findMany: Mock;
    update: Mock;
    create: Mock;
    delete: Mock;
    updateMany: Mock;
  };
  documentSignature: {
    findMany: Mock;
    update: Mock;
    create: Mock;
    delete: Mock;
    updateMany: Mock;
  };
};

const DOC = "11111111-1111-4111-8111-111111111111";
const NUMERO = "AXI-CONV-2026-0042";
/** Empreinte du PDF servi aujourd'hui. */
const PDF = "c".repeat(64);

/* ───────────────────────── Fabrique de chaînes RÉELLES ─────────────────────── */

/**
 * Construit une chaîne dont les empreintes sont VRAIMENT calculées.
 *
 * ⚠️ Point crucial : on n'écrit aucun `selfHash` en dur. Un test qui poserait des
 * empreintes fictives passerait au vert quel que soit le tuple, et ne prouverait
 * donc rien du tout — c'est le test qui a l'air de tester.
 */
function chaine(
  parties: readonly PartieSignataire[],
  options: { pdfParPartie?: Partial<Record<PartieSignataire, string>> } = {},
): LigneDocumentSignature[] {
  const lignes: LigneDocumentSignature[] = [];
  let prevHash: string | null = null;

  parties.forEach((partie, i) => {
    const documentHashSha256 = options.pdfParPartie?.[partie] ?? PDF;
    const signeAt = new Date(Date.UTC(2026, 5, 10, 10, i, 0, 0));
    const tuple: TupleDocumentSignatureV1 = {
      contexteType: "document_engagement",
      documentGenereId: DOC,
      documentNumero: NUMERO,
      documentType: "convention",
      documentHashSha256,
      partie,
      provider: "interne",
      providerSubmissionId: null,
      signataireNom: `Signataire ${partie}`,
      signataireEmail: `${partie}@example.test`,
      signataireQualite: null,
      methode: "trace",
      signatureSha256: "a".repeat(64),
      mentionVersion: "doc-v1",
      consentementVersion: "doc-consent-v1",
      signeAtIso: signeAt.toISOString(),
      prevHash,
    };
    const selfHash = calculerSelfHashDocument(tuple);
    lignes.push({
      id: `sig-${i}`,
      documentGenereId: DOC,
      provider: "interne",
      providerSubmissionId: null,
      partie,
      signataireNom: tuple.signataireNom,
      signataireEmail: tuple.signataireEmail,
      signataireQualite: null,
      documentHashSha256,
      methode: "trace",
      signatureSha256: "a".repeat(64),
      mentionVersion: "doc-v1",
      consentementVersion: "doc-consent-v1",
      signeAt,
      prevHash,
      selfHash,
      hashVersion: HASH_VERSION_DOCUMENT,
    });
    prevHash = selfHash;
  });

  return lignes;
}

function piece(over: Partial<PieceAVerifier> = {}): PieceAVerifier {
  return {
    id: DOC,
    numero: NUMERO,
    type: "convention",
    hashSha256: PDF,
    statutSignature: "signee",
    // Circuit `convention` = ["client", "axionia"].
    signatures: chaine(["client", "axionia"]),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
});

/* ──────────────────────────────── La chaîne ────────────────────────────────── */

describe("construireRapportPiece — intégrité de la chaîne", () => {
  it("déclare intacte une chaîne complète et cohérente", () => {
    const r = construireRapportPiece(piece());

    expect(r.chaine.valide).toBe(true);
    expect(r.chaine.nbVerifies).toBe(2);
    expect(r.anomaliesPiece).toStrictEqual([]);
    expect(r.preuveIntacte).toBe(true);
    expect(r.statutRecalcule).toBe("signee");
    expect(r.partiesManquantes).toStrictEqual([]);
    expect(r.empreinteTete).toBe(r.signataires[1]?.selfHash);
  });

  it("rend rupture_chainage quand un maillon INTERMÉDIAIRE a été retiré", () => {
    // Trois parties (convention tripartite), on supprime celle du milieu : le
    // `prevHash` du troisième pointe alors dans le vide. C'est très exactement
    // la trace qu'une signature a été effacée d'un dossier.
    const lignes = chaine(["client", "financeur", "axionia"]);
    const ampute = [lignes[0]!, lignes[2]!];

    const r = construireRapportPiece(piece({ type: "convention_tripartite", signatures: ampute }));

    expect(r.chaine.valide).toBe(false);
    expect(r.chaine.anomalies.map((a) => a.type)).toContain("rupture_chainage");
    expect(r.preuveIntacte).toBe(false);
  });

  it("rend premier_maillon_chaine quand la TÊTE a été retirée", () => {
    const lignes = chaine(["client", "axionia"]);
    const r = construireRapportPiece(piece({ signatures: [lignes[1]!] }));

    expect(r.chaine.anomalies.map((a) => a.type)).toContain("premier_maillon_chaine");
  });

  it("rend empreinte_invalide quand une colonne scellée a été modifiée après coup", () => {
    // `signataireNom` est dans le tuple : le réécrire sans toucher `selfHash`
    // est la falsification la plus évidente, et c'est celle que le chaînage doit
    // attraper sans aide.
    const lignes = chaine(["client", "axionia"]);
    lignes[0] = { ...lignes[0]!, signataireNom: "Quelqu'un d'autre" };

    const r = construireRapportPiece(piece({ signatures: lignes }));

    expect(r.chaine.valide).toBe(false);
    expect(r.chaine.anomalies.map((a) => a.type)).toContain("empreinte_invalide");
  });

  it("rend empreinte_invalide quand la PIÈCE a été renumérotée après signature", () => {
    // `documentNumero` est haché mais porté par `DocumentGenere`. Le verdict est
    // JUSTE : renuméroter une pièce signée altère ce qui a été signé. ⚠️ Ne
    // jamais « réparer » en cherchant l'ancien numéro — il n'existe nulle part,
    // et c'est le point.
    const r = construireRapportPiece(piece({ numero: "AXI-CONV-2026-9999" }));

    expect(r.chaine.valide).toBe(false);
    expect(r.chaine.anomalies.every((a) => a.type === "empreinte_invalide")).toBe(true);
  });

  it("rend version_inconnue sur un tuple d'une version que ce code ne sait plus recalculer", () => {
    const lignes = chaine(["client"]);
    lignes[0] = { ...lignes[0]!, hashVersion: 99 };

    const r = construireRapportPiece(piece({ signatures: lignes }));

    expect(r.chaine.anomalies.map((a) => a.type)).toStrictEqual(["version_inconnue"]);
    // 🔴 Et surtout : pas d'`empreinte_invalide` en plus. Une version inconnue
    // n'est PAS une falsification constatée, c'est un aveu d'incapacité à
    // conclure. Les confondre ferait accuser un dossier intact.
    expect(r.chaine.anomalies).toHaveLength(1);
  });

  it("ne lève jamais, même sur une chaîne entièrement incohérente", () => {
    const lignes = chaine(["client", "axionia"]);
    lignes[1] = { ...lignes[1]!, prevHash: "f".repeat(64), selfHash: "0".repeat(64) };

    expect(() => construireRapportPiece(piece({ signatures: lignes }))).not.toThrow();
  });

  it("une pièce sans aucune signature vivante est une chaîne vide VALIDE", () => {
    // Distinct de « pièce introuvable » : ici il n'y a rien à contredire.
    const r = construireRapportPiece(piece({ signatures: [], statutSignature: "en_attente" }));

    expect(r.chaine).toStrictEqual({ valide: true, anomalies: [], nbVerifies: 0 });
    expect(r.statutRecalcule).toBe("en_attente");
    expect(r.empreinteTete).toBeNull();
    expect(r.preuveIntacte).toBe(true);
  });
});

/* ───────────────────── Le recoupement PDF (le trou refermé) ─────────────────── */

describe("construireRapportPiece — recoupement PDF scellé vs courant", () => {
  it("détecte un PDF RÉGÉNÉRÉ après signature, sur une chaîne pourtant intacte", () => {
    // 🔴 Le cœur du module. La chaîne est valide — les lignes n'ont pas bougé —
    // et pourtant la signature ne porte plus sur le document servi. Sans ce
    // recoupement, le dossier passait au vert.
    const r = construireRapportPiece(piece({ hashSha256: "d".repeat(64) }));

    expect(r.chaine.valide).toBe(true);
    expect(r.anomaliesPiece.map((a) => a.type)).toStrictEqual([
      "pdf_regenere_apres_signature",
      "pdf_regenere_apres_signature",
    ]);
    expect(r.signataires.every((s) => s.porteSurLePdfCourant)).toBe(false);
    expect(r.preuveIntacte).toBe(false);
  });

  it("nomme la signature concernée quand une SEULE des parties est décrochée", () => {
    const r = construireRapportPiece(
      piece({ signatures: chaine(["client", "axionia"], { pdfParPartie: { axionia: PDF } }) }),
    );
    // `client` a signé PDF, `axionia` aussi → aucune divergence ici.
    expect(r.anomaliesPiece).toStrictEqual([]);

    // Maintenant le client a signé une version antérieure.
    const decroche = construireRapportPiece(
      piece({
        signatures: chaine(["client", "axionia"], { pdfParPartie: { client: "e".repeat(64) } }),
      }),
    );
    const pdfAnomalies = decroche.anomaliesPiece.filter(
      (a) => a.type === "pdf_regenere_apres_signature",
    );
    expect(pdfAnomalies).toHaveLength(1);
    expect(pdfAnomalies[0]?.signatureId).toBe("sig-0");
    expect(decroche.signataires[0]?.porteSurLePdfCourant).toBe(false);
    expect(decroche.signataires[1]?.porteSurLePdfCourant).toBe(true);
  });

  it("signale que les parties n'ont pas signé la MÊME version du document", () => {
    // Distinct du cas précédent : revenir au PDF courant ne réparerait rien, il
    // n'existe aucune version que les deux parties aient acceptée.
    const r = construireRapportPiece(
      piece({
        signatures: chaine(["client", "axionia"], { pdfParPartie: { client: "e".repeat(64) } }),
      }),
    );

    expect(r.anomaliesPiece.map((a) => a.type)).toContain("parties_sur_versions_differentes");
  });
});

/* ───────────────────── Le circuit et le cache de statut ────────────────────── */

describe("construireRapportPiece — circuit et statut", () => {
  it("dit partielle et nomme la partie manquante", () => {
    const r = construireRapportPiece(
      piece({ signatures: chaine(["client"]), statutSignature: "partielle" }),
    );

    expect(r.statutRecalcule).toBe("partielle");
    expect(r.partiesManquantes).toStrictEqual(["axionia"]);
    expect(r.anomaliesPiece).toStrictEqual([]);
  });

  it("REMONTE le cache divergent, et ne le corrige pas", () => {
    // Le cache annonce une convention conclue ; seule la moitié des parties a
    // signé. Aucune écriture ne doit être tentée — l'indice disparaîtrait au
    // moment où on le découvre.
    const r = construireRapportPiece(
      piece({ signatures: chaine(["client"]), statutSignature: "signee" }),
    );

    const div = r.anomaliesPiece.filter((a) => a.type === "statut_cache_divergent");
    expect(div).toHaveLength(1);
    expect(div[0]?.detail).toContain("partielle");
    expect(mockPrisma.documentGenere.update).not.toHaveBeenCalled();
  });

  it("remonte un cache « signee » alors qu'aucune signature vivante ne subsiste", () => {
    const r = construireRapportPiece(piece({ signatures: [], statutSignature: "signee" }));

    expect(r.anomaliesPiece.map((a) => a.type)).toStrictEqual(["statut_cache_divergent"]);
  });

  it("NE crie PAS sur les états légitimes — sans quoi le registre cesse d'être lu", () => {
    // Pièce signable jamais présentée : le défaut du schéma est `non_requise`,
    // et la mise en attente est un acte de workflow, pas un fait de preuve.
    expect(
      construireRapportPiece(piece({ signatures: [], statutSignature: "non_requise" }))
        .anomaliesPiece,
    ).toStrictEqual([]);
    expect(
      construireRapportPiece(piece({ signatures: [], statutSignature: "en_attente" }))
        .anomaliesPiece,
    ).toStrictEqual([]);
    // `refusee` / `expiree` : aucune ligne de signature n'exprime ces états.
    expect(
      construireRapportPiece(piece({ signatures: chaine(["client"]), statutSignature: "refusee" }))
        .anomaliesPiece,
    ).toStrictEqual([]);
    expect(
      construireRapportPiece(piece({ signatures: chaine(["client"]), statutSignature: "expiree" }))
        .anomaliesPiece,
    ).toStrictEqual([]);
  });

  it("signale une signature posée sur une pièce qu'aucun circuit ne déclare signable", () => {
    // `signerDocument` refuse cette insertion : la trouver en base veut dire
    // qu'elle n'est pas passée par le service.
    const r = construireRapportPiece(
      piece({ type: "facture", signatures: chaine(["client"]), statutSignature: "partielle" }),
    );

    expect(r.partiesRequises).toBeNull();
    expect(r.statutRecalcule).toBe("indeterminable");
    expect(r.anomaliesPiece.map((a) => a.type)).toStrictEqual(["signature_sur_piece_non_signable"]);
  });

  it("signale une partie qui n'appartient pas au circuit de la pièce", () => {
    // `financeur` n'est pas au circuit de `convention` (bipartite).
    const r = construireRapportPiece(
      piece({ signatures: chaine(["financeur"]), statutSignature: "partielle" }),
    );

    expect(r.anomaliesPiece.map((a) => a.type)).toContain("partie_hors_circuit");
  });
});

/* ────────────────────────────── Accès base ─────────────────────────────────── */

describe("verifierChaineDocument", () => {
  it("trie sur createdAt puis id, JAMAIS sur signeAt", async () => {
    // 🔴 L'invariant le plus facile à casser et le plus coûteux : `signeAt` peut
    // venir d'un tiers et n'est pas monotone. Un vérificateur qui trierait
    // dessus verrait une rupture sur une chaîne intacte, définitivement.
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      id: DOC,
      numero: NUMERO,
      type: "convention",
      hashSha256: PDF,
      statutSignature: "signee",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      signatures: chaine(["client", "axionia"]),
    });

    const res = await verifierChaineDocument(DOC);

    expect(res).toStrictEqual({ valide: true, anomalies: [], nbVerifies: 2 });
    const args = mockPrisma.documentGenere.findUnique.mock.calls[0]?.[0];
    expect(args.select.signatures.orderBy).toStrictEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(JSON.stringify(args.select.signatures.orderBy)).not.toContain("signeAt");
  });

  it("ne voit que les maillons VIVANTS", async () => {
    // Une révoquée laissée dans la chaîne ferait rendre `rupture_chainage` sur
    // une chaîne saine : le service rechaîne la suite après révocation.
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      id: DOC,
      numero: NUMERO,
      type: "convention",
      hashSha256: PDF,
      statutSignature: "signee",
      createdAt: new Date(),
      signatures: chaine(["client", "axionia"]),
    });

    await verifierChaineDocument(DOC);

    const args = mockPrisma.documentGenere.findUnique.mock.calls[0]?.[0];
    expect(args.select.signatures.where).toStrictEqual({ revokedAt: null });
  });

  it("rend null sur une pièce introuvable — à ne pas confondre avec « valide »", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(null);
    expect(await verifierChaineDocument(DOC)).toBeNull();
  });

  it("rend null au build sans base (stub.invalid) sans interroger Prisma", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await verifierChaineDocument(DOC)).toBeNull();
    expect(mockPrisma.documentGenere.findUnique).not.toHaveBeenCalled();
  });

  it("n'écrit RIEN, même en constatant une chaîne rompue", async () => {
    const lignes = chaine(["client", "axionia"]);
    lignes[1] = { ...lignes[1]!, prevHash: "f".repeat(64) };
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      id: DOC,
      numero: NUMERO,
      type: "convention",
      hashSha256: PDF,
      statutSignature: "signee",
      createdAt: new Date(),
      signatures: lignes,
    });

    const res = await verifierChaineDocument(DOC);

    expect(res?.valide).toBe(false);
    expect(mockPrisma.documentGenere.update).not.toHaveBeenCalled();
    expect(mockPrisma.documentGenere.create).not.toHaveBeenCalled();
    expect(mockPrisma.documentGenere.delete).not.toHaveBeenCalled();
    expect(mockPrisma.documentSignature.update).not.toHaveBeenCalled();
    expect(mockPrisma.documentSignature.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.documentSignature.delete).not.toHaveBeenCalled();
  });
});

describe("rapportSignatureDocument", () => {
  it("repose le createdAt RÉEL, distinct de signeAt — la trace d'une antidatation", () => {
    // Sans ce report, les deux horodatages seraient confondus et l'écart, qui
    // est précisément l'indice d'une insertion tardive, disparaîtrait.
    const lignes = chaine(["client"]);
    const tardif = new Date("2026-09-01T08:00:00.000Z");
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      id: DOC,
      numero: NUMERO,
      type: "convention",
      hashSha256: PDF,
      statutSignature: "partielle",
      createdAt: new Date(),
      signatures: lignes.map((l) => ({ ...l, createdAt: tardif })),
    });

    return rapportSignatureDocument(DOC).then((r) => {
      expect(r?.signataires[0]?.signeAt.toISOString()).toBe("2026-06-10T10:00:00.000Z");
      expect(r?.signataires[0]?.createdAt.toISOString()).toBe(tardif.toISOString());
    });
  });
});

describe("listerRegistreSignatures", () => {
  function pieceDb(over: Record<string, unknown> = {}) {
    return {
      id: DOC,
      numero: NUMERO,
      type: "convention",
      hashSha256: PDF,
      statutSignature: "signee",
      createdAt: new Date("2026-06-10T00:00:00.000Z"),
      signatures: chaine(["client", "axionia"]).map((l) => ({ ...l, createdAt: l.signeAt })),
      ...over,
    };
  }

  it("compte séparément le statut RECALCULÉ et le statut CACHE", async () => {
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      pieceDb(),
      pieceDb({
        id: "22222222-2222-4222-8222-222222222222",
        numero: "AXI-CONV-2026-0043",
        statutSignature: "signee",
        signatures: chaine(["client"]).map((l) => ({ ...l, createdAt: l.signeAt })),
      }),
    ]);

    const reg = await listerRegistreSignatures();

    expect(reg.nbPieces).toBe(2);
    expect(reg.parStatutRecalcule.signee).toBe(1);
    expect(reg.parStatutRecalcule.partielle).toBe(1);
    // Le cache, lui, croit deux pièces conclues. L'écart se lit d'un coup d'œil.
    expect(reg.parStatutCache["signee"]).toBe(2);
    expect(reg.nbStatutsCacheDivergents).toBe(1);
    expect(reg.nbPreuvesIntactes).toBe(1);
  });

  it("compte les pièces dont le PDF a été régénéré après signature", async () => {
    mockPrisma.documentGenere.findMany.mockResolvedValue([pieceDb({ hashSha256: "d".repeat(64) })]);

    const reg = await listerRegistreSignatures();

    expect(reg.nbPdfRegeneres).toBe(1);
    expect(reg.nbPreuvesIntactes).toBe(0);
  });

  it("seulementAnomalies ne garde que les pièces dont la preuve ne tient pas", async () => {
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      pieceDb(),
      pieceDb({ id: "33333333-3333-4333-8333-333333333333", hashSha256: "d".repeat(64) }),
    ]);

    const reg = await listerRegistreSignatures({ seulementAnomalies: true });

    expect(reg.nbPieces).toBe(1);
    expect(reg.pieces[0]?.documentGenereId).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("ratisse aussi les pièces NON signables qui portent une signature", async () => {
    // Sans cette seconde branche, une signature glissée sur une facture serait
    // invisible du registre — exactement le cas qu'il faut voir.
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);

    await listerRegistreSignatures();

    const where = mockPrisma.documentGenere.findMany.mock.calls[0]?.[0].where;
    expect(where.OR).toHaveLength(2);
    expect(where.OR[1]).toStrictEqual({ signatures: { some: { revokedAt: null } } });
    expect(where.OR[0].type.in).toContain("convention");
  });

  it("borne le filtre de type explicite, sans la branche « porte une signature »", async () => {
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);

    await listerRegistreSignatures({ types: ["convention"] });

    const where = mockPrisma.documentGenere.findMany.mock.calls[0]?.[0].where;
    expect(where.OR).toBeUndefined();
    expect(where.type).toStrictEqual({ in: ["convention"] });
  });

  it("annonce un résultat TRONQUÉ — un registre partiel ne doit pas passer pour complet", async () => {
    mockPrisma.documentGenere.findMany.mockResolvedValue([pieceDb(), pieceDb({ id: "b" })]);

    const reg = await listerRegistreSignatures({ limite: 2 });

    expect(reg.tronque).toBe(true);
    expect(mockPrisma.documentGenere.findMany.mock.calls[0]?.[0].take).toBe(2);
  });

  it("rend un registre vide au build sans base, sans interroger Prisma", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";

    const reg = await listerRegistreSignatures();

    expect(reg.nbPieces).toBe(0);
    expect(reg.tronque).toBe(false);
    expect(mockPrisma.documentGenere.findMany).not.toHaveBeenCalled();
  });

  it("ne déclare aucune dérive SSOT ↔ schéma", async () => {
    // Un circuit qui désignerait un type absent de l'enum produirait un `IN`
    // amputé, et le registre dirait sereinement « rien à vérifier ».
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);
    const reg = await listerRegistreSignatures();
    expect(reg.typesSignablesInconnusDuSchema).toStrictEqual([]);
  });

  it("n'écrit RIEN, même en balayant des pièces anormales", async () => {
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      pieceDb({ hashSha256: "d".repeat(64), statutSignature: "en_attente" }),
    ]);

    await listerRegistreSignatures();

    for (const modele of [mockPrisma.documentGenere, mockPrisma.documentSignature]) {
      expect(modele.update).not.toHaveBeenCalled();
      expect(modele.create).not.toHaveBeenCalled();
      expect(modele.delete).not.toHaveBeenCalled();
      expect(modele.updateMany).not.toHaveBeenCalled();
    }
  });
});
