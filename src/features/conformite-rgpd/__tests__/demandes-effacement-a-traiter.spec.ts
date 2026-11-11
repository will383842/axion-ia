/**
 * Une trace `gdpr.erase.requested` n'est « à traiter » que tant que l'alerte
 * `rgpd_effacement_a_traiter` n'est pas résolue ; la résolution donne la date « faite le ».
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  journal: [] as unknown[],
  alertes: [] as unknown[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rgpdDemande: { findMany: async () => [] },
    activityLog: { findMany: async () => d.journal },
    alerteSysteme: { findMany: async () => d.alertes },
  },
}));

import { listerDemandes } from "../demandes";

const DEMANDE = new Date("2026-11-11T10:00:00Z");
const RESOLUE = new Date("2026-11-20T09:00:00Z");

function trace(id: string, emailHash = "h-1") {
  return {
    id,
    action: "gdpr.erase.requested",
    createdAt: DEMANDE,
    changes: { emailHash },
  };
}

describe("demandes d'effacement du site : état déduit de l'alerte", () => {
  beforeEach(() => {
    d.journal = [];
    d.alertes = [];
  });

  it("alerte non résolue → à traiter, pas de date", async () => {
    d.journal = [trace("j1")];
    d.alertes = [
      { cibleId: "h-1", resolue: false, resolueAt: null, metadata: { journalId: "j1" } },
    ];
    const [x] = await listerDemandes();
    expect(x?.aTraiter).toBe(true);
    expect(x?.faiteLe).toBeNull();
  });

  it("alerte résolue (retrouvée par journalId) → faite, avec la date de résolution", async () => {
    d.journal = [trace("j1", "autre")];
    d.alertes = [
      { cibleId: "h-1", resolue: true, resolueAt: RESOLUE, metadata: { journalId: "j1" } },
    ];
    const [x] = await listerDemandes();
    expect(x?.aTraiter).toBe(false);
    expect(x?.faiteLe).toEqual(RESOLUE);
  });

  it("alerte résolue (retrouvée par l'empreinte) → faite", async () => {
    d.journal = [trace("j2", "h-9")];
    d.alertes = [{ cibleId: "h-9", resolue: true, resolueAt: RESOLUE, metadata: {} }];
    const [x] = await listerDemandes();
    expect(x?.aTraiter).toBe(false);
    expect(x?.faiteLe).toEqual(RESOLUE);
  });

  it("aucune alerte retrouvée → reste à traiter (jamais « faite » sans preuve)", async () => {
    d.journal = [trace("j3", "h-3")];
    const [x] = await listerDemandes();
    expect(x?.aTraiter).toBe(true);
    expect(x?.faiteLe).toBeNull();
  });
});
