import { describe, it, expect } from "vitest";
import { createCampaignSchema } from "./campaign-schema";
import { canProspection } from "./rbac";

describe("createCampaignSchema — garde ciblage (G1)", () => {
  const base = {
    nom: "Pilote Isère BTP",
    departements: ["38"],
    tailles: ["PME"],
  };
  it("accepte un secteur", () => {
    const r = createCampaignSchema.safeParse({ ...base, secteurs: ["btp"] });
    expect(r.success).toBe(true);
  });
  it("accepte un code NAF explicite", () => {
    const r = createCampaignSchema.safeParse({ ...base, nafCodes: ["41.20A"] });
    expect(r.success).toBe(true);
  });
  it("REFUSE un ciblage vide (ni secteur ni NAF)", () => {
    const r = createCampaignSchema.safeParse({ ...base });
    expect(r.success).toBe(false);
  });
  it("REFUSE sans département", () => {
    expect(
      createCampaignSchema.safeParse({
        nom: "x",
        departements: [],
        tailles: ["PME"],
        secteurs: ["btp"],
      }).success,
    ).toBe(false);
  });
  it("REFUSE sans taille", () => {
    expect(
      createCampaignSchema.safeParse({
        nom: "x",
        departements: ["38"],
        tailles: [],
        secteurs: ["btp"],
      }).success,
    ).toBe(false);
  });
  it("applique les défauts", () => {
    const r = createCampaignSchema.parse({ ...base, secteurs: ["btp"] });
    expect(r.enrichirContacts).toBe(true);
    expect(r.enrichirPersonnes).toBe(false);
    expect(r.priorite).toBe(0);
  });
});

describe("canProspection — RBAC (D-T0-2)", () => {
  it("export réservé admin/super_admin (dpo|admin)", () => {
    expect(canProspection("admin", "export")).toBe(true);
    expect(canProspection("super_admin", "export")).toBe(true);
    expect(canProspection("editor", "export")).toBe(false); // operator = pas d'export
  });
  it("consultation/opération pour operator (editor)", () => {
    expect(canProspection("editor", "view")).toBe(true);
    expect(canProspection("editor", "operate")).toBe(true);
  });
  it("config réservé admin", () => {
    expect(canProspection("admin", "config")).toBe(true);
    expect(canProspection("editor", "config")).toBe(false);
  });
  it("rôle inconnu → aucune capacité", () => {
    expect(canProspection("reader", "view")).toBe(false);
  });
});
