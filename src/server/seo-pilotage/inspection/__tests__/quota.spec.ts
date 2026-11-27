import { describe, expect, it } from "vitest";

import {
  CLE_QUOTA_PREFIXE,
  DEBIT_MAX_PAR_MINUTE,
  PLAFOND_JOUR,
  QUOTA_PAR_USAGE,
  cleQuota,
  jourPacifique,
  reserverInspections,
  type MagasinQuota,
} from "../quota";

/** Magasin en mémoire, même contrat que l'atomique Redis : table d'usages → compte. */
function magasin(): MagasinQuota & { etat: Map<string, Record<string, number>> } {
  const etat = new Map<string, Record<string, number>>();
  return {
    etat,
    reserver: async (cle, usage, n, plafondUsage, plafondTotal) => {
      const h = etat.get(cle) ?? {};
      const total = Object.values(h).reduce((a, b) => a + b, 0);
      const deja = h[usage] ?? 0;
      const accorde = Math.max(0, Math.min(n, plafondUsage - deja, plafondTotal - total));
      h[usage] = deja + accorde;
      etat.set(cle, h);
      return accorde;
    },
  };
}

describe("quota d'inspection partagé", () => {
  it("découpe 200 / 1 400 / 400 sous un plafond de 2 000", () => {
    expect(QUOTA_PAR_USAGE).toEqual({ suivi: 200, rotation: 1400, manuel: 400 });
    expect(PLAFOND_JOUR).toBe(2000);
    expect(Object.values(QUOTA_PAR_USAGE).reduce((a, b) => a + b, 0)).toBe(PLAFOND_JOUR);
    expect(DEBIT_MAX_PAR_MINUTE).toBeLessThanOrEqual(300);
  });

  it("le jour est celui du Pacifique, clé unique par jour", () => {
    // 2026-11-27 07:30 UTC = 26 novembre 23:30 à Los Angeles
    expect(jourPacifique(new Date("2026-11-27T07:30:00Z"))).toBe("2026-11-26");
    expect(jourPacifique(new Date("2026-11-27T08:30:00Z"))).toBe("2026-11-27");
    expect(cleQuota("2026-11-27")).toBe(`${CLE_QUOTA_PREFIXE}2026-11-27`);
    expect(CLE_QUOTA_PREFIXE).toBe("gsc:inspection:quota:");
  });

  it("refuse au plafond de l'usage, et accorde le reste d'une demande partielle", async () => {
    const m = magasin();
    const maintenant = new Date("2026-11-27T12:00:00Z");
    expect(await reserverInspections(m, "rotation", 1000, maintenant)).toBe(1000);
    expect(await reserverInspections(m, "rotation", 1000, maintenant)).toBe(400);
    expect(await reserverInspections(m, "rotation", 1, maintenant)).toBe(0);
  });

  it("un usage ne mange pas le quota d'un autre", async () => {
    const m = magasin();
    const maintenant = new Date("2026-11-27T12:00:00Z");
    await reserverInspections(m, "rotation", 1400, maintenant);
    expect(await reserverInspections(m, "suivi", 500, maintenant)).toBe(200);
    expect(await reserverInspections(m, "manuel", 500, maintenant)).toBe(400);
  });

  it("le plafond total de 2 000 tient même si un usage est relevé", async () => {
    const m = magasin();
    const maintenant = new Date("2026-11-27T12:00:00Z");
    await reserverInspections(m, "manuel", 400, maintenant);
    await reserverInspections(m, "suivi", 200, maintenant);
    expect(await reserverInspections(m, "rotation", 5000, maintenant)).toBe(1400);
  });

  it("un nouveau jour Pacifique repart de zéro", async () => {
    const m = magasin();
    await reserverInspections(m, "rotation", 1400, new Date("2026-11-27T12:00:00Z"));
    expect(await reserverInspections(m, "rotation", 10, new Date("2026-11-28T12:00:00Z"))).toBe(10);
  });

  it("une demande nulle ou négative ne réserve rien", async () => {
    const m = magasin();
    expect(await reserverInspections(m, "rotation", 0, new Date())).toBe(0);
    expect(await reserverInspections(m, "rotation", -5, new Date())).toBe(0);
    expect(m.etat.size).toBe(0);
  });
});
