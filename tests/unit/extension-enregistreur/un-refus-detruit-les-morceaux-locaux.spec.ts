/**
 * ⛔ UN REFUS DÉTRUIT LES MORCEAUX LOCAUX (PR 5).
 *
 * « Refus » (avant ou après l'accord) : la capture s'arrête, tout ce que la
 * file porte pour cette capture est détruit, et le refus est déclaré au site.
 * Les autres captures ne sont pas touchées.
 *
 * Mutation qui rougit : retirer l'action `detruire_local` de `refus` → 1er cas.
 * Contre-témoin : la capture d'à côté garde ses morceaux.
 */

import { describe, expect, it } from "vitest";

import * as capture from "../../../extensions/enregistreur-meet/lib/etats-capture.js";
import {
  classerReponse,
  purgerCapture,
} from "../../../extensions/enregistreur-meet/lib/file-envoi.js";
import { base } from "./outils";

const T = 1_000_000;

describe("⛔ un refus détruit les morceaux locaux", () => {
  it.each([false, true])(
    "refus (accord déjà obtenu : %s) → arrêt, destruction, déclaration",
    (accorde) => {
      let e = capture.demarrer(capture.etatInitial(), base(T), T).etat;
      if (accorde) e = capture.accordObtenu(e, T + 10_000).etat;
      const r = capture.refus(e, T + 20_000);
      expect(r.etat.phase).toBe("detruit");
      const types = r.actions.map((a: { type: string }) => a.type);
      expect(types).toEqual(["arreter_capture", "detruire_local", "declarer_refus"]);
    },
  );

  it("la purge ne retire QUE la capture refusée", () => {
    const file = [
      { id: "a1", type: "morceau", cleClient: "A", creeLe: 1 },
      { id: "a2", type: "tranche", cleClient: "A", creeLe: 2 },
      { id: "b1", type: "morceau", cleClient: "B", creeLe: 3 },
    ];
    expect(purgerCapture(file, "A").map((e) => e.id)).toEqual(["b1"]);
  });

  it("une réponse « enregistrement clos » du site fait aussi détruire", () => {
    expect(classerReponse("morceau", 409, "enregistrement_clos")).toBe("detruire");
    expect(classerReponse("session", 409, "opposition_ia")).toBe("detruire");
    expect(classerReponse("morceau", 409, "accord_en_attente")).toBe("reessayer");
    expect(classerReponse("morceau", 503, "stockage_indisponible")).toBe("reessayer");
    expect(classerReponse("morceau", 0, undefined)).toBe("reessayer");
    expect(classerReponse("morceau", 200, undefined)).toBe("fait");
  });
});
