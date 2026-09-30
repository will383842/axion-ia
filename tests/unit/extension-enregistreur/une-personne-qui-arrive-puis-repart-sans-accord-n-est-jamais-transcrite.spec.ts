/**
 * ⛔ UNE PERSONNE QUI ARRIVE PUIS REPART SANS ACCORD N'EST JAMAIS TRANSCRITE
 * (vérification finale V1, RGPD-01 ; V7-02 : « les segments captés entre
 * l'arrivée et ce clic sont marqués et exclus de la transcription »).
 *
 * La fenêtre « hors accord » s'ouvrait à la COUPURE du son (2 min après
 * l'arrivée) : les deux premières minutes d'un participant sans accord étaient
 * transcrites, et s'il repartait avant, aucune fenêtre n'existait. Elle s'ouvre
 * désormais à l'ARRIVÉE — et même une période de mesure plus tôt, puisque le
 * service worker ne compte les participants que toutes les 15 s —, et se ferme
 * au clic « Nouvelle personne : accord obtenu » ou au départ. La coupure du
 * gain à 2 min reste un second filet.
 *
 * Le test enchaîne la machine d'états de l'extension et la règle du serveur
 * (`estHorsAccord`, `recevoir-transcription.ts`) : ce qui compte est le
 * segment transcrit, pas la forme de la fenêtre.
 *
 * Mutation qui rougit : dans `tic`, n'ouvrir la fenêtre qu'à la coupure (le
 * code d'avant) → les trois premiers cas. Retirer la baisse de
 * `participantsAccordes` au départ → le 4e cas.
 * Contre-témoin : ce qui est dit avant l'arrivée et après l'accord est transcrit.
 * Angle mort : le SON d'une tranche qui chevauche la fenêtre part encore à la
 * transcription (le texte des segments hors accord est jeté avant toute
 * écriture) ; une tranche de 180 s ne se découpe pas côté serveur.
 */

import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import { PERIODE_MESURE_SALLE_MS } from "../../../extensions/enregistreur-meet/lib/constantes.js";
import { estHorsAccord, type Periode } from "../../../src/server/visio/dialogue";
import { base, MESURE_NORMALE } from "./outils";

const T = 1_000_000;
const TROIS = { ...MESURE_NORMALE, nbParticipants: 3 };

function enCours() {
  const d = capture.demarrer(capture.etatInitial(), base(T), T);
  return capture.accordObtenu(d.etat, T + 5000).etat;
}

/** Les fenêtres telles que la fin de session les envoie au site. */
function fenetresEnvoyees(etat: Record<string, unknown>, finMs: number): Periode[] {
  const fin = capture.arreter(etat, finMs);
  const terminer = fin.actions.find((a: { type: string }) => a.type === "terminer_session") as
    { fenetresHorsAccord: Periode[] } | undefined;
  return terminer?.fenetresHorsAccord ?? [];
}

/** Un segment de parole, en millisecondes depuis le début de la capture. */
function transcrit(fenetres: readonly Periode[], debutMs: number, finMs: number): boolean {
  return !estHorsAccord({ debutMs: T + debutMs, finMs: T + finMs }, fenetres, T);
}

describe("⛔ une personne qui arrive puis repart sans accord n'est jamais transcrite", () => {
  it("elle parle 100 s puis repart avant la coupure : rien de ce qu'elle a dit n'est transcrit", () => {
    let r = capture.tic(enCours(), TROIS, T + 720_000); // arrivée vue à 12 min
    r = capture.tic(r.etat, TROIS, T + 780_000);
    r = capture.tic(r.etat, MESURE_NORMALE, T + 820_000); // repartie, pas de clic
    expect(r.etat.sonCoupe).toBe(false);
    const f = fenetresEnvoyees(r.etat, T + 1_200_000);
    expect(f.length).toBe(1);
    // Elle parle de 12:01 à 13:40.
    expect(transcrit(f, 721_000, 800_000)).toBe(false);
    // Arrivée entre deux mesures (15 s) : ses premières secondes aussi.
    expect(transcrit(f, 720_000 - PERIODE_MESURE_SALLE_MS + 1000, 719_000)).toBe(false);
  });

  it("elle reste sans accord : ses 2 premières minutes sont exclues, pas seulement la suite", () => {
    let r = capture.tic(enCours(), TROIS, T + 60_000);
    r = capture.tic(r.etat, TROIS, T + 180_000); // coupure du son
    expect(r.actions).toContainEqual({ type: "gain", valeur: 0 });
    const f = fenetresEnvoyees(r.etat, T + 240_000);
    expect(transcrit(f, 70_000, 150_000)).toBe(false);
    expect(transcrit(f, 190_000, 230_000)).toBe(false);
  });

  it("accord obtenu 30 s après l'arrivée : ces 30 s sont exclues, la suite est transcrite", () => {
    let r = capture.tic(enCours(), TROIS, T + 60_000);
    const a = capture.nouvellePersonneAccord(r.etat, T + 90_000);
    expect(a.actions).toContainEqual({
      type: "declarer_accord",
      accordLe: T + 90_000,
      nouvellePersonne: true,
    });
    r = capture.tic(a.etat, TROIS, T + 400_000);
    expect(r.etat.sonCoupe).toBe(false);
    const f = fenetresEnvoyees(r.etat, T + 500_000);
    expect(transcrit(f, 62_000, 88_000)).toBe(false);
    expect(transcrit(f, 95_000, 300_000)).toBe(true);
  });

  it("🔴 un accordé repart et un INCONNU prend sa place : fenêtre ouverte", () => {
    const d = capture.demarrer(capture.etatInitial(), { ...base(T), nbParticipants: 3 }, T);
    let r = { etat: capture.accordObtenu(d.etat, T + 5000).etat, actions: [] as unknown[] };
    r = capture.tic(r.etat, MESURE_NORMALE, T + 60_000); // un des trois part
    r = capture.tic(r.etat, TROIS, T + 120_000); // quelqu'un (un autre ?) arrive
    expect(r.actions.map((x) => (x as { type: string }).type)).toContain("notifier");
    const f = fenetresEnvoyees(r.etat, T + 200_000);
    expect(transcrit(f, 125_000, 190_000)).toBe(false);
  });

  it("contre-témoin : ce qui est dit avant l'arrivée est transcrit, et sans arrivée rien n'est exclu", () => {
    let r = capture.tic(enCours(), TROIS, T + 720_000);
    r = capture.tic(r.etat, MESURE_NORMALE, T + 820_000);
    const f = fenetresEnvoyees(r.etat, T + 1_200_000);
    expect(transcrit(f, 300_000, 600_000)).toBe(true);
    expect(transcrit(f, 900_000, 1_100_000)).toBe(true);

    const calme = capture.tic(enCours(), MESURE_NORMALE, T + 600_000);
    expect(fenetresEnvoyees(calme.etat, T + 700_000)).toEqual([]);
  });
});
