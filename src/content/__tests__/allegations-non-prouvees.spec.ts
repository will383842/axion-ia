/**
 * Garde GEO/DGCCRF (2026-11-18) : les allégations non prouvables retirées du site
 * ne doivent pas revenir dans les contenus publics (pages, composants, contenus,
 * messages). Les pages d'administration, les tests et les e-mails sont exclus.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");

// Mots-clés de rédaction et base de génération : matière interne, pas des textes publiés.
const EXCLUS = [/keywords/, /content-gen/, /__tests__/, /\.(spec|test)\.tsx?$/, /\(admin\)/, /[\/]components[\/]admin[\/]/, /[\/]server[\/]/, /[\/]lib[\/]email[\/]/];

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (EXCLUS.some((r) => r.test(relative(SRC, chemin)))) continue;
    const st = statSync(chemin);
    if (st.isDirectory()) fichiers(chemin, acc);
    else if (/\.(ts|tsx|json)$/.test(nom)) acc.push(chemin);
  }
  return acc;
}

const INTERDITES: ReadonlyArray<RegExp> = [
  /le plus choisi/i,
  /most chosen/i,
  /la référence française/i,
  /the french benchmark/i,
  /le seul partenaire/i,
  /the only partner/i,
  /la première plateforme/i,
  /the first platform/i,
  /visibilité 10\s?×/i,
  /10× visibility/i,
  /recruter 5\s?×/i,
  /5× faster hiring/i,
  /sans hallucination/i,
  /gains? de temps instantanés?/i,
  /instant time savings/i,
];

describe("allégations non prouvées : absentes des contenus publics", () => {
  const tous = fichiers(SRC);
  it("aucune allégation retirée ne réapparaît", () => {
    const trouvees: string[] = [];
    for (const f of tous) {
      const txt = readFileSync(f, "utf8");
      for (const re of INTERDITES) if (re.test(txt)) trouvees.push(`${relative(SRC, f)} : ${re}`);
    }
    expect(trouvees).toEqual([]);
  });

  it("l'appel gratuit de /formations dure 45 minutes", () => {
    const txt = readFileSync(join(SRC, "app", "[locale]", "formations", "page.tsx"), "utf8");
    expect(txt).not.toMatch(/30 min,/);
  });

  it("le guide IA n'affiche pas de ville d'édition", () => {
    expect(readFileSync(join(SRC, "content", "guide-ia-page.ts"), "utf8")).not.toMatch(/Grenoble/);
  });

  it("les conditions tarifaires des formations ne citent ni OPCO, ni prise en charge, ni Qualiopi", () => {
    const txt = readFileSync(join(SRC, "content", "formations", "conditions-tarifaires.ts"), "utf8");
    const code = txt.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/OPCO|prise en charge|Qualiopi/i);
  });

  it("la FAQ transversale n'emploie plus « prise en charge »", () => {
    expect(readFileSync(join(SRC, "content", "transversal.ts"), "utf8")).not.toMatch(/prise en charge/i);
  });
});
