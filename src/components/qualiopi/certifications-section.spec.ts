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
  getNdaPublic: vi.fn(),
}));

import { getNdaPublic, getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";
import {
  buildDeclarationActiviteSection,
  buildQualiopiCertificationsSection,
} from "./certifications-section";

const mockIdentity = getQualiopiPublicIdentity as unknown as ReturnType<typeof vi.fn>;
const mockNda = getNdaPublic as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockIdentity.mockReset();
  mockNda.mockReset();
});

/**
 * 🔴 Le défaut que ces tests verrouillent (2026-08-17).
 *
 * Le NDA était rendu à l'intérieur de la section Qualiopi, donc derrière
 * `getQualiopiPublicIdentity`, qui est `null` tant que la certification n'est pas
 * obtenue. Le récépissé DREETS du 17 août 2026 n'aurait donc rien affiché sur le
 * site — un numéro légalement mentionnable retenu par une garde qui ne le
 * concerne pas. Les deux premiers tests ci-dessous échouent sur l'ancien code.
 */
describe("buildDeclarationActiviteSection", () => {
  it("affiche le NDA MÊME SANS certification Qualiopi", async () => {
    mockNda.mockResolvedValue("84381100438");
    // Certification absente — c'est exactement l'état de production.
    mockIdentity.mockResolvedValue(null);

    const section = await buildDeclarationActiviteSection(true);
    expect(section).not.toBeNull();
    expect(section?.title).toBe("Déclaration d'activité");
    expect(section?.body).toContain("84381100438");
  });

  it("le numéro n'est JAMAIS publié sans « ne vaut pas agrément de l'État »", async () => {
    // Art. L.6352-12 C. trav. : faire état de l'enregistrement sans cette
    // précision est une infraction, pas une omission de style.
    mockNda.mockResolvedValue("84381100438");
    const section = await buildDeclarationActiviteSection(true);
    expect(section?.body).toContain("ne vaut pas agrément de l'État");
    // Et l'autorité qui a enregistré, telle qu'elle figure sur le récépissé.
    expect(section?.body).toContain("Auvergne-Rhône-Alpes");
  });

  it("ne revendique AUCUNE certification — le mot Qualiopi n'apparaît pas", async () => {
    mockNda.mockResolvedValue("84381100438");
    const section = await buildDeclarationActiviteSection(true);
    expect(section?.body).not.toContain("Qualiopi");
    expect(section?.body).not.toContain("certifié");
  });

  it("renvoie null si le numéro n'est pas disponible (pas de section vide)", async () => {
    mockNda.mockResolvedValue("");
    expect(await buildDeclarationActiviteSection(true)).toBeNull();
  });

  it("EN : intitulé traduit, mention légale française conservée verbatim", async () => {
    mockNda.mockResolvedValue("84381100438");
    const section = await buildDeclarationActiviteSection(false);
    expect(section?.title).toBe("Training provider registration");
    expect(section?.body).toContain("Activity registration number (NDA): 84381100438.");
    expect(section?.body).toContain("ne vaut pas agrément de l'État");
  });
});

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
    // 🔴 Le NDA n'est PLUS ici — il a sa propre section depuis le 2026-08-17.
    // L'y laisser le ferait apparaître deux fois sur la page le jour où la
    // certification sera obtenue.
    expect(section?.body).not.toContain("11380490538");
    expect(section?.body).not.toContain("ne vaut pas agrément de l'État");
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
