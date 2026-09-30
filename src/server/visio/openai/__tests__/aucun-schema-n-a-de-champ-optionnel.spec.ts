/**
 * AUCUN SCHÉMA N'A DE CHAMP OPTIONNEL (ADR 0055 §1.3 ; sortie structurée `strict`).
 *
 * En mode `strict: true`, OpenAI exige que TOUS les champs soient requis et
 * `additionalProperties: false` partout ; une valeur absente s'écrit `null`.
 * On le vérifie sur le JSON Schema réellement envoyé (fichiers figés), à
 * tous les niveaux, et sur le source (aucun `.optional()`).
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SCHEMAS_VISIO } from "../../schemas";

const DOSSIER = path.resolve(__dirname, "../../schemas");

function fautes(noeud: unknown, chemin: string, out: string[]): void {
  if (Array.isArray(noeud)) {
    noeud.forEach((n, i) => fautes(n, `${chemin}[${i}]`, out));
    return;
  }
  if (typeof noeud !== "object" || noeud === null) return;
  const o = noeud as Record<string, unknown>;
  if (o["type"] === "object" && typeof o["properties"] === "object") {
    const proprietes = Object.keys(o["properties"] as object);
    const requis = new Set((o["required"] as string[] | undefined) ?? []);
    for (const p of proprietes) if (!requis.has(p)) out.push(`${chemin}.${p} n'est pas requis`);
    if (o["additionalProperties"] !== false) out.push(`${chemin} accepte des propriétés en plus`);
  }
  for (const [k, v] of Object.entries(o)) fautes(v, `${chemin}.${k}`, out);
}

describe("aucun schéma n'a de champ optionnel", () => {
  it("tous les champs sont requis, partout, dans chaque schéma envoyé", () => {
    for (const s of Object.values(SCHEMAS_VISIO)) {
      const out: string[] = [];
      fautes(JSON.parse(readFileSync(path.join(DOSSIER, s.fichier), "utf8")), s.nom, out);
      expect(out, s.nom).toEqual([]);
    }
  });

  it("aucun `.optional()` dans le source des schémas", () => {
    for (const f of readdirSync(DOSSIER).filter((n) => n.endsWith(".ts"))) {
      const code = readFileSync(path.join(DOSSIER, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code, f).not.toMatch(/\.optional\(\)/);
    }
  });

  it("contre-témoin : la détection voit un champ non requis", () => {
    const out: string[] = [];
    fautes(
      {
        type: "object",
        properties: { a: {}, b: {} },
        required: ["a"],
        additionalProperties: false,
      },
      "x",
      out,
    );
    expect(out).toEqual(["x.b n'est pas requis"]);
  });
});
