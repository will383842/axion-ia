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
    expect(s[2]).toMatchObject({ source: "releves", facturesHtCents: 50_000, viresTtcCents: 20_000 });
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
    expect(anomaliesDePeriode({ nbCibles: 1, releves: [releve()] })).toEqual([]);
  });
  it("complétude : moins de relevés (rang 0) que de cibles", () => {
    const a = anomaliesDePeriode({ nbCibles: 3, releves: [releve()] });
    expect(a.map((x) => x.code)).toContain("completude");
    expect(a.find((x) => x.code === "completude")?.detail).toContain("2");
  });
  it("e-mail absent, PDF absent, données modifiées, échec d'enfilage", () => {
    const a = anomaliesDePeriode({
      nbCibles: 4,
      releves: [
        releve({ id: "1", emailPresent: false }),
        releve({ id: "2", pdfDisponible: false }),
        releve({ id: "3", erreur: "données du mois modifiées depuis la vérification" }),
        releve({ id: "4", statut: "echec", erreur: "envoi interrompu" }),
      ],
    });
    expect(a.map((x) => x.code).sort()).toEqual(
      ["donnees_modifiees", "echec_envoi", "email_absent", "pdf_absent"].sort(),
    );
  });
  it("un relevé écarté ne déclenche ni e-mail absent ni PDF absent", () => {
    const a = anomaliesDePeriode({
      nbCibles: 1,
      releves: [releve({ statut: "ecarte", emailPresent: false, pdfDisponible: false })],
    });
    expect(a).toEqual([]);
  });
});
