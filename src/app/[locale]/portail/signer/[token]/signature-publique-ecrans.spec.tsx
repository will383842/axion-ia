/**
 * Page de signature : contact de l'organisme sur les écrans d'erreur, exemplaire signé,
 * « refusé » ≠ « expiré », lien PDF gardé par le jeton (plus d'URL de stockage signée au rendu).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  verif: vi.fn(),
  statut: vi.fn(),
  lire: vi.fn(),
  piece: vi.fn(),
  devisLie: vi.fn(),
  count: vi.fn(),
  formulaire: vi.fn(),
  signer: vi.fn(),
  identite: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: (...a: unknown[]) => m.verif(...a),
  statutDevisDuLien: (...a: unknown[]) => m.statut(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: (...a: unknown[]) => m.piece(...a) },
    documentSignature: { count: (...a: unknown[]) => m.count(...a) },
    devis: { findFirst: (...a: unknown[]) => m.devisLie(...a) },
  },
}));
vi.mock("@/lib/r2-storage", () => ({
  signedDocumentPdfUrl: (...a: unknown[]) => m.signer(...a),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: (...a: unknown[]) => m.identite(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/devis-signature-queries", () => ({
  lireDevisASigner: (...a: unknown[]) => m.lire(...a),
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

const TOKEN = "tok_abc";
async function rendu(): Promise<string> {
  const el = await SignerDevisPage({ params: Promise.resolve({ locale: "fr", token: TOKEN }) });
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
  conditionsParticulieres: null,
  chiffrageIndisponible: false,
  statutBloquant: null,
};
const piece = (over: Record<string, unknown> = {}) => ({
  numero: "AXI-DOC-2026-077",
  type: "devis",
  pdfUrl: "documents/x.pdf",
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
  m.identite.mockResolvedValue({
    raisonSociale: "Organisme",
    email: "contact@organisme.test",
    telephone: "+33 4 12 34 56 78",
  });
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
  m.signer.mockResolvedValue("https://stockage.example/signe");
});

const contactPresent = (html: string) => {
  expect(html).toContain('href="mailto:contact@organisme.test"');
  expect(html).toContain('href="tel:+33412345678"');
};

describe("écrans d'erreur : contact de l'organisme", () => {
  it.each([
    ["lien expiré", { ok: false, raison: "expire" }, "autre"],
    ["lien désactivé", { ok: false, raison: "revoque" }, "autre"],
    ["devis fermé", { ok: false, raison: "revoque" }, "refuse"],
    ["lien invalide", { ok: false, raison: "inconnu" }, "autre"],
  ])("%s", async (_n, v, st) => {
    m.verif.mockResolvedValue(v);
    m.statut.mockResolvedValue(st);
    contactPresent(await rendu());
  });

  it("pièce annulée", async () => {
    m.piece.mockResolvedValue(piece({ annuleeAt: new Date() }));
    contactPresent(await rendu());
  });

  it("devis non affichable (photo absente)", async () => {
    m.lire.mockResolvedValue({ ...DEVIS, chiffrageIndisponible: true });
    contactPresent(await rendu());
  });

  it("identité illisible ou contact vide : l'écran s'affiche, sans lien cassé", async () => {
    m.verif.mockResolvedValue({ ok: false, raison: "expire" });
    m.statut.mockResolvedValue("autre");
    m.identite.mockRejectedValue(new Error("db"));
    let html = await rendu();
    expect(html).toContain("Ce lien a expiré");
    expect(html).not.toContain("mailto:");
    m.identite.mockResolvedValue({ raisonSociale: "O", email: "", telephone: "" });
    html = await rendu();
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("tel:");
  });
});

describe("exemplaire signé", () => {
  it("« Vous avez déjà signé » : lien gardé par le jeton", async () => {
    m.count.mockResolvedValue(1);
    const html = await rendu();
    expect(html).toContain("Télécharger votre exemplaire signé (PDF)");
    expect(html).toContain(`href="/fr/portail/signer/${TOKEN}/pdf"`);
    expect(html).not.toContain("stockage.example");
  });
  it("pièce sans PDF : pas de lien", async () => {
    m.count.mockResolvedValue(1);
    m.piece.mockResolvedValue(piece({ pdfUrl: null }));
    expect(await rendu()).not.toContain("exemplaire signé (PDF)");
  });
});

describe("« refusé » ≠ « expiré »", () => {
  it("devis refusé : message propre", async () => {
    m.lire.mockResolvedValue({ ...DEVIS, statutBloquant: "refuse" });
    const html = await rendu();
    expect(html).toContain("Ce devis a été refusé");
    expect(html).not.toContain("expiré");
  });
  it("devis expiré : message propre", async () => {
    m.lire.mockResolvedValue({ ...DEVIS, statutBloquant: "expire" });
    const html = await rendu();
    expect(html).toContain("Ce devis a expiré");
    expect(html).not.toContain("refusé");
  });
});

describe("lien PDF et contact transmis au formulaire", () => {
  it("pdfUrl = route gardée ; aucune signature de stockage au rendu", async () => {
    await rendu();
    const props = m.formulaire.mock.calls[0]![0] as Record<string, unknown>;
    expect(props["pdfUrl"]).toBe(`/fr/portail/signer/${TOKEN}/pdf`);
    expect(props["organismeEmail"]).toBe("contact@organisme.test");
    expect(m.signer).not.toHaveBeenCalled();
  });
  it("pièce sans PDF : pdfUrl nul", async () => {
    m.piece.mockResolvedValue(piece({ pdfUrl: "" }));
    await rendu();
    expect((m.formulaire.mock.calls[0]![0] as Record<string, unknown>)["pdfUrl"]).toBeNull();
  });
});
