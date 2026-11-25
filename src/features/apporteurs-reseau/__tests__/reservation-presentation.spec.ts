import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 1 (données seules) de la règle « validation d'une entreprise présentée au premier
// rendez-vous tenu » : la réservation se lit en tolérant la table absente (fenêtre app/worker),
// mais s'ÉCRIT sans rien rattraper — une réservation non enregistrée ne doit jamais passer en
// silence.

const p = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationReservation: {
      findMany: (...a: unknown[]) => p.findMany(...a),
      create: (...a: unknown[]) => p.create(...a),
    },
  },
}));

import {
  cleRendezVous,
  enregistrerReservation,
  lireReservations,
  tableAbsente,
} from "../reservation-presentation";

const absente = () => Object.assign(new Error("absente"), { code: "P2021" });

const LIGNE = {
  presentationId: "p1",
  regle: "rendez_vous",
  reserveeJusquAt: new Date("2026-12-25T00:00:00.000Z"),
  echueAt: null,
  rendezVousPrisAt: null,
  rendezVousAt: null,
  rendezVousCle: null,
  validationSource: null,
  valideeAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  p.findMany.mockResolvedValue([]);
  p.create.mockResolvedValue({});
});

describe("tableAbsente", () => {
  it("vrai pour l'erreur Prisma P2021, faux pour le reste", () => {
    expect(tableAbsente(absente())).toBe(true);
    expect(tableAbsente(Object.assign(new Error("unique"), { code: "P2002" }))).toBe(false);
    expect(tableAbsente(new Error("panne"))).toBe(false);
    expect(tableAbsente(null)).toBe(false);
    expect(tableAbsente("P2021")).toBe(false);
  });
});

describe("lireReservations", () => {
  it("liste vide : carte vide, sans requête", async () => {
    expect((await lireReservations([])).size).toBe(0);
    expect(p.findMany).not.toHaveBeenCalled();
  });

  it("table absente (P2021) : carte vide, rien ne lève", async () => {
    p.findMany.mockRejectedValue(absente());
    const m = await lireReservations(["p1"]);
    expect(m.size).toBe(0);
  });

  it("toute autre erreur remonte", async () => {
    p.findMany.mockRejectedValue(Object.assign(new Error("panne"), { code: "P1001" }));
    await expect(lireReservations(["p1"])).rejects.toThrow("panne");
  });

  it("présentation sans ligne : absente de la carte", async () => {
    p.findMany.mockResolvedValue([LIGNE]);
    const m = await lireReservations(["p1", "p2"]);
    expect(m.has("p2")).toBe(false);
    expect(m.get("p1")).toEqual(LIGNE);
    expect(m.size).toBe(1);
    expect(p.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { presentationId: { in: ["p1", "p2"] } } }),
    );
  });
});

describe("enregistrerReservation", () => {
  const jusqua = new Date("2026-12-25T00:00:00.000Z");

  it("crée la ligne avec la règle « rendez_vous »", async () => {
    await enregistrerReservation("p1", jusqua);
    expect(p.create).toHaveBeenCalledWith({
      data: { presentationId: "p1", regle: "rendez_vous", reserveeJusquAt: jusqua },
    });
  });

  it("écrit dans la transaction qu'on lui passe", async () => {
    const create = vi.fn(async () => ({}));
    await enregistrerReservation("p1", jusqua, {
      presentationReservation: { create },
    } as never);
    expect(create).toHaveBeenCalledTimes(1);
    expect(p.create).not.toHaveBeenCalled();
  });

  it("laisse remonter l'erreur de table absente", async () => {
    p.create.mockRejectedValue(absente());
    await expect(enregistrerReservation("p1", jusqua)).rejects.toMatchObject({ code: "P2021" });
  });
});

describe("cleRendezVous", () => {
  it("la clé Calendly prime sur la clé rencontre", () => {
    expect(cleRendezVous({ calendlyEventId: "c1", rencontreId: "r1" })).toBe("calendly:c1");
    expect(cleRendezVous({ calendlyEventId: "c1" })).toBe("calendly:c1");
  });

  it("sans Calendly : la rencontre", () => {
    expect(cleRendezVous({ rencontreId: "r1" })).toBe("rencontre:r1");
    expect(cleRendezVous({ calendlyEventId: null, rencontreId: "r1" })).toBe("rencontre:r1");
  });

  it("rien : null", () => {
    expect(cleRendezVous({})).toBeNull();
    expect(cleRendezVous({ calendlyEventId: null, rencontreId: null })).toBeNull();
    expect(cleRendezVous({ calendlyEventId: "", rencontreId: "" })).toBeNull();
  });
});

describe("le cliquet RGPD connaît les deux tables", () => {
  const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

  it.each(["PresentationReservation", "PropositionRendezVousPresentation"])(
    "%s porte « rgpd: technique — <motif> »",
    (modele) => {
      expect(schema).toMatch(new RegExp(`/// rgpd: technique — \\S[^\\n]*\\nmodel ${modele} \\{`));
    },
  );
});
