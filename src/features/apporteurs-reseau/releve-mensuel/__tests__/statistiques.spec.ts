// @vitest-environment node

/** Lot 3e — logique PURE des statistiques et des anomalies (aucune base). */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  anomaliesDePeriode,
  construireSerie,
  hauteursEnPourcent,
  periodesDouzeMois,
  type ReleveEcran,
  type TotauxPeriode,
} from "../statistiques";

function releve(over: Partial<ReleveEcran> = {}): ReleveEcran {
  return {
    id: "r1",
    numero: "REL-2026-10-0001",
    apporteurId: "a1",
    apporteurNom: "Apporteur fictif",
    rang: 0,
    statut: "prepare",
    nbLignes: 1,
    facturesHtCents: 10_000,
    avoirsHtCents: 0,
    tvaCents: 0,
    ttcCents: 10_000,
    viresTtcCents: 0,
    enAttenteHtCents: 0,
    cumulAnneeHtCents: 10_000,
    empreinteCourte: "abcd1234",
    pdfDisponible: true,
    emailPresent: true,
    erreur: null,
    motifEcart: null,
    envoyeAt: null,
    ...over,
  };
}

function cible(apporteurId: string, nom = "Apporteur fictif") {
  return { apporteurId, nom };
}

describe("periodesDouzeMois", () => {
  it("rend 12 mois consécutifs, le plus ancien d'abord, finissant à la période donnée", () => {
    const p = periodesDouzeMois("2026-10");
    expect(p).toHaveLength(12);
    expect(p[0]).toBe("2025-11");
    expect(p[11]).toBe("2026-10");
  });
});

describe("construireSerie", () => {
  const totaux: TotauxPeriode = {
    nbReleves: 3,
    nbLignes: 5,
    facturesHtCents: 50_000,
    avoirsHtCents: 5_000,
    viresTtcCents: 20_000,
    enAttenteHtCents: 0,
    cumulAnneeHtCents: 0,
  };
  it("lit les colonnes dénormalisées d'un mois préparé, calcule en direct sinon", () => {
    const s = construireSerie(
      ["2026-08", "2026-09", "2026-10"],
      new Map([["2026-10", totaux]]),
      new Map([["2026-09", { facturesHtCents: 7_000, avoirsHtCents: 0 }]]),
    );
    expect(s[2]).toMatchObject({
      source: "releves",
      facturesHtCents: 50_000,
      viresTtcCents: 20_000,
    });
    expect(s[1]).toMatchObject({ source: "direct", facturesHtCents: 7_000, viresTtcCents: null });
    expect(s[0]).toMatchObject({ source: "aucune", facturesHtCents: 0 });
  });
});

describe("hauteursEnPourcent", () => {
  it("met la plus grande valeur à 100 et reste à 0 si tout est nul", () => {
    expect(hauteursEnPourcent([50, 100, 0])).toEqual([50, 100, 0]);
    expect(hauteursEnPourcent([0, 0])).toEqual([0, 0]);
  });
});

