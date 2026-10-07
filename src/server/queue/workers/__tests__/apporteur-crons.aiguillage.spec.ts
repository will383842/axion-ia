// La file `apporteur-crons` porte deux passages depuis le 2026-09-27 : les
// rappels de l'invitation (08:00 UTC) et le relevé des réponses Zoho (toutes
// les 15 minutes). Le processeur les aiguille par le NOM du job — un relevé
// qui lancerait les rappels toutes les 15 minutes, ou l'inverse, ne se verrait
// nulle part ailleurs.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  relances: vi.fn(),
  reponses: vi.fn(),
  invitations: vi.fn(),
  facturation: vi.fn(),
  quotidien: vi.fn(),
  archivage: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(...args: unknown[]) {
      d.ctor(...args);
    }
    on(): this {
      return this;
    }
  },
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/features/commercial-application/relances-invitation-apporteur", () => ({
  passerRelancesInvitation: (...a: unknown[]) => d.relances(...a),
}));
vi.mock("@/features/commercial-application/reponses-entrantes-apporteur", () => ({
  passerReponsesEntrantes: (...a: unknown[]) => d.reponses(...a),
}));

vi.mock("@/features/commercial-application/invitation-auto", () => ({
  passerInvitationsAuto: (...a: unknown[]) => d.invitations(...a),
}));

vi.mock("@/features/commercial-application/archivage-auto-apporteurs", () => ({
  archiverApporteursTermines: (...a: unknown[]) => d.archivage(...a),
}));

vi.mock("@/features/apporteurs-reseau/passage-quotidien", () => ({
  passerFacturationApporteurs: (...a: unknown[]) => d.facturation(...a),
  passerReseauApporteurs: (...a: unknown[]) => d.quotidien(...a),
}));

import { startApporteurCronsWorker } from "../apporteur-crons-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

beforeEach(() => {
  process.env["REDIS_URL"] = "redis://doublure:6379";
  d.relances.mockResolvedValue({ personnes: 0, envoyees: { j3: 0, j7: 0 }, ecartees: {} });
  d.reponses.mockResolvedValue({
    lus: 0,
    reconnus: 0,
    enregistrees: { humaines: 0, automatiques: 0 },
    dejaConnues: 0,
    erreurs: 0,
  });
  d.invitations.mockResolvedValue({ fichesCreees: 0, envoyees: 0, ecartees: {}, aReessayer: 0 });
  d.facturation.mockResolvedValue({ autofacturesEmises: 0, erreurs: 0 });
  d.quotidien.mockResolvedValue({ autofacturesEmises: 0, erreurs: 0 });
  d.facturation.mockClear();
  d.quotidien.mockClear();
  d.archivage.mockReset();
  d.archivage.mockResolvedValue({
    archivees: 0,
    laisseesOuvertes: 0,
    personnesContresignees: 0,
    personnesNonRetenues: 0,
    ecrit: true,
  });
});

describe("🔴 l'archivage automatique des apporteurs (2026-10-07)", () => {
  it("le passage des invitations archive aussi, sur une fenêtre de 7 jours, en écrivant", async () => {
    await processeur()({ name: "invitation-auto", data: { type: "invitation-auto" } });
    expect(d.archivage).toHaveBeenCalledTimes(1);
    const arg = d.archivage.mock.calls[0]![0] as { appliquer: boolean; depuis: Date };
    expect(arg.appliquer).toBe(true);
    const jours = (Date.now() - arg.depuis.getTime()) / (24 * 3600 * 1000);
    expect(Math.round(jours)).toBe(7);
  });

  it("une panne de l'archivage ne fait pas échouer le passage des invitations", async () => {
    d.archivage.mockRejectedValue(new Error("base lente"));
    await expect(
      processeur()({ name: "invitation-auto", data: { type: "invitation-auto" } }),
    ).resolves.toBeUndefined();
    expect(d.invitations).toHaveBeenCalled();
  });

  it("les autres passages n'archivent pas", async () => {
    await processeur()({ name: "relance-invitation", data: { type: "relance-invitation" } });
    await processeur()({ name: "reponses-entrantes", data: { type: "reponses-entrantes" } });
    expect(d.archivage).not.toHaveBeenCalled();
    // Les cas suivants comptent leurs appels sans remise à zéro.
    d.reponses.mockClear();
    d.relances.mockClear();
  });
});

