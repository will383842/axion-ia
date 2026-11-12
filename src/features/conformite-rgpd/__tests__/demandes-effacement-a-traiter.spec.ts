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
});
