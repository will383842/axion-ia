/**
 * Le jeton SANS EXPIRATION n'avertit pas dans l'extension (révision du 02/10).
 *
 * Le site renvoie désormais `jetonExpireLe` = `JETON_SANS_EXPIRATION`
 * (9999-12-31), pour tout jeton non révoqué — y compris un jeton créé avant la
 * révision. L'extension 1.3.0 n'est PAS modifiée : ce test prouve qu'avec
 * cette date elle n'affiche aucun avertissement (ni orange J-14, ni rouge J-3)
 * et laisse démarrer une capture, aujourd'hui comme dans dix ans.
 *
 * Mutation qui rougit : renvoyer l'ancienne date d'origine (90 jours) depuis
 * `authentifierAppareil` → la valeur relue n'est plus la sentinelle.
 */

import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import { etatJeton } from "../../../extensions/enregistreur-meet/lib/jeton.js";
import { JETON_SANS_EXPIRATION } from "../../../src/server/visio/jeton";
import { base } from "./outils";

const T = Date.parse("2026-10-02T08:00:00.000Z");
const ANNEE = 365 * 86_400_000;
const SENTINELLE = JETON_SANS_EXPIRATION.toISOString();

describe("le jeton sans expiration n'avertit pas dans l'extension", () => {
  it("la date renvoyée est la sentinelle 9999-12-31", () => {
    expect(SENTINELLE).toBe("9999-12-31T00:00:00.000Z");
  });

  it.each([0, 1, 10])("dans %i an(s) : niveau « ok », aucun message", (ans) => {
    const e = etatJeton("a".repeat(64), SENTINELLE, T + ans * ANNEE);
    expect(e).toEqual({ peutDemarrer: true, niveau: "ok", message: "" });
  });

  it("une capture démarre avec la sentinelle", () => {
    const r = capture.demarrer(
      capture.etatInitial(),
      { ...base(T), jeton: "a".repeat(64), jetonExpireLe: SENTINELLE },
      T,
    );
    expect(r.etat.phase).toBe("accord_en_attente");
  });
});
