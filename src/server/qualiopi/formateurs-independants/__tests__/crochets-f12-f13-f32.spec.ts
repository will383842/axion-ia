// M7 (lot A) — F12, F13 et F32 : avec les valeurs que leurs appelants fournissent,
// AUCUN [crochet] ne reste vide (sinon l'adaptateur refuse : « valeurs-manquantes »).
// Les crochets à choix (« [motif : a / b] ») sont alignés sur une clé simple.
import { describe, expect, it } from "vitest";

import { MOTIFS_COMPLEMENT } from "../verifier-contresigner-regles";

import { remplir, varianteDe } from "@/lib/email/templates/_formateur-independant";
import {
  CROCHET_NON_REMPLI,
  TEXTES_FORMATEUR,
  type GabaritFormateurIndependant,
} from "@/lib/email/templates/formateur-independant-textes";

function crochetsVides(g: GabaritFormateurIndependant, payload: Record<string, unknown>): string[] {
  const v = varianteDe(g, payload);
  return [v.objet, ...v.paragraphes]
    .map((t) => remplir(t, payload))
    .filter((t) => CROCHET_NON_REMPLI.test(t));
}

describe("crochets de F12, F13, F32", () => {
  it.each([...MOTIFS_COMPLEMENT])("F12 (W-4) — motif « %s » : tout est rempli", (motif) => {
    expect(crochetsVides("formateur-dossier-a-completer", { valeurs: { motif } })).toEqual([]);
  });

  it.each(["entreprise fermée", "numéro introuvable"])(
    "F13 — motif « %s » : tout est rempli",
    (motif) => {
      expect(crochetsVides("formateur-dossier-refuse", { valeurs: { motif } })).toEqual([]);
    },
  );

  it("F32 — le motif du moteur des missions remplit le crochet", () => {
    expect(
      crochetsVides("formateur-mission-en-attente", {
        valeurs: { motif: "une attestation URSSAF à jour, votre numéro de déclaration d'activité" },
      }),
    ).toEqual([]);
  });

  it("aucun crochet à choix ne subsiste dans ces trois textes", () => {
    for (const g of [
      "formateur-dossier-a-completer",
      "formateur-dossier-refuse",
      "formateur-mission-en-attente",
    ] as const) {
      for (const v of TEXTES_FORMATEUR[g].variantes) {
        for (const t of [v.objet, ...v.paragraphes]) {
          for (const m of t.match(/\[[^[\]]+\]/g) ?? []) expect(m).not.toMatch(/[:/]/);
        }
      }
    }
  });

  it("sans valeurs, le crochet reste visible (l'adaptateur refusera)", () => {
    expect(crochetsVides("formateur-dossier-refuse", {})).not.toEqual([]);
  });
});
