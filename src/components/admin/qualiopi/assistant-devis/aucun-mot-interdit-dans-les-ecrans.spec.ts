/**
 * Garde : tant que la certification n'est pas obtenue, aucun texte visible de l'assistant de devis
 * ne contient « opco », « cpf », « france travail », « financ », « prise en charge », « qualiopi »
 * ou « certification » (sans tenir compte de la casse).
 *
 * L'assistant n'a AUCUNE branche « certifié » : tout texte affiché y est donc affiché sans
 * condition, et un seul mot interdit est une faute.
 *
 * Ce qui est lu (arbre syntaxique TypeScript, jamais une recherche textuelle brute) :
 *  - le texte JSX et les attributs de texte (`aria-label`, `title`, `placeholder`, `alt`, `label`) ;
 *  - toute chaîne ou gabarit contenant un espace (une phrase) hors import/export et hors type.
 * Ce qui ne l'est pas : commentaires, fichiers de test, imports, noms de types et de clés, et les
 * identifiants techniques d'un seul mot (`"opco"`, `/qualiopi/devis`) qui ne sont pas affichés.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

const RACINE = join(process.cwd(), "src/components/admin/qualiopi/assistant-devis");
const INTERDIT = /opco|cpf|france travail|financ|prise en charge|qualiopi|certification/i;
/** Propriétés d'objet dont la valeur est un texte affiché, même d'un seul mot. */
const PROPRIETES_TEXTE = new Set([
  "label",
  "libelle",
  "titre",
  "texte",
  "aide",
  "message",
  "placeholder",
]);

/** Chaîne d'un seul mot retenue : enfant direct d'une expression JSX, ou valeur d'une propriété-texte. */
function estTexteUnMot(n: ts.Node): boolean {
  const p = n.parent;
  if (!p) return false;
  if (ts.isJsxExpression(p) && !ts.isJsxAttribute(p.parent)) return true;
  return (
    ts.isPropertyAssignment(p) &&
    p.initializer === n &&
    (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
    PROPRIETES_TEXTE.has(p.name.text)
  );
}

const ATTRIBUTS_TEXTE = new Set(["aria-label", "title", "placeholder", "alt", "label"]);

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) return nom === "__tests__" ? [] : fichiers(chemin);
    if (!/\.tsx?$/.test(nom) || /\.(spec|test)\.tsx?$/.test(nom)) return [];
    return [chemin];
  });
}

function dansTypeOuImport(n: ts.Node): boolean {
  for (let p: ts.Node | undefined = n; p; p = p.parent) {
    if (
      ts.isImportDeclaration(p) ||
      ts.isExportDeclaration(p) ||
      ts.isTypeNode(p) ||
      ts.isInterfaceDeclaration(p) ||
      ts.isTypeAliasDeclaration(p)
    )
      return true;
  }
  return false;
}

/** Textes visibles d'un fichier, avec leur ligne. */
export function textesVisibles(
  nom: string,
  source: string,
): Array<{ ligne: number; texte: string }> {
  const sf = ts.createSourceFile(nom, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Array<{ ligne: number; texte: string }> = [];
  const noter = (n: ts.Node, texte: string) =>
    out.push({ ligne: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, texte });
  const visite = (n: ts.Node): void => {
    if (ts.isJsxText(n)) {
      if (n.text.trim() !== "") noter(n, n.text);
    } else if (ts.isJsxAttribute(n)) {
      const nomAttr = ts.isIdentifier(n.name) ? n.name.text : "";
      if (ATTRIBUTS_TEXTE.has(nomAttr) && n.initializer && ts.isStringLiteral(n.initializer))
        noter(n, n.initializer.text);
    } else if (
      (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
      !dansTypeOuImport(n) &&
      !ts.isJsxAttribute(n.parent) &&
      !(ts.isPropertyAssignment(n.parent) && n.parent.name === n) &&
      (/\s/.test(n.text.trim()) || (n.text.trim() !== "" && estTexteUnMot(n)))
    ) {
      noter(n, n.text);
    } else if (
      (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) &&
      !dansTypeOuImport(n) &&
      /\s/.test(n.text.trim())
    ) {
      noter(n, n.text);
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return out;
}

describe("assistant de devis — aucun mot interdit dans un texte visible", () => {
  const liste = fichiers(RACINE);

  it("parcourt bien les écrans (la garde ne passe pas à vide)", () => {
    expect(liste.length).toBeGreaterThan(20);
    expect(liste.some((f) => f.endsWith("AssistantDevis.tsx"))).toBe(true);
  });

  it("détecte un mot interdit dans un texte JSX, un attribut et une phrase (anti-faux-vert)", () => {
    const src =
      'export const A = () => <p title="Un titre">Prise en charge OPCO{x}</p>;\n' +
      'const m = "Le financement est prêt";\n' +
      'const id = "opco"; // France Travail en commentaire\n' +
      'import x from "@/server/qualiopi/a b";\n' +
      'type T = { a: "financement possible" };\n' +
      'const o = { "clé avec espace financement": 1, libelle: "Qualiopi pour tous" };\n' +
      'const opts = [{ value: "cpf", label: "CPF" }, { cle: "opco", aide: "OPCO" }];\n' +
      'const J = () => <option>{"OPCO"}</option>;\n' +
      'const ok = f.mode === "opco" ? { value: "cpf", type: "opco" } : null;\n';
    const hits = textesVisibles("x.tsx", src).filter((t) => INTERDIT.test(t.texte));
    expect(hits.map((h) => h.texte)).toEqual([
      "Prise en charge OPCO",
      "Le financement est prêt",
      "Qualiopi pour tous",
      "CPF",
      "OPCO",
      "OPCO",
    ]);
  });

  it("aucun texte visible des écrans ne contient un mot interdit", () => {
    const fautes: string[] = [];
    for (const f of liste) {
      for (const t of textesVisibles(f, readFileSync(f, "utf8")))
        if (INTERDIT.test(t.texte))
          fautes.push(`${f.replace(RACINE, "")}:${t.ligne} « ${t.texte.trim()} »`);
    }
    expect(fautes).toEqual([]);
  });
});
