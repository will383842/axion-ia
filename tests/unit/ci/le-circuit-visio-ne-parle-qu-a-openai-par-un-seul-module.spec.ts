/**
 * ⛔ LE CIRCUIT VISIO NE PARLE QU'À OPENAI, PAR UN SEUL MODULE
 * (chantier visio, PR 2 ; ADR 0055 — remplace le verrou GP1 du plan).
 *
 * Ordre de Will du 28/09 (nuit) : l'IA du circuit est le CRÉDIT API OPENAI,
 * déjà sous-traitant déclaré, et rien d'autre. Donc, sous les dossiers du
 * circuit (site, scripts, extension Chrome) :
 *   · aucun SDK d'un autre fournisseur d'IA (Anthropic, Mistral, Google, Groq) ;
 *   · aucune adresse d'API d'un autre fournisseur, ni `claude -p` ;
 *   · le SDK `openai` n'est importé QUE par `src/server/visio/openai/client.ts`
 *     (un seul endroit où la clé est lue et où `store: false` est posé) ;
 *   · l'extension ne contient ni `api.openai.com` ni `OPENAI` : elle parle au
 *     site, jamais au fournisseur (la clé ne quitte pas le serveur).
 *
 * Les dossiers n'existent pas encore (PR 5 et 6) : la garde passe à vide, et
 * le CONTRE-TÉMOIN ci-dessous prouve qu'elle rougirait.
 * Angle mort avoué : un appel HTTP construit par morceaux de chaîne
 * (`"api." + "anthropic.com"`) échappe au motif.
 */

import { describe, expect, it } from "vitest";
import {
  DOSSIERS_DU_CIRCUIT_ELARGI,
  lire,
  sansCommentaires,
  sourcesSous,
} from "./sources-du-circuit-visio";

const SEUL_MODULE_OPENAI = "src/server/visio/openai/client.ts";

/** Import d'un module (statique, dynamique, require) dont le nom correspond. */
function importDe(motifModule: string): RegExp {
  return new RegExp(
    String.raw`(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'\x60]` +
      motifModule +
      String.raw`["'\x60]`,
  );
}

const SDK_INTERDITS: ReadonlyArray<{ nom: string; motif: RegExp }> = [
  { nom: "@anthropic-ai/sdk", motif: importDe(String.raw`@anthropic-ai\/[^"'\x60]*`) },
  { nom: "@mistralai/*", motif: importDe(String.raw`@mistralai\/[^"'\x60]*`) },
  { nom: "@google-cloud/*", motif: importDe(String.raw`@google-cloud\/[^"'\x60]*`) },
  { nom: "groq-sdk", motif: importDe(String.raw`groq-sdk(?:\/[^"'\x60]*)?`) },
];

const CHAINES_INTERDITES = [
  "api.anthropic.com",
  "api.mistral.ai",
  "api.groq.com",
  "generativelanguage.googleapis.com",
  "aiplatform.googleapis.com",
  "claude -p",
] as const;

const IMPORT_OPENAI = importDe(String.raw`openai(?:\/[^"'\x60]*)?`);

type Fichier = { chemin: string; code: string };

function fautes(fichiers: readonly Fichier[]): string[] {
  const out: string[] = [];
  for (const { chemin, code } of fichiers) {
    const c = sansCommentaires(code);
    for (const sdk of SDK_INTERDITS) {
      if (sdk.motif.test(c)) out.push(`${chemin} importe ${sdk.nom}`);
    }
    for (const chaine of CHAINES_INTERDITES) {
      if (c.includes(chaine)) out.push(`${chemin} contient « ${chaine} »`);
    }
    if (IMPORT_OPENAI.test(c) && chemin !== SEUL_MODULE_OPENAI) {
      out.push(`${chemin} importe openai hors de ${SEUL_MODULE_OPENAI}`);
    }
    if (
      chemin.startsWith("extensions/") &&
      (c.includes("api.openai.com") || c.includes("OPENAI"))
    ) {
      out.push(`${chemin} (extension) désigne OpenAI directement`);
    }
  }
  return out;
}

describe("le circuit visio ne parle qu'à OpenAI, par un seul module", () => {
  it("contre-témoin : chaque interdit est bien reconnu", () => {
    const fictifs: Fichier[] = [
      { chemin: "src/server/visio/a.ts", code: `import Anthropic from "@anthropic-ai/sdk";` },
      { chemin: "src/server/visio/b.ts", code: `const m = await import("@mistralai/mistralai");` },
      { chemin: "src/server/visio/c.ts", code: `const g = require("groq-sdk");` },
      { chemin: "src/server/visio/d.ts", code: `import { x } from "@google-cloud/speech";` },
      { chemin: "scripts/visio/e.ts", code: `fetch("https://api.anthropic.com/v1/messages")` },
      { chemin: "scripts/visio/f.ts", code: `exec("claude -p 'résume'")` },
      { chemin: "src/server/visio/g.ts", code: `import OpenAI from "openai";` },
      {
        chemin: "extensions/enregistreur-meet/h.js",
        code: `fetch("https://api.openai.com/v1/audio")`,
      },
    ];
    expect(fautes(fictifs)).toHaveLength(8);
  });

  it("contre-témoin : le module unique a le droit d'importer openai, et un commentaire ne compte pas", () => {
    expect(
      fautes([
        { chemin: SEUL_MODULE_OPENAI, code: `import OpenAI from "openai";` },
        { chemin: "src/server/visio/i.ts", code: `// jamais @anthropic-ai/sdk ni claude -p` },
      ]),
    ).toEqual([]);
  });

  it("aucun fichier du circuit n'enfreint la règle", () => {
    const fichiers = sourcesSous(DOSSIERS_DU_CIRCUIT_ELARGI).map((chemin) => ({
      chemin,
      code: lire(chemin),
    }));
    expect(
      fautes(fichiers),
      "le circuit visio n'utilise que le crédit API OpenAI, par un seul module (ADR 0055) :",
    ).toEqual([]);
  });
});
