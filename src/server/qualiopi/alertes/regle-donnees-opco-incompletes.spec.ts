/**
 * Alerte `donnees_opco_incompletes` (lot OPCO A7c, manques n°3 et n°8) : client
 * entreprise avec une session à venir financée par un OPCO, mais sans OPCO
 * reconnu, ou sans IDCC, ou sans effectif. UNE alerte par client.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSessions } = vi.hoisted(() => ({ mockSessions: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { trainingSession: { findMany: mockSessions } } }));

import {
  candidatsDonneesOpcoIncompletes,
  regleDonneesOpcoIncompletes,
} from "./regle-donnees-opco-incompletes";
import type { ClientOpcoLu, SessionOpcoAVenir } from "./sessions-opco-a-venir";
import { ALERTE_CATALOGUE } from "./catalogue";
import { guichetPourCode } from "./routage";

const J = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

const COMPLET: ClientOpcoLu = {
  id: "c-1",
  type: "entreprise",
  opco: "akto",
  opcoIdentifie: null,
  idcc: "1516",
  effectif: 12,
};

const session = (
  numero: string,
  client: Partial<ClientOpcoLu> | null,
  dateDebut = J("2026-11-10"),
): SessionOpcoAVenir => ({
  id: `s-${numero}`,
  numero,
  dateDebut,
  client: client === null ? null : { ...COMPLET, ...client },
  dossiersFinancement: [],
});

describe("candidatsDonneesOpcoIncompletes", () => {
  it("client complet : rien", () => {
    expect(candidatsDonneesOpcoIncompletes([session("S-1", {})])).toEqual([]);
  });

  it("lève une alerte ciblée sur le CLIENT, qui dit ce qui manque", () => {
    const [a] = candidatsDonneesOpcoIncompletes([session("S-1", { idcc: null, effectif: null })]);
    expect(a?.code).toBe("donnees_opco_incompletes");
    expect(a?.niveau).toBe("important");
    expect(a?.cibleType).toBe("Client");
    expect(a?.cibleId).toBe("c-1");
    expect(a?.message).toContain("IDCC");
    expect(a?.message).toContain("effectif");
    expect(a?.message).not.toContain("OPCO reconnu");
    expect(a?.message).toContain("S-1");
  });

  it("OPCO absent ou texte libre non reconnu : « OPCO reconnu » manque", () => {
    const [absent] = candidatsDonneesOpcoIncompletes([session("S-1", { opco: null })]);
    expect(absent?.message).toContain("OPCO reconnu");
    const [libre] = candidatsDonneesOpcoIncompletes([
      session("S-2", { opco: null, opcoIdentifie: "OPCO du coin" }),
    ]);
    expect(libre?.message).toContain("OPCO reconnu");
    expect(libre?.message).toContain("« OPCO du coin »");
  });

  it("l'ancien texte libre reconnu SUFFIT (règle unique opcoDuClient)", () => {
    expect(
      candidatsDonneesOpcoIncompletes([session("S-1", { opco: null, opcoIdentifie: "akto" })]),
    ).toEqual([]);
  });

  it("un IDCC illisible compte comme absent", () => {
    const [a] = candidatsDonneesOpcoIncompletes([session("S-1", { idcc: "n/a" })]);
    expect(a?.message).toContain("IDCC");
  });

  it("🔴 UNE seule alerte par client, même avec trois sessions", () => {
    const alertes = candidatsDonneesOpcoIncompletes([
      session("S-1", { effectif: null }),
      session("S-2", { effectif: null }),
      session("S-3", { effectif: null }),
    ]);
    expect(alertes).toHaveLength(1);
    expect(alertes[0]?.message).toContain("S-1");
    expect(alertes[0]?.message).toContain("3 sessions");
  });

  it("🔴 client particulier : jamais alerté", () => {
    expect(
      candidatsDonneesOpcoIncompletes([
        session("S-1", { type: "particulier", opco: null, idcc: null, effectif: null }),
      ]),
    ).toEqual([]);
  });

  it("session sans client : rien à cibler", () => {
    expect(candidatsDonneesOpcoIncompletes([session("S-1", null)])).toEqual([]);
  });

  it("se résout quand la fiche est complétée", () => {
    expect(candidatsDonneesOpcoIncompletes([session("S-1", { effectif: null })])).toHaveLength(1);
    expect(candidatsDonneesOpcoIncompletes([session("S-1", { effectif: 4 })])).toEqual([]);
  });
});

describe("regleDonneesOpcoIncompletes — requête", () => {
  beforeEach(() => mockSessions.mockReset());

  it("lit les sessions planifiées à venir financées par un OPCO, avec les deux champs OPCO", async () => {
    mockSessions.mockResolvedValue([session("S-1", { effectif: null })]);
    const alertes = await regleDonneesOpcoIncompletes(J("2026-10-04"));
    expect(alertes).toHaveLength(1);
    const args = mockSessions.mock.calls[0]?.[0];
    expect(args.where.statut).toBe("planifiee");
    expect(args.where.OR).toEqual(
      expect.arrayContaining([{ financementType: { in: ["opco", "mixte"] } }]),
    );
    expect(args.select.client.select).toMatchObject({
      type: true,
      opco: true,
      opcoIdentifie: true,
      idcc: true,
      effectif: true,
    });
  });

  it("au catalogue : guichet direction, résolution automatique", () => {
    expect(ALERTE_CATALOGUE["donnees_opco_incompletes"]?.resolutionAuto).toBe(true);
    expect(guichetPourCode("donnees_opco_incompletes")).toBe("direction");
  });
});
