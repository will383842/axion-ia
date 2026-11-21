/**
 * Page de signature, formulaire RÉEL : `dateValiditeImprimee` lue par la page (devis-signature-
 * queries) traverse jusqu'à la mention « Validité prolongée » de `PieceSignatureForm`.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  verif: vi.fn(),
  lire: vi.fn(),
  piece: vi.fn(),
  devisLie: vi.fn(),
  count: vi.fn(),
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

describe("page de signature → formulaire : mention de validité prolongée", () => {
  it("date imprimée différente de la validité en cours : la mention atteint la page rendue", async () => {
    m.lire.mockResolvedValue({ ...DEVIS, dateValiditeImprimee: "15/11/2026" });
    const html = await rendu();
    expect(html).toContain("Valable jusqu&#x27;au 31/12/2026.");
    expect(html).toContain('data-testid="validite-prolongee"');
    expect(html).toContain("(15/11/2026)");
  });

  it("date imprimée identique ou absente : aucune mention", async () => {
    m.lire.mockResolvedValue({ ...DEVIS, dateValiditeImprimee: "31/12/2026" });
    expect(await rendu()).not.toContain('data-testid="validite-prolongee"');
    m.lire.mockResolvedValue({ ...DEVIS, dateValiditeImprimee: null });
    expect(await rendu()).not.toContain('data-testid="validite-prolongee"');
  });
});
