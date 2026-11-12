/**
 * Une trace `gdpr.erase.requested` n'est « à traiter » que tant que l'alerte
 * `rgpd_effacement_a_traiter` n'est pas résolue ; la résolution donne la date « faite le ».
 */

import { cibleIdAlerteDepuisEmpreinte } from "@/server/rgpd/constantes";
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  journal: [] as unknown[],
  alertes: [] as unknown[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rgpdDemande: { findMany: async () => [] },
    activityLog: {
      // Honore `where.action` et `take` comme la base : la coupe doit se voir dans le test.
      findMany: async (a?: { where?: { action?: string | { in: string[] } }; take?: number }) => {
        const act = a?.where?.action;
        const gardees = (d.journal as { action: string; createdAt: Date }[])
          .filter((l) =>
            act === undefined
              ? true
              : typeof act === "string"
                ? l.action === act
                : act.in.includes(l.action),
          )
          .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
        return a?.take ? gardees.slice(0, a.take) : gardees;
      },
    },
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
      {
        cibleId: cibleIdAlerteDepuisEmpreinte("h-1"),
        resolue: false,
        resolueAt: null,
        metadata: { journalId: "j1" },
      },
    ];
    const [x] = await listerDemandes();
    expect(x?.aTraiter).toBe(true);
    expect(x?.faiteLe).toBeNull();
  });

  it("alerte résolue (retrouvée par journalId) → faite, avec la date de résolution", async () => {
    d.journal = [trace("j1", "autre")];
    d.alertes = [
      {
        cibleId: cibleIdAlerteDepuisEmpreinte("h-1"),
        resolue: true,
        resolueAt: RESOLUE,
        metadata: { journalId: "j1" },
      },
    ];
    const [x] = await listerDemandes();
    expect(x?.aTraiter).toBe(false);
    expect(x?.faiteLe).toEqual(RESOLUE);
  });

  it("alerte résolue (retrouvée par l'empreinte) → faite", async () => {
    d.journal = [trace("j2", "h-9")];
    d.alertes = [
      {
        cibleId: cibleIdAlerteDepuisEmpreinte("h-9"),
        resolue: true,
        resolueAt: RESOLUE,
        metadata: {},
      },
    ];
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

  it("🔑 une ancienne demande résolue ne redevient pas « à traiter » à cause d'une 2e demande", async () => {
    d.journal = [trace("j2"), trace("j1")];
    d.alertes = [
      // la plus récente en tête, même empreinte
      {
        cibleId: cibleIdAlerteDepuisEmpreinte("h-1"),
        resolue: false,
        resolueAt: null,
        metadata: { journalId: "j2" },
      },
      {
        cibleId: cibleIdAlerteDepuisEmpreinte("h-1"),
        resolue: true,
        resolueAt: RESOLUE,
        metadata: { journalId: "j1" },
      },
    ];
    const lignes = await listerDemandes();
    const j1 = lignes.find((x) => x.id === "j1");
    const j2 = lignes.find((x) => x.id === "j2");
    expect(j1?.aTraiter).toBe(false);
    expect(j1?.faiteLe).toEqual(RESOLUE);
    expect(j2?.aTraiter).toBe(true);
  });

  it("l'origine affichée vient de changes.origine (console Lettre ≠ site)", async () => {
    d.journal = [
      { ...trace("j1"), changes: { emailHash: "h-1", origine: "console-lettre" } },
      { ...trace("j2", "h-2"), changes: { emailHash: "h-2", origine: "libre-service" } },
    ];
    const lignes = await listerDemandes();
    expect(lignes.find((x) => x.id === "j1")?.origine).toBe("console_lettre");
    expect(lignes.find((x) => x.id === "j2")?.origine).toBe("libre_service");
  });

  it("🔑 2e demande dédoublonnée : se ferme avec l'alerte (journalIds)", async () => {
    // j1 a créé l'alerte ; j2 (autre clic, même jour) y a été rattachée par journalIds.
    d.journal = [trace("j2"), trace("j1")];
    d.alertes = [
      {
        cibleId: cibleIdAlerteDepuisEmpreinte("h-1"),
        resolue: true,
        resolueAt: RESOLUE,
        metadata: { journalId: "j1", journalIds: ["j2"] },
      },
    ];
    const lignes = await listerDemandes();
    expect(lignes.find((x) => x.id === "j1")?.aTraiter).toBe(false);
    const j2 = lignes.find((x) => x.id === "j2");
    expect(j2?.aTraiter).toBe(false);
    expect(j2?.faiteLe).toEqual(RESOLUE);
  });

  it("2e demande rattachée à une alerte encore ouverte : reste à traiter, puis se ferme avec elle", async () => {
    d.journal = [trace("j2")];
    d.alertes = [
      {
        cibleId: cibleIdAlerteDepuisEmpreinte("h-1"),
        resolue: false,
        resolueAt: null,
        metadata: { journalId: "j1", journalIds: ["j2"] },
      },
    ];
    expect((await listerDemandes())[0]?.aTraiter).toBe(true);
    d.alertes = [
      {
        cibleId: cibleIdAlerteDepuisEmpreinte("h-1"),
        resolue: true,
        resolueAt: RESOLUE,
        metadata: { journalId: "j1", journalIds: ["j2"] },
      },
    ];
    expect((await listerDemandes())[0]?.aTraiter).toBe(false);
  });

  it("🔴 201 exports livrés plus récents qu'une demande d'effacement ouverte : elle reste « à traiter »", async () => {
    const exports = Array.from({ length: 201 }, (_, i) => ({
      id: `e${i}`,
      action: "gdpr.export.delivered",
      createdAt: new Date(DEMANDE.getTime() + (i + 1) * 60_000),
      changes: {},
    }));
    d.journal = [trace("j1"), ...exports];
    d.alertes = [
      {
        cibleId: cibleIdAlerteDepuisEmpreinte("h-1"),
        resolue: false,
        resolueAt: null,
        metadata: { journalId: "j1" },
      },
    ];
    const toutes = await listerDemandes();
    const demande = toutes.find((x) => x.id === "j1");
    expect(demande?.aTraiter).toBe(true);
    expect(toutes[0]?.id).toBe("j1"); // à traiter d'abord
  });
});
