/* eslint-disable @typescript-eslint/no-explicit-any -- doubles de base en mémoire */
import { beforeEach, describe, expect, it, vi } from "vitest";

// L3c (console) : une réservation ÉCHUE non validée reste proposée à la saisie d'un rendez-vous
// (présentation `terminee`, jamais confirmée), avec sa date de fin.
type Ligne = Record<string, any>;
const bd = vi.hoisted(() => ({ lignes: [] as Ligne[], pres: [] as Ligne[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationReservation: {
      findMany: async ({ where }: any) =>
        bd.lignes.filter(
          (l) =>
            l.regle === where.regle &&
            l.valideeAt == null &&
            (where.echueAt === null ? l.echueAt == null : l.echueAt != null),
        ),
    },
    presentationEntreprise: {
      findMany: async ({ where }: any) =>
        bd.pres.filter(
          (p) =>
            where.id.in.includes(p.id) &&
            where.OR.some((c: Ligne) =>
              Object.entries(c).every(([k, v]: [string, any]) =>
                v === null ? p[k] == null : v?.in ? v.in.includes(p[k]) : p[k] === v,
              ),
            ),
        ),
    },
  },
}));

import { LIBELLE_RESERVATION_ECHUE, lireReservationsOuvertes } from "../requetes-console";

const FIN = new Date("2026-12-31T10:00:00Z");
const ECHUE = new Date("2027-01-01T04:00:00Z");
const ligne = (id: string, o: Ligne = {}) => ({
  presentationId: id,
  regle: "rendez_vous",
  reserveeJusquAt: FIN,
  echueAt: null,
  valideeAt: null,
  ...o,
});
const pres = (id: string, o: Ligne = {}) => ({
  id,
  denomination: id,
  siren: "732829320",
  recueAt: new Date("2026-11-01T10:00:00Z"),
  statut: "reservee",
  confirmeeAt: null,
  apporteur: { prenom: "A", nom: "B" },
  ...o,
});

beforeEach(() => {
  bd.lignes.length = 0;
  bd.pres.length = 0;
  vi.stubEnv("DATABASE_URL", "postgresql://x:y@db:5432/z");
});

describe("lireReservationsOuvertes : les réservations échues non validées restent saisissables", () => {
  it("inclut une ligne échue (présentation terminee, jamais confirmée) avec sa date de fin", async () => {
    bd.lignes.push(ligne("p1"), ligne("p2", { echueAt: ECHUE }));
    bd.pres.push(pres("p1"), pres("p2", { statut: "terminee" }));
    const v = await lireReservationsOuvertes();
    expect(v.map((x) => x.presentationId).sort()).toEqual(["p1", "p2"]);
    expect(v.find((x) => x.presentationId === "p1")!.echueAt).toBeNull();
    expect(v.find((x) => x.presentationId === "p2")!.echueAt).toEqual(ECHUE);
  });

  it("exclut une présentation terminee déjà confirmée, et une ligne validée", async () => {
    bd.lignes.push(
      ligne("p1", { echueAt: ECHUE }),
      ligne("p2", { echueAt: ECHUE, valideeAt: ECHUE }),
    );
    bd.pres.push(
      pres("p1", { statut: "terminee", confirmeeAt: new Date("2026-12-01T10:00:00Z") }),
      pres("p2", { statut: "terminee" }),
    );
    expect(await lireReservationsOuvertes()).toEqual([]);
  });

  it("une présentation terminee SANS échéance (résiliation) n'est pas proposée", async () => {
    bd.lignes.push(ligne("p1"));
    bd.pres.push(pres("p1", { statut: "terminee" }));
    expect(await lireReservationsOuvertes()).toEqual([]);
  });

  it("le libellé dit que la validation reste possible si le rendez-vous a été pris avant cette date", () => {
    expect(LIBELLE_RESERVATION_ECHUE("1 janvier 2027")).toBe(
      "Réservation terminée le 1 janvier 2027 ; validation encore possible si le rendez-vous a été pris avant cette date",
    );
  });
});
