// @vitest-environment node
/**
 * ⛔ DRAPEAU ÉTEINT : UN ENREGISTREMENT MUET EST CLÔTURÉ ET DATÉ (V1, F1).
 *
 * `DOSSIER_BALAYAGE_ENABLED` n'allume que le balayage du DOSSIER CLIENT (il
 * attend la reprise de l'historique Calendly). Mais le même worker portait le
 * seul appel périodique de l'ENREGISTREUR : clôture d'office, reprise des
 * purges de refus, témoin de clé, alertes jeton J-14 / J-3. Drapeau éteint,
 * ni worker ni entrée répétable : un enregistrement dont Chrome a planté
 * restait `interrompu` sans `audio_a_purger_avant`, donc jamais purgé ni
 * signalé — le son chiffré restait dans R2 au-delà des 30 jours promis.
 *
 * Désormais le worker `visio-balayage` démarre et son entrée répétable est
 * posée SANS condition ; seul `passerBalayage` reste sous le drapeau.
 *
 * Mutations qui rougissent : remettre `if (!balayageActive()) return;` en
 * tête de `processJob` (1er cas : rien n'est clôturé) ; remettre la condition
 * sur `startVisioBalayageWorker()` dans `worker.ts` ou sur l'entrée
 * répétable dans `queues.ts` (2e cas).
 * Contre-témoin : drapeau éteint, le balayage du dossier client, lui, ne
 * tourne pas (la reprise Calendly n'arrive pas en rafale).
 * Angle mort : l'ordre de démarrage réel des workers (Redis) n'est pas joué ici.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FausseBase } from "../../../../tests/outils/fausse-base-enregistreur";

const etat = vi.hoisted(() => ({
  db: null as unknown,
  processeur: null as null | ((job: unknown) => Promise<void>),
  passerBalayage: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_nom: string, processeur: (job: unknown) => Promise<void>) {
      etat.processeur = processeur;
    }
    on() {
      return this;
    }
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: (_c, nom: string) => (etat.db as Record<string, unknown>)[nom] }),
}));
vi.mock("@/server/notifications", () => ({
  notify: vi.fn(async () => ({ channels: { telegram: "sent" } })),
}));
vi.mock("@/server/qualiopi/alertes/evaluateur", () => ({ evaluerAlertesDetaille: vi.fn() }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/visio/balayage", () => ({ passerBalayage: etat.passerBalayage }));

import {
  commePrisma,
  fausseBase,
  MINUTE,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

const RACINE = process.cwd();
const lire = (f: string) => readFileSync(path.join(RACINE, f), "utf8");

async function unPassage(): Promise<void> {
  const { startVisioBalayageWorker } = await import("@/server/queue/workers/visio-balayage-worker");
  startVisioBalayageWorker();
  if (!etat.processeur) throw new Error("processeur non capturé");
  await etat.processeur({ id: "t" });
}

describe("⛔ drapeau éteint : un enregistrement muet est clôturé et daté", () => {
  beforeEach(() => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("DOSSIER_BALAYAGE_ENABLED", "");
    vi.stubEnv("ENREGISTREMENT_VISIO_PILOTE", "true");
    delete process.env["DATABASE_URL"];
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it(
    "drapeau éteint : l'enregistrement abandonné est déposé avec sa date de purge",
    { timeout: 60_000 },
    async () => {
      const db: FausseBase = fausseBase();
      etat.db = commePrisma(db);
      const { appareilId } = semerAppareil(db);
      const rencontreId = semerRencontreTest(db, { debutPrevu: T0 }).rencontreId;
      semerEnregistrement(db, { rencontreId, appareilId, statut: "interrompu", updatedAt: T0 });
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(T0.getTime() + 600 * MINUTE));

      await unPassage();

      const e = db.lignes("enregistrement")[0]!;
      expect(e["statut"]).toBe("depose");
      expect(e["motifArret"]).toBe("cloture_serveur");
      expect(e["audioAPurgerAvant"]).toBeInstanceOf(Date);
      // Contre-témoin : le dossier client, lui, reste éteint.
      expect(etat.passerBalayage).not.toHaveBeenCalled();
    },
  );

  it("le worker démarre et son entrée répétable est posée sans condition", () => {
    const worker = lire("src/server/queue/worker.ts");
    expect(worker).toMatch(/^\s*startVisioBalayageWorker\(\),/m);
    expect(worker).not.toMatch(/DOSSIER_BALAYAGE_ENABLED[^\n]*startVisioBalayageWorker/);

    const queues = lire("src/server/queue/queues.ts");
    const bloc = queues.slice(
      queues.indexOf("if (visioBalayageQueue) {"),
      queues.indexOf("// ── 2026-09-29 — balayage du CIRCUIT visio"),
    );
    expect(bloc).toContain('jobId: "visio-balayage-cron"');
    expect(bloc).not.toContain("DOSSIER_BALAYAGE_ENABLED");
  });
});
