/**
 * Tests — certifications-section.ts (section « Certifications & agréments »
 * injectée dans les mentions légales).
 *
 * On mocke directement `getQualiopiPublicIdentity` (la source de vérité gated) :
 * ça isole la LOGIQUE DE FORMATAGE du builder, sans dépendre de prisma, du flag,
 * ni du wrapper React `cache()` (qui se comporte mal hors contexte de rendu).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/config/public-identity", () => ({
  getQualiopiPublicIdentity: vi.fn(),
}));

import { getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";
import { buildQualiopiCertificationsSection } from "./certifications-section";

const mockIdentity = getQualiopiPublicIdentity as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => mockIdentity.mockReset());

describe("buildQualiopiCertificationsSection", () => {
  it("renvoie null hors Phase B (identité absente)", async () => {
    mockIdentity.mockResolvedValue(null);
    expect(await buildQualiopiCertificationsSection(true)).toBeNull();
  });

  it("renvoie une section complète en Phase B", async () => {
    mockIdentity.mockResolvedValue({
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
    });

    const section = await buildQualiopiCertificationsSection(true);
    expect(section).not.toBeNull();
    expect(section?.title).toBe("Certifications & agréments");
    // NDA + base juridique déclaration d'activité (verbatim).
    expect(section?.body).toContain("11380490538");
    expect(section?.body).toContain("ne vaut pas agrément de l'État");
    // N° de certificat + mention obligatoire de la marque + validité formatée FR.
    expect(section?.body).toContain("CERT-2026-001");
    expect(section?.body).toContain("Certif'OF");
    expect(section?.body).toContain(
      "La certification qualité a été délivrée au titre de la ou des catégories d'actions suivantes",
    );
    expect(section?.body).toContain("30 juin 2031");
  });

  /**
   * Garde des champs vides (2026-08-10).
   *
   * La configuration Qualiopi est saisie à la main en console admin : rien ne
   * garantit qu'elle soit complète le jour où le drapeau de certification est
   * levé. La phrase doit rester grammaticale dans tous les cas.
   */
  describe("champs de configuration incomplets", () => {
    const identiteVide = {
      raisonSociale: "Axion-IA SAS",
      nda: "",
      qualiopiNumero: "",
      qualiopiOrganisme: "",
      qualiopiDateObtention: "",
      qualiopiValidite: "",
      categoriesCertifiees: "Actions de formation",
      logoPath: "",
      siret: "",
      adresseSiege: "",
    };

    it("🔴 numéro vide → AUCUNE parenthèse orpheline « (certificat n° ) »", async () => {
      mockIdentity.mockResolvedValue(identiteVide);
      const section = await buildQualiopiCertificationsSection(true);
      // Le défaut exact constaté en aperçu local avant correctif.
      expect(section?.body).not.toContain("certificat n° )");
      expect(section?.body).not.toContain("(certificat n°");
      expect(section?.body).not.toMatch(/\(\s*\)/);
      // La phrase reste complète et se termine proprement.
      expect(section?.body).toContain("Axion-IA est un organisme de formation certifié Qualiopi.");
    });

    it("date SANS organisme → « délivré le », pas une date sans verbe", async () => {
      mockIdentity.mockResolvedValue({
        ...identiteVide,
        qualiopiNumero: "CERT-2026-001",
        qualiopiDateObtention: "2026-01-12",
      });
      const section = await buildQualiopiCertificationsSection(true);
      expect(section?.body).toContain("délivré le 12 janvier 2026");
      // Avant correctif : « (certificat n° CERT-2026-001 le 12 janvier 2026) ».
      expect(section?.body).not.toContain("CERT-2026-001 le 12 janvier 2026");
    });

    it("organisme ET date → « délivré par X le D » (formulation d'origine préservée)", async () => {
      mockIdentity.mockResolvedValue({
        ...identiteVide,
        qualiopiNumero: "CERT-2026-001",
        qualiopiOrganisme: "Certif'OF",
        qualiopiDateObtention: "2026-01-12",
      });
      const section = await buildQualiopiCertificationsSection(true);
      expect(section?.body).toContain(
        "(certificat n° CERT-2026-001, délivré par Certif'OF le 12 janvier 2026)",
      );
    });
  });
});
