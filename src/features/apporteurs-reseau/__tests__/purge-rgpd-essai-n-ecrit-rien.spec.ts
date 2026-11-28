// PR N : le mode « essai » n'écrit rien en base et envoie UNE alerte récapitulative sans nom.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ecritures, fauxPrisma } from "./purge-rgpd-faux-prisma";

const etat = vi.hoisted(() => ({
  prisma: null as unknown,
  alertes: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return etat.prisma;
  },
}));
vi.mock("../alerte-interne", () => ({
  alerteInterne: vi.fn(async (a: Record<string, unknown>) => {
    etat.alertes.push(a);
    return true;
  }),
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import { modePurgeRgpd, purgerDonneesApporteurs } from "../purge-rgpd";
import { etapePurgeRgpd, jourDuMoisParis } from "../purge-rgpd-etape";

const maintenant = new Date("2031-01-01T10:00:00Z");

beforeEach(() => {
  etat.alertes = [];
  delete process.env.APPORTEURS_PURGE_RGPD;
  etat.prisma = fauxPrisma({
    "apporteurReseau.findMany": [
      {
        id: "a1",
        statut: "refuse",
        refuseAt: new Date("2030-01-01T00:00:00Z"),
        resilieAt: null,
        majAt: new Date("2030-01-01T00:00:00Z"),
        signeParSocieteAt: null,
      },
    ],
    "pieceApporteur.findMany": [
      {
        id: "p9",
        apporteurId: "a2",
        type: "rib",
        statut: "a_retransmettre",
        remplaceeAt: null,
        deposeeAt: new Date("2030-01-01T00:00:00Z"),
      },
    ],
  });
});

describe("mode essai", () => {
  it("n'écrit rien, compte par règle, une alerte sans identifiant ni nom", async () => {
    const b = await purgerDonneesApporteurs(maintenant, "essai");
    const p = etat.prisma as ReturnType<typeof fauxPrisma>;
    expect(ecritures(p.appels)).toEqual([]);
    expect(b.parRegle.refuse_6mois).toBe(1);
    expect(b.parRegle.piece_6mois).toBe(1);
    expect(etat.alertes).toHaveLength(1);
    const texte = JSON.stringify(etat.alertes[0]);
    expect(texte).not.toMatch(/a1|a2|p9/);
    expect(texte).toContain("rien n'a été effacé");
  });
});

describe("l'interrupteur", () => {
  it("absent : rien ne tourne ; valeur inconnue : rien ne tourne", async () => {
    expect(modePurgeRgpd()).toBeNull();
    process.env.APPORTEURS_PURGE_RGPD = "true";
    expect(modePurgeRgpd()).toBeNull();
    await etapePurgeRgpd(maintenant);
    expect((etat.prisma as ReturnType<typeof fauxPrisma>).appels).toEqual([]);
  });
  it("allumé : seulement le 1er du mois à Paris", async () => {
    process.env.APPORTEURS_PURGE_RGPD = "essai";
    expect(jourDuMoisParis(new Date("2031-01-01T10:00:00Z"))).toBe(1);
    expect(jourDuMoisParis(new Date("2031-01-02T10:00:00Z"))).toBe(2);
    await etapePurgeRgpd(new Date("2031-01-02T10:00:00Z"));
    expect((etat.prisma as ReturnType<typeof fauxPrisma>).appels).toEqual([]);
    await etapePurgeRgpd(maintenant);
    expect(etat.alertes).toHaveLength(1);
  });
  it("journal absent (P2021) : rien n'est fait", async () => {
    etat.prisma = fauxPrisma({
      "apporteurPurgeRgpd.findMany": () => {
        throw Object.assign(new Error("absent"), { code: "P2021" });
      },
    });
    const b = await purgerDonneesApporteurs(maintenant, "appliquer");
    expect(b.purgees).toBe(0);
    expect(ecritures((etat.prisma as ReturnType<typeof fauxPrisma>).appels)).toEqual([]);
  });
});

describe("garde-fous métier", () => {
  it("argent en jeu : aucune purge, même après l'échéance", async () => {
    etat.prisma = fauxPrisma({
      "apporteurReseau.findMany": [
        {
          id: "a1",
          statut: "refuse",
          refuseAt: new Date("2020-01-01"),
          resilieAt: null,
          majAt: new Date("2020-01-01"),
          signeParSocieteAt: null,
        },
      ],
      "commissionApporteur.count": 1,
    });
    const b = await purgerDonneesApporteurs(maintenant, "appliquer");
    expect(b.purgees).toBe(0);
    expect(ecritures((etat.prisma as ReturnType<typeof fauxPrisma>).appels)).toEqual([]);
  });
  it("au plus 20 apporteurs par passage", async () => {
    const l = Array.from({ length: 30 }, (_, i) => ({
      id: `a${i}`,
      statut: "refuse",
      refuseAt: new Date("2020-01-01"),
      resilieAt: null,
      majAt: new Date("2020-01-01"),
      signeParSocieteAt: null,
    }));
    etat.prisma = fauxPrisma({ "apporteurReseau.findMany": l });
    const b = await purgerDonneesApporteurs(maintenant, "appliquer");
    expect(b.purgees).toBe(20);
  });
});