describe("anomaliesDePeriode", () => {
  it("aucune anomalie quand tout est complet", () => {
    expect(anomaliesDePeriode({ cibles: [cible("a1")], releves: [releve()] })).toEqual([]);
  });
  it("complétude : une anomalie par apporteur cible sans relevé (rang 0)", () => {
    const a = anomaliesDePeriode({
      cibles: [cible("a1"), cible("a2", "Deux"), cible("a3", "Trois")],
      releves: [releve()],
    });
    const c = a.filter((x) => x.code === "completude");
    expect(c).toHaveLength(2);
    expect(c.map((x) => x.detail).join("|")).toContain("Deux");
    expect(c.map((x) => x.detail).join("|")).toContain("Trois");
  });
  it("complétude par ENSEMBLES : un résilié préparé ne masque pas un signé manquant", () => {
    // 2 cibles (un signé a2, un résilié a9 de la règle Q4 b) ; seul le résilié a un relevé.
    const a = anomaliesDePeriode({
      cibles: [cible("a2", "Signé manquant"), cible("a9", "Résilié")],
      releves: [releve({ id: "r9", apporteurId: "a9" })],
    });
    const c = a.filter((x) => x.code === "completude");
    expect(c).toHaveLength(1);
    expect(c[0]!.detail).toContain("Signé manquant");
  });
  it("un signé APRÈS la coupure n'est pas une cible : aucune anomalie", () => {
    // `cibles` ne le contient pas (la lecture l'exclut) : rien à reprocher.
    expect(
      anomaliesDePeriode({
        cibles: [cible("a1")],
        releves: [releve()],
      }),
    ).toEqual([]);
  });
  it("un relevé de rang > 0 (rectificatif) ne tient pas lieu de relevé d'origine", () => {
    const a = anomaliesDePeriode({
      cibles: [cible("a1")],
      releves: [releve({ rang: 1 })],
    });
    expect(a.map((x) => x.code)).toContain("completude");
  });
  it("e-mail absent, PDF absent, données modifiées, échec d'enfilage", () => {
    const a = anomaliesDePeriode({
      cibles: [cible("a1"), cible("a2"), cible("a3"), cible("a4")],
      releves: [
        releve({ id: "1", apporteurId: "a1", emailPresent: false }),
        releve({ id: "2", apporteurId: "a2", pdfDisponible: false }),
        releve({
          id: "3",
          apporteurId: "a3",
          erreur: "données du mois modifiées depuis la vérification",
        }),
        releve({ id: "4", apporteurId: "a4", statut: "echec", erreur: "envoi interrompu" }),
      ],
    });
    expect(a.map((x) => x.code).sort()).toEqual(
      ["donnees_modifiees", "echec_envoi", "email_absent", "pdf_absent"].sort(),
    );
  });
  it("un relevé écarté ne déclenche ni e-mail absent ni PDF absent", () => {
    const a = anomaliesDePeriode({
      cibles: [cible("a1")],
      releves: [releve({ statut: "ecarte", emailPresent: false, pdfDisponible: false })],
    });
    expect(a).toEqual([]);
  });
});

describe("lireCiblesPeriode (définition des cibles)", () => {
  it("signés contresignés AVANT la coupure, plus les non-signés avec argent en jeu (Q4 b)", async () => {
    const appels: Array<{ where: Record<string, unknown> }> = [];
    const prisma = (await import("@/lib/prisma")).prisma as unknown as Record<string, unknown>;
    prisma.apporteurReseau = {
      findMany: async (arg: { where: Record<string, unknown> }) => {
        appels.push(arg);
        return arg.where.statut === "signe"
          ? [{ id: "s1", prenom: "A", nom: "B", denomination: null }]
          : [{ id: "r1", prenom: "C", nom: "D", denomination: "Société fictive" }];
      },
    };
    const { lireCiblesPeriode } = await import("../statistiques");
    const cibles = await lireCiblesPeriode("2026-10", true);
    expect(cibles.map((c) => c.apporteurId).sort()).toEqual(["r1", "s1"]);
    const signes = appels.find((a) => a.where.statut === "signe")!;
    expect(JSON.stringify(signes.where)).toContain('"signeParSocieteAt":{"lt"');
    const q4b = appels.find((a) => a.where.statut !== "signe")!;
    expect(JSON.stringify(q4b.where)).toContain("autofactureEmiseAt");
    expect(JSON.stringify(q4b.where)).toContain("autofactureAttenteDepuis");
    // identité masquée : aucun nom réel
    prisma.apporteurReseau = {
      findMany: async () => [{ id: "s1", prenom: "A", nom: "B", denomination: null }],
    };
    const masque = await lireCiblesPeriode("2026-10", false);
    expect(masque[0]!.nom).toBe("Apporteur (identité masquée)");
  });
});
