/** Page de signature : lien révoqué sur devis REFUSÉ ≠ « version révisée adressée ». */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verif, statut } = vi.hoisted(() => ({ verif: vi.fn(), statut: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: (...a: unknown[]) => verif(...a),
  statutDevisDuLien: (...a: unknown[]) => statut(...a),
}));
vi.mock("@/lib/prisma", () => ({}));
vi.mock("@/lib/r2-storage", () => ({}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({}));
vi.mock("@/server/qualiopi/documents/signature/devis-signature-queries", () => ({}));
vi.mock("@/server/qualiopi/documents/signature/parties-requises", () => ({}));
vi.mock("@/server/qualiopi/documents/signature/mentions-document", () => ({}));
vi.mock("@/server/qualiopi/devis/choix-signature", () => ({}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({}));
vi.mock("@/components/portail/PieceSignatureForm", () => ({}));
vi.mock("@/server/actions/qualiopi/piece-signature", () => ({}));
vi.mock("@/server/qualiopi/documents/signature/contrat-cadre-signature", () => ({}));
vi.mock("@/lib/content-disposition", () => ({}));

import SignerDevisPage from "./page";

async function rendu(): Promise<string> {
  const el = await SignerDevisPage({ params: Promise.resolve({ locale: "fr", token: "t" }) });
  return renderToStaticMarkup(el as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db:5432/x";
});

describe("page de signature — lien refusé", () => {
  it("devis refusé : message exact, sans « version révisée »", async () => {
    verif.mockResolvedValue({ ok: false, raison: "revoque" });
    statut.mockResolvedValue("refuse");
    const html = await rendu();
    expect(html).toContain("n&#x27;est plus ouvert à la signature");
    expect(html).not.toContain("version révisée");
  });
  it("lien remplacé (devis encore ouvert) : message actuel conservé", async () => {
    verif.mockResolvedValue({ ok: false, raison: "revoque" });
    statut.mockResolvedValue("autre");
    const html = await rendu();
    expect(html).toContain("Ce lien a été désactivé");
    expect(html).toContain("version révisée");
  });
});
