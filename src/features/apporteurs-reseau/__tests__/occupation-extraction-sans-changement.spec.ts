// `perimetreOccupe` rend, sur les cas de `reponse-deja-attribuee.spec.ts`, la même réponse que `refusBienRecu`.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  actives: [] as Array<Record<string, unknown>>,
  terminees: [] as Array<Record<string, unknown>>,
  reservations: [] as Array<Record<string, unknown>>,
}));

vi.mock("server-only", () => ({}));
vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, vrai.AVANT_2_6] as const)),
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationReservation: { findMany: vi.fn(async () => etat.reservations) },
    presentationEntreprise: {
      findMany: vi.fn(async (a: { where: { statut: unknown } }) =>
        (a.where.statut as { in?: string[] }).in ? etat.actives : etat.terminees,
      ),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { perimetreOccupe } from "../occupation";

const MAINT = new Date("2026-11-20T10:00:00Z");
const P = { siren: "123456782", siret: null, entreprise: true };
const occupe = (opts = {}) => perimetreOccupe(prisma as never, P, MAINT, opts);

beforeEach(() => {
  etat.actives = [];
  etat.terminees = [];
  etat.reservations = [];
});

describe("perimetreOccupe", () => {
  it("rien d'autre sur le SIREN : libre", async () => {
    expect(await occupe()).toBe(false);
  });

  it("une réservée à qui l'on a écrit : occupé", async () => {
    etat.actives = [
      {
        id: "P1",
        apporteurId: "APP1",
        statut: "reservee",
        contactEnvoyeAt: new Date("2026-11-01T00:00:00Z"),
        recueAt: new Date("2026-11-01T00:00:00Z"),
        protegeeJusquAt: null,
      },
    ];
    expect(await occupe()).toBe(true);
  });

  it("confirmée dont la protection est passée : libre ; encore valide : occupé", async () => {
    const base = {
      id: "P1",
      apporteurId: "APP1",
      statut: "confirmee",
      contactEnvoyeAt: new Date("2026-05-01T00:00:00Z"),
      recueAt: new Date("2026-05-01T00:00:00Z"),
    };
    etat.actives = [{ ...base, protegeeJusquAt: new Date("2026-11-19T00:00:00Z") }];
    expect(await occupe()).toBe(false);
    etat.actives = [{ ...base, protegeeJusquAt: new Date("2026-11-21T00:00:00Z") }];
    expect(await occupe()).toBe(true);
  });

  it("terminée sans validation : occupé pendant ses 30 jours de repos, libre ensuite", async () => {
    etat.terminees = [
      {
        id: "P1",
        apporteurId: "APP1",
        statut: "terminee",
        contactEnvoyeAt: new Date("2026-09-01T00:00:00Z"),
        recueAt: new Date("2026-09-01T00:00:00Z"),
        protegeeJusquAt: null,
      },
    ];
    const reservation = (echueAt: string) => ({
      presentationId: "P1",
      regle: "rendez_vous",
      reserveeJusquAt: new Date("2026-10-30T00:00:00Z"),
      echueAt: new Date(echueAt),
      rendezVousPrisAt: null,
      valideeAt: null,
    });
    etat.reservations = [reservation("2026-11-10T00:00:00Z")];
    expect(await occupe()).toBe(true);
    etat.reservations = [reservation("2026-10-01T00:00:00Z")];
    expect(await occupe()).toBe(false);
  });

  it("saufApporteurId écarte l'apporteur indiqué (le filtre part dans la requête)", async () => {
    await occupe({ saufApporteurId: "APP9" });
    const appels = (prisma.presentationEntreprise.findMany as ReturnType<typeof vi.fn>).mock.calls;
    expect(appels.at(-1)![0].where.apporteurId).toEqual({ not: "APP9" });
  });
});
