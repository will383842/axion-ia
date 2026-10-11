/**
 * Lot L16a — l'effacement art. 17 d'un formateur indépendant est un geste
 * d'ADMINISTRATEUR : garde super-admin, confirmation saisie, fiche désignée par
 * son UUID, journal sans donnée personnelle.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
  effacer: vi.fn(),
  journal: vi.fn(),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireSuperAdmin: (...a: unknown[]) => m.requireSuperAdmin(...a),
  donneesJournalQualiopi: (...a: unknown[]) => m.journal(...a),
}));
vi.mock("@/lib/rgpd-formateur-independant", () => ({
  CONFIRMATION_EFFACEMENT_FORMATEUR: "EFFACER",
  effacerFormateurIndependant: (...a: unknown[]) => m.effacer(...a),
}));

import { effacerFormateurIndependantAction } from "../rgpd-formateur-independant";

const ID = "11111111-1111-4111-8111-111111111111";
const SESSION = { userId: "22222222-2222-4222-8222-222222222222", role: "super_admin" };
const FAIT = { formateur: "efface", piecesMasquees: 1, piecesLegalesIntactes: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  m.requireSuperAdmin.mockResolvedValue(SESSION);
  m.effacer.mockResolvedValue(FAIT);
  m.journal.mockResolvedValue({});
});

describe("effacerFormateurIndependantAction", () => {
  it("🔴 un rôle non super-admin est refusé avant toute écriture", async () => {
    m.requireSuperAdmin.mockRejectedValue(new Error("forbidden"));
    await expect(
      effacerFormateurIndependantAction({ trainerId: ID, confirmation: "EFFACER" }),
    ).rejects.toThrow("forbidden");
    expect(m.effacer).not.toHaveBeenCalled();
  });

  it("sans la confirmation exacte → refus, rien n'est fait", async () => {
    const r = await effacerFormateurIndependantAction({
      trainerId: ID,
      confirmation: "effacer" as "EFFACER",
    });
    expect(r.ok).toBe(false);
    expect(m.effacer).not.toHaveBeenCalled();
  });

  it("identifiant non UUID → refus (aucune cible non UUID au journal)", async () => {
    const r = await effacerFormateurIndependantAction({
      trainerId: "formatrice@example.test",
      confirmation: "EFFACER",
    });
    expect(r.ok).toBe(false);
    expect(m.effacer).not.toHaveBeenCalled();
  });

  it("journal : cible = UUID de la fiche, changements = comptes seulement", async () => {
    const r = await effacerFormateurIndependantAction({ trainerId: ID, confirmation: "EFFACER" });
    expect(r).toEqual({ ok: true, resultat: FAIT });
    const [, options] = m.effacer.mock.calls[0]! as [
      string,
      { acteurId: string; journal: (x: unknown) => Promise<unknown> },
    ];
    expect(options.acteurId).toBe(SESSION.userId);
    await options.journal(FAIT);
    expect(m.journal).toHaveBeenCalledWith({
      action: "qualiopi.trainer.rgpd_effacement",
      targetType: "Trainer",
      targetId: ID,
      changes: FAIT,
      session: SESSION,
    });
  });

  it("interrupteur éteint → rien n'est déclaré fait", async () => {
    m.effacer.mockResolvedValue({
      formateur: "eteint",
      piecesMasquees: 0,
      piecesLegalesIntactes: 0,
    });
    const r = await effacerFormateurIndependantAction({ trainerId: ID, confirmation: "EFFACER" });
    expect(r.ok).toBe(false);
  });
});
