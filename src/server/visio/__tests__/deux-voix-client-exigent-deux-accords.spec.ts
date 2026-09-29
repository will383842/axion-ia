/**
 * DEUX VOIX CLIENT EXIGENT DEUX ACCORDS (G16 ; plan §3.13).
 *
 * La diarisation de la piste client distingue les voix (`A`, `B`) : chacune
 * doit avoir SON accord retrouvé. Une voix sans accord est un signal noté au
 * journal (et la validation exige la correspondance des voix).
 */

import { describe, expect, it } from "vitest";

import { planDePrecontrole } from "../precontroles";
import { conversation, precontrole, seg } from "./outils-pipeline";

describe("deux voix client exigent deux accords", () => {
  const base = conversation().map((s) => ({
    ...s,
    debutMs: s.debutMs + 200_000,
    finMs: s.finMs + 200_000,
  }));

  it("deux voix, une seule dit oui → une voix sans accord", () => {
    const plan = planDePrecontrole(
      precontrole({
        segments: [
          seg({
            piste: "client",
            debutMs: 12_000,
            locuteurBrut: "A",
            texte: "Oui, pas de problème pour moi.",
          }),
          seg({
            piste: "client",
            debutMs: 16_000,
            locuteurBrut: "B",
            texte: "Je voulais juste savoir combien de temps ça dure.",
          }),
          ...base,
        ],
      }),
    );
    expect(plan).toMatchObject({ voixClient: 2, voixSansAccord: 1 });
  });

  it("chacune dit oui → deux accords, deux preuves", () => {
    const plan = planDePrecontrole(
      precontrole({
        segments: [
          seg({
            piste: "client",
            debutMs: 12_000,
            locuteurBrut: "A",
            texte: "Oui, pas de problème pour moi.",
          }),
          seg({
            piste: "client",
            debutMs: 16_000,
            locuteurBrut: "B",
            texte: "Pour moi aussi, d'accord.",
          }),
          ...base,
        ],
      }),
    );
    expect(plan).toMatchObject({ voixClient: 2, voixSansAccord: 0 });
    expect(plan.accords).toHaveLength(2);
  });
});
