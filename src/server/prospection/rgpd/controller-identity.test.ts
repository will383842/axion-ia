import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveLegalIdentity = vi.fn();
const getProspectionConfig = vi.fn();
vi.mock("@/lib/legal-identity", () => ({
  resolveLegalIdentity: () => resolveLegalIdentity(),
}));
vi.mock("@/server/prospection/config/site-settings", () => ({
  getProspectionConfig: (k: string) => getProspectionConfig(k),
}));

import { getProspectionControllerIdentity } from "./controller-identity";

const FULL_ID = {
  legalName: "Axion-IA SAS",
  siren: "123456789",
  siret: "12345678900012",
  addressSiege: "11 Av. Paul Verlaine, 38100 Grenoble",
  contactEmail: "contact@axion-ia.com",
  dpoContact: "contact@axion-ia.com",
};

beforeEach(() => {
  resolveLegalIdentity.mockReset();
  getProspectionConfig.mockReset();
});

describe("getProspectionControllerIdentity", () => {
  it("identité + AIPD complètes → productionReady", async () => {
    resolveLegalIdentity.mockResolvedValue(FULL_ID);
    getProspectionConfig.mockResolvedValue({
      aipdValidatedBy: "Will",
      aipdValidatedAt: "2026-07-04",
    });
    const id = await getProspectionControllerIdentity();
    expect(id.productionReady).toBe(true);
    expect(id.missing).toEqual([]);
    expect(id.dpoContact).toBe("contact@axion-ia.com");
  });

  it("SIREN absent + AIPD non validée → non productionReady, liste les manques", async () => {
    resolveLegalIdentity.mockResolvedValue({ ...FULL_ID, siren: null });
    getProspectionConfig.mockResolvedValue({ aipdValidatedBy: "", aipdValidatedAt: "" });
    const id = await getProspectionControllerIdentity();
    expect(id.productionReady).toBe(false);
    expect(id.missing).toContain("SIREN (Kbis)");
    expect(id.missing).toContain("validation AIPD (qui)");
  });
});
