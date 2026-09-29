// @vitest-environment node
/**
 * Le CHANGEMENT D'HEURE du 25/10/2026 (Paris passe de UTC+2 à UTC+1 à 3 h) :
 * « demain », « échue », « ce mois-ci » et la relance « dans 5 jours ouvrés »
 * se comptent en JOURS DE PARIS. Un calcul en UTC déplacerait d'un jour ce
 * qui tombe entre minuit et 1 h ou 2 h du matin.
 *
 * Mutation qui fait rougir : remplacer `dayKeyInParis(x)` par
 * `x.toISOString().slice(0, 10)` dans `compterVeille` → le 1er test rougit.
 * Contre-témoin : un rendez-vous d'après-demain n'est pas « demain ».
 */

import { describe, expect, it } from "vitest";

import {
  dossierEnMemoire,
  fiche,
  id,
} from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { jourOuvreApres } from "@/features/dossier-client/suite-proposee";
import { compterSuitesEchues, compterVeille } from "../balayage";

function rencontre(clientId: unknown, debut: Date) {
  return {
    id: id(5),
    source: "saisie_manuelle",
    type: "visio",
    titre: "Rendez-vous",
    clientId,
    rattachementStatut: "valide",
    statut: "planifie",
    estTestInterne: false,
    debutPrevu: debut,
  };
}

describe("les jours du balayage suivent Paris au changement d'heure (25/10/2026)", () => {
  it("la veille : un rendez-vous du lundi 26 à 0 h 30 (Paris) est « demain » le dimanche 25", async () => {
    const f = fiche({ raisonSociale: "Fiche Fictive" });
    // Lundi 26/10 à 0 h 30 à Paris = dimanche 25/10 à 23 h 30 UTC (heure d'hiver).
    const lundiMinuitTrente = new Date("2026-10-25T23:30:00Z");
    // Après-demain : mardi 27/10 à 9 h Paris.
    const mardi = new Date("2026-10-27T08:00:00Z");
    const base = dossierEnMemoire({
      client: [f],
      rencontre: [rencontre(f["id"], lundiMinuitTrente), rencontre(f["id"], mardi)],
    });
    // Dimanche 25/10 à 10 h Paris (9 h UTC, heure d'hiver depuis 3 h).
    const dimanche = new Date("2026-10-25T09:00:00Z");
    expect(await compterVeille(base.client as never, dimanche)).toBe(1);
  });

  it("une suite du 25/10 est échue le 26 à 0 h 30 (Paris), pas avant", async () => {
    const base = dossierEnMemoire({
      rencontreSuivi: [
        {
          rencontreId: id(5),
          issue: "eu_lieu",
          suite: "relance",
          suiteLe: new Date("2026-10-25T00:00:00Z"),
        },
      ],
    });
    // 25/10 à 23 h 30 Paris = 22 h 30 UTC : encore le 25, pas échue.
    expect(await compterSuitesEchues(base.client as never, new Date("2026-10-25T22:30:00Z"))).toBe(
      0,
    );
    // 26/10 à 0 h 30 Paris = 25/10 à 23 h 30 UTC : c'est le 26 à Paris, échue.
    expect(await compterSuitesEchues(base.client as never, new Date("2026-10-25T23:30:00Z"))).toBe(
      1,
    );
  });

  it("la relance à 5 jours ouvrés saute le week-end, en jours de Paris", () => {
    // Vendredi 23/10 à 23 h 30 Paris (21 h 30 UTC) : c'est vendredi.
    expect(jourOuvreApres(new Date("2026-10-23T21:30:00Z"), 5)).toBe("2026-10-30");
    // Samedi 24/10 à 0 h 30 Paris (23/10 22 h 30 UTC) : c'est samedi.
    expect(jourOuvreApres(new Date("2026-10-23T22:30:00Z"), 5)).toBe("2026-10-30");
    // Dimanche 25/10 (jour du changement d'heure) → lundi 26 est le 1er jour ouvré.
    expect(jourOuvreApres(new Date("2026-10-25T12:00:00Z"), 1)).toBe("2026-10-26");
  });
});
