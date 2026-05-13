// Tests legal-snapshot — Sprint X.17.

import { describe, it, expect } from "vitest";
import { captureLegalSnapshotSync, type LegalSnapshot } from "./legal-snapshot";

describe("captureLegalSnapshotSync", () => {
  it("régime EE_OU par défaut", () => {
    const s = captureLegalSnapshotSync();
    expect(s.fiscalRegime).toBe("EE_OU");
    expect(s.vatRate).toBe(0);
    expect(s.vatReverseCharge).toBe(true);
    expect(s.vatMention).toContain("art. 196");
    expect(s.loiApplicable).toContain("estonien");
    expect(s.companyLegalForm).toBe("OÜ");
    expect(s.forceMajeureArticle).toContain("Võlaõigusseadus");
    expect(s.version).toBe(1);
  });

  it("régime FR_SARL", () => {
    const s = captureLegalSnapshotSync("FR_SARL");
    expect(s.fiscalRegime).toBe("FR_SARL");
    expect(s.vatRate).toBe(20);
    expect(s.vatReverseCharge).toBe(false);
    expect(s.vatMention).toContain("20");
    expect(s.loiApplicable).toContain("français");
    expect(s.companyLegalForm).toBe("SARL");
    expect(s.forceMajeureArticle).toContain("1218");
  });

  it("capturedAt est une chaîne ISO", () => {
    const s = captureLegalSnapshotSync();
    expect(s.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(s.capturedAt).toString()).not.toBe("Invalid Date");
  });

  it("snapshots successifs ont des capturedAt distincts", async () => {
    const s1 = captureLegalSnapshotSync();
    await new Promise((r) => setTimeout(r, 5));
    const s2 = captureLegalSnapshotSync();
    expect(s1.capturedAt).not.toBe(s2.capturedAt);
  });

  it("retourne immuable structure prête JSONB", () => {
    const s = captureLegalSnapshotSync();
    const keys: Array<keyof LegalSnapshot> = [
      "version",
      "fiscalRegime",
      "vatMention",
      "vatRate",
      "vatReverseCharge",
      "loiApplicable",
      "juridiction",
      "companyLegalForm",
      "companyRegistrationNumber",
      "companyVatNumber",
      "forceMajeureArticle",
      "capturedAt",
    ];
    for (const k of keys) {
      expect(s).toHaveProperty(k);
    }
  });

  it("EE → reverse-charge UE auto-liquidation mention art. 196", () => {
    const s = captureLegalSnapshotSync("EE_OU");
    expect(s.vatReverseCharge).toBe(true);
    expect(s.vatMention).toContain("autoliquidation");
    expect(s.vatMention).toContain("art. 196");
  });

  it("FR → TVA 20% pas de reverse-charge", () => {
    const s = captureLegalSnapshotSync("FR_SARL");
    expect(s.vatReverseCharge).toBe(false);
    expect(s.vatMention).not.toContain("autoliquidation");
  });
});
