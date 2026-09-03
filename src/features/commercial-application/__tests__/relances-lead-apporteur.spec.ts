/**
 * Relances du premier contact — deux invariants :
 *   1. le `jobId` dérive du HASH de l'e-mail (jamais l'adresse) et ne porte
 *      pas de « : » (séparateur de clés BullMQ) ;
 *   2. `annuler` retire exactement les deux jobs d'une adresse, et se tait si
 *      la file est absente ou si le job est déjà parti.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const retirer = vi.fn(async (_id: string) => 1);
const enfiler = vi.fn(async (..._a: unknown[]) => ({ enqueued: true }));
const queueMock = vi.hoisted(() => ({ present: true }));

vi.mock("@/server/queue/queues", () => ({
  get emailsQueue() {
    return queueMock.present ? { remove: (id: string) => retirer(id) } : null;
  },
  enqueueEmail: (...a: unknown[]) => enfiler(...a),
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => (e ? `h-${e.replace(/[^a-z]/g, "")}` : null),
}));

import {
  annulerRelancesLeadApporteur,
  jobIdRelance,
  planifierRelancesLeadApporteur,
} from "../relances-lead-apporteur";

beforeEach(() => {
  retirer.mockClear();
  enfiler.mockClear();
  queueMock.present = true;
});

describe("jobIdRelance", () => {
  it("porte le hash, pas l'adresse, et aucun « : »", () => {
    const id = jobIdRelance("j2", "h-nadiaexamplecom");
    expect(id).toBe("lead-apporteur-relance-j2-h-nadiaexamplecom");
    expect(id).not.toContain(":");
  });
});

describe("planifierRelancesLeadApporteur", () => {
  it("pose deux jobs retardés, identifiés par étape et hash", async () => {
    const n = await planifierRelancesLeadApporteur({
      email: "nadia@example.com",
      prenom: "Nadia",
      dossierUrl: "https://axion-ia.com/fr/devenir-commercial-ia/candidature",
      submissionId: "s-1",
    });
    expect(n).toBe(2);
    const ids = enfiler.mock.calls.map((c) => (c[4] as { jobId: string }).jobId);
    expect(ids).toEqual([
      "lead-apporteur-relance-j2-h-nadiaexamplecom",
      "lead-apporteur-relance-j7-h-nadiaexamplecom",
    ]);
    for (const c of enfiler.mock.calls) {
      expect(JSON.stringify(c[4])).not.toContain("nadia@");
    }
  });

  it("sans hash possible, ne pose rien", async () => {
    const n = await planifierRelancesLeadApporteur({
      email: "",
      prenom: "X",
      dossierUrl: "https://axion-ia.com/x",
      submissionId: "s-2",
    });
    expect(n).toBe(0);
    expect(enfiler).not.toHaveBeenCalled();
  });
});

describe("annulerRelancesLeadApporteur", () => {
  it("retire les deux jobs de l'adresse", async () => {
    const n = await annulerRelancesLeadApporteur("nadia@example.com");
    expect(n).toBe(2);
    expect(retirer.mock.calls.map((c) => c[0])).toEqual([
      "lead-apporteur-relance-j2-h-nadiaexamplecom",
      "lead-apporteur-relance-j7-h-nadiaexamplecom",
    ]);
  });

  it("file absente : 0, sans erreur", async () => {
    queueMock.present = false;
    await expect(annulerRelancesLeadApporteur("nadia@example.com")).resolves.toBe(0);
    expect(retirer).not.toHaveBeenCalled();
  });

  it("job déjà parti (remove throw ou 0) : on continue, on ne remonte rien", async () => {
    retirer.mockImplementationOnce(async () => {
      throw new Error("job not found");
    });
    retirer.mockImplementationOnce(async () => 0);
    await expect(annulerRelancesLeadApporteur("nadia@example.com")).resolves.toBe(0);
    expect(retirer).toHaveBeenCalledTimes(2);
  });
});
