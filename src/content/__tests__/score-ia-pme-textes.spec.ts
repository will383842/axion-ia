// T-7 — textes du Score IA TPE-PME : aucun mot interdit, aucun nom d'avant, aucun chiffre en dur.
// Plan V2-10 §7 PR-3 + amendement A. Porte sur `textes.ts`, `pistes.ts`, les libellés des
// questions, la page et les trois composants (commentaires exclus : on lit ce que le visiteur lit).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as textes from "@/content/score-ia-pme/textes";
import { PISTES } from "@/content/score-ia-pme/pistes";
import { construireQuestions } from "@/content/score-ia-pme/questions";
import { LIBELLES_SCORE } from "@/lib/score-ia-pme/libelles";

const RACINE = process.cwd();
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");

/** Retire les commentaires (`//` et `/* *​/`) : seul le texte exécuté compte. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

const FICHIERS_TEXTE = [
  "src/content/score-ia-pme/textes.ts",
  "src/content/score-ia-pme/pistes.ts",
  "src/content/score-ia-pme/questions.ts",
  "src/app/[locale]/diagnostic/page.tsx",
  "src/components/score-ia-pme/ScoreFlow.tsx",
  "src/components/score-ia-pme/AjoutObservatoire.tsx",
  "src/components/score-ia-pme/RetraitReponses.tsx",
  "src/components/score-ia-pme/RetraitBloc.tsx",
];

const INTERDITS: ReadonlyArray<[string, RegExp]> = [
  ["Qualiopi", /qualiopi/i],
  ["OPCO", /\bopco\b/i],
  ["CPF", /\bcpf\b/i],
  ["France Travail", /france\s+travail/i],
  ["financement", /financ(?:ement|er|é)/i],
  ["prise en charge", /prise\s+en\s+charge/i],
  ["Grenoble", /grenoble/i],
  ["Aucun gain garanti", /aucun\s+gain\s+garanti/i],
  ["nom du fondateur", /williams|jullin/i],
  // Ancien nom de l'appel (liste de `un-seul-nom-pour-l-appel.spec.ts`).
  [
    "ancien nom de l'appel",
    /appel\s+(?:de\s+)?cadrage|cadrage\s+par\s+appel|diagnostic\s+gratuit\s+de\s+45|appel\s+(?:de\s+)?d[ée]couverte|appel\s+strat[ée]gique|cadrage\s+45|[ée]change\s+d[ée]couverte/i,
  ],
  // Amendement A : le nom public est « Score IA TPE-PME », jamais « Score IA PME ».
  ["Score IA PME (nom visible)", /Score\s+IA\s+PME/],
  // Aucun avis, aucune note.
  ["avis / note", /\b(?:avis\s+client|note\s+moyenne|\d(?:[.,]\d)?\s*\/\s*5)\b/i],
];

/** Tout le texte réellement lu : constantes de textes, pistes, libellés et questions résolues. */
function texteRendu(): string {
  const exports = Object.values(textes).map((v) => {
    if (typeof v === "function") {
      try {
        return (v as (...a: unknown[]) => unknown)(0, "x", 0, "x");
      } catch {
        return "";
      }
    }
    return v;
  });
  return JSON.stringify([
    exports,
    textes.encadreInformation("Axion-IA SAS", "contact@axion-ia.com"),
    PISTES,
    LIBELLES_SCORE,
    construireQuestions(),
  ]);
}

describe("T-7 — mots interdits", () => {
  for (const [nom, re] of INTERDITS) {
    it(`« ${nom} » n'apparaît dans aucun texte du Score`, () => {
      expect(texteRendu()).not.toMatch(re);
      for (const f of FICHIERS_TEXTE) {
        expect(sansCommentaires(lire(f)), f).not.toMatch(re);
      }
    });
  }

  it("le bouton de l'appel s'appelle « Diagnostic IA »", () => {
    expect(textes.ECRANS.sorties.appel.titre).toBe("Diagnostic IA");
  });

  it("le nom public est « Score IA TPE-PME » (H1, titre, définition)", () => {
    expect(textes.NOM_PUBLIC).toBe("Score IA TPE-PME");
    expect(textes.H1).toBe("Score IA TPE-PME : où en est votre entreprise avec l'IA ?");
    expect(textes.TITRE_PAGE).toBe("Score IA TPE-PME : votre maturité IA en 4 minutes · Axion-IA");
    expect(textes.DEFINITION.startsWith("Le Score IA TPE-PME est")).toBe(true);
  });

  it("la définition tient en 40 à 60 mots", () => {
    const mots = textes.DEFINITION.trim().split(/\s+/).length;
    expect(mots).toBeGreaterThanOrEqual(40);
    expect(mots).toBeLessThanOrEqual(60);
  });
});

describe("T-7 — aucun nombre en dur dans les textes", () => {
  // 4 (minutes), 15 (questions), 5 (plancher et durée), 30 (seuil), 45 (appel). Les autres
  // chiffres (poids, durée, seuils) viennent des constantes ou de `formule.ts`, jamais écrits.
  const AUTORISES = new Set(["4", "15", "5", "30", "45"]);

  for (const f of ["src/content/score-ia-pme/textes.ts", "src/content/score-ia-pme/pistes.ts"]) {
    it(`${f} ne contient que des nombres autorisés`, () => {
      const code = sansCommentaires(lire(f))
        // Les valeurs interpolées (`${…}`) viennent des constantes : hors de la règle.
        .replace(/\$\{[^}]*\}/g, "")
        // Identifiants et versions techniques (`v1`, `q-score-v1`…) : pas du texte lu.
        .replace(/\b[A-Za-z_]+\d+[A-Za-z_]*\b/g, "");
      const trouves = [...code.matchAll(/(?<![\w.-])\d+(?![\w-])/g)].map((m) => m[0]);
      const interdits = trouves.filter((n) => !AUTORISES.has(n));
      expect(interdits, `${f} : nombres non autorisés`).toEqual([]);
    });
  }

  it("la durée et les seuils affichés suivent les constantes", () => {
    const [, finalite, conservation] = textes.encadreInformation("a", "b");
    expect(conservation).toContain("5 ans");
    expect(finalite).toContain("moins de 5 entreprises");
  });
});
