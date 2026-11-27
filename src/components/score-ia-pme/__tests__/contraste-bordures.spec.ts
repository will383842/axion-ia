// Garde statique du contraste (WCAG 1.4.11, 3:1) : les bordures des éléments interactifs du
// parcours Score IA TPE-PME restent à `border-ink/60` ou plus. Un retour à `/30` ou moins ne
// faisait virer aucun test au rouge (mutation M6 de la relecture).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = path.resolve(__dirname, "..");
const INTERACTIFS = new Set(["button", "input", "a", "Link", "textarea", "select"]);
const BORDURE_FAIBLE = /border-ink\/(?:[1-4]0|[1-9]|[1-4][05])\b/g;

function fautes(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(BORDURE_FAIBLE)) {
    const avant = source.slice(0, m.index);
    const ouvertures = [...avant.matchAll(/<([A-Za-z][A-Za-z0-9]*)\b/g)];
    const balise = ouvertures[ouvertures.length - 1]?.[1] ?? "";
    if (INTERACTIFS.has(balise)) out.push(`<${balise}> ${m[0]}`);
  }
  return out;
}

describe("contraste des bordures interactives", () => {
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".tsx"));

  it("trouve les composants du parcours", () => {
    expect(fichiers.length).toBeGreaterThan(3);
  });

  it.each(fichiers)("%s : aucune bordure interactive sous 60 %%", (f) => {
    expect(fautes(readFileSync(path.join(DOSSIER, f), "utf8"))).toEqual([]);
  });

  it("le détecteur voit une bordure faible sur un bouton", () => {
    expect(fautes('<button className="border-ink/30 rounded">x</button>')).toHaveLength(1);
    expect(fautes('<div className="border-ink/15">x</div>')).toHaveLength(0);
  });
});
