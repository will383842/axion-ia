/**
 * ⛔ UN REFUS PERDU EST RENVOYÉ JUSQU'AU SUCCÈS (PR 5).
 *
 * Avant : « Refus » partait UNE fois, hors file, sans regarder la réponse. Un
 * réseau coupé à ce moment laissait l'enregistrement `en_cours` côté site :
 * `interrompu` à 10 min, `depose` 2 h plus tard — et le son d'une personne qui
 * avait refusé partait en transcription (PR 6).
 *
 * Maintenant le refus est un ÉLÉMENT DE FILE sans `cleClient` :
 *   · la destruction locale (`purgerCapture`, `detruireCapture`) ne l'emporte pas ;
 *   · il est envoyable même quand sa capture est détruite ou absente, en tête ;
 *   · il est renvoyé (délai doublé) tant que le site ne répond pas 2xx.
 * Et la boucle d'envoi relit la capture AVANT CHAQUE envoi : un morceau d'une
 * capture détruite pendant la boucle ne part plus.
 *
 * Mutation qui rougit : redonner un `cleClient` à `elementRefus` → 1er cas ;
 * classer « refus + réseau » en `abandonner` → 2e cas ; remettre l'appel direct
 * dans `declarer_refus` → 3e cas.
 * Contre-témoin : un morceau d'une capture détruite n'est PAS envoyable.
 * Angle mort : le 3e cas lit le SOURCE du service worker (il ne s'exécute pas
 * hors de Chrome) ; il voit un retour à l'appel direct, pas un appel ignoré.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  classerReponse,
  elementRefus,
  envoyablesMaintenant,
  purgerCapture,
} from "../../../extensions/enregistreur-meet/lib/file-envoi.js";
import { DOSSIER_EXTENSION, sansCommentaires } from "./outils";

const ID = "11111111-2222-4333-8444-555555555555";
const T = 1_000_000;

describe("⛔ un refus perdu est renvoyé jusqu'au succès", () => {
  it("le refus survit à la destruction de sa capture et part en tête", () => {
    const refus = elementRefus(ID, T, T);
    expect(refus).not.toHaveProperty("cleClient");
    const file = [
      { id: "a1", type: "morceau", cleClient: "A", creeLe: 1 },
      { id: "s", type: "session", cleClient: "B", creeLe: 0 },
      refus,
    ];
    const apres = purgerCapture(file, "A");
    expect(apres.map((e) => e.id)).toContain(refus.id);
    const captures = {
      A: { accord: true, enregistrementId: ID, detruit: true },
      B: { accord: false, enregistrementId: null },
    };
    expect(envoyablesMaintenant(apres, captures, T)[0]?.id).toBe(refus.id);
    expect(envoyablesMaintenant([refus], {}, T)).toHaveLength(1);
  });

  it("réseau coupé, 5xx, 429 : réessayer ; 2xx : fait ; 404/409 : abandonner", () => {
    for (const statut of [0, 429, 500, 502, 503]) {
      expect(classerReponse("refus", statut, "stockage_indisponible")).toBe("reessayer");
    }
    expect(classerReponse("refus", 200, undefined)).toBe("fait");
    expect(classerReponse("refus", 404, "enregistrement_inconnu")).toBe("abandonner");
    expect(classerReponse("refus", 409, "retrait_apres_traitement")).toBe("abandonner");
    expect(classerReponse("refus", 401, "jeton_expire")).toBe("jeton");
  });

  it("le service worker met le refus en FILE et relit la capture avant chaque envoi", () => {
    const sw = sansCommentaires(readFileSync(join(DOSSIER_EXTENSION, "service-worker.js"), "utf8"));
    const bloc = sw.slice(sw.indexOf('case "declarer_refus"'), sw.indexOf('case "detruire_local"'));
    expect(bloc).toMatch(/ajouterALaFile\(elementRefus\(/);
    expect(bloc).not.toMatch(/appeler\(/);
    expect(sw).toMatch(/\(await lireCaptures\(\)\)\[el\.cleClient\]/);
  });

  it("contre-témoin : un morceau d'une capture détruite n'est pas envoyable", () => {
    const morceau = { id: "m", type: "morceau", cleClient: "A", creeLe: 1 };
    const captures = { A: { accord: true, enregistrementId: ID, detruit: true } };
    expect(envoyablesMaintenant([morceau], captures, T)).toHaveLength(0);
  });
});
