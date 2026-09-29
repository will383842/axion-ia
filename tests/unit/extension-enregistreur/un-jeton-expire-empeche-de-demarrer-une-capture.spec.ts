/**
 * ⛔ UN JETON EXPIRÉ EMPÊCHE DE DÉMARRER UNE CAPTURE (PR 5).
 *
 * Jeton absent, mal formé ou expiré : `demarrer` refuse, avec un message qui
 * dit quoi faire (« renouvelez-le dans la console, prenez des notes à la
 * main »). Badge orange à J-14, rouge à J-3 — sans empêcher de démarrer.
 *
 * Mutation qui rougit : faire rendre `peutDemarrer: true` au cas expiré.
 * Contre-témoin : un jeton valide démarre.
 */

import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import { etatJeton } from "../../../extensions/enregistreur-meet/lib/jeton.js";
import { base } from "./outils";

const T = Date.parse("2026-10-06T08:00:00.000Z");
const JOUR = 86_400_000;

describe("⛔ un jeton expiré empêche de démarrer une capture", () => {
  it.each([
    ["absent", null, new Date(T + 30 * JOUR).toISOString()],
    ["mal formé", "pas-un-jeton", new Date(T + 30 * JOUR).toISOString()],
    ["expiré", "a".repeat(64), new Date(T - 1).toISOString()],
  ])("%s : aucune capture, un message", (_n, jeton, expireLe) => {
    const r = capture.demarrer(
      capture.etatInitial(),
      { ...base(T), jeton, jetonExpireLe: expireLe },
      T,
    );
    expect(r.etat.phase).toBe("repos");
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]?.type).toBe("refuser");
    expect(String(r.actions[0]?.message).length).toBeGreaterThan(10);
  });

  it("le message d'un jeton expiré dit quoi faire", () => {
    expect(etatJeton("a".repeat(64), new Date(T - 1).toISOString(), T).message).toMatch(/console/);
  });

  it("orange à J-14, rouge à J-3, sans bloquer", () => {
    expect(etatJeton("a".repeat(64), new Date(T + 10 * JOUR).toISOString(), T)).toMatchObject({
      niveau: "orange",
      peutDemarrer: true,
    });
    expect(etatJeton("a".repeat(64), new Date(T + 2 * JOUR).toISOString(), T)).toMatchObject({
      niveau: "rouge",
      peutDemarrer: true,
    });
  });

  it("contre-témoin : un jeton valide démarre", () => {
    const r = capture.demarrer(capture.etatInitial(), base(T), T);
    expect(r.etat.phase).toBe("accord_en_attente");
  });
});
