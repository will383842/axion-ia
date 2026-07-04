import { describe, it, expect } from "vitest";
import { aggregateActivity } from "./activity-stats";

describe("aggregateActivity", () => {
  it("ventile collectées/enrichies/exploitables + % par activité, trié par volume", () => {
    const contacts = [
      { key: "btp", contactabilite: "exploitable", count: 30 },
      { key: "btp", contactabilite: "partiel", count: 20 },
      { key: "btp", contactabilite: "non_contactable", count: 50 },
      { key: "sante", contactabilite: "exploitable", count: 10 },
      { key: "sante", contactabilite: null, count: 10 },
    ];
    const enriched = [
      { key: "btp", count: 40 },
      { key: "sante", count: 5 },
    ];
    const rows = aggregateActivity(contacts, enriched, (k) => k.toUpperCase());

    expect(rows[0]!.key).toBe("btp"); // plus gros volume en premier
    expect(rows[0]!.label).toBe("BTP");
    expect(rows[0]!.collectees).toBe(100);
    expect(rows[0]!.exploitables).toBe(30);
    expect(rows[0]!.enrichies).toBe(40);
    expect(rows[0]!.pctExploitable).toBeCloseTo(0.3);
    expect(rows[0]!.pctEnrichies).toBeCloseTo(0.4);

    const sante = rows.find((r) => r.key === "sante")!;
    expect(sante.collectees).toBe(20); // 10 exploitable + 10 null
    expect(sante.nonContactables).toBe(10); // le null compte comme non contactable
    expect(sante.pctExploitable).toBeCloseTo(0.5);
  });

  it("collectées = 0 → pas de division par zéro", () => {
    expect(aggregateActivity([], [], (k) => k)).toEqual([]);
  });
});
