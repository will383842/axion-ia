/**
 * Tests — creneaux-signables.ts
 *
 * Ce que ce module empêche : qu'un stagiaire signe six demi-journées d'un coup
 * le dernier jour, ou qu'il signe d'avance une matinée qu'il n'a pas suivie.
 * `CAA Nantes 20/04/2021` sanctionne les « signatures à la chaîne » et les dates
 * impossibles — un filtre qui laisserait passer ces deux cas ne servirait à rien.
 *
 * Les instants sont écrits en UTC et la bascule est vérifiée EN HEURE DE PARIS,
 * été comme hiver : c'est là que se cachent les erreurs d'une à deux heures.
 */

import { describe, it, expect } from "vitest";
import {
  demiJourneeCommencee,
  etatsCreneaux,
  creneauxSignables,
  type CreneauCandidat,
} from "./creneaux-signables";

function creneau(over: Partial<CreneauCandidat> = {}): CreneauCandidat {
  return {
    id: "cre-1",
    date: "2026-06-10",
    demiJournee: "matin",
    jourHeureDebut: "09:00",
    jourHeureFin: "17:00",
    dejaSigne: false,
    ...over,
  };
}

describe("demiJourneeCommencee", () => {
  it("la matinée s'ouvre à son heure de début, pas avant", () => {
    // 2026-06-10 est en heure d'été : Paris = UTC+2. 09:00 Paris = 07:00 UTC.
    expect(demiJourneeCommencee(creneau(), new Date("2026-06-10T06:59:00Z"))).toBe(false);
    expect(demiJourneeCommencee(creneau(), new Date("2026-06-10T07:00:00Z"))).toBe(true);
  });

  it("l'après-midi s'ouvre au pivot, pas au début de la journée", () => {
    const c = creneau({ demiJournee: "apres_midi" });
    // Pivot 13:00 Paris = 11:00 UTC en été.
    expect(demiJourneeCommencee(c, new Date("2026-06-10T09:00:00Z"))).toBe(false); // 11 h Paris
    expect(demiJourneeCommencee(c, new Date("2026-06-10T11:00:00Z"))).toBe(true); // 13 h Paris
  });

  it("⭐ ne bascule PAS une heure trop tôt en heure d'hiver", () => {
    // 2026-01-14, Paris = UTC+1. 09:00 Paris = 08:00 UTC.
    const c = creneau({ date: "2026-01-14" });
    expect(demiJourneeCommencee(c, new Date("2026-01-14T07:59:00Z"))).toBe(false);
    expect(demiJourneeCommencee(c, new Date("2026-01-14T08:00:00Z"))).toBe(true);
  });

  it("une journée passée est toujours ouverte — c'est le rattrapage des 48 h", () => {
    expect(demiJourneeCommencee(creneau(), new Date("2026-06-11T05:00:00Z"))).toBe(true);
  });

  it("une journée future ne l'est jamais, même tard dans la soirée", () => {
    expect(
      demiJourneeCommencee(creneau({ date: "2026-06-12" }), new Date("2026-06-10T22:00:00Z")),
    ).toBe(false);
  });

  it("une matinée seule utilise sa propre fin, pas le pivot", () => {
    const c = creneau({ jourHeureFin: "12:30" });
    expect(demiJourneeCommencee(c, new Date("2026-06-10T07:00:00Z"))).toBe(true);
  });

  it("une après-midi seule s'ouvre à son propre début, pas au pivot", () => {
    const c = creneau({
      demiJournee: "apres_midi",
      jourHeureDebut: "14:00",
      jourHeureFin: "17:30",
    });
    // 13:00 Paris (11:00 UTC) : le pivot est passé mais la demi-journée commence à 14:00.
    expect(demiJourneeCommencee(c, new Date("2026-06-10T11:00:00Z"))).toBe(false);
    expect(demiJourneeCommencee(c, new Date("2026-06-10T12:00:00Z"))).toBe(true);
  });
});

describe("etatsCreneaux", () => {
  it("🔴 empêche de signer les six demi-journées d'un coup le premier matin", () => {
    // Le scénario que le filtre existe pour interdire : une formation de 3 jours,
    // et un stagiaire qui voudrait tout signer dès l'ouverture.
    const jours = ["2026-06-10", "2026-06-11", "2026-06-12"];
    const tous = jours.flatMap((date) =>
      (["matin", "apres_midi"] as const).map((dj) =>
        creneau({ id: `${date}-${dj}`, date, demiJournee: dj }),
      ),
    );

    // 09:30 Paris le premier jour.
    const signables = creneauxSignables(tous, new Date("2026-06-10T07:30:00Z"));
    expect(signables).toEqual(["2026-06-10-matin"]);
  });

  it("ouvre progressivement au fil de la formation", () => {
    const tous = [
      creneau({ id: "j1-matin", demiJournee: "matin" }),
      creneau({ id: "j1-aprem", demiJournee: "apres_midi" }),
      creneau({ id: "j2-matin", date: "2026-06-11", demiJournee: "matin" }),
    ];
    // 14:00 Paris le premier jour : les deux demi-journées du jour 1 sont ouvertes.
    expect(creneauxSignables(tous, new Date("2026-06-10T12:00:00Z"))).toEqual([
      "j1-matin",
      "j1-aprem",
    ]);
  });

  it("un créneau déjà signé n'est plus signable, et le motif le dit", () => {
    const etats = etatsCreneaux([creneau({ dejaSigne: true })], new Date("2026-06-10T12:00:00Z"));
    expect(etats[0]).toEqual({ id: "cre-1", signable: false, motif: "deja_signe" });
  });

  it("« déjà signé » PRIME sur « pas encore commencé »", () => {
    // Annoncer « pas encore commencé » sur une signature déjà apposée serait
    // absurde — et ce cas existe si les horaires sont corrigés après coup.
    const etats = etatsCreneaux(
      [creneau({ date: "2026-06-20", dejaSigne: true })],
      new Date("2026-06-10T12:00:00Z"),
    );
    expect(etats[0]).toMatchObject({ motif: "deja_signe" });
  });

  it("distingue « pas encore commencé » d'un créneau simplement absent", () => {
    // Un créneau qui disparaîtrait de l'écran passerait pour un bug ; le motif
    // permet de dire au stagiaire qu'il devra revenir.
    const etats = etatsCreneaux(
      [creneau({ demiJournee: "apres_midi" })],
      new Date("2026-06-10T07:30:00Z"),
    );
    expect(etats[0]).toEqual({ id: "cre-1", signable: false, motif: "pas_encore_commence" });
  });

  it("conserve l'ordre reçu", () => {
    const tous = [
      creneau({ id: "a", demiJournee: "matin" }),
      creneau({ id: "b", demiJournee: "apres_midi" }),
    ];
    expect(etatsCreneaux(tous, new Date("2026-06-10T12:00:00Z")).map((e) => e.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("une liste vide ne lève pas", () => {
    expect(etatsCreneaux([], new Date())).toEqual([]);
  });
});
