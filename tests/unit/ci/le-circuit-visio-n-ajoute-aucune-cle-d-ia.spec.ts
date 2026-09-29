/**
 * ⛔ LE CIRCUIT VISIO N'AJOUTE AUCUNE CLÉ D'IA (chantier visio, PR 2 ;
 * ADR 0055 — remplace le verrou GP2 du plan).
 *
 * Deux règles :
 *   1. la liste des variables `*_API_KEY` de `src/env.ts` est FIGÉE au
 *      29/09/2026 : une clé de plus (un second fournisseur d'IA, par exemple)
 *      exige de passer ici, donc d'être vue en revue ;
 *   2. le circuit (site, scripts, extension) ne lit QUE `OPENAI_API_KEY` —
 *      la clé déjà posée sur les deux conteneurs, sous le plafond de dépense
 *      existant.
 *
 * Contre-témoin : un fichier fictif qui lit `MISTRAL_API_KEY` est reconnu.
 * Angle mort avoué : une clé lue sous un autre nom que `*_API_KEY`
 * (`*_TOKEN`, `*_SECRET`) échappe à la règle 2.
 */

import { describe, expect, it } from "vitest";
import {
  DOSSIERS_DU_CIRCUIT_ELARGI,
  lire,
  sansCommentaires,
  sourcesSous,
} from "./sources-du-circuit-visio";

/** Relevé le 29/09/2026 sur `origin/main` (`grep -oE '\b[A-Z0-9_]+_API_KEY\b' src/env.ts`). */
const CLES_FIGEES = [
  "ANTHROPIC_API_KEY",
  "DOCUSEAL_API_KEY",
  "GOOGLE_PSI_API_KEY",
  "MAILWIZZ_API_KEY",
  "OPENAI_API_KEY",
  "PERPLEXITY_API_KEY",
  "PMTA_API_KEY",
  "VOYAGE_API_KEY",
] as const;

const SEULE_CLE_DU_CIRCUIT = "OPENAI_API_KEY";
const MOTIF_CLE = /\b[A-Z0-9_]+_API_KEY\b/g;

function clesLues(code: string): string[] {
  return [...new Set(sansCommentaires(code).match(MOTIF_CLE) ?? [])].sort();
}

describe("le circuit visio n'ajoute aucune clé d'IA", () => {
  it("la liste des clés d'API de src/env.ts est figée", () => {
    const presentes = [...new Set(lire("src/env.ts").match(MOTIF_CLE) ?? [])].sort();
    expect(
      presentes,
      "une clé d'API a été ajoutée ou retirée dans src/env.ts. Si c'est pour le circuit " +
        "visio : c'est interdit (ADR 0055, crédit API OpenAI seulement). Sinon, mettre à " +
        "jour CLES_FIGEES dans cette garde, en revue.",
    ).toEqual([...CLES_FIGEES]);
  });

  it("contre-témoin : une autre clé lue par le circuit est reconnue", () => {
    expect(clesLues(`const k = process.env.MISTRAL_API_KEY;`)).toEqual(["MISTRAL_API_KEY"]);
    expect(clesLues(`// process.env.MISTRAL_API_KEY`)).toEqual([]);
  });

  it("le circuit ne lit que OPENAI_API_KEY", () => {
    const fautes = sourcesSous(DOSSIERS_DU_CIRCUIT_ELARGI).flatMap((f) =>
      clesLues(lire(f))
        .filter((c) => c !== SEULE_CLE_DU_CIRCUIT)
        .map((c) => `${f} lit ${c}`),
    );
    expect(fautes, "le circuit visio ne lit que OPENAI_API_KEY (ADR 0055) :").toEqual([]);
  });
});
