// Les échanges apporteurs sont à part des appels clients (2026-09-19).
//
// Dans l'agenda, un candidat apporteur qui réserve l'échange de 15 minutes se
// mêlait aux appels de découverte des clients. Le filtre `public` les sépare —
// et son ABSENCE doit rendre la liste d'avant, à l'identique : la boîte de
// réception et l'outil MCP appellent ces fonctions sans lui.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: (...a: unknown[]) => findManyMock(...a) } },
}));
vi.mock("@/lib/admin-path", () => ({
  adminPath: (_l: string, p: string) => `/fr/adm/${p}`,
}));

import { getRdvMonth, listRendezVous } from "../queries";

function row(id: string, eventTypeName: string, startTime: string) {
  return {
    id,
    eventTypeName,
    status: "scheduled",
    startTime: new Date(startTime),
    endTime: null,
    inviteeName: null,
    inviteeEmail: null,
    inviteePhone: null,
    location: null,
    rawPayload: {},
    notes: null,
    capturedAt: new Date(startTime),
  };
}

const LIGNES = [
  row("client", "Appel découverte — 30 min", "2026-09-22T08:00:00Z"),
  row("apporteur", "Échange apporteur d'affaires (15 min)", "2026-09-22T09:00:00Z"),
  // Casse et accents : la règle normalise, comme `estAppelApporteur`.
  row("apporteur-maj", "ÉCHANGE APPORTEUR", "2026-09-23T09:00:00Z"),
  row("slug", "premier-contact", "2026-09-24T09:00:00Z"),
];

beforeEach(() => {
  vi.clearAllMocks();
  findManyMock.mockResolvedValue(LIGNES);
});

describe("listRendezVous — public", () => {
  it("apporteurs : seuls les types dont le nom contient « apporteur »", async () => {
    const { rows, total } = await listRendezVous({ public: "apporteurs" });
    expect(rows.map((r) => r.sourceRecordId).sort()).toEqual(["apporteur", "apporteur-maj"]);
    expect(total).toBe(2);
  });

  it("clients : tout le reste, et aucun échange apporteur", async () => {
    const { rows } = await listRendezVous({ public: "clients" });
    expect(rows.map((r) => r.sourceRecordId).sort()).toEqual(["client", "slug"]);
  });

  it("SANS le paramètre : exactement la liste d'avant", async () => {
    const { rows, total } = await listRendezVous({});
    expect(total).toBe(LIGNES.length);
    expect(rows.map((r) => r.sourceRecordId)).toEqual([
      "slug",
      "apporteur-maj",
      "apporteur",
      "client",
    ]);
  });
});

describe("getRdvMonth — public", () => {
  it("apporteurs : le mois ne porte que les échanges apporteurs", async () => {
    const byDay = await getRdvMonth(2026, 9, { public: "apporteurs" });
    const ids = [...byDay.values()].flat().map((r) => r.sourceRecordId);
    expect(ids.sort()).toEqual(["apporteur", "apporteur-maj"]);
  });

  it("SANS options : tout le mois, comme avant", async () => {
    const byDay = await getRdvMonth(2026, 9);
    expect([...byDay.values()].flat()).toHaveLength(LIGNES.length);
  });
});
