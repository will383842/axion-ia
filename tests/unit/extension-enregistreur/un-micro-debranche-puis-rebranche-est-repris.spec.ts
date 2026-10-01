/**
 * ⛔ UN MICRO DÉBRANCHÉ PUIS REBRANCHÉ EST REPRIS (V2, M7).
 *
 * Le gestionnaire `devicechange` sortait si l'enregistreur était
 * `recording` — ce qu'il est TOUJOURS, puisqu'il enregistre la destination
 * audio, qui survit à la piste du micro. Et même sinon, il réutilisait le
 * flux mort sans nouveau `getUserMedia`. Un casque Bluetooth qui décroche :
 * plus aucune parole de Williams jusqu'à la fin, sans aucun signal.
 *
 * Désormais :
 *   · la fin de la piste du micro (`ended`) déclenche un nouveau
 *     `getUserMedia`, la nouvelle source est rebranchée sur le nœud de gain
 *     existant et une tranche `micro_reconnecte` s'ouvre ; un `devicechange`
 *     relance la reprise si le micro n'était pas encore revenu ;
 *   · un badge « micro muet » s'allume quand le micro ne capte rien depuis
 *     60 s alors que le client parle.
 *
 * Mutations qui rougissent : rétablir la sortie sur `state === "recording"`
 * (2e cas) ; retirer le badge (1er cas). Contre-témoin : le micro qui revient
 * éteint le badge. Angle mort : le document offscreen ne tourne pas sous
 * Vitest ; sa reprise est vérifiée sur le texte du fichier, et à la main.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import { base, DOSSIER_EXTENSION, MESURE_NORMALE, sansCommentaires } from "./outils";

const T = 1_000_000;
const MICRO_MUET = { ...MESURE_NORMALE, niveauAxion: 0 };

function enCours() {
  const d = capture.demarrer(capture.etatInitial(), base(T), T);
  return capture.accordObtenu(d.etat, T + 5000).etat;
}

describe("un micro débranché puis rebranché est repris", () => {
  it("le client parle, le micro ne capte rien depuis 60 s : badge « micro muet »", () => {
    let e = enCours();
    e = capture.tic(e, MICRO_MUET, T + 59_000).etat;
    expect(e.badges).not.toContain("micro_muet");
    e = capture.tic(e, MICRO_MUET, T + 61_000).etat;
    expect(e.badges).toContain("micro_muet");
    // Contre-témoin : le micro revient, le badge s'éteint.
    e = capture.tic(e, MESURE_NORMALE, T + 62_000).etat;
    expect(e.badges).not.toContain("micro_muet");
  });

  it("le document offscreen rebranche un nouveau micro à la fin de la piste", () => {
    const js = sansCommentaires(readFileSync(join(DOSSIER_EXTENSION, "offscreen.js"), "utf8"));
    expect(js).not.toMatch(/state\s*===\s*"recording"\)\s*return/);
    expect(js).toMatch(/onended/);
    expect(js).toMatch(
      /async function rebrancherMicro[\s\S]*getUserMedia[\s\S]*\.connect\(p\.gain\)/,
    );
    expect(js).toMatch(/demarrerTranche\(p, "micro_reconnecte"\)/);
  });

  it("le panneau a un libellé pour le badge", () => {
    const js = readFileSync(join(DOSSIER_EXTENSION, "panneau.js"), "utf8");
    expect(js).toMatch(/micro_muet:\s*"/);
  });
});
