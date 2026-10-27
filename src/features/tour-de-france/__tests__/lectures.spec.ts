import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  groupBy: vi.fn(),
  findMany: vi.fn(),
  rdv: vi.fn(),
  decrypt: vi.fn((v: string) => v.replace(/^enc:/, "")),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tourDemande: { groupBy: m.groupBy, findMany: m.findMany },
    calendlyEvent: { findMany: m.rdv },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: m.decrypt }));

import { hashEmailForLookup } from "@/lib/security/email-hash";
import { compteurParVille, lireCompteursPublics, lireDemandesConsole } from "../lectures";

const ligne = (id: string, email: string, extra: Record<string, unknown> = {}) => ({
  id,
  nom: `enc:Personne ${id}`,
  email: `enc:${email}`,
  telephone: "enc:0612345678",
  emailHash: hashEmailForLookup(email),
  villeSaisie: "lyon",
  villeCle: "lyon",
  villeNom: "Lyon",
  statut: "recue",
  rattachement: "sans_fiche",
  clientId: null,
  fichesProches: null,
  compte: true,
  doublonDeId: null,
  depuis: null,
  creeLe: new Date("2026-10-27T10:00:00Z"),
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.decrypt.mockImplementation((v: string) => v.replace(/^enc:/, ""));
  m.rdv.mockResolvedValue([]);
});

describe("lectures : une base qui échoue rend une liste vide, jamais une page en erreur", () => {
  it("lireCompteursPublics", async () => {
    m.groupBy.mockRejectedValue(new Error("table absente"));
    await expect(lireCompteursPublics()).resolves.toEqual([]);
  });

  it("compteurParVille", async () => {
    m.groupBy.mockRejectedValue(new Error("table absente"));
    await expect(compteurParVille()).resolves.toEqual([]);
  });

  it("lireDemandesConsole", async () => {
    m.findMany.mockRejectedValue(new Error("table absente"));
    const r = await lireDemandesConsole();
    expect(r.demandes).toEqual([]);
    expect(r.tronquee).toBe(false);
  });
});

describe("lectures : le compteur public", () => {
  it("compte les demandes comptées et écarte celles que l'équipe a écartées", async () => {
    m.groupBy.mockResolvedValue([{ villeCle: "lyon", villeNom: "Lyon", _count: { _all: 4 } }]);
    const r = await lireCompteursPublics();
    expect(r).toEqual([{ villeCle: "lyon", villeNom: "Lyon", total: 4 }]);
    const arg = m.groupBy.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ compte: true, statut: { not: "ecartee" } });
  });
});

describe("lectures : la console", () => {
  it("déchiffre la personne et calcule « rendez-vous pris » par l'empreinte de l'e-mail", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr"), ligne("b", "bob@exemple.fr")]);
    m.rdv.mockResolvedValue([{ inviteeEmail: "Alice@Exemple.fr" }]);
    const r = await lireDemandesConsole();
    expect(r.demandes.map((d) => [d.nom, d.statut])).toEqual([
      ["Personne a", "rdv_pris"],
      ["Personne b", "recue"],
    ]);
    expect(r.demandes[0]?.email).toBe("alice@exemple.fr");
    expect(r.rapprochementIndisponible).toBe(false);
    const rdv = m.rdv.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(rdv.where["typeRendezVous"]).toBe("tour_de_france_ia");
    expect(rdv.where["status"]).toEqual({ not: "canceled" });
  });

  it("une panne de la lecture des rendez-vous est dite, sans casser la liste", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr")]);
    m.rdv.mockRejectedValue(new Error("calendly_events"));
    const r = await lireDemandesConsole();
    expect(r.demandes).toHaveLength(1);
    expect(r.demandes[0]?.statut).toBe("recue");
    expect(r.rapprochementIndisponible).toBe(true);
  });

  it("filtre par statut affiché et par ville", async () => {
    m.findMany.mockResolvedValue([
      ligne("a", "alice@exemple.fr"),
      ligne("b", "bob@exemple.fr", { statut: "ecartee" }),
    ]);
    const r = await lireDemandesConsole({ statut: "ecartee", ville: "lyon" });
    expect(r.demandes.map((d) => d.id)).toEqual(["b"]);
    const arg = m.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ villeCle: "lyon" });
  });

  it("une valeur chiffrée illisible s'affiche « illisible », sans lever", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr")]);
    m.decrypt.mockImplementation(() => {
      throw new Error("clé absente");
    });
    const r = await lireDemandesConsole();
    expect(r.demandes[0]?.nom).toBe("illisible");
  });
});

describe("lectures : le compteur de la console", () => {
  it("regroupe par ville : toutes les demandes, et celles qui comptent", async () => {
    m.groupBy.mockResolvedValue([
      { villeCle: "lyon", villeNom: "Lyon", compte: true, _count: { _all: 3 } },
      { villeCle: "lyon", villeNom: "Lyon", compte: false, _count: { _all: 2 } },
      { villeCle: "?annecy", villeNom: null, compte: true, _count: { _all: 1 } },
    ]);
    const r = await compteurParVille();
    expect(r[0]).toEqual({ villeCle: "lyon", ville: "Lyon", demandes: 5, comptees: 3 });
    expect(r[1]).toEqual({ villeCle: "?annecy", ville: "annecy", demandes: 1, comptees: 1 });
  });
});
