// Ordre de la liste « Appels réservés » (régression 2026-07-29).
//
// Constaté en production juste après l'activation de l'enrichissement Calendly :
// la réservation du 23/07 — la plus récente, et la seule à avoir un horaire —
// s'affichait SOUS celles du 09/07 et du 01/07.
//
// Cause : `ORDER BY start_time DESC` place les NULL en tête sous Postgres. Tant
// qu'aucune ligne n'avait d'horaire, l'ordre retombait sur `captured_at` et
// paraissait juste. Dès qu'une ligne était enrichie, elle passait dernière.
//
// Le tri se fait donc désormais en mémoire sur l'ancre d'affichage
// (`startTime ?? capturedAt`), la même qui détermine le jour affiché.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: (...a: unknown[]) => findManyMock(...a) } },
}));
vi.mock("@/lib/admin-path", () => ({
  adminPath: (_l: string, p: string) => `/fr/adm/${p}`,
}));

import { listRendezVous } from "../queries";

function row(id: string, capturedAt: string, startTime: string | null) {
  return {
    id,
    eventTypeName: "premier-contact",
    status: "scheduled",
    startTime: startTime ? new Date(startTime) : null,
    endTime: null,
    inviteeName: null,
    inviteeEmail: null,
    inviteePhone: null,
    location: null,
    notes: null,
    capturedAt: new Date(capturedAt),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("listRendezVous — ordre chronologique", () => {
  it("place la réservation enrichie du 23/07 en tête, pas en queue", async () => {
    // Volontairement dans l'ordre que renvoyait Postgres (NULLS FIRST).
    findManyMock.mockResolvedValueOnce([
      row("b", "2026-07-09T15:52:00Z", null),
      row("c", "2026-07-09T07:32:00Z", null),
      row("d", "2026-07-01T15:15:00Z", null),
      row("a", "2026-07-23T07:26:00Z", "2026-07-23T09:30:00Z"),
    ]);
    const { rows } = await listRendezVous({});
    expect(rows.map((r) => r.sourceRecordId)).toEqual(["a", "b", "c", "d"]);
  });

  it("mélange sainement lignes horodatées et lignes sans heure", async () => {
    findManyMock.mockResolvedValueOnce([
      row("vieux-horodate", "2026-07-01T08:00:00Z", "2026-07-02T08:00:00Z"),
      row("recent-sans-heure", "2026-07-20T08:00:00Z", null),
      row("futur-horodate", "2026-07-25T08:00:00Z", "2026-08-10T08:00:00Z"),
    ]);
    const { rows } = await listRendezVous({});
    expect(rows.map((r) => r.sourceRecordId)).toEqual([
      "futur-horodate",
      "recent-sans-heure",
      "vieux-horodate",
    ]);
  });

  it("la pagination reste cohérente avec l'ordre trié", async () => {
    findManyMock.mockResolvedValueOnce([
      row("d", "2026-07-01T00:00:00Z", null),
      row("a", "2026-07-23T00:00:00Z", "2026-07-23T09:30:00Z"),
      row("b", "2026-07-09T00:00:00Z", null),
    ]);
    const { rows, total } = await listRendezVous({ page: 2, pageSize: 1 });
    expect(total).toBe(3);
    expect(rows.map((r) => r.sourceRecordId)).toEqual(["b"]);
  });
});
