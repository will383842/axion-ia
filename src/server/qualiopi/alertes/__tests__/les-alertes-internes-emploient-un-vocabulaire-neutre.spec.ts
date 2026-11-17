// Garde (fiche L11, PR A) : les alertes internes n'emploient pas le vocabulaire
// de financement tiers dans leurs textes visibles (titres, messages, libellés).
// On lit le code source avec l'analyseur TypeScript : chaque chaîne et chaque
// modèle de chaîne est examiné, y compris dans les `${…}` imbriqués.
//
// Les mots recherchés sont écrits par concaténation pour que la recherche dans
// le dépôt ne les trouve pas.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const MOTS = new RegExp(
  "op" + "cos?\\b|pris(e|es)? en " + "charge|finan" + "ceurs?|quali" + "(?=" + "opi)",
  "i",
);

/** Identifiant technique : snake/kebab-case, valeur d'énumération, chemin. */
const TECHNIQUE_MINUSCULES = /^[a-z0-9_.:/@-]+$/;
/** Nom de modèle PascalCase. */
const TECHNIQUE_PASCAL = /^[A-Z][a-z0-9]+([A-Z][a-z0-9]*)+$/;

/** Liste blanche explicite : { fichier, texte, raison }. Vide au départ. */
const AUTORISES: { fichier: string; texte: string; raison: string }[] = [];

function estTechnique(texte: string): boolean {
  return TECHNIQUE_MINUSCULES.test(texte) || TECHNIQUE_PASCAL.test(texte);
}

function estAppelIgnore(n: ts.Node): boolean {
  if (!ts.isCallExpression(n)) return false;
  const f = n.expression;
  if (f.kind === ts.SyntaxKind.ImportKeyword) return true;
  if (ts.isIdentifier(f) && f.text === "require") return true;
  if (ts.isPropertyAccessExpression(f) && ts.isIdentifier(f.expression)) {
    return f.expression.text === "console";
  }
  return false;
}

/** Renvoie les chaînes visibles fautives d'une source. */
export function chainesFautives(source: string, nomFichier: string): string[] {
  const sf = ts.createSourceFile(nomFichier, source, ts.ScriptTarget.Latest, true);
  const fautes: string[] = [];

  const examiner = (texte: string) => {
    // Les routes /qualiopi/... sont des chemins, pas des textes lus.
    const sansRoutes = texte.replace(/\/quali(?:opi)\/[\w/-]*/gi, "");
    if (!sansRoutes.trim() || estTechnique(sansRoutes.trim())) return;
    if (!MOTS.test(sansRoutes)) return;
    if (AUTORISES.some((a) => a.fichier === nomFichier && a.texte === texte)) return;
    fautes.push(texte);
  };

  const visiter = (n: ts.Node): void => {
    if (
      ts.isImportDeclaration(n) ||
      ts.isExportDeclaration(n) ||
      ts.isLiteralTypeNode(n) ||
      ts.isImportTypeNode(n) ||
      estAppelIgnore(n)
    ) {
      return;
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      examiner(n.text);
      return;
    }
    if (ts.isTemplateExpression(n)) {
      examiner(n.head.text + n.templateSpans.map((s) => "x" + s.literal.text).join(""));
      for (const s of n.templateSpans) visiter(s.expression);
      return;
    }
    ts.forEachChild(n, visiter);
  };
  visiter(sf);
  return fautes;
}

describe("chainesFautives (test du test)", () => {
  const O = "OP" + "CO";
  it("signale un titre qui emploie le mot", () => {
    expect(chainesFautives(`const a = { titre: "Facture ${O}" };`, "x.ts")).toHaveLength(1);
  });
  it("ignore un code technique", () => {
    expect(
      chainesFautives(`const a = { code: "delai_facturation_${"op" + "co"}" };`, "x.ts"),
    ).toEqual([]);
  });
  it("ignore un cibleType PascalCase", () => {
    expect(chainesFautives(`const a = { cibleType: "Bareme${"Op" + "co"}" };`, "x.ts")).toEqual([]);
  });
  it("lit un modèle imbriqué", () => {
    const src = "const a = `x ${cond ? \"l'" + O + '" : "y"}`;';
    expect(chainesFautives(src, "x.ts")).toHaveLength(1);
  });
  it("ignore les imports", () => {
    expect(
      chainesFautives(`import { a } from "./regle-depot-${"op" + "co"}-a-faire";`, "x.ts"),
    ).toEqual([]);
  });
  it("ignore console.*", () => {
    expect(chainesFautives(`console.warn("[${"op" + "co"}] échec");`, "x.ts")).toEqual([]);
  });
  it("signale « prises en charge » et « Financeurs »", () => {
    expect(chainesFautives(`const a = "des prises en ${"char" + "ge"}";`, "x.ts")).toHaveLength(1);
    expect(chainesFautives(`const a = "Finan${"ceu" + "rs"} à relancer";`, "x.ts")).toHaveLength(1);
  });
  it("ignore une route de console", () => {
    expect(chainesFautives(`const a = "/${"quali" + "opi"}/offres";`, "x.ts")).toEqual([]);
  });
});

describe("les alertes internes emploient un vocabulaire neutre", () => {
  const dossier = join(process.cwd(), "src/server/qualiopi/alertes");
  const fichiers = readdirSync(dossier).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".spec.ts") && !f.endsWith(".test.ts"),
  );

  it("lit assez de fichiers pour ne pas passer au vert à vide", () => {
    expect(fichiers.length).toBeGreaterThanOrEqual(30);
  });

  it("aucun texte visible ne contient les mots de financement tiers", () => {
    const fautes: string[] = [];
    for (const f of fichiers) {
      for (const t of chainesFautives(readFileSync(join(dossier, f), "utf8"), f)) {
        fautes.push(`${f}: ${t.slice(0, 120)}`);
      }
    }
    expect(fautes).toEqual([]);
  });
});
