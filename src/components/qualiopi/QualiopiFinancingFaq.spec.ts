// @vitest-environment node
/**
 * Rendu de la FAQ Financement & certification : null hors Phase B ; en Phase B,
 * questions + réponses (data-faq-q/a → speakable) + FAQPage JSON-LD.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/server/qualiopi/config/public-identity", () => ({
  getQualiopiPublicIdentity: vi.fn(),
}));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("fr"),
}));

import { getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";
import { QualiopiFinancingFaq } from "./QualiopiFinancingFaq";

const mockId = getQualiopiPublicIdentity as unknown as ReturnType<typeof vi.fn>;

const PHASE_B = {
  raisonSociale: "Axion-IA SAS",
  nda: "11380490538",
  qualiopiNumero: "CERT-2026-001",
  qualiopiOrganisme: "Certif'OF",
  qualiopiDateObtention: "",
  qualiopiValidite: "2031-06-30",
  categoriesCertifiees: "Actions de formation",
  logoPath: "",
  siret: "",
  adresseSiege: "",
};

beforeEach(() => mockId.mockReset());
afterEach(() => vi.clearAllMocks());

describe("QualiopiFinancingFaq (rendu)", () => {
  it("ne rend RIEN hors Phase B", async () => {
    mockId.mockResolvedValue(null);
    expect(await QualiopiFinancingFaq()).toBeNull();
  });

  it("rend la FAQ + FAQPage JSON-LD en Phase B", async () => {
    mockId.mockResolvedValue(PHASE_B);
    const html = renderToStaticMarkup((await QualiopiFinancingFaq()) as React.ReactElement);
    // Questions + finançable. Décision Will : le n° de certificat n'est JAMAIS public.
    expect(html).toContain("certifiées Qualiopi");
    expect(html).not.toContain("CERT-2026-001");
    expect(html).toContain("finançables");
    // Attributs speakable (ciblés par buildFaqSpeakableJsonLd).
    expect(html).toContain("data-faq-q");
    expect(html).toContain("data-faq-a");
    // FAQPage JSON-LD émis.
    expect(html).toContain("FAQPage");
    expect(html).toContain("application/ld+json");
  });
});
