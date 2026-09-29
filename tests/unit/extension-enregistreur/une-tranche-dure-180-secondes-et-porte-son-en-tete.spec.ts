/**
 * ⛔ UNE TRANCHE DURE 180 SECONDES ET PORTE SON EN-TÊTE (PR 5, ADR 0055).
 *
 *   · la relance du `MediaRecorder` a lieu à 180 s, pas avant ;
 *   · une tranche pleine compte 18 morceaux de 10 s ;
 *   · chaque morceau part avec l'heure de début de SA tranche (le serveur crée
 *     la tranche au premier morceau reçu, quel que soit l'ordre) ;
 *   · le premier morceau d'une tranche commence par l'en-tête EBML (fichier
 *     WebM autonome, transcrit sans `ffmpeg`) — `commenceParEnTeteWebM` est la
 *     vérification que l'offscreen peut appliquer.
 *
 * Mutation qui rougit : passer `DUREE_TRANCHE_MS` à 170 000 → 1er cas.
 * Contre-témoin : un morceau qui n'est PAS un début de fichier est reconnu.
 */

import { describe, expect, it } from "vitest";

import {
  MORCEAUX_PAR_TRANCHE,
  ajouterMorceau,
  commenceParEnTeteWebM,
  doitChangerDeTranche,
  entetesDuMorceau,
  finDeTranche,
  nouvelleTranche,
} from "../../../extensions/enregistreur-meet/lib/tranches.js";

describe("⛔ une tranche dure 180 secondes et porte son en-tête", () => {
  it("relance à 180 s exactement, pas avant", () => {
    expect(doitChangerDeTranche(0, 179_999)).toBe(false);
    expect(doitChangerDeTranche(0, 180_000)).toBe(true);
    expect(MORCEAUX_PAR_TRANCHE).toBe(18);
  });

  it("les morceaux sont numérotés 0, 1, 2… et la fin annonce leur nombre", () => {
    let t = nouvelleTranche(4, 1_700_000_000_000, "nouvelle_tranche");
    const seqs: number[] = [];
    for (let i = 0; i < 18; i++) {
      const r = ajouterMorceau(t, 40_000);
      seqs.push(r.seq);
      t = r.tranche;
    }
    expect(seqs).toEqual([...Array(18).keys()]);
    const fin = finDeTranche(t, "client", {
      empreinte: "a".repeat(64),
      dureeMs: 180_000,
      finMuette: false,
    });
    expect(fin).toMatchObject({
      numero: 4,
      nbMorceaux: 18,
      debutCaptureEpochMs: 1_700_000_000_000,
      motifDebut: "nouvelle_tranche",
    });
  });

  it("chaque morceau porte l'heure de début de sa tranche et une clé sans chemin", () => {
    const h = entetesDuMorceau({
      piste: "axion",
      tranche: 2,
      seq: 0,
      debutCaptureMs: 123,
      empreinte: "b".repeat(64),
    });
    expect(h).toEqual({
      "x-piste": "axion",
      "x-tranche": "2",
      "x-seq": "0",
      "x-debut-capture-ms": "123",
      "x-empreinte": "b".repeat(64),
    });
    expect(() =>
      entetesDuMorceau({ piste: "../x", tranche: 0, seq: 0, debutCaptureMs: 1, empreinte: "" }),
    ).toThrow();
  });

  it("le premier morceau d'une tranche commence par l'en-tête EBML ; contre-témoin : un morceau du milieu non", () => {
    expect(commenceParEnTeteWebM(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01]))).toBe(true);
    expect(commenceParEnTeteWebM(new Uint8Array([0x1f, 0x43, 0xb6, 0x75]))).toBe(false);
    expect(commenceParEnTeteWebM(new Uint8Array([0x1a]))).toBe(false);
  });
});
