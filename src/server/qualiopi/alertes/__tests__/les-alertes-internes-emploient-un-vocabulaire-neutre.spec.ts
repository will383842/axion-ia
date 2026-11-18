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

/**
 * Un texte qui est EXACTEMENT un mot recherché (« opco », « financeur ») ressemble à un code
 * technique, mais c'est aussi ce qu'un repli (`?? "financeur"`) ou un retour de fonction
 * afficherait à l'écran : il n'est technique que dans les contextes de `contexteTechnique`.
 */
const MOT_NU = new RegExp("^(?:op" + "cos?|finan" + "ceurs?)$", "i");

/** Clés de propriété dont la valeur est un code, jamais un texte lu. */
const CLES_TECHNIQUES = new Set([
  "code",
  "type",
  "nom",
  "source",
  "destinataire",
  "financementSuggere",
  "financementType",
  "cibleType",
  "targetType",
]);
/** Clés dont la valeur est une liste de codes (filtres de requête). */
const CLES_LISTES_TECHNIQUES = new Set(["in", "notIn", "distinct"]);

/** Liste blanche explicite : { fichier, texte, raison }. Vide au départ. */
const AUTORISES: { fichier: string; texte: string; raison: string }[] = [];

function estTechnique(texte: string): boolean {
  return TECHNIQUE_MINUSCULES.test(texte) || TECHNIQUE_PASCAL.test(texte);
}

function nomDeCle(n: ts.PropertyName): string | null {
  return ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : null;
}

