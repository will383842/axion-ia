/**
 * Page de signature : écrans de fin (« annulée », « déjà signée »). Le client a reçu un devis
 * AXI-DEV-… : c'est ce numéro qu'on lui montre, jamais la référence interne AXI-DOC-….
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
  MENTION_VERSION_DOCUMENT: "doc-v2",
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

describe("page de signature — numéro du devis sur les écrans de fin", () => {
  it("devis annulé : numéro AXI-DEV, pas AXI-DOC", async () => {
    m.piece.mockResolvedValue(piece({ annuleeAt: new Date() }));
    const html = await rendu();
    expect(html).toContain("Le devis AXI-DEV-2026-014 ne fait plus foi");
    expect(html).not.toContain("AXI-DOC");
  });

  it("devis déjà signé : numéro AXI-DEV, pas AXI-DOC", async () => {
    m.count.mockResolvedValue(1);
    const html = await rendu();
    expect(html).toContain("Votre signature sur le devis AXI-DEV-2026-014 est enregistrée");
    expect(html).not.toContain("AXI-DOC");
  });

  it("convention annulée : AXI-DOC conservé, sans lecture de devis", async () => {
    m.piece.mockResolvedValue(
      piece({ type: "convention", numero: "AXI-DOC-2026-039", annuleeAt: new Date() }),
    );
    const html = await rendu();
    expect(html).toContain("La convention de formation AXI-DOC-2026-039 ne fait plus foi");
    expect(m.devisLie).not.toHaveBeenCalled();
  });

  it("devis sans devis lié : repli sur AXI-DOC", async () => {
    m.devisLie.mockResolvedValue(null);
    m.piece.mockResolvedValue(piece({ annuleeAt: new Date() }));
    const html = await rendu();
    expect(html).toContain("Le devis AXI-DOC-2026-077 ne fait plus foi");
  });
});
