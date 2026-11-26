import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  appels: [] as string[],
}));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => etat.session) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("../regime-tva", () => ({
  changerRegimeTva: vi.fn(async () => {
    etat.appels.push("changer");
    return { ok: true, changementId: "x", message: "ok" };
  }),
  annulerChangementAVenir: vi.fn(async () => {
    etat.appels.push("annuler");
    return { ok: true, message: "ok" };
  }),
  piecesEmisesDepuis: vi.fn(async () => []),
  jourDepuisSaisie: (s: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(s) ? "2026-12-01" : null),
}));

import {
  annulerChangementRegimeTvaAction,
  changerRegimeTvaAction,
  piecesEmisesDepuisAction,
} from "../actions-regime-tva";

const ID = "6f1f6f1f-6f1f-4f1f-8f1f-6f1f6f1f6f1f";
const saisie = { apporteurId: ID, regimeTva: "franchise_293b", effetAu: "01/12/2026" };

beforeEach(() => {
  etat.session = null;
  etat.appels = [];
});

describe("actions de changement de régime de TVA : session et droit « contresigner »", () => {
  it("sans session : refus, rien n'est appelé", async () => {
    expect(await changerRegimeTvaAction(saisie)).toMatchObject({ ok: false });
    expect(
      await annulerChangementRegimeTvaAction({ apporteurId: ID, changementId: ID }),
    ).toMatchObject({ ok: false });
    expect(
      await piecesEmisesDepuisAction({ apporteurId: ID, effetAu: "01/12/2026" }),
    ).toMatchObject({ ok: false });
    expect(etat.appels).toEqual([]);
  });

  it("rôle sans le droit : refus", async () => {
    etat.session = { user: { id: "U1", role: "reader" } };
    expect(await changerRegimeTvaAction(saisie)).toMatchObject({
      ok: false,
      message: "Réservé aux administrateurs.",
    });
    expect(etat.appels).toEqual([]);
  });

  it("administrateur : l'action passe, avec un UUID valide et un régime connu seulement", async () => {
    etat.session = { user: { id: "U1", role: "super_admin" } };
    expect(await changerRegimeTvaAction({ ...saisie, apporteurId: "pas-un-uuid" })).toMatchObject({
      ok: false,
    });
    expect(await changerRegimeTvaAction({ ...saisie, regimeTva: "debits" })).toMatchObject({
      ok: false,
    });
    expect(await changerRegimeTvaAction(saisie)).toMatchObject({ ok: true });
    expect(etat.appels).toEqual(["changer"]);
  });
});
