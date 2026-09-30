/**
 * ⛔ RIEN NE PART AVANT L'ACCORD, ET TOUT EST DÉTRUIT À 3 MINUTES (PR 5).
 *
 * Côté extension : pendant `accord_en_attente`, la file n'autorise AUCUN
 * morceau, aucune fin de tranche, aucune fin ; sans « Accord obtenu » à
 * 3 minutes, la capture s'arrête et le son local est détruit. Un rappel part à
 * 2 minutes.
 *
 * Mutation qui rougit : dans `envoyablesMaintenant`, laisser passer un
 * `morceau` sans `accord` → le 1er cas rougit ; dans `tic`, retirer le test des
 * 3 minutes → le 3ᵉ rougit.
 * Contre-témoin : après l'accord, les mêmes morceaux partent.
 * Angle mort : la destruction réelle de l'IndexedDB (`detruireCapture`) n'est
 * pas exécutée en Node ; on prouve qu'elle est DEMANDÉE.
 */

import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import { envoyablesMaintenant } from "../../../extensions/enregistreur-meet/lib/file-envoi.js";
import { base, MESURE_NORMALE } from "./outils";

const T = 1_000_000;
const CLE = base().cleClient;

const FILE = [
  { id: "s", type: "session", cleClient: CLE, creeLe: T },
  { id: "m0", type: "morceau", cleClient: CLE, creeLe: T + 10_000 },
  { id: "t0", type: "tranche", cleClient: CLE, creeLe: T + 11_000 },
  { id: "f", type: "fin", cleClient: CLE, creeLe: T + 12_000 },
];

describe("⛔ rien ne part avant l'accord, et tout est détruit à 3 minutes", () => {
  it("sans accord, seule la création de session part (aucun son)", () => {
    const sansAccord = envoyablesMaintenant(
      FILE,
      { [CLE]: { accord: false, enregistrementId: "e" } },
      T + 60_000,
    );
    expect(sansAccord.map((e) => e.id)).toEqual(["s"]);
  });

  it("contre-témoin : avec l'accord, le son part, dans l'ordre", () => {
    const avec = envoyablesMaintenant(
      FILE,
      { [CLE]: { accord: true, enregistrementId: "e" } },
      T + 60_000,
    );
    expect(avec.map((e) => e.id)).toEqual(["s", "m0", "t0", "f"]);
  });

  it("à 3 min sans accord : arrêt et destruction locale ; rappel à 2 min, une fois", () => {
    let r = capture.demarrer(capture.etatInitial(), base(T), T);
    expect(r.etat.phase).toBe("accord_en_attente");
    expect(capture.peutEnvoyerDuSon(r.etat)).toBe(false);

    r = capture.tic(r.etat, MESURE_NORMALE, T + 120_000);
    expect(r.actions.filter((a: { type: string }) => a.type === "notifier")).toHaveLength(1);
    r = capture.tic(r.etat, MESURE_NORMALE, T + 150_000);
    expect(r.actions.filter((a: { type: string }) => a.type === "notifier")).toHaveLength(0);

    r = capture.tic(r.etat, MESURE_NORMALE, T + 180_001);
    expect(r.etat.phase).toBe("detruit");
    expect(r.actions).toContainEqual({ type: "detruire_local", cleClient: CLE });
    expect(r.actions).toContainEqual({ type: "arreter_capture" });
  });

  it("un « Accord obtenu » tardif (après 3 min) ne sauve rien : destruction", () => {
    const d = capture.demarrer(capture.etatInitial(), base(T), T);
    const r = capture.accordObtenu(d.etat, T + 181_000);
    expect(r.etat.phase).toBe("detruit");
  });

  it("« Accord obtenu » à temps : en_cours, le son peut partir", () => {
    const d = capture.demarrer(capture.etatInitial(), base(T), T);
    const r = capture.accordObtenu(d.etat, T + 90_000);
    expect(r.etat.phase).toBe("en_cours");
    expect(capture.peutEnvoyerDuSon(r.etat)).toBe(true);
    expect(r.actions[0]).toMatchObject({ type: "declarer_accord", nouvellePersonne: false });
  });

  it("arrêter avant l'accord détruit aussi", () => {
    const d = capture.demarrer(capture.etatInitial(), base(T), T);
    const r = capture.arreter(d.etat, T + 30_000);
    expect(r.etat.phase).toBe("detruit");
    expect(r.actions).toContainEqual({ type: "detruire_local", cleClient: CLE });
  });
});
