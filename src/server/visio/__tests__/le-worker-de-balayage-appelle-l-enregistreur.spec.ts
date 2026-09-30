// @vitest-environment node
/**
 * ⛔ LE WORKER DE BALAYAGE APPELLE L'ENREGISTREUR (PR 5, relecture #1224).
 *
 * `balayerEnregistreur` (alertes jeton J-14 / J-3, extension silencieuse,
 * témoin de clé, clôture d'office, reprise des purges) n'a qu'un seul
 * appelant périodique : le `visio-balayage-worker`. Si l'appel disparaît,
 * aucune alerte ne part plus, et rien ne le signale : ce test rougit.
 *
 * Mutation qui rougit : retirer `await passerEnregistreur(...)` de
 * `processJob` → 1er cas. Faire lever `passerBalayage` avant l'appel sans
 * `try` propre → 2e cas (une panne de l'enregistreur n'arrête pas le job).
 * Contre-témoin : balayage éteint (`DOSSIER_BALAYAGE_ENABLED` absent), rien
 * n'est appelé.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const espions = vi.hoisted(() => ({
  processeur: null as null | ((job: unknown) => Promise<void>),
  passerBalayage: vi.fn(),
  balayerEnregistreur: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_nom: string, processeur: (job: unknown) => Promise<void>) {
      espions.processeur = processeur;
    }
    on() {
      return this;
    }
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { marque: "prisma" } }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: espions.capture }));
vi.mock("@/server/visio/balayage", () => ({ passerBalayage: espions.passerBalayage }));
vi.mock("@/server/visio/balayage-enregistreur", () => ({
  balayerEnregistreur: espions.balayerEnregistreur,
  notifierParTelegram: vi.fn(),
}));

const RESULTAT_BALAYAGE = {
  rencontresAssurees: 0,
  comptesRendusAValider: 0,
  suitesEchues: 0,
  veille: 0,
  couverture: null,
  etapesEnEchec: [],
};

async function unPassage(): Promise<void> {
  const { startVisioBalayageWorker } = await import("@/server/queue/workers/visio-balayage-worker");
  startVisioBalayageWorker();
  if (!espions.processeur) throw new Error("processeur non capturé");
  await espions.processeur({ id: "t" });
}

describe("le worker de balayage appelle l'enregistreur", () => {
  beforeEach(() => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    espions.passerBalayage.mockReset().mockResolvedValue(RESULTAT_BALAYAGE);
    espions.balayerEnregistreur
      .mockReset()
      .mockResolvedValue({ cloture: {}, purges: {}, temoinOk: true, alertes: 0 });
    espions.capture.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("⛔ chaque passage appelle balayerEnregistreur, avec prisma et le notifieur Telegram", async () => {
    vi.stubEnv("DOSSIER_BALAYAGE_ENABLED", "true");
    await unPassage();
    expect(espions.passerBalayage).toHaveBeenCalledTimes(1);
    expect(espions.balayerEnregistreur).toHaveBeenCalledTimes(1);
    const [db, , entree] = espions.balayerEnregistreur.mock.calls[0] as [
      unknown,
      unknown,
      { maintenant: Date; version: string },
    ];
    expect(db).toEqual({ marque: "prisma" });
    expect(entree.maintenant).toBeInstanceOf(Date);
  });

  it("⛔ une panne de l'enregistreur est signalée sans faire échouer le passage", async () => {
    vi.stubEnv("DOSSIER_BALAYAGE_ENABLED", "true");
    espions.balayerEnregistreur.mockRejectedValueOnce(new Error("verrou"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(unPassage()).resolves.toBeUndefined();
    expect(espions.capture).toHaveBeenCalledTimes(1);
  });

  it("contre-témoin : balayage éteint, rien n'est appelé", async () => {
    await unPassage();
    expect(espions.passerBalayage).not.toHaveBeenCalled();
    expect(espions.balayerEnregistreur).not.toHaveBeenCalled();
  });
});
