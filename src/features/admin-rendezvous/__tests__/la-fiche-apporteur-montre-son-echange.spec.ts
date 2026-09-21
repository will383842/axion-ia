// La fiche apporteur montre l'échange qui lui est rattaché (2026-09-19).
//
// La requête lit bien les rendez-vous de CETTE fiche. Le filtre de rôle du bloc
// qui l'affiche est testé à côté du composant
// (`components/admin/contacts/__tests__/rendez-vous-apporteur.spec.ts`).

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));

import { listRendezVousDeFiche } from "../queries";

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([
    {
      id: "evt_1",
      eventTypeName: "Échange apporteur (15 min)",
      status: "scheduled",
      startTime: new Date("2026-09-22T08:00:00Z"),
      endTime: new Date("2026-09-22T08:15:00Z"),
      inviteeName: "Léa",
      inviteeEmail: "lea@example.com",
      inviteePhone: null,
      location: null,
      rawPayload: {},
      notes: null,
      capturedAt: new Date("2026-09-19T08:00:00Z"),
    },
  ]);
});

describe("listRendezVousDeFiche", () => {
  it("lit les rendez-vous rattachés à CETTE fiche, et eux seuls", async () => {
    const rdvs = await listRendezVousDeFiche("sub_42");
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ where: { linkedSubmissionId: "sub_42" } });
    expect(rdvs.map((r) => r.sourceRecordId)).toEqual(["evt_1"]);
    expect(rdvs[0]?.detailHref).toBe("/fr/adm/contacts/appels/evt_1");
  });
});
