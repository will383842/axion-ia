/**
 * Aides partagées par les gardes de textes de l'assistant de devis (arbre syntaxique TypeScript,
 * jamais une recherche textuelle brute). Sorties de `aucun-mot-interdit-dans-les-ecrans.spec.ts`
 * sans changer leur logique.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

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

export const ATTRIBUTS_TEXTE = new Set(["aria-label", "title", "placeholder", "alt", "label"]);

export function fichiers(dir: string): string[] {
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
