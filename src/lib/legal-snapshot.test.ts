// Tests legal-snapshot — SAS française (régime France uniquement).

import { describe, it, expect } from "vitest";
import { captureLegalSnapshotSync, type LegalSnapshot } from "./legal-snapshot";

describe("captureLegalSnapshotSync", () => {
  it("régime France (SAS) : TVA 20 %, droit français, pas de reverse-charge", () => {
    const s = captureLegalSnapshotSync();
    expect(s.fiscalRegime).toBe("FR_SARL");
    expect(s.vatRate).toBe(20);
    expect(s.vatReverseCharge).toBe(false);
    expect(s.vatMention).toContain("20");
    expect(s.vatMention).not.toContain("autoliquidation");
    expect(s.loiApplicable).toContain("français");
    expect(s.juridiction).toContain("France");
    expect(s.companyLegalForm).toBe("SAS");
    expect(s.forceMajeureArticle).toContain("1218");
    expect(s.version).toBe(1);
  });

  it("aucune trace d'Estonie / OÜ dans le snapshot", () => {
    const s = captureLegalSnapshotSync();
    const blob = JSON.stringify(s).toLowerCase();
    expect(blob).not.toContain("oü");
    expect(blob).not.toContain("estoni");
    expect(blob).not.toContain("tallinn");
    expect(blob).not.toContain("eesti");
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

  it("retourne une structure immuable prête JSONB", () => {
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
});
