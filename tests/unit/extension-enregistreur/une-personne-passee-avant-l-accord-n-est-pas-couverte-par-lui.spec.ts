/**
 * ⛔ UNE PERSONNE PASSÉE AVANT L'ACCORD N'EST PAS COUVERTE PAR LUI (V2, N6).
 *
 * Avant le clic « Accord obtenu », personne n'était compté : la capture
 * démarre avec 2 participants, `tic` ne suivait les arrivées qu'en cours, et
 * l'accord ne recalait rien. Un collègue du client passe 60 s puis quitte la
 * réunion avant l'annonce : au clic, tout le son d'avant l'accord partait,
 * sa voix comprise, sans accord de sa part.
 *
 * Désormais, pendant l'attente de l'accord, la POINTE de participants est
 * notée (avec l'heure d'arrivée, une période de mesure plus tôt, et l'heure
 * de départ). Au clic, si elle dépasse le compte présent, une fenêtre hors
 * accord couvre ce passage ; l'accord ne couvre que les présents.
 *
 * Mutation qui rougit : ne pas suivre la pointe en `accord_en_attente` (1er
 * cas). Contre-témoin : sans personne en plus, aucune fenêtre (2e cas).
 */

import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import { base, MESURE_NORMALE } from "./outils";

const T = 1_000_000;
const DEUX = { ...MESURE_NORMALE, nbParticipants: 2 };
const TROIS = { ...MESURE_NORMALE, nbParticipants: 3 };

describe("une personne passée avant l'accord n'est pas couverte par lui", () => {
  it("un collègue passe 60 s avant le clic : une fenêtre hors accord couvre son passage", () => {
    let e = capture.demarrer(capture.etatInitial(), base(T), T).etat;
    e = capture.tic(e, DEUX, T + 1_000).etat;
    e = capture.tic(e, TROIS, T + 20_000).etat;
    e = capture.tic(e, DEUX, T + 80_000).etat;
    const r = capture.accordObtenu(e, T + 100_000);
    expect(r.etat.fenetresHorsAccord).toEqual([{ debutMs: 5_000, finMs: 80_000 }]);
    expect(r.etat.participantsAccordes).toBe(2);
  });

  it("contre-témoin : sans personne en plus, aucune fenêtre", () => {
    let e = capture.demarrer(capture.etatInitial(), base(T), T).etat;
    e = capture.tic(e, DEUX, T + 1_000).etat;
    e = capture.tic(e, DEUX, T + 50_000).etat;
    const r = capture.accordObtenu(e, T + 100_000);
    expect(r.etat.fenetresHorsAccord).toEqual([]);
  });

  it("la personne encore là au clic est couverte par l'accord", () => {
    let e = capture.demarrer(capture.etatInitial(), base(T), T).etat;
    e = capture.tic(e, TROIS, T + 20_000).etat;
    const r = capture.accordObtenu(e, T + 100_000);
    expect(r.etat.fenetresHorsAccord).toEqual([]);
    expect(r.etat.participantsAccordes).toBe(3);
  });
});
