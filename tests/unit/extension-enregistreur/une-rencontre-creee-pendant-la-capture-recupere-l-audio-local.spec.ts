/**
 * Une rencontre créée pendant la capture récupère l'audio local (PR 5, V1-C4).
 *
 * Rendez-vous absent de la liste : Will démarre quand même (le son reste
 * local), crée le rendez-vous dans la console, clique « Actualiser » et le
 * choisit. La capture s'y rattache ; ses morceaux déjà gardés partent vers
 * elle, dans l'ordre, une fois la session créée et l'accord donné. Sans
 * rencontre 24 h après la fin (cas A), tout est détruit.
 */

import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import {
  capturesADetruire,
  envoyablesMaintenant,
  rattacherCapture,
} from "../../../extensions/enregistreur-meet/lib/file-envoi.js";
import { base } from "./outils";

const T = 1_000_000;
const CLE = "c1";

describe("une rencontre créée pendant la capture récupère l'audio local", () => {
  it("démarrer sans rencontre est possible ; le son reste local", () => {
    const r = capture.demarrer(capture.etatInitial(), { ...base(T), rencontreId: null }, T);
    expect(r.etat.phase).toBe("accord_en_attente");
    expect(r.etat.rencontreId).toBeNull();
  });

  it("rien ne part sans rencontre ; rattachée, la session puis le son partent", () => {
    const file = [
      { id: "m0", type: "morceau", cleClient: CLE, creeLe: T + 10_000 },
      { id: "m1", type: "morceau", cleClient: CLE, creeLe: T + 20_000 },
    ];
    let captures: Record<
      string,
      { accord: boolean; enregistrementId: string | null; rencontreId?: string }
    > = {
      [CLE]: { accord: true, enregistrementId: null },
    };
    expect(envoyablesMaintenant(file, captures, T + 60_000)).toEqual([]);

    captures = rattacherCapture(captures, CLE, "r1");
    expect(captures[CLE]?.rencontreId).toBe("r1");
    const avecSession = [
      { id: "s", type: "session", cleClient: CLE, creeLe: T + 300_000 },
      ...file,
    ];
    expect(envoyablesMaintenant(avecSession, captures, T + 300_000).map((e) => e.id)).toEqual([
      "s",
    ]);

    captures = { [CLE]: { ...captures[CLE]!, enregistrementId: "e1" } };
    expect(envoyablesMaintenant(file, captures, T + 301_000).map((e) => e.id)).toEqual([
      "m0",
      "m1",
    ]);
  });

  it("cas A : sans rencontre 24 h après la fin, la capture est détruite", () => {
    const captures = {
      a: { enregistrementId: null, finMs: T, detruit: false },
      b: { enregistrementId: "e", finMs: T, detruit: false },
      c: { enregistrementId: null, finMs: null, detruit: false },
    };
    expect(capturesADetruire(captures, T + 86_400_000 - 1)).toEqual([]);
    expect(capturesADetruire(captures, T + 86_400_000)).toEqual(["a"]);
  });
});
