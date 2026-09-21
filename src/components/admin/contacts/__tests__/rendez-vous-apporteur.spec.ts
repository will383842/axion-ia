// Fiche apporteur — le bloc « Échange réservé » (2026-09-19).
//
// Régime FILTRE de `admin-calendly/acces.ts` : un rôle qui ne voit pas les
// appels ne rend rien ET ne déclenche même pas la lecture de `calendly_events`.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { RendezVousApporteur } from "../RendezVousApporteur";

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

describe("RendezVousApporteur", () => {
  it("un rôle qui ne voit pas les appels ne rend rien ET ne lit rien", async () => {
    const rendu = await RendezVousApporteur({ submissionId: "sub_42", role: "reader" });
    expect(rendu).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("un rôle habilité voit le bloc", async () => {
    const rendu = await RendezVousApporteur({ submissionId: "sub_42", role: "admin" });
    expect(rendu).not.toBeNull();
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
