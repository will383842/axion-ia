// @vitest-environment node
/**
 * ⛔ UNE PANNE DE BORNE N'EMPÊCHE PAS L'ENREGISTREUR (V1, F6).
 *
 * `passerBalayage` lit la borne du balayage HORS de son enveloppe d'étapes :
 * si cette lecture levait (base indisponible un instant, colonne pas encore
 * migrée), `processJob` sortait AVANT `passerEnregistreur`. Le commentaire
 * promettait pourtant qu'« une panne de l'un n'arrête pas l'autre ».
 *
 * Mutation qui rougit : retirer le `try/catch` autour de `passerBalayage`
 * dans `processJob` → le job lève et l'enregistreur n'est pas appelé.
 * Contre-témoin : sans panne, les deux sont appelés, et rien n'est envoyé à
 * Sentry. Angle mort : la panne est signalée à Sentry, pas sur Telegram
 * (c'est l'alerte `visio.balayage_en_panne` du balayage qui le fait, quand il
 * tourne).
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

async function unPassage(): Promise<void> {
  const { startVisioBalayageWorker } = await import("@/server/queue/workers/visio-balayage-worker");
  startVisioBalayageWorker();
  if (!espions.processeur) throw new Error("processeur non capturé");
  await espions.processeur({ id: "t" });
}

describe("⛔ une panne de borne n'empêche pas l'enregistreur", () => {
  beforeEach(() => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("DOSSIER_BALAYAGE_ENABLED", "true");
    espions.passerBalayage.mockReset();
    espions.balayerEnregistreur
      .mockReset()
      .mockResolvedValue({ cloture: {}, purges: {}, temoinOk: true, alertes: 0 });
    espions.capture.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("la lecture de la borne lève : l'enregistreur passe quand même, Sentry est prévenu", async () => {
    espions.passerBalayage.mockRejectedValueOnce(new Error("lecture de la borne"));
    await expect(unPassage()).resolves.toBeUndefined();
    expect(espions.balayerEnregistreur).toHaveBeenCalledTimes(1);
    expect(espions.capture).toHaveBeenCalledTimes(1);
  });

  it("contre-témoin : sans panne, les deux passent et Sentry ne reçoit rien", async () => {
    espions.passerBalayage.mockResolvedValueOnce({
      rencontresAssurees: 0,
      comptesRendusAValider: 0,
      suitesEchues: 0,
      veille: 0,
      couverture: null,
      etapesEnEchec: [],
    });
    await unPassage();
    expect(espions.passerBalayage).toHaveBeenCalledTimes(1);
    expect(espions.balayerEnregistreur).toHaveBeenCalledTimes(1);
    expect(espions.capture).not.toHaveBeenCalled();
  });
});
