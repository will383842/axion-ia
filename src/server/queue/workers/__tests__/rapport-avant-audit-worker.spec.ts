/**
 * Worker du rapport avant audit : SIGTERM ne touche JAMAIS la base (le drapeau seul), le traitement
 * reçoit ce drapeau, et les lancements en suspens sont repris au démarrage PUIS toutes les 10 min.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  processeur: null as null | ((job: { data: { rapportId: string } }) => Promise<void>),
  lancementsEnSuspens: vi.fn(),
  remettreEnAttente: vi.fn(),
  marquerErreur: vi.fn(),
  traiterRapport: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_nom: string, processeur: (job: { data: { rapportId: string } }) => Promise<void>) {
      m.processeur = processeur;
    }
    on(): this {
      return this;
    }
  },
}));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({}) }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({
  enqueueRapportAvantAudit: m.enqueue,
  RAPPORT_AVANT_AUDIT_QUEUE_NAME: "rapport-avant-audit",
}));
vi.mock("@/features/rapport-avant-audit/persistance", () => ({
  lancementsEnSuspens: m.lancementsEnSuspens,
  remettreEnAttente: m.remettreEnAttente,
  marquerErreur: m.marquerErreur,
}));
vi.mock("@/features/rapport-avant-audit/traitement", () => ({
  traiterRapport: m.traiterRapport,
  depsParDefaut: (arretDemande: () => boolean) => ({ arretDemande }),
}));

const ID = "00000000-0000-4000-8000-000000000001";

let gestionnaires: Array<() => void> = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  gestionnaires = [];
  // Le gestionnaire SIGTERM est capturé, jamais posé sur le vrai processus de test.
  vi.spyOn(process, "once").mockImplementation(((ev: string, fn: () => void) => {
    if (ev === "SIGTERM") gestionnaires.push(fn);
    return process;
  }) as typeof process.once);
  m.lancementsEnSuspens.mockResolvedValue([]);
  m.enqueue.mockResolvedValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("worker rapport avant audit", () => {
  it("SIGTERM pendant le dernier appel : le gestionnaire n'écrit rien, le traitement voit le drapeau et termine", async () => {
    const w = await import("../rapport-avant-audit-worker");
    w.startRapportAvantAuditWorker();
    let vuPendantAppel: boolean | null = null;
    m.traiterRapport.mockImplementation(
      async (_id: string, deps: { arretDemande: () => boolean }) => {
        // SIGTERM arrive pendant le dernier appel d'IA…
        for (const g of gestionnaires) g();
        vuPendantAppel = deps.arretDemande();
        // …l'appel va au bout et le rapport est enregistré.
        return "termine";
      },
    );
    await m.processeur!({ data: { rapportId: ID } });
    expect(gestionnaires).toHaveLength(1);
    expect(vuPendantAppel).toBe(true);
    // Le défaut corrigé : le gestionnaire remettait la ligne en attente sous le rapport qui finissait.
    expect(m.remettreEnAttente).not.toHaveBeenCalled();
    expect(m.marquerErreur).not.toHaveBeenCalled();
  });

  it("reprend les lancements en suspens au démarrage puis toutes les 10 minutes", async () => {
    m.lancementsEnSuspens.mockResolvedValue([ID]);
    const w = await import("../rapport-avant-audit-worker");
    w.startRapportAvantAuditWorker();
    await vi.advanceTimersByTimeAsync(0);
    expect(m.lancementsEnSuspens).toHaveBeenCalledTimes(1);
    expect(m.enqueue).toHaveBeenCalledWith(ID, { reprise: true });

    await vi.advanceTimersByTimeAsync(w.BALAYAGE_SUSPENS_MS);
    expect(m.lancementsEnSuspens).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(w.BALAYAGE_SUSPENS_MS);
    expect(m.lancementsEnSuspens).toHaveBeenCalledTimes(3);

    // Après SIGTERM, le balayage s'arrête.
    for (const g of gestionnaires) g();
    await vi.advanceTimersByTimeAsync(3 * w.BALAYAGE_SUSPENS_MS);
    expect(m.lancementsEnSuspens).toHaveBeenCalledTimes(3);
  });
});
