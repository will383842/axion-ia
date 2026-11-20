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
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: async () => ({ raisonSociale: "O", email: "", telephone: "" }),
}));
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
  it("jeton révoqué + devis refusé : message de refus, sans « version révisée »", async () => {
    verif.mockResolvedValue({ ok: false, raison: "revoque" });
    statut.mockResolvedValue("refuse");
    const html = await rendu();
    expect(html).toContain("Ce devis a été refusé");
    expect(html).not.toContain("version révisée");
    expect(html).not.toContain("a expiré");
  });
  it("jeton révoqué + devis expiré : message d'expiration", async () => {
    verif.mockResolvedValue({ ok: false, raison: "revoque" });
    statut.mockResolvedValue("expire");
    const html = await rendu();
    expect(html).toContain("Ce devis a expiré");
    expect(html).not.toContain("refusé");
  });
  it("jeton révoqué pour remplacement : message neutre « lien désactivé » conservé", async () => {
    verif.mockResolvedValue({ ok: false, raison: "revoque" });
    statut.mockResolvedValue("autre");
    const html = await rendu();
    expect(html).toContain("Ce lien a été désactivé");
    expect(html).not.toContain("Ce devis a été refusé");
    expect(html).not.toContain("Ce devis a expiré");
  });
  it("jeton révoqué, pièce autre qu'un devis : message neutre", async () => {
    verif.mockResolvedValue({ ok: false, raison: "revoque" });
    statut.mockResolvedValue(null);
    expect(await rendu()).toContain("Ce lien a été désactivé");
  });
  it("jeton invalide : l'identité de l'organisme n'est pas lue", async () => {
    // Le mock d'identité ci-dessus ne compte pas ses appels : voir signature-publique-ecrans.
    verif.mockResolvedValue({ ok: false, raison: "inconnu" });
    statut.mockResolvedValue(null);
    expect(await rendu()).toContain("Lien invalide");
  });
});
