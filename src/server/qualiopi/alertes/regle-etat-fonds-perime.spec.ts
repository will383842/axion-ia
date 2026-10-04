/**
 * Alerte `etat_fonds_perime` (lot OPCO A5, élargie au lot A7c — manque n°8) :
 * relevé le plus récent de plus de 31 jours, OU aucun relevé pour un OPCO qui a
 * au moins une session à venir (la veille n'a jamais été amorcée).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSessions, mockReleves, mockDernier } = vi.hoisted(() => ({
  mockSessions: vi.fn(),
  mockReleves: vi.fn(),
  mockDernier: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: mockSessions },
    etatFondsOpco: { findMany: mockReleves },
  },
}));
vi.mock("@/server/qualiopi/financements/etat-fonds-opco-lecture", () => ({
  dernierReleveEtatFonds: mockDernier,
}));

import { candidatsEtatFondsPerime, regleEtatFondsPerime } from "./regle-etat-fonds-perime";
import type { SessionOpcoAVenir } from "./sessions-opco-a-venir";

const J = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const NOW = J("2026-10-04");

const session = (opco: string | null, s: Partial<SessionOpcoAVenir> = {}): SessionOpcoAVenir => ({
  id: `s-${opco}`,
  numero: "AXI-SES-301",
  dateDebut: J("2026-11-10"),
  client: {
    id: "c-1",
    type: "entreprise",
    opco,
    opcoIdentifie: null,
    idcc: null,
    effectif: 10,
  },
  dossiersFinancement: [],
  ...s,
});

describe("candidatsEtatFondsPerime", () => {
  it("relevé de plus de 31 jours : une alerte ciblée sur le relevé (comportement A5 conservé)", () => {
    const [a, ...reste] = candidatsEtatFondsPerime(
      { dernier: { id: "f1", releveLe: D("2026-08-20") }, opcosSansReleve: [] },
      NOW,
    );
    expect(reste).toEqual([]);
    expect(a?.code).toBe("etat_fonds_perime");
    expect(a?.cibleType).toBe("EtatFondsOpco");
    expect(a?.cibleId).toBe("f1");
  });

  it("🔴 aucun relevé du tout, mais une session Akto à venir : l'alerte se lève", () => {
    const [a] = candidatsEtatFondsPerime({ dernier: null, opcosSansReleve: ["akto"] }, NOW);
    expect(a?.code).toBe("etat_fonds_perime");
    expect(a?.niveau).toBe("important");
    expect(a?.cibleType).toBeUndefined();
    expect(a?.cibleId).toBeUndefined();
    expect(a?.message).toContain("Akto");
  });

  it("relevé récent et aucun OPCO sans relevé : rien", () => {
    expect(
      candidatsEtatFondsPerime(
        { dernier: { id: "f2", releveLe: D("2026-09-20") }, opcosSansReleve: [] },
        NOW,
      ),
    ).toEqual([]);
  });

  it("les deux causes à la fois : deux alertes distinctes (relevé ciblé, veille non amorcée sans cible)", () => {
    const alertes = candidatsEtatFondsPerime(
      { dernier: { id: "f1", releveLe: D("2026-08-20") }, opcosSansReleve: ["atlas", "akto"] },
      NOW,
    );
    expect(alertes).toHaveLength(2);
    expect(alertes[1]?.message).toContain("Akto, Atlas");
  });
});

describe("regleEtatFondsPerime", () => {
  beforeEach(() => {
    mockSessions.mockReset();
    mockReleves.mockReset();
    mockDernier.mockReset();
  });

  it("lève quand un OPCO d'une session à venir n'a aucun relevé", async () => {
    mockDernier.mockResolvedValue({ id: "f-atlas", releveLe: D("2026-09-30") });
    mockSessions.mockResolvedValue([session("akto"), session("atlas")]);
    mockReleves.mockResolvedValue([{ opco: "atlas" }]);
    const alertes = await regleEtatFondsPerime(NOW);
    expect(alertes).toHaveLength(1);
    expect(alertes[0]?.message).toContain("Akto");
    expect(alertes[0]?.message).not.toContain("Atlas");
    expect(mockReleves.mock.calls[0]?.[0]?.where).toEqual({ opco: { in: ["akto", "atlas"] } });
  });

  it("lit l'OPCO par la règle unique (ancien texte libre reconnu)", async () => {
    mockDernier.mockResolvedValue(null);
    mockSessions.mockResolvedValue([
      session(null, {
        client: {
          id: "c-2",
          type: "entreprise",
          opco: null,
          opcoIdentifie: "akto",
          idcc: null,
          effectif: 3,
        },
      }),
    ]);
    mockReleves.mockResolvedValue([]);
    expect(await regleEtatFondsPerime(NOW)).toHaveLength(1);
  });

  it("se résout dès qu'un relevé existe pour chaque OPCO concerné", async () => {
    mockDernier.mockResolvedValue({ id: "f-akto", releveLe: D("2026-10-02") });
    mockSessions.mockResolvedValue([session("akto")]);
    mockReleves.mockResolvedValue([{ opco: "akto" }]);
    expect(await regleEtatFondsPerime(NOW)).toEqual([]);
  });

  it("aucune session à venir : aucune lecture des relevés, aucune alerte de veille", async () => {
    mockDernier.mockResolvedValue(null);
    mockSessions.mockResolvedValue([]);
    expect(await regleEtatFondsPerime(NOW)).toEqual([]);
    expect(mockReleves).not.toHaveBeenCalled();
  });

  it("un client particulier ou sans OPCO reconnu n'amorce pas la veille", async () => {
    mockDernier.mockResolvedValue(null);
    mockSessions.mockResolvedValue([
      session("akto", {
        client: {
          id: "c-3",
          type: "particulier",
          opco: "akto",
          opcoIdentifie: null,
          idcc: null,
          effectif: null,
        },
      }),
      session(null),
    ]);
    expect(await regleEtatFondsPerime(NOW)).toEqual([]);
    expect(mockReleves).not.toHaveBeenCalled();
  });
});
