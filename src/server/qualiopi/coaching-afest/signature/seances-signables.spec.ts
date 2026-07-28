/**
 * Tests — seances-signables.ts
 *
 * Le cas central n'est pas « une séance future n'est pas signable » : c'est
 * **douze séances back-signables d'un coup en fin de parcours**. C'était l'état
 * réel avant ce module, la seule borne étant l'expiration du jeton (fin de
 * session + 48 h) sur un parcours de 6 à 24 mois.
 */

import { describe, it, expect } from "vitest";
import {
  etatSeance,
  etatsSeances,
  seancesSignables,
  horairesSeance,
  finSeance,
  FENETRE_RATTRAPAGE_SEANCE_MS,
  type SeanceCandidate,
  type EtatSeance,
} from "./seances-signables";

/** 10 juin 2026, 09:00 Paris = 07:00 UTC (heure d'été). */
const DEBUT = new Date("2026-06-10T07:00:00.000Z");

function seance(over: Partial<SeanceCandidate> = {}): SeanceCandidate {
  return {
    id: "cr-1",
    debut: DEBUT,
    dureeMinutes: 150,
    statut: "realisee",
    dejaSigne: false,
    ...over,
  };
}

describe("horairesSeance", () => {
  it("dérive les horaires RÉELS de la séance, en heure de Paris", () => {
    expect(horairesSeance(DEBUT, 150)).toStrictEqual({
      jourParis: "2026-06-10",
      heureDebut: "09:00",
      heureFin: "11:30",
    });
  });

  it("zéro-padde — le CHECK SQL et l'ordre lexicographique l'exigent", () => {
    // 10 juin 08:05 Paris = 06:05 UTC.
    expect(horairesSeance(new Date("2026-06-10T06:05:00.000Z"), 60)).toStrictEqual({
      jourParis: "2026-06-10",
      heureDebut: "08:05",
      heureFin: "09:05",
    });
  });

  it("refuse une durée absente, nulle ou négative plutôt que d'inventer un « 09h00–17h00 »", () => {
    expect(horairesSeance(DEBUT, null)).toBe(null);
    expect(horairesSeance(DEBUT, 0)).toBe(null);
    expect(horairesSeance(DEBUT, -30)).toBe(null);
    expect(horairesSeance(DEBUT, Number.NaN)).toBe(null);
  });

  it("refuse une séance qui déborde sur le jour civil suivant", () => {
    // 10 juin 23:00 Paris = 21:00 UTC, + 120 min → 11 juin 01:00 Paris.
    // Les colonnes sont bornées `HH:MM` et le CHECK exige fin > début : une
    // ligne à « 23:00 → 01:00 » serait rejetée par la base, ou pire, acceptée
    // avec des horaires qui mentent.
    expect(horairesSeance(new Date("2026-06-10T21:00:00.000Z"), 120)).toBe(null);
  });

  it("travaille en heure de PARIS, pas en UTC", () => {
    // 10 juin 21:30 UTC = 23:30 Paris. Un calcul UTC donnerait « 21:30 ».
    expect(horairesSeance(new Date("2026-06-10T21:30:00.000Z"), 20)?.heureDebut).toBe("23:30");
  });

  it("`finSeance` suit la même règle de refus", () => {
    expect(finSeance(DEBUT, null)).toBe(null);
    expect(finSeance(DEBUT, 150)?.toISOString()).toBe("2026-06-10T09:30:00.000Z");
  });
});

