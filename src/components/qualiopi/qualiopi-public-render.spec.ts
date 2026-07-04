// @vitest-environment node
/**
 * Vérification de RENDU des surfaces publiques Qualiopi (badge + bandeau) :
 * on rend réellement le markup (renderToStaticMarkup) avec une identité Phase B
 * mockée, et on vérifie que le DOM produit est correct + conforme.
 *
 * Mocks : `getQualiopiPublicIdentity` (source gated) + `getLocale` (next-intl/server,
 * sinon throw hors contexte de requête). `legal-mentions` reste réel (pur).
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
import { QualiopiBadge } from "./QualiopiBadge";
import { QualiopiReassuranceBand } from "./QualiopiReassuranceBand";

const mockId = getQualiopiPublicIdentity as unknown as ReturnType<typeof vi.fn>;

const PHASE_B_IDENTITY = {
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

describe("QualiopiReassuranceBand (rendu)", () => {
  it("ne rend RIEN hors Phase B", async () => {
    mockId.mockResolvedValue(null);
    expect(await QualiopiReassuranceBand()).toBeNull();
  });

  it("rend le bandeau conforme en Phase B", async () => {
    mockId.mockResolvedValue(PHASE_B_IDENTITY);
    const html = renderToStaticMarkup((await QualiopiReassuranceBand()) as React.ReactElement);
    expect(html).toContain("Organisme de formation certifié Qualiopi");
    expect(html).toContain("Actions de formation");
    // Décision Will : le n° de certificat n'est JAMAIS affiché publiquement.
    expect(html).not.toContain("CERT-2026-001");
    // accessibilité : libellé d'aside.
    expect(html).toContain('aria-label="Certification Qualiopi"');
  });
});

describe("QualiopiBadge (rendu)", () => {
  it("ne rend RIEN hors Phase B", async () => {
    mockId.mockResolvedValue(null);
    expect(await QualiopiBadge({})).toBeNull();
  });

  it("variante card : mention obligatoire + libellé textuel si pas de logo, SANS n° public", async () => {
    mockId.mockResolvedValue(PHASE_B_IDENTITY);
    const html = renderToStaticMarkup((await QualiopiBadge({})) as React.ReactElement);
    expect(html).toContain("Organisme de formation certifié Qualiopi");
    // NB : renderToStaticMarkup échappe les apostrophes (d'actions → d&#x27;actions),
    // on assert donc un fragment de la mention obligatoire sans apostrophe.
    expect(html).toContain(
      "La certification qualité a été délivrée au titre de la ou des catégories",
    );
    // Décision Will : le n° de certificat n'est JAMAIS affiché publiquement.
    expect(html).not.toContain("CERT-2026-001");
    // logoPath vide → libellé textuel, AUCUNE balise <img> (pas de faux logo).
    expect(html).not.toContain("<img");
  });

  it("variante card : affiche le logo officiel quand le chemin est renseigné", async () => {
    mockId.mockResolvedValue({ ...PHASE_B_IDENTITY, logoPath: "/qualiopi/qualiopi-logo.png" });
    const html = renderToStaticMarkup((await QualiopiBadge({})) as React.ReactElement);
    expect(html).toContain("<img");
    expect(html).toContain("/qualiopi/qualiopi-logo.png");
  });

  it("variante inline : pastille texte seul, ZÉRO image (Web Vitals safe)", async () => {
    mockId.mockResolvedValue({ ...PHASE_B_IDENTITY, logoPath: "/qualiopi/qualiopi-logo.png" });
    const html = renderToStaticMarkup(
      (await QualiopiBadge({ variant: "inline" })) as React.ReactElement,
    );
    expect(html).toContain("Certifié Qualiopi");
    expect(html).toContain("Actions de formation");
    // Même avec un logoPath renseigné, la variante inline n'embarque PAS d'image.
    expect(html).not.toContain("<img");
  });
});
