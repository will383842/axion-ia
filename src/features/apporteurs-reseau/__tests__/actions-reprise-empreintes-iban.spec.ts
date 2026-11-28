// Reprise des empreintes IBAN depuis la console : super_admin SEUL, essai à blanc / appliquer, trace d'audit sans IBAN.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  reprise: vi.fn(),
  journal: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => etat.session) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../reprise-historique-iban", () => ({ repriseEmpreintesIban: etat.reprise }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: etat.journal }));

import { repriseEmpreintesIbanAction } from "../actions-reprise-empreintes-iban";

const COMPTES = {
  appliquer: false,
  refus: null,
  vus: 3,
  dejaAJour: 1,
  aCalculer: 2,
  calcules: 0,
  ignores: { sansIban: 0, illisible: 0, ecritureEchouee: 0 },
};

beforeEach(() => {
  etat.session = null;
  etat.reprise.mockReset().mockResolvedValue(COMPTES);
  etat.journal.mockReset().mockResolvedValue(true);
});

describe("repriseEmpreintesIbanAction", () => {
  it("sans session : refus, rien n'est lancé", async () => {
    expect(await repriseEmpreintesIbanAction({ appliquer: false })).toMatchObject({ ok: false });
    expect(etat.reprise).not.toHaveBeenCalled();
  });
  it.each(["admin", "secretaire", "editor", "reader", "responsable_qualite"])(
    "%s : refusé, même en appelant l'action directement",
    async (role) => {
      etat.session = { user: { id: "u1", role } };
      expect(await repriseEmpreintesIbanAction({ appliquer: true })).toMatchObject({ ok: false });
      expect(etat.reprise).not.toHaveBeenCalled();
      expect(etat.journal).not.toHaveBeenCalled();
    },
  );
  it("super_admin : essai à blanc accepté, comptes rendus, trace sans IBAN", async () => {
    etat.session = { user: { id: "u1", role: "super_admin" } };
    const r = await repriseEmpreintesIbanAction({ appliquer: false });
    expect(r).toMatchObject({ ok: true, comptes: { vus: 3, aCalculer: 2 } });
    expect(etat.reprise).toHaveBeenCalledWith({ appliquer: false });
    const entree = etat.journal.mock.calls[0]?.[1];
    expect(entree.action).toBe("apporteur.reprise_empreintes_iban.essai");
    expect(entree.session).toEqual({ userId: "u1" });
    expect(entree.changes).toMatchObject({ appliquer: false, vus: 3 });
  });
  it("super_admin : appliquer est tracé « appliquee » avec les comptes", async () => {
    etat.session = { user: { id: "u1", role: "super_admin" } };
    etat.reprise.mockResolvedValue({ ...COMPTES, appliquer: true, calcules: 2 });
    const r = await repriseEmpreintesIbanAction({ appliquer: true });
    expect(r).toMatchObject({ ok: true });
    expect(etat.reprise).toHaveBeenCalledWith({ appliquer: true });
    expect(etat.journal.mock.calls[0]?.[1].action).toBe(
      "apporteur.reprise_empreintes_iban.appliquee",
    );
    expect(etat.journal.mock.calls[0]?.[1].changes).toMatchObject({ appliquer: true, calcules: 2 });
  });
  it("secret absent : refus clair relayé, tracé", async () => {
    etat.session = { user: { id: "u1", role: "super_admin" } };
    etat.reprise.mockResolvedValue({ ...COMPTES, refus: "secret_absent" });
    const r = await repriseEmpreintesIbanAction({ appliquer: true });
    expect(r).toMatchObject({ ok: false });
    expect(etat.journal).toHaveBeenCalled();
  });
  it("une panne de la reprise ne fuit aucun détail", async () => {
    etat.session = { user: { id: "u1", role: "super_admin" } };
    etat.reprise.mockRejectedValue(new Error("FR1420041010050500013M02606"));
    const r = await repriseEmpreintesIbanAction({ appliquer: true });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("FR14");
  });
});
