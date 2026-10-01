/**
 * ⛔ UNE FIN DE TRANCHE MUETTE SE JUGE SUR 20 SECONDES (V2, M2).
 *
 * `finMuette` était UNE mesure instantanée (≈ 43 ms) prise à l'arrêt du
 * `MediaRecorder`. Une touche de clavier à cet instant suffisait à déclarer
 * « non muette » une piste silencieuse depuis 30 s : le serveur la croyait
 * tronquée. Le serveur juge la troncature sur les 20 dernières secondes ;
 * l'extension mesure maintenant sur la même fenêtre : la fin est muette si
 * moins d'un quart des relevés de cette fenêtre dépassent le seuil.
 *
 * Mutation qui rougit : rendre le seul dernier relevé (1er cas). Contre-
 * témoin : une piste qui parle dans les 20 dernières secondes n'est pas
 * muette (2e cas).
 */

import { describe, expect, it } from "vitest";

import { finMuetteSur, noterNiveau } from "../../../extensions/enregistreur-meet/lib/tranches.js";

type Releve = { le: number; niveau: number };

function releves(niveaux: number[], fin: number): Releve[] {
  let h: Releve[] = [];
  niveaux.forEach((n, i) => {
    h = noterNiveau(h, fin - (niveaux.length - 1 - i) * 1000, n);
  });
  return h;
}

describe("une fin de tranche muette se juge sur 20 secondes", () => {
  it("30 s de silence puis une touche de clavier à l'arrêt : muette", () => {
    const h = releves([...Array(29).fill(0.001), 0.2], 200_000);
    expect(finMuetteSur(h, 200_000, 0.2)).toBe(true);
  });

  it("contre-témoin : quelqu'un parle dans les 20 dernières secondes : pas muette", () => {
    const h = releves([...Array(15).fill(0.001), ...Array(15).fill(0.08)], 200_000);
    expect(finMuetteSur(h, 200_000, 0.001)).toBe(false);
  });

  it("l'historique ne garde que la fenêtre", () => {
    const h = releves(Array(60).fill(0.001), 200_000);
    expect(h.every((r: Releve) => r.le > 200_000 - 21_000)).toBe(true);
  });

  it("sans aucun relevé, l'instant d'arrêt décide", () => {
    expect(finMuetteSur([], 200_000, 0.001)).toBe(true);
    expect(finMuetteSur([], 200_000, 0.2)).toBe(false);
  });
});