function processeur(): Processeur {
  startApporteurCronsWorker();
  return d.ctor.mock.calls.at(-1)?.[1] as Processeur;
}

describe("🔴 l'aiguillage de la file apporteur-crons", () => {
  it("un job `reponses-entrantes` relève les réponses, et ne lance PAS les rappels", async () => {
    await processeur()({ name: "reponses-entrantes", data: { type: "reponses-entrantes" } });
    expect(d.reponses).toHaveBeenCalledTimes(1);
    expect(d.relances).not.toHaveBeenCalled();
  });

  it("un job `relance-invitation` lance les rappels, et ne relève pas Zoho", async () => {
    d.reponses.mockClear();
    d.relances.mockClear();
    await processeur()({ name: "relance-invitation", data: { type: "relance-invitation" } });
    expect(d.relances).toHaveBeenCalledTimes(1);
    expect(d.reponses).not.toHaveBeenCalled();
  });

  it("le programme pose le relevé toutes les 15 minutes, jobId stable, à côté des rappels", () => {
    const queues = readFileSync(join(process.cwd(), "src/server/queue/queues.ts"), "utf8");
    expect(queues).toMatch(/PATTERN_REPONSES_ENTRANTES = "\*\/15 \* \* \* \*"/);
    expect(queues).toMatch(
      /type: "reponses-entrantes" as const,\s*pattern: PATTERN_REPONSES_ENTRANTES,\s*jobId: "apporteur-reponses-entrantes-cron"/,
    );
    expect(queues).toMatch(/jobId: "apporteur-relance-invitation-cron"/);
  });

  it("un job `invitation-auto` invite, et ne lance ni les rappels ni le relevé", async () => {
    d.reponses.mockClear();
    d.relances.mockClear();
    d.invitations.mockClear();
    await processeur()({ name: "invitation-auto", data: { type: "invitation-auto" } });
    expect(d.invitations).toHaveBeenCalledTimes(1);
    expect(d.relances).not.toHaveBeenCalled();
    expect(d.reponses).not.toHaveBeenCalled();
  });

  it("le programme pose l'invitation automatique toutes les 5 minutes, jobId stable", () => {
    const queues = readFileSync(join(process.cwd(), "src/server/queue/queues.ts"), "utf8");
    expect(queues).toMatch(/PATTERN_INVITATION_AUTO = "\*\/5 \* \* \* \*"/);
    expect(queues).toMatch(
      /type: "invitation-auto" as const,\s*pattern: PATTERN_INVITATION_AUTO,\s*jobId: "apporteur-invitation-auto-cron"/,
    );
  });
});

describe("🔴 la facturation des commissions : job horaire distinct du quotidien", () => {
  it("un job `reseau-facturation` lance la facturation, et PAS le passage quotidien", async () => {
    await processeur()({ name: "reseau-facturation", data: { type: "reseau-facturation" } });
    expect(d.facturation).toHaveBeenCalledTimes(1);
    expect(d.quotidien).not.toHaveBeenCalled();
    expect(d.relances).not.toHaveBeenCalled();
  });

  it("un job `reseau-quotidien` lance le passage quotidien, et PAS la facturation seule", async () => {
    await processeur()({ name: "reseau-quotidien", data: { type: "reseau-quotidien" } });
    expect(d.quotidien).toHaveBeenCalledTimes(1);
    expect(d.facturation).not.toHaveBeenCalled();
  });

  it("le programme pose la facturation TOUTES LES HEURES (minute 10 UTC), jobId stable, à côté du quotidien", () => {
    const queues = readFileSync(join(process.cwd(), "src/server/queue/queues.ts"), "utf8");
    expect(queues).toMatch(/PATTERN_RESEAU_FACTURATION = "10 \* \* \* \*"/);
    expect(queues).toMatch(
      /type: "reseau-facturation" as const,\s*pattern: PATTERN_RESEAU_FACTURATION,\s*jobId: "apporteur-reseau-facturation-cron"/,
    );
    expect(queues).toMatch(/PATTERN_RESEAU_QUOTIDIEN = "0 7 \* \* \*"/);
  });
});
