// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

// `vi.mock` est remonté en tête de fichier : la fonction doit l'être aussi.
const { notify } = vi.hoisted(() => ({ notify: vi.fn(async () => ({})) }));
vi.mock("@/server/notifications", () => ({ notify }));

import {
  alerterSiDisquePlein,
  calculerEtatDisque,
  lireDernierElagage,
  memoriserDernierElagage,
  niveauDisque,
} from "../etat-serveur";

describe("calculerEtatDisque", () => {
  it("rend le même pourcentage que `df` sur la mesure du VPS du 2026-10-23", () => {
    // df : 150G, 132G utilisés, 13G disponibles, 92 %. (bfree inclut la réserve root.)
    const Go = 1024 ** 3 / 4096;
    const etat = calculerEtatDisque({
      bsize: 4096,
      blocks: 150 * Go,
      bfree: 18 * Go,
      bavail: 13 * Go,
    });
    expect(etat).toEqual({ pourcent: 92, libresGo: 13, totalGo: 150, niveau: "alerte" });
  });
});

describe("niveauDisque", () => {
  it("passe en vigilance à 75 % et en alerte à 85 %", () => {
    expect(niveauDisque(74)).toBe("ok");
    expect(niveauDisque(75)).toBe("vigilance");
    expect(niveauDisque(84)).toBe("vigilance");
    expect(niveauDisque(85)).toBe("alerte");
  });
});

describe("dernier élagage", () => {
  it("est partagé par globalThis (instrumentation et pages sont deux bundles)", () => {
    memoriserDernierElagage(
      { octetsAvant: 10, octetsSupprimes: 4, entreesSupprimees: 2 },
      new Date("2026-10-23T18:00:00Z"),
    );
    expect(lireDernierElagage()).toEqual({
      octetsAvant: 10,
      octetsSupprimes: 4,
      entreesSupprimees: 2,
      a: "2026-10-23T18:00:00.000Z",
    });
  });
});

describe("alerterSiDisquePlein", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    notify.mockClear();
  });

  it("prévient au-delà de 85 %, dédupliqué 6 h (et pas les 5 min par défaut de notify)", async () => {
    const fs = await import("node:fs");
    const Go = 1024 ** 3 / 4096;
    vi.spyOn(fs.promises, "statfs").mockResolvedValue({
      bsize: 4096,
      blocks: 150 * Go,
      bfree: 18 * Go,
      bavail: 13 * Go,
    } as Awaited<ReturnType<typeof fs.promises.statfs>>);

    expect(await alerterSiDisquePlein(new Date("2026-10-23T19:00:00Z"))).toBe(true);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "MONITORING_ALERT",
        dedupKey: "disque-serveur-plein-2026-10-23-3",
        dedupTtlSec: 6 * 3600,
      }),
    );
  });

  it("se tait sous le seuil", async () => {
    const fs = await import("node:fs");
    const Go = 1024 ** 3 / 4096;
    vi.spyOn(fs.promises, "statfs").mockResolvedValue({
      bsize: 4096,
      blocks: 150 * Go,
      bfree: 50 * Go,
      bavail: 45 * Go,
    } as Awaited<ReturnType<typeof fs.promises.statfs>>);

    expect(await alerterSiDisquePlein()).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
});
