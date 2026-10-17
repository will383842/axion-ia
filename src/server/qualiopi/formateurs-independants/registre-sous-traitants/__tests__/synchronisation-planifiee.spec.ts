// @vitest-environment node

/**
 * Qualiopi ind. 27 — la synchronisation du registre est INSCRITE comme tâche planifiée
 * (« tenu automatiquement »), et la tâche lit son interrupteur avant toute autre requête.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  setting: { findUnique: vi.fn() },
  trainer: { findMany: vi.fn() },
  registreSousTraitantIndependant: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
// Chargement du worker sans BullMQ, sans `next-auth` ni requête HTTP.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/queue/connection", () => ({ getBullConnectionOrThrow: vi.fn() }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("bullmq", () => ({ Worker: vi.fn() }));

import {
  formationCronsHandler,
  type FormationCronJobType,
} from "@/server/queue/workers/qualiopi-formation-crons-worker";

const TYPE = "formation-crons.registre-sous-traitants" as FormationCronJobType;

describe("registre des sous-traitants — tâche planifiée", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("est inscrite dans le calendrier des tâches de formation", () => {
    const source = readFileSync(join(process.cwd(), "src/server/queue/queues.ts"), "utf8");
    expect(source).toContain(`type: "${TYPE}"`);
    expect(source).toContain(`jobId: "formation-crons-registre-sous-traitants-cron"`);
  });

  it("interrupteur absent : la tâche lit le réglage et ne lit aucune fiche", async () => {
    db.setting.findUnique.mockResolvedValue(null);
    await formationCronsHandler({ type: TYPE, tick: "2026-10-16T08:50:00Z" });
    expect(db.setting.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "formateurs.registre_sous_traitants" } }),
    );
    expect(db.trainer.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("ne lève jamais : une base en panne n'arrête pas le worker", async () => {
    db.setting.findUnique.mockResolvedValue({ value: { actif: true } });
    db.$transaction.mockRejectedValue(new Error("panne"));
    await expect(formationCronsHandler({ type: TYPE, tick: "x" })).resolves.toBeUndefined();
  });

  it("🔴 le journal du worker ne porte que des compteurs, jamais un message brut", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/queue/workers/qualiopi-formation-crons-worker.ts"),
      "utf8",
    );
    const debut = src.indexOf("async function handleRegistreSousTraitants(");
    expect(debut).toBeGreaterThan(0);
    const corps = src.slice(debut, src.indexOf("\n}\n", debut));
    expect(corps).toContain("catch (err)");
    expect(corps).not.toMatch(/err\.message|String\(err\)/);
  });
});
