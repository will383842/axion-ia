/**
 * Le récap de 7 h 30 : sa PROGRAMMATION et son RATTRAPAGE.
 *
 *  · la file `alertes-clients-crons` reçoit UN répétable `30 7 * * *` fuseau Europe/Paris
 *    (jamais un décalage UTC en dur : l'heure d'été et d'hiver sont suivies par `tz`), après
 *    purge des répétables existants ;
 *  · le worker ne rattrape qu'à partir de 7 h 30 (Paris), et un échec du récap fait ÉCHOUER le
 *    passage (jamais confondu avec une journée calme).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  ajouts: [] as Array<{ file: string; nom: string; data: unknown; opts: Record<string, unknown> }>,
  retraits: [] as Array<{ file: string; cle: string }>,
  anciens: [{ key: "ancienne-cle", name: "recap-quotidien", pattern: "30 6 * * *" }],
  envoyer: vi.fn(),
  options: {} as Record<string, Record<string, unknown>>,
  bornesLeve: false,
}));

vi.mock("bullmq", () => {
  class Queue {
    constructor(
      private readonly nom: string,
      opts?: { defaultJobOptions?: Record<string, unknown> },
    ) {
      d.options[nom] = opts?.defaultJobOptions ?? {};
    }
    async add(nom: string, data: unknown, opts: Record<string, unknown>) {
      d.ajouts.push({ file: this.nom, nom, data, opts });
    }
    async getRepeatableJobs() {
      return this.nom === "alertes-clients-crons" ? d.anciens : [];
    }
    async removeRepeatableByKey(cle: string) {
      d.retraits.push({ file: this.nom, cle });
    }
    async removeRepeatable() {
      return true;
    }
    async upsertJobScheduler() {}
    async getJobSchedulers() {
      return [];
    }
    async removeJobScheduler() {}
  }
  class Worker {
    on(): this {
      return this;
    }
  }
  return { Queue, Worker };
});
vi.mock("@/server/queue/connection", () => ({
  getBullConnection: () => ({}),
  isBullmqDisabled: () => false,
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/alertes-clients/bornes-paris", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/server/alertes-clients/bornes-paris")>();
  return {
    ...reel,
    heureMinuteParis: (...a: Parameters<typeof reel.heureMinuteParis>) => {
      if (d.bornesLeve) throw new Error("bornes-paris indisponible");
      return reel.heureMinuteParis(...a);
    },
  };
});
vi.mock("@/server/alertes-clients/recap", () => ({
  envoyerRecapVeille: (...a: unknown[]) => d.envoyer(...a),
}));

import {
  bootRepeatableJobs,
  PATTERN_RECAP_CLIENTS,
  FUSEAU_RECAP_CLIENTS,
} from "@/server/queue/queues";
import { rattraperRecapSiManque } from "../alertes-clients-crons-worker";

beforeEach(() => {
  d.ajouts.length = 0;
  d.retraits.length = 0;
  d.envoyer.mockReset();
  d.bornesLeve = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("programmation du récap", () => {
  it("7 h 30 à Paris (fuseau, pas UTC), après purge des répétables existants", async () => {
    await bootRepeatableJobs();
    expect(PATTERN_RECAP_CLIENTS).toBe("30 7 * * *");
    expect(FUSEAU_RECAP_CLIENTS).toBe("Europe/Paris");

    const ajouts = d.ajouts.filter((a) => a.file === "alertes-clients-crons");
    expect(ajouts).toHaveLength(1);
    expect(ajouts[0]!.opts["repeat"]).toEqual({ pattern: "30 7 * * *", tz: "Europe/Paris" });
    expect(ajouts[0]!.opts["jobId"]).toBe("alertes-clients-recap-cron");
    expect(d.retraits).toContainEqual({ file: "alertes-clients-crons", cle: "ancienne-cle" });
  });
});

describe("reprise des passages ratés", () => {
  it("3 essais, espacés de 5 minutes (le jobId du jour rend le rejeu sans danger)", () => {
    const opts = d.options["alertes-clients-crons"]!;
    expect(opts["attempts"]).toBe(3);
    expect(opts["backoff"]).toEqual({ type: "fixed", delay: 5 * 60_000 });
  });
});

describe("rattrapage au démarrage du worker", () => {
  it("module des bornes en panne : « echec », sans rejet non géré", async () => {
    d.bornesLeve = true;
    await expect(rattraperRecapSiManque(new Date("2026-11-14T08:00:00Z"))).resolves.toBe("echec");
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("avant 7 h 30 (Paris) : ne fait rien", async () => {
    // 07:10 à Paris (hiver) = 06:10 UTC.
    expect(await rattraperRecapSiManque(new Date("2026-11-14T06:10:00Z"))).toBe("trop-tot");
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("à partir de 7 h 30 (Paris) : envoie le récap (le jobId évite le doublon)", async () => {
    d.envoyer.mockResolvedValue("queued");
    // 09:00 à Paris (hiver) = 08:00 UTC ; l'été, 7 h 30 Paris = 05:30 UTC.
    expect(await rattraperRecapSiManque(new Date("2026-11-14T08:00:00Z"))).toBe("tente");
    expect(await rattraperRecapSiManque(new Date("2026-07-14T05:30:00Z"))).toBe("tente");
    expect(await rattraperRecapSiManque(new Date("2026-07-14T05:29:00Z"))).toBe("trop-tot");
    expect(d.envoyer).toHaveBeenCalledTimes(2);
  });

  it("récap non parti : le rattrapage ne lève pas, mais le dit", async () => {
    d.envoyer.mockResolvedValue("failed");
    expect(await rattraperRecapSiManque(new Date("2026-11-14T08:00:00Z"))).toBe("echec");
  });
});