/** Le littéral `n` (un mot nu) est-il à une place où l'on écrit un code ? */
function contexteTechnique(n: ts.Node): boolean {
  const parent = n.parent;
  if (!parent) return false;
  // { code: "opco" }
  if (ts.isPropertyAssignment(parent) && parent.initializer === n) {
    const cle = nomDeCle(parent.name);
    return cle !== null && CLES_TECHNIQUES.has(cle);
  }
  // { in: ["opco", …] } ; new Set(["opco", …])
  if (ts.isArrayLiteralExpression(parent)) {
    const grand = parent.parent;
    if (grand && ts.isPropertyAssignment(grand) && grand.initializer === parent) {
      const cle = nomDeCle(grand.name);
      return cle !== null && CLES_LISTES_TECHNIQUES.has(cle);
    }
    return (
      !!grand &&
      ts.isNewExpression(grand) &&
      ts.isIdentifier(grand.expression) &&
      grand.expression.text === "Set" &&
      grand.arguments?.[0] === parent
    );
  }
  // x === "opco" ; x !== "opco"
  if (ts.isBinaryExpression(parent)) {
    return (
      parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      parent.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
    );
  }
  // case "opco":
  return ts.isCaseClause(parent);
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

function estPlus(n: ts.Node): n is ts.BinaryExpression {
  return ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken;
}

/** Renvoie les chaînes visibles fautives d'une source. */
export function chainesFautives(source: string, nomFichier: string): string[] {
  const sf = ts.createSourceFile(nomFichier, source, ts.ScriptTarget.Latest, true);
  const fautes: string[] = [];

  /** `noeud` : le littéral isolé examiné (son contexte compte) ; absent pour un texte assemblé. */
  const examiner = (texte: string, noeud?: ts.Node, morceaux?: readonly string[]) => {
    // Les routes /qualiopi/... sont des chemins, pas des textes lus.
    const sansRoutes = texte.replace(/\/quali(?:opi)\/[\w/-]*/gi, "");
    const nu = sansRoutes.trim();
    if (!nu) return;
    if (estTechnique(nu)) {
      const motNu = MOT_NU.test(nu);
      if (!motNu || (noeud !== undefined && contexteTechnique(noeud))) return;
    }
    // Un identifiant assemblé (`qualiopi-alertes-${a}-${b}`) : tous ses morceaux de texte sont
    // des codes techniques. Un morceau qui a une phrase (« Facture opco ») ne l'est pas.
    if (
      morceaux !== undefined &&
      morceaux.every((m) => {
        const t = m.trim();
        return t === "" || (estTechnique(t) && !MOT_NU.test(t));
      })
    ) {
      return;
    }
    if (!MOTS.test(sansRoutes)) return;
    if (AUTORISES.some((a) => a.fichier === nomFichier && a.texte === texte)) return;
    fautes.push(texte);
  };

  /** Le texte d'un modèle : les `${…}` deviennent des espaces (jamais « x » collé au mot). */
  const texteDuModele = (n: ts.TemplateExpression): string =>
    n.head.text + n.templateSpans.map((s) => " " + s.literal.text).join("");
  const morceauxDuModele = (n: ts.TemplateExpression): string[] => [
    n.head.text,
    ...n.templateSpans.map((s) => s.literal.text),
  ];

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
    // Une chaîne de `+` est lue UNE fois, jointe : « "prise en " + "charge" » est un seul texte.
    if (estPlus(n)) {
      const feuilles: ts.Expression[] = [];
      const aplatir = (e: ts.Expression): void => {
        if (estPlus(e)) {
          aplatir(e.left);
          aplatir(e.right);
        } else feuilles.push(e);
      };
      aplatir(n);
      const estTexte = (e: ts.Expression) =>
        ts.isStringLiteral(e) ||
        ts.isNoSubstitutionTemplateLiteral(e) ||
        ts.isTemplateExpression(e);
      if (feuilles.some(estTexte)) {
        examiner(
          feuilles
            .map((e) =>
              ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)
                ? e.text
                : ts.isTemplateExpression(e)
                  ? texteDuModele(e)
                  : " ",
            )
            .join(""),
        );
        // Les sous-expressions qui ne sont pas du texte peuvent en contenir (appel, ternaire…).
        for (const e of feuilles) {
          if (ts.isTemplateExpression(e)) for (const s of e.templateSpans) visiter(s.expression);
          else if (!estTexte(e)) visiter(e);
        }
        return;
      }
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      examiner(n.text, n);
      return;
    }
    if (ts.isTemplateExpression(n)) {
      examiner(texteDuModele(n), undefined, morceauxDuModele(n));
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
  it("signale un texte coupé par une concaténation « + »", () => {
    const src = `const a = "la prise en " + "${"char" + "ge"} au barème";`;
    expect(chainesFautives(src, "x.ts")).toHaveLength(1);
  });
  it("signale un mot collé à un « ${…} » de modèle", () => {
    const O = "OP" + "CO";
    expect(chainesFautives("const a = `Facture " + O + "${suffixe}`;", "x.ts")).toHaveLength(1);
  });
  it("laisse passer un identifiant assemblé, signale une phrase à trous", () => {
    expect(chainesFautives("const k = `quali" + "opi-alertes-${a}-${b}`;", "x.ts")).toEqual([]);
    expect(chainesFautives("const m = `Facture OP" + "CO${suffixe}`;", "x.ts")).toHaveLength(1);
  });
  it("signale un mot nu en repli ou en retour de fonction", () => {
    const mot = "finan" + "ceur";
    expect(chainesFautives(`const a = d.nom ?? "${mot}";`, "x.ts")).toHaveLength(1);
    expect(chainesFautives(`function f() { return "${"op" + "co"}"; }`, "x.ts")).toHaveLength(1);
  });
  it("laisse passer un mot nu dans un contexte de code (non-régression)", () => {
    const o = "op" + "co";
    const f = "finan" + "ceur";
    expect(
      chainesFautives(`const a = { financementType: { in: ["${o}", "mixte"] } };`, "x.ts"),
    ).toEqual([]);
    expect(chainesFautives(`const a = { source: "${f}" };`, "x.ts")).toEqual([]);
    expect(chainesFautives(`const a = x === "${o}";`, "x.ts")).toEqual([]);
    expect(chainesFautives(`const a = x !== "${o}";`, "x.ts")).toEqual([]);
    expect(chainesFautives(`switch (x) { case "${o}": break; }`, "x.ts")).toEqual([]);
    expect(chainesFautives(`const s = new Set(["${o}", "${f}"]);`, "x.ts")).toEqual([]);
    expect(chainesFautives(`const a = { where: { distinct: ["${o}"] } };`, "x.ts")).toEqual([]);
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
