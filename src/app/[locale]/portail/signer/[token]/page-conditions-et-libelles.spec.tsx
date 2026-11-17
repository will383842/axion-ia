/**
 * Page de signature : conditions particulières transmises au formulaire, numéro du DEVIS dans
 * l'attestation, articles des libellés (« le devis », « la convention de formation »).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  verif: vi.fn(),
  lire: vi.fn(),
  piece: vi.fn(),
  devisLie: vi.fn(),
  count: vi.fn(),
  formulaire: vi.fn(),
  mentions: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: (...a: unknown[]) => m.verif(...a),
  statutDevisDuLien: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: (...a: unknown[]) => m.piece(...a) },
    documentSignature: { count: (...a: unknown[]) => m.count(...a) },
    devis: { findFirst: (...a: unknown[]) => m.devisLie(...a) },
  },
}));
vi.mock("@/lib/r2-storage", () => ({}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: async () => ({ raisonSociale: "Organisme" }),
}));
vi.mock("@/server/qualiopi/documents/signature/devis-signature-queries", () => ({
  lireDevisASigner: (...a: unknown[]) => m.lire(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/mentions-document", () => ({
  mentionCompleteDocument: (...a: unknown[]) => {
    m.mentions(...a);
    return [];
  },
}));
vi.mock("@/server/qualiopi/devis/choix-signature", () => ({
  devisSignableParFormules: () => true,
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => true,
}));
vi.mock("@/components/portail/PieceSignatureForm", () => ({
  PieceSignatureForm: (p: unknown) => {
    m.formulaire(p);
    return "FORMULAIRE_SIGNATURE";
  },
}));
vi.mock("@/server/actions/qualiopi/piece-signature", () => ({
  apercuChoixAction: vi.fn(),
  demanderCodeDevisAction: vi.fn(),
  demanderCodeSignatureAction: vi.fn(),
  signerPieceParJetonAction: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/contrat-cadre-signature", () => ({
  codeRequis: () => false,
}));
vi.mock("@/lib/content-disposition", () => ({ lienTelechargement: (x: string) => x }));

import SignerDevisPage from "./page";

async function rendu(): Promise<string> {
  const el = await SignerDevisPage({ params: Promise.resolve({ locale: "fr", token: "t" }) });
  return renderToStaticMarkup(el as never);
}

const DEVIS = {
  devisId: "d1",
  numero: "AXI-DEV-2026-014",
  dateValiditeLisible: "31/12/2026",
  clientRaisonSociale: "C",
  lignes: [],
  totalHtLisible: "",
  totalTtcLisible: "",
  mentionTva: null,
  conditionsParticulieres: "Acompte de 30 %.",
  chiffrageIndisponible: false,
  statutBloquant: null,
};

const piece = (over: Record<string, unknown> = {}) => ({
  numero: "AXI-DOC-2026-077",
  type: "devis",
  pdfUrl: null,
  createdAt: new Date(),
  annuleeAt: null,
  metadata: null,
  client: null,
  trainee: null,
  sousTraitant: null,
  session: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db:5432/x";
  m.verif.mockResolvedValue({
    ok: true,
    documentGenereId: "doc1",
    partie: "client",
    signataireNom: "S",
    signataireQualite: "Q",
  });
  m.piece.mockResolvedValue(piece());
  m.count.mockResolvedValue(0);
  m.lire.mockResolvedValue(DEVIS);
  m.devisLie.mockResolvedValue({
    numero: DEVIS.numero,
    offre: null,
    offreSha256: null,
    dateValidite: new Date(),
  });
});

describe("page de signature — devis classique", () => {
  it("transmet les conditions particulières de la photo au formulaire", async () => {
    await rendu();
    expect(m.formulaire.mock.calls[0]?.[0]).toMatchObject({
      conditionsParticulieres: "Acompte de 30 %.",
      phrasePrimauteConditionsParticulieres: expect.stringContaining(
        "dérogent aux Conditions générales de vente",
      ),
      pieceLibelleDefini: "le devis",
    });
  });

  it("sans conditions : la prop est absente ou nulle", async () => {
    m.lire.mockResolvedValue({ ...DEVIS, conditionsParticulieres: null });
    await rendu();
    expect(m.formulaire.mock.calls[0]?.[0].conditionsParticulieres ?? null).toBeNull();
  });

  it("l'attestation désigne le DEVIS (AXI-DEV), pas le numéro de pièce AXI-DOC", async () => {
    await rendu();
    expect(m.mentions.mock.calls[0]?.[1]).toMatchObject({ pieceNumero: "AXI-DEV-2026-014" });
  });

  it("autre pièce : le numéro de pièce reste celui de l'attestation, libellé défini transmis", async () => {
    m.piece.mockResolvedValue(piece({ type: "convention", numero: "AXI-DOC-2026-039" }));
    await rendu();
    expect(m.mentions.mock.calls[0]?.[1]).toMatchObject({ pieceNumero: "AXI-DOC-2026-039" });
    expect(m.formulaire.mock.calls[0]?.[0]).toMatchObject({
      pieceLibelleDefini: "la convention de formation",
    });
  });
});

describe("page de signature — articles des messages", () => {
  it("pièce annulée : « Le devis … ne fait plus foi »", async () => {
    m.piece.mockResolvedValue(piece({ annuleeAt: new Date() }));
    const html = await rendu();
    expect(html).toContain("Le devis AXI-DOC-2026-077 ne fait plus foi");
    expect(html).not.toContain("Le Le");
  });

  it("déjà signée : « Votre signature sur le devis … »", async () => {
    m.count.mockResolvedValue(1);
    const html = await rendu();
    expect(html).toContain("Votre signature sur le devis AXI-DOC-2026-077 est enregistrée");
  });
});