describe("etatSeance", () => {
  const finUtc = new Date("2026-06-10T09:30:00.000Z"); // 11:30 Paris

  it("est signable pendant la séance", () => {
    expect(etatSeance(seance(), new Date("2026-06-10T08:00:00.000Z"))).toStrictEqual({
      id: "cr-1",
      signable: true,
    });
  });

  it("est signable juste après la fin", () => {
    expect(etatSeance(seance(), new Date(finUtc.getTime() + 60_000)).signable).toBe(true);
  });

  it("refuse une séance non commencée", () => {
    const e = etatSeance(seance(), new Date("2026-06-10T06:59:00.000Z"));
    expect(e).toStrictEqual({ id: "cr-1", signable: false, motif: "seance_non_commencee" });
  });

  it("reste signable au bord exact de la fenêtre de rattrapage", () => {
    expect(
      etatSeance(seance(), new Date(finUtc.getTime() + FENETRE_RATTRAPAGE_SEANCE_MS)).signable,
    ).toBe(true);
  });

  it("🔴 refuse au-delà de la fenêtre — pas de back-signature de fin de parcours", () => {
    const e = etatSeance(
      seance(),
      new Date(finUtc.getTime() + FENETRE_RATTRAPAGE_SEANCE_MS + 1_000),
    );
    expect(e).toStrictEqual({ id: "cr-1", signable: false, motif: "seance_trop_ancienne" });
  });

  it("🔴 refuse une séance vieille de trois mois", () => {
    const troisMoisApres = new Date("2026-09-10T09:00:00.000Z");
    expect(etatSeance(seance(), troisMoisApres)).toStrictEqual({
      id: "cr-1",
      signable: false,
      motif: "seance_trop_ancienne",
    });
  });

  it("neutralise une séance annulée ou justifiée — elle ne bloque ni ne se signe", () => {
    for (const statut of ["annulee", "absence_justifiee"] as const) {
      expect(etatSeance(seance({ statut }), new Date("2026-06-10T08:00:00.000Z")).signable).toBe(
        false,
      );
      const e = etatSeance(seance({ statut }), new Date("2026-06-10T08:00:00.000Z"));
      expect(e.signable === false && e.motif).toBe("seance_neutralisee");
    }
  });

  it("refuse une séance sans durée renseignée", () => {
    const e = etatSeance(seance({ dureeMinutes: null }), new Date("2026-06-10T08:00:00.000Z"));
    expect(e.signable === false && e.motif).toBe("horaires_indeterminables");
  });

  it("une séance déjà signée le reste, même hors fenêtre", () => {
    // L'ordre des tests compte : annoncer « trop ancienne » sur une signature
    // déjà apposée serait absurde.
    const e = etatSeance(seance({ dejaSigne: true }), new Date("2027-01-01T00:00:00.000Z"));
    expect(e.signable === false && e.motif).toBe("deja_signe");
  });
});

describe("🔴 le scénario que ce module existe pour interdire", () => {
  it("douze séances d'un parcours de six mois ne sont PAS signables le dernier jour", () => {
    // Une séance par quinzaine, à partir du 10 juin.
    const douze: SeanceCandidate[] = Array.from({ length: 12 }, (_, i) => ({
      id: `cr-${String(i)}`,
      debut: new Date(DEBUT.getTime() + i * 14 * 24 * 3600 * 1000),
      dureeMinutes: 150,
      statut: "realisee",
      dejaSigne: false,
    }));
    // Dernier jour du parcours : la 12ᵉ séance vient de finir.
    const dernierJour = new Date(douze[11]!.debut.getTime() + 3 * 3600 * 1000);

    // Une seule est signable : la dernière. Les onze autres sont hors fenêtre.
    expect(seancesSignables(douze, dernierJour)).toStrictEqual(["cr-11"]);

    const motifs = etatsSeances(douze, dernierJour)
      // 🔴 Le prédicat doit dériver d'`EtatSeance`, pas le redécrire à la main :
      // la version manuscrite élargissait `motif` en `string`, ce qui n'est pas
      // assignable à `MotifNonSignable` et faisait échouer la compilation.
      .filter((e): e is Extract<EtatSeance, { signable: false }> => !e.signable)
      .map((e) => e.motif);
    expect(new Set(motifs)).toStrictEqual(new Set(["seance_trop_ancienne"]));
  });
});
