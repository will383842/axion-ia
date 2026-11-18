/** Page de signature : photo de la pièce absente → aucun formulaire, aucun recalcul. */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  verif: vi.fn(),
  lire: vi.fn(),
  piece: vi.fn(),
  devisLie: vi.fn(),
  count: vi.fn(),
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
vi.mock("@/server/qualiopi/documents/signature/parties-requises", () => ({
  circuitPour: () => ({ libelle: "Devis", canal: "publique" }),
}));
vi.mock("@/server/qualiopi/documents/signature/mentions-document", () => ({
  MENTION_VERSION_DOCUMENT: "doc-v2",
  mentionCompleteDocument: () => [],
}));
vi.mock("@/server/qualiopi/devis/choix-signature", () => ({
  devisSignableParFormules: () => true,
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => true,
}));
vi.mock("@/components/portail/PieceSignatureForm", () => ({
  PieceSignatureForm: () => "FORMULAIRE_SIGNATURE",
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
  numero: "N1",
  dateValiditeLisible: "31/12/2026",
  clientRaisonSociale: "C",
  lignes: [],
  totalHtLisible: "",
  totalTtcLisible: "",
  mentionTva: null,
  statutBloquant: null,
};

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
  m.piece.mockResolvedValue({
    numero: "N1",
    type: "devis",
    pdfUrl: null,
    createdAt: new Date(),
    annuleeAt: null,
    metadata: null,
    client: null,
    trainee: null,
    sousTraitant: null,
    session: null,
  });
  m.count.mockResolvedValue(0);
  m.devisLie.mockResolvedValue({
    numero: "N1",
    offre: null,
    offreSha256: null,
    dateValidite: new Date(),
  });
});

describe("page de signature — photo de la pièce", () => {
  it("photo absente : message « ne peut pas être affiché », pas de formulaire", async () => {
    m.lire.mockResolvedValue({ ...DEVIS, chiffrageIndisponible: true });
    const html = await rendu();
    expect(m.lire).toHaveBeenCalledWith("doc1");
    expect(html).toContain("Ce devis ne peut pas être affiché");
    expect(html).not.toContain("FORMULAIRE_SIGNATURE");
  });
  it("photo présente : formulaire affiché", async () => {
    m.lire.mockResolvedValue({ ...DEVIS, chiffrageIndisponible: false });
    expect(await rendu()).toContain("FORMULAIRE_SIGNATURE");
  });
});
