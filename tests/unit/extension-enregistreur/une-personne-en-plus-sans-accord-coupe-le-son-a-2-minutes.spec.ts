/**
 * ⛔ UNE PERSONNE EN PLUS SANS ACCORD COUPE LE SON À 2 MINUTES (PR 5, V7-02).
 *
 * Un participant arrive en cours d'appel : notification immédiate ; sans
 * « Nouvelle personne : accord obtenu » sous 2 minutes, le GAIN passe à zéro
 * (le son cesse d'être enregistré). La fenêtre « hors accord », elle, est
 * ouverte dès l'ARRIVÉE (une période de mesure plus tôt, RGPD-01 : voir
 * `une-personne-qui-arrive-puis-repart-sans-accord-n-est-jamais-transcrite`) ;
 * elle est envoyée avec la fin et exclue du traitement.
 *
 * Mutation qui rougit : retirer l'action `gain 0` de la branche « 2 minutes »
 * de `tic` → 1er cas. Contre-témoin : l'accord de la nouvelle personne rend le
 * son et ferme la fenêtre.
 */

import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import { base, MESURE_NORMALE } from "./outils";

const T = 1_000_000;
const TROIS = { ...MESURE_NORMALE, nbParticipants: 3 };

function enCours() {
  const d = capture.demarrer(capture.etatInitial(), base(T), T);
  return capture.accordObtenu(d.etat, T + 5000).etat;
}

describe("⛔ une personne en plus sans accord coupe le son à 2 minutes", () => {
  it("arrivée → notification et fenêtre ouverte ; 2 min → gain 0", () => {
    let r = capture.tic(enCours(), TROIS, T + 60_000);
    expect(r.actions.map((a: { type: string }) => a.type)).toContain("notifier");
    expect(r.etat.fenetresHorsAccord).toEqual([{ debutMs: 45_000, finMs: null }]);
    r = capture.tic(r.etat, TROIS, T + 179_000);
    expect(r.actions).not.toContainEqual({ type: "gain", valeur: 0 });
    r = capture.tic(r.etat, TROIS, T + 180_000);
    expect(r.actions).toContainEqual({ type: "gain", valeur: 0 });
    expect(r.etat.sonCoupe).toBe(true);
    expect(r.etat.fenetresHorsAccord).toEqual([{ debutMs: 45_000, finMs: null }]);

    const fin = capture.arreter(r.etat, T + 240_000);
    const terminer = fin.actions.find((a: { type: string }) => a.type === "terminer_session");
    expect(terminer?.fenetresHorsAccord).toEqual([{ debutMs: 45_000, finMs: 240_000 }]);
  });

  it("contre-témoin : l'accord de la nouvelle personne rend le son et le déclare", () => {
    let r = capture.tic(enCours(), TROIS, T + 60_000);
    r = capture.tic(r.etat, TROIS, T + 180_000);
    const a = capture.nouvellePersonneAccord(r.etat, T + 200_000);
    expect(a.actions).toContainEqual({ type: "gain", valeur: 1 });
    expect(a.actions).toContainEqual({
      type: "declarer_accord",
      accordLe: T + 200_000,
      nouvellePersonne: true,
    });
    expect(a.etat.fenetresHorsAccord).toEqual([{ debutMs: 45_000, finMs: 200_000 }]);
    const suite = capture.tic(a.etat, TROIS, T + 400_000);
    expect(suite.etat.sonCoupe).toBe(false);
  });

  it("la personne repart avant 2 min : le son n'est pas coupé, la fenêtre se ferme au départ", () => {
    let r = capture.tic(enCours(), TROIS, T + 60_000);
    r = capture.tic(r.etat, MESURE_NORMALE, T + 100_000);
    r = capture.tic(r.etat, MESURE_NORMALE, T + 400_000);
    expect(r.etat.sonCoupe).toBe(false);
    expect(r.etat.fenetresHorsAccord).toEqual([{ debutMs: 45_000, finMs: 100_000 }]);
  });
});
