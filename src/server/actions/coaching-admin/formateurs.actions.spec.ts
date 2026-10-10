/**
 * Lot S1 (ADR 0066) — la console coaching était la QUATRIÈME porte : elle
 * écrivait `Trainer.actif` en direct, ouverte à `editor`, sans garde.
 * Elle passe désormais par l'écrivain unique.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  trainerUpdate: vi.fn(),
  trainerUpdateMany: vi.fn(),
  trainerFindUnique: vi.fn(),
  missionUpdateMany: vi.fn(),
  session: { userId: "admin-uuid", role: "super_admin" } as { userId: string; role: string },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      update: (...a: unknown[]) => m.trainerUpdate(...a),
      updateMany: (...a: unknown[]) => m.trainerUpdateMany(...a),
      findUnique: (...a: unknown[]) => m.trainerFindUnique(...a),
    },
    missionFormateur: { updateMany: (...a: unknown[]) => m.missionUpdateMany(...a) },
    activityLog: { create: vi.fn() },
  },
}));
vi.mock("@/server/actions/intervention-documents/_guards", () => ({
  requireAdminWrite: vi.fn(async () => m.session),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/formateur/magic-link", () => ({ createFormateurMagicLink: vi.fn() }));

import { setFormateurActifAction } from "./formateurs.actions";

const TRAINER_ID = "22222222-2222-2222-2222-222222222222";

function aEcritActifVrai(): boolean {
  return [...m.trainerUpdate.mock.calls, ...m.trainerUpdateMany.mock.calls].some(
    (c) => (c[0] as { data?: { actif?: boolean } })?.data?.actif === true,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  m.session = { userId: "admin-uuid", role: "super_admin" };
  m.trainerUpdate.mockResolvedValue({ id: TRAINER_ID });
  m.trainerUpdateMany.mockResolvedValue({ count: 1 });
  m.missionUpdateMany.mockResolvedValue({ count: 0 });
});

describe("setFormateurActifAction", () => {
  it("🔴 REFUSE d'activer un sous-traitant dont le dossier est vide", async () => {
    m.trainerFindUnique.mockResolvedValue({
      statut: "sous_traitant",
      actif: false,
      sousTraitantVerifieAt: null,
      sousTraitantNda: null,
      sousTraitantContratSigneAt: null,
      documents: [],
    });
    const r = await setFormateurActifAction({ trainerId: TRAINER_ID, actif: true });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/déclaration d'activité/);
    expect(aEcritActifVrai()).toBe(false);
  });

  it("salarié : un `editor` le réactive comme avant (INCHANGÉ)", async () => {
    m.session = { userId: "editeur-uuid", role: "editor" };
    m.trainerFindUnique.mockResolvedValue({
      statut: "salarie",
      actif: false,
      sousTraitantVerifieAt: null,
      sousTraitantNda: null,
      sousTraitantContratSigneAt: null,
      documents: [],
    });
    const r = await setFormateurActifAction({ trainerId: TRAINER_ID, actif: true });
    expect(r).toEqual({ ok: true });
    expect(aEcritActifVrai()).toBe(true);
  });

  it("la désactivation coupe l'accès ET retire les propositions en attente", async () => {
    const r = await setFormateurActifAction({ trainerId: TRAINER_ID, actif: false });
    expect(r).toEqual({ ok: true });
    expect(m.missionUpdateMany).toHaveBeenCalledWith({
      where: { trainerId: TRAINER_ID, statut: "en_attente" },
      data: { statut: "retiree" },
    });
  });
});
