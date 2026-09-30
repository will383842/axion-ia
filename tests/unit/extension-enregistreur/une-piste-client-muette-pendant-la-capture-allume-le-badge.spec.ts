/**
 * ⛔ UNE PISTE CLIENT MUETTE PENDANT LA CAPTURE ALLUME LE BADGE (PR 5).
 *
 * Si le son de l'onglet Meet ne remonte plus (onglet muet, mauvais onglet),
 * Will le voit au bout de 60 s : « le son du client n'est pas capté ». Le
 * silence des DEUX pistes n'arrête rien avant 30 min (badge à 3 min,
 * notification à 5 min).
 *
 * Mutation qui rougit : retirer la ligne du badge `piste_client_muette` → 1er cas.
 * Contre-témoin : le son du client qui revient éteint le badge.
 */

import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import { base, MESURE_NORMALE } from "./outils";

const T = 1_000_000;
const MUET = { ...MESURE_NORMALE, niveauClient: 0 };

function enCours() {
  const d = capture.demarrer(capture.etatInitial(), base(T), T);
  return capture.accordObtenu(d.etat, T + 5000).etat;
}

describe("⛔ une piste client muette pendant la capture allume le badge", () => {
  it("59 s : rien ; 60 s : badge", () => {
    let e = enCours();
    e = capture.tic(e, MUET, T + 59_000).etat;
    expect(e.badges).not.toContain("piste_client_muette");
    e = capture.tic(e, MUET, T + 60_000).etat;
    expect(e.badges).toContain("piste_client_muette");
  });

  it("contre-témoin : le son du client qui revient éteint le badge", () => {
    let e = enCours();
    e = capture.tic(e, MUET, T + 61_000).etat;
    e = capture.tic(e, MESURE_NORMALE, T + 62_000).etat;
    expect(e.badges).not.toContain("piste_client_muette");
  });

  it("silence total : badge à 3 min, notification à 5 min, arrêt à 30 min seulement", () => {
    const SILENCE = { ...MESURE_NORMALE, niveauClient: 0, niveauAxion: 0 };
    let r = { etat: enCours(), actions: [] as Array<{ type: string }> };
    r = capture.tic(r.etat, SILENCE, T + 3 * 60_000 + 1);
    expect(r.etat.badges).toContain("silence");
    r = capture.tic(r.etat, SILENCE, T + 5 * 60_000 + 1);
    expect(r.actions.map((a) => a.type)).toContain("notifier");
    r = capture.tic(r.etat, SILENCE, T + 29 * 60_000);
    expect(r.etat.phase).toBe("en_cours");
    r = capture.tic(r.etat, SILENCE, T + 30 * 60_000 + 1);
    expect(r.etat.phase).toBe("termine");
  });
});
