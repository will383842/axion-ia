/**
 * L7 — la lecture du fil d'un futur apporteur : les quatre sources arrivent
 * dans le fil, et un rôle qui ne voit pas les appels n'y voit pas l'échange.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const J = (j: number) => new Date(Date.UTC(2026, 9, j, 10));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submissionReply: { findMany: async () => [] },
    emailLog: {
      findMany: async () => [
        { id: "i1", createdAt: J(1), template: "apporteur-invitation-appel", status: "sent" },
        { id: "i2", createdAt: J(4), template: "apporteur-invitation-relance", status: "sent" },
      ],
    },
    calendlyEvent: {
      findMany: async () => [
        { id: "c1", capturedAt: J(5), startTime: J(9), status: "scheduled", suivi: null },
      ],
    },
  },
}));
vi.mock("@/features/commercial-application/reponses-recues", () => ({
  lireReponsesRecues: async () => [
    { id: "r1", recueLe: J(6), objet: "Re", extrait: "Parfait", automatique: false, lienZoho: "z" },
  ],
}));
vi.mock("@/features/admin-calendly/acces", () => ({
  peutVoirLesAppels: (r: string | null) => r === "admin",
}));
vi.mock("@/server/partages/config", () => ({ partagesActifs: () => false }));
vi.mock("@/server/partages/suivi", () => ({}));
vi.mock("@/features/admin-job-applications/timeline", () => ({
  lireFrise: vi.fn(),
  LIBELLE_EVENEMENT: {},
}));
vi.mock("@/features/admin-job-applications/reponses-recues", () => ({
  lireReponsesRecuesCandidat: vi.fn(),
}));
vi.mock("@/features/commercial-application/invitation-apporteur", () => ({
  GABARIT_INVITATION_APPORTEUR: "apporteur-invitation-appel",
}));

import { lireFilApporteur } from "../lire-fil";

beforeEach(() => vi.clearAllMocks());

describe("lireFilApporteur", () => {
  it("invité, relancé, a répondu, a réservé → quatre faits dans l'ordre", async () => {
    const fil = await lireFilApporteur("s1", { role: "admin" });
    expect(fil.map((f) => f.titre)).toEqual([
      "Reçu",
      "Échange de 15 minutes réservé",
      "Envoyé · Rappel automatique",
      "Envoyé · Invitation à l'échange",
    ]);
  });

  it("un rôle qui ne voit pas les appels ne voit pas l'échange réservé", async () => {
    const fil = await lireFilApporteur("s1", { role: "editor" });
    expect(fil.map((f) => f.titre)).not.toContain("Échange de 15 minutes réservé");
  });
});
