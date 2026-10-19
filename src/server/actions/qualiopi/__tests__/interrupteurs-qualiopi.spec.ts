/**
 * Tests — l'écran « Interrupteurs Qualiopi » (chantier QNC) : l'action de
 * bascule, la liste des lots, la page sans base.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ecriture: vi.fn(),
  basculer: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ requireAdminWrite: m.ecriture }));
vi.mock("@/server/qualiopi/socle/interrupteurs", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/socle/interrupteurs")>()),
  basculerInterrupteurQualiopi: m.basculer,
}));

import { basculerInterrupteurQualiopiAction } from "../interrupteurs-qualiopi";
import {
  LOTS_INTERRUPTEURS,
  estLotInterrupteurConnu,
} from "@/server/qualiopi/socle/lots-interrupteurs";

beforeEach(() => {
  vi.clearAllMocks();
  m.ecriture.mockResolvedValue({ userId: "u1", role: "admin" });
  m.basculer.mockImplementation(async (e: { lot: string; etat: string }) => ({
    cle: `qualiopi.${e.lot}.actif`,
    avant: "eteint",
    apres: e.etat,
  }));
});

describe("basculerInterrupteurQualiopiAction", () => {
  it("est refusée sans droit d'écriture : rien n'est écrit", async () => {
    m.ecriture.mockRejectedValue(new Error("forbidden"));
    await expect(
      basculerInterrupteurQualiopiAction({ lot: "veille", etat: "essai" }),
    ).rejects.toThrow("forbidden");
    expect(m.basculer).not.toHaveBeenCalled();
  });

  it.each(["editor", "secretaire", "responsable_qualite", "reader"])(
    "refuse la bascule au rôle « %s » : un interrupteur actif envoie de vrais e-mails",
    async (role) => {
      m.ecriture.mockResolvedValue({ userId: "u2", role });
      const r = await basculerInterrupteurQualiopiAction({
        lot: "convocation_v2",
        etat: "actif",
        confirmerActif: true,
      });
      expect(r.ok).toBe(false);
      expect(m.basculer).not.toHaveBeenCalled();
    },
  );

  it.each(["admin", "super_admin"])("accepte la bascule du rôle « %s »", async (role) => {
    m.ecriture.mockResolvedValue({ userId: "u3", role });
    const r = await basculerInterrupteurQualiopiAction({ lot: "veille", etat: "essai" });
    expect(r.ok).toBe(true);
    expect(m.basculer).toHaveBeenCalledOnce();
  });

  it("refuse un lot inconnu", async () => {
    const r = await basculerInterrupteurQualiopiAction({ lot: "inconnu", etat: "essai" });
    expect(r).toEqual({ ok: false, error: "Interrupteur inconnu." });
    expect(m.basculer).not.toHaveBeenCalled();
  });

  it("refuse un lot formateurs.* ou un lot de test du socle", async () => {
    for (const lot of ["formateurs.textes_valides", "l99", "absent", "a.b", ""]) {
      const r = await basculerInterrupteurQualiopiAction({ lot, etat: "essai" });
      expect(r.ok, lot).toBe(false);
    }
    expect(m.basculer).not.toHaveBeenCalled();
  });

  it("refuse un état invalide", async () => {
    const r = await basculerInterrupteurQualiopiAction({ lot: "veille", etat: "allume" });
    expect(r).toEqual({ ok: false, error: "État invalide." });
    expect(m.basculer).not.toHaveBeenCalled();
  });

  it("bascule via basculerInterrupteurQualiopi (journalisé) avec l'identifiant de l'admin", async () => {
    const r = await basculerInterrupteurQualiopiAction({ lot: "veille", etat: "essai" });
    expect(m.basculer).toHaveBeenCalledWith({ lot: "veille", etat: "essai", adminUserId: "u1" });
    expect(r).toMatchObject({ ok: true, etat: "essai" });
  });

  it("exige la confirmation pour passer à actif", async () => {
    const sans = await basculerInterrupteurQualiopiAction({ lot: "veille", etat: "actif" });
    expect(sans.ok).toBe(false);
    expect(m.basculer).not.toHaveBeenCalled();
    const avec = await basculerInterrupteurQualiopiAction({
      lot: "veille",
      etat: "actif",
      confirmerActif: true,
    });
    expect(avec).toMatchObject({ ok: true, etat: "actif" });
  });

  it("n'exige pas de confirmation pour essai ou éteint", async () => {
    for (const etat of ["essai", "eteint"]) {
      expect((await basculerInterrupteurQualiopiAction({ lot: "moyens", etat })).ok).toBe(true);
    }
  });

  it("rend une erreur claire si la transaction échoue (journal impossible)", async () => {
    m.basculer.mockRejectedValue(new Error("journal"));
    const r = await basculerInterrupteurQualiopiAction({ lot: "veille", etat: "essai" });
    expect(r).toEqual({ ok: false, error: "La bascule a échoué : rien n'a été modifié." });
  });
});

describe("la liste des lots", () => {
  it("exclut formateurs.* et la visio, et porte libellé + description pour chaque lot", () => {
    expect(LOTS_INTERRUPTEURS.length).toBeGreaterThan(10);
    for (const l of LOTS_INTERRUPTEURS) {
      expect(l.lot, l.lot).toMatch(/^[a-z0-9_]{1,40}$/);
      expect(l.lot).not.toMatch(/formateurs|visio/);
      expect(l.libelle.length).toBeGreaterThan(3);
      expect(l.description.length).toBeGreaterThan(20);
    }
    expect(new Set(LOTS_INTERRUPTEURS.map((l) => l.lot)).size).toBe(LOTS_INTERRUPTEURS.length);
    expect(estLotInterrupteurConnu("veille")).toBe(true);
    expect(estLotInterrupteurConnu("formateurs.textes_valides")).toBe(false);
  });
});

describe("la bascule est journalisée", () => {
  it("écrit le réglage ET la ligne activity_logs (qui, avant, après) dans la même transaction", async () => {
    const reel = await vi.importActual<typeof import("@/server/qualiopi/socle/interrupteurs")>(
      "@/server/qualiopi/socle/interrupteurs",
    );
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      setting: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
      },
      activityLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const r = await reel.basculerInterrupteurQualiopi(
      { lot: "veille", etat: "essai", adminUserId: "u1" },
      { $transaction: async (fn: (t: never) => Promise<unknown>) => fn(tx as never) } as never,
    );
    expect(r).toEqual({ cle: "qualiopi.veille.actif", avant: "eteint", apres: "essai" });
    expect(tx.setting.upsert).toHaveBeenCalledOnce();
    expect(tx.activityLog.create).toHaveBeenCalledOnce();
    expect(tx.activityLog.create.mock.calls[0]?.[0].data).toMatchObject({
      action: "qualiopi.interrupteur_bascule",
      adminUserId: "u1",
    });
  });
});
