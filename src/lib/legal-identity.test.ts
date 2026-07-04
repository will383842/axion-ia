// Tests legal-identity — SSOT identité légale (mentions légales + factures).

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma : on pilote la valeur du SiteSetting `legal_overrides`.
const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { siteSetting: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

import {
  LEGAL_IDENTITY_DEFAULTS,
  resolveLegalIdentity,
  buildLegalIdentitySections,
  type LegalIdentity,
} from "./legal-identity";

beforeEach(() => {
  findUnique.mockReset();
});

describe("LEGAL_IDENTITY_DEFAULTS", () => {
  it("SAS française, directeur Williams Jullin, placeholders null", () => {
    expect(LEGAL_IDENTITY_DEFAULTS.legalName).toContain("Axion-IA");
    expect(LEGAL_IDENTITY_DEFAULTS.legalForm).toContain("SAS");
    expect(LEGAL_IDENTITY_DEFAULTS.directorName).toBe("Williams Jullin");
    expect(LEGAL_IDENTITY_DEFAULTS.directorTitle).toBe("Président");
    expect(LEGAL_IDENTITY_DEFAULTS.contactEmail).toBe("contact@axion-ia.com");
    expect(LEGAL_IDENTITY_DEFAULTS.siren).toBeNull();
    expect(LEGAL_IDENTITY_DEFAULTS.vatNumber).toBeNull();
    expect(LEGAL_IDENTITY_DEFAULTS.dpoContact).toBe("contact@axion-ia.com");
  });
});

describe("resolveLegalIdentity", () => {
  it("sans override (null) → defaults", async () => {
    findUnique.mockResolvedValue(null);
    const id = await resolveLegalIdentity();
    expect(id).toEqual(LEGAL_IDENTITY_DEFAULTS);
  });

  it("DB indisponible (throw) → defaults, ne casse pas le build", async () => {
    findUnique.mockRejectedValue(new Error("stub.invalid"));
    const id = await resolveLegalIdentity();
    expect(id.legalForm).toBe(LEGAL_IDENTITY_DEFAULTS.legalForm);
  });

  it("merge des overrides structurés", async () => {
    findUnique.mockResolvedValue({
      value: {
        capitalSocial: "1 000 €",
        addressSiege: "12 rue de l'IA, 38000 Grenoble",
        rcsVille: "Grenoble",
        siren: "123 456 789",
        siret: "123 456 789 00012",
        vatNumber: "FR12123456789",
        contactPhone: "+33 4 00 00 00 00",
        dpoContact: "rgpd@axion-ia.com",
      },
    });
    const id = await resolveLegalIdentity();
    expect(id.capitalSocial).toBe("1 000 €");
    expect(id.rcsVille).toBe("Grenoble");
    expect(id.siren).toBe("123 456 789");
    expect(id.vatNumber).toBe("FR12123456789");
    expect(id.contactPhone).toBe("+33 4 00 00 00 00");
    expect(id.dpoContact).toBe("rgpd@axion-ia.com");
  });

  it("repli sur les clés historiques factures (companyVatNumber / companyLegalForm)", async () => {
    findUnique.mockResolvedValue({
      value: { companyLegalForm: "SASU", companyVatNumber: "FR99999999999" },
    });
    const id = await resolveLegalIdentity();
    expect(id.legalForm).toBe("SASU");
    expect(id.vatNumber).toBe("FR99999999999");
  });

  it("ignore les chaînes vides et valeurs non-string", async () => {
    findUnique.mockResolvedValue({ value: { siren: "   ", capitalSocial: 1000 } });
    const id = await resolveLegalIdentity();
    expect(id.siren).toBeNull();
    expect(id.capitalSocial).toBeNull();
  });
});

describe("buildLegalIdentitySections", () => {
  const FULL: LegalIdentity = {
    legalName: "Axion-IA SAS",
    legalForm: "Société par actions simplifiée (SAS)",
    capitalSocial: "1 000 €",
    addressSiege: "12 rue de l'IA, 38000 Grenoble",
    rcsVille: "Grenoble",
    siren: "123 456 789",
    siret: "123 456 789 00012",
    vatNumber: "FR12123456789",
    contactEmail: "contact@axion-ia.com",
    contactPhone: "+33 4 00 00 00 00",
    directorName: "Williams Jullin",
    directorTitle: "Président",
    dpoContact: "contact@axion-ia.com",
  };

  it("FR defaults : placeholders gracieux, jamais de section vide", () => {
    const [editeur, directeur] = buildLegalIdentitySections(LEGAL_IDENTITY_DEFAULTS, true);
    expect(editeur?.title).toBe("Éditeur du site");
    expect(editeur?.body).toContain("communiqué sur demande");
    expect(editeur?.body).not.toContain("null");
    expect(editeur?.body).not.toContain("[");
    expect(directeur?.body).toContain("Williams Jullin");
    expect(directeur?.body).toContain("Président");
  });

  it("FR identité complète : valeurs réelles rendues", () => {
    const [editeur] = buildLegalIdentitySections(FULL, true);
    expect(editeur?.body).toContain("Axion-IA SAS");
    expect(editeur?.body).toContain("1 000 €");
    expect(editeur?.body).toContain("Grenoble");
    expect(editeur?.body).toContain("FR12123456789");
    expect(editeur?.body).not.toContain("communiqué sur demande");
  });

  it("EN renvoie des titres anglais", () => {
    const [editeur, directeur] = buildLegalIdentitySections(FULL, false);
    expect(editeur?.title).toBe("Publisher");
    expect(directeur?.title).toBe("Publication director");
    expect(editeur?.body.toLowerCase()).toContain("registered office");
  });

  it("aucune trace d'Estonie / OÜ", () => {
    const blob = JSON.stringify(buildLegalIdentitySections(FULL, true)).toLowerCase();
    expect(blob).not.toContain("oü");
    expect(blob).not.toContain("estoni");
    expect(blob).not.toContain("tallinn");
  });
});
