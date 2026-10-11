// L-ENV (P6) — Les e-mails aux formateurs indépendants échappent aux règles attrape-tout,
// et leur approbation en corbeille comme toute règle qui les nomme sont réservées au
// super-admin. Les autres e-mails ne changent pas.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { refusGabaritFormateur, resoudreModeEnvoi } from "@/server/email/outbox-policy";

describe("resoudreModeEnvoi — formateurs indépendants", () => {
  it("une règle globale attrape-tout `validation` ne les emporte pas", () => {
    const regles = [
      { scope: "global" as const, clientId: null, template: null, mode: "validation" as const },
    ];
    expect(resoudreModeEnvoi("formateur-dossier-relance", regles)).toBe("auto");
    // Témoin : un e-mail commercial reste emporté par la même règle.
    expect(resoudreModeEnvoi("devis-envoi", regles)).toBe("validation");
  });
  it("une règle qui NOMME le gabarit s'applique", () => {
    const regles = [
      {
        scope: "global" as const,
        clientId: null,
        template: "formateur-dossier-relance",
        mode: "validation" as const,
      },
    ];
    expect(resoudreModeEnvoi("formateur-dossier-relance", regles)).toBe("validation");
  });
  it("un gabarit « formateur-… » existant n'est pas concerné", () => {
    const regles = [
      { scope: "global" as const, clientId: null, template: null, mode: "validation" as const },
    ];
    expect(resoudreModeEnvoi("formateur-mission-proposee", regles)).toBe("validation");
  });
});

describe("refusGabaritFormateur", () => {
  it("refuse un non super-admin sur un gabarit formateur indépendant", () => {
    expect(refusGabaritFormateur("formateur-issue-non-retenu", false)).toMatch(/super-admin/);
    expect(refusGabaritFormateur("formateur-issue-non-retenu", true)).toBeNull();
  });
  it("laisse passer tout le reste", () => {
    expect(refusGabaritFormateur(null, false)).toBeNull();
    expect(refusGabaritFormateur("devis-envoi", false)).toBeNull();
    expect(refusGabaritFormateur("formateur-mission-proposee", false)).toBeNull();
  });
});

// ── Les actions de la corbeille ────────────────────────────────────────────

const h = vi.hoisted(() => ({
  session: { userId: "u-1", role: "editor" },
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => h.session,
  logQualiopiActivity: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn(async () => ({ enqueued: true })) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findUnique: (...a: unknown[]) => h.findUnique(...a),
      updateMany: (...a: unknown[]) => h.updateMany(...a),
    },
    emailAutomationSetting: {
      findFirst: (...a: unknown[]) => h.findFirst(...a),
      create: (...a: unknown[]) => h.create(...a),
      update: vi.fn(),
    },
  },
}));

import {
  approuverEmailAction,
  definirReglageEmailAction,
} from "@/server/actions/qualiopi/email-outbox";

const OUTBOX = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  h.session = { userId: "u-1", role: "editor" };
  h.findFirst.mockResolvedValue(null);
  h.create.mockResolvedValue({ id: OUTBOX });
  h.updateMany.mockResolvedValue({ count: 0 });
});

describe("approuverEmailAction", () => {
  it("un editor ne peut pas approuver un e-mail formateur indépendant", async () => {
    h.findUnique.mockResolvedValue({
      id: OUTBOX,
      template: "formateur-issue-non-retenu",
      statut: "a_valider",
    });
    const r = await approuverEmailAction({ id: OUTBOX });
    expect(r).toEqual({ error: expect.stringMatching(/super-admin/) });
    expect(h.updateMany).not.toHaveBeenCalled();
  });
  it("un super-admin passe la garde", async () => {
    h.session = { userId: "u-1", role: "super_admin" };
    h.findUnique.mockResolvedValue({
      id: OUTBOX,
      template: "formateur-issue-non-retenu",
      statut: "a_valider",
    });
    await approuverEmailAction({ id: OUTBOX });
    expect(h.updateMany).toHaveBeenCalled();
  });
});

describe("definirReglageEmailAction", () => {
  it("un editor ne peut pas poser de règle qui nomme un gabarit formateur indépendant", async () => {
    const r = await definirReglageEmailAction({
      scope: "global",
      template: "formateur-dossier-relance",
      mode: "auto",
    });
    expect(r).toEqual({ error: expect.stringMatching(/super-admin/) });
    expect(h.create).not.toHaveBeenCalled();
  });
  it("une règle attrape-tout reste permise (elle ne les emporte pas)", async () => {
    const r = await definirReglageEmailAction({ scope: "global", template: null, mode: "auto" });
    expect(r).toEqual({ data: { id: OUTBOX } });
  });
});
