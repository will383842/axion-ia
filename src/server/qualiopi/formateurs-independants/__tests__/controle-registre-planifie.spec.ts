/**
 * M5 (lot E) — le recontrôle périodique du registre est INSCRIT comme tâche
 * planifiée, et la tâche lit son interrupteur avant toute autre requête.
 *
 * Avant ce lot, `passerControleRegistrePeriodique` n'avait aucun appelant : son
 * interrupteur avait un bouton mais aucun effet, alors qu'il est le préalable
 * de `garde_mission`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  setting: { findUnique: vi.fn() },
  trainer: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
// Chargement du worker sans BullMQ, sans `next-auth` ni requête HTTP.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/queue/connection", () => ({ getBullConnectionOrThrow: vi.fn() }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("bullmq", () => ({ Worker: vi.fn() }));
// Le registre n'est jamais appelé ici : aucun formateur n'est à recontrôler.
const lire = vi.hoisted(() => vi.fn());
vi.mock("@/server/registre-entreprises/annuaire", () => ({ lireEtablissementParSiret: lire }));

import {
  formationCronsHandler,
  type FormationCronJobType,
} from "@/server/queue/workers/qualiopi-formation-crons-worker";

const TYPE = "formation-crons.controle-registre-periodique" as FormationCronJobType;

describe("M5 — recontrôle périodique du registre, tâche planifiée", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("est inscrit dans le calendrier des tâches de formation", () => {
    const source = readFileSync(join(process.cwd(), "src/server/queue/queues.ts"), "utf8");
    expect(source).toContain(`type: "${TYPE}"`);
    expect(source).toContain(`jobId: "formation-crons-controle-registre-periodique-cron"`);
  });

  it("interrupteur absent : la tâche lit le réglage et ne lit aucun formateur", async () => {
    db.setting.findUnique.mockResolvedValue(null);
    await formationCronsHandler({ type: TYPE, tick: "2026-10-12T08:35:00Z" });
    expect(db.setting.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "formateurs.controle_registre_periodique" },
      }),
    );
    expect(db.trainer.findMany).not.toHaveBeenCalled();
  });

  it("interrupteur allumé, dans la plage : relit les formateurs actifs", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T08:35:00Z")); // 10 h 35 à Paris
    db.setting.findUnique.mockResolvedValue({ value: { actif: true } });
    db.trainer.findMany.mockResolvedValue([]);
    await formationCronsHandler({ type: TYPE, tick: "2026-10-12T08:35:00Z" });
    expect(db.trainer.findMany).toHaveBeenCalledTimes(1);
  });

  it("ne lève jamais : une base en panne n'arrête pas le worker", async () => {
    db.setting.findUnique.mockRejectedValue(new Error("panne"));
    await expect(formationCronsHandler({ type: TYPE, tick: "x" })).resolves.toBeUndefined();
  });
});

describe("recontrôle périodique — journal du worker", () => {
  it("🔴 une erreur est journalisée par son NOM, jamais son message brut", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/queue/workers/qualiopi-formation-crons-worker.ts"),
      "utf8",
    );
    const debut = src.indexOf("async function handleControleRegistrePeriodique(");
    const corps = src.slice(debut, src.indexOf("\n}\n", debut));
    expect(corps).toContain("catch (err)");
    expect(corps).not.toMatch(/err\.message|String\(err\)/);
  });
});
