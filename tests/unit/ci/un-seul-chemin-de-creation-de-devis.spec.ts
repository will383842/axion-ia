// @vitest-environment node
/**
 * S15 — UN SEUL CHEMIN de création de devis.
 *
 * Un devis ne naît que par `createDevisAction` (classique) ou `creerDevisFormulesAction`
 * (formules). La garde raisonne PAR FICHIER, pas par fonction : `devis.ts` et `devis-formules.ts`
 * sont les seuls fichiers qui écrivent la table (`create`, `createMany`, `createManyAndReturn`,
 * `upsert`), et `reviseDevisAction`, dans `devis.ts`, y crée elle aussi un devis (la révision) :
 * elle est couverte parce qu'elle vit dans un fichier autorisé, pas parce qu'elle est visée.
 * Un nouvel écran qui importerait l'une des deux actions, ou qui écrirait la table lui-même,
 * contournerait la conversion rejouée côté serveur : ce test rougit et nomme le fichier.
 *
 * « Importer » : import nommé (renommé compris), import dynamique (`await import(...)`),
 * `import * as`, `export { … } from`, `export * from`. Pour les formes qui prennent le module
 * entier, le spécifieur est résolu vers le module qui définit les actions.
 * LIMITES CONNUES : une écriture imbriquée (`devis: { create: … }`) n'est vue que sous sa forme
 * littérale directe ; passée par une variable intermédiaire, elle échappe à la garde. De même,
 * l'alias `const d = tx.devis; d.create(...)` n'est PAS détecté : seule la forme
 * `<x>.devis.create(` l'est.
 *
 * Lecture par arbre syntaxique TypeScript : une mention dans un commentaire, une chaîne ou un
 * type n'est pas un import, un appel `.devis.create(` n'est pas un texte.
 *
 * Code produit = `src/**` hors `*.spec.*`, `*.test.*`, `__tests__` et `*.spec-util.ts`.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, posix, relative } from "node:path";

import { describe, expect, it } from "vitest";
import ts from "typescript";

const RACINE = process.cwd();

/** Importeurs autorisés des deux actions de création. */
const IMPORTEURS_ACTIONS = [
  "src/server/actions/qualiopi/devis-assistant-finaliser.ts",
  // Repli de l'interrupteur : le formulaire classique reste le chemin quand l'assistant est éteint.
  "src/components/admin/qualiopi/DevisForm.tsx",
  // Repli de l'interrupteur : la vente guidée garde son appel direct tant que l'assistant n'y est pas branché.
  "src/components/admin/qualiopi/VenteWizard.tsx",
];

/** Seuls fichiers qui écrivent la table `devis` (create / createMany / upsert). */
const ECRIVAINS_TABLE = [
  "src/server/actions/qualiopi/devis.ts",
  "src/server/actions/qualiopi/devis-formules.ts",
];

/** Seuls importeurs de `DevisForm`. */
const IMPORTEURS_DEVIS_FORM = [
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis/new/page.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis/[id]/corriger/page.tsx",
];

const ACTIONS = new Set(["createDevisAction", "creerDevisFormulesAction"]);
/** Méthodes de promesse : appelées sur `import(...)`, elles prennent le module entier. */
const PROMESSE = new Set(["then", "catch", "finally"]);
const ECRITURES = new Set(["create", "createMany", "createManyAndReturn", "upsert"]);

function estTest(chemin: string): boolean {
  return (
    /\.(spec|test)\.[cm]?[tj]sx?$/.test(chemin) ||
    /\.spec-util\.[cm]?[tj]sx?$/.test(chemin) ||
    chemin.split("/").includes("__tests__")
  );
}

function parcourir(dir: string, out: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) parcourir(chemin, out);
    else if (/\.[cm]?tsx?$/.test(nom)) out.push(relative(RACINE, chemin).split("\\").join("/"));
  }
  return out;
}

function arbre(fichier: string, source: string): ts.SourceFile {
  return ts.createSourceFile(fichier, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/**
 * Spécifieur des actions, tenu dans une constante : la garde de cloisonnement lit une ligne
 * d'import qui porte ce chemin comme une arête de dépendance, et ce fichier n'en est pas une.
 */
const ACTIONS_MOD = "@/server/actions/qualiopi/devis";

/** Modules qui DÉFINISSENT les actions de création (chemins sans extension). */
const MODULES_ACTIONS: ReadonlySet<string> = new Set([
  "src/server/actions/qualiopi/devis",
  "src/server/actions/qualiopi/devis-formules",
]);
/** Module qui définit `DevisForm`. */
const MODULES_DEVIS_FORM: ReadonlySet<string> = new Set([
  "src/components/admin/qualiopi/DevisForm",
]);

/** Chemin (sans extension ni `/index`) visé par un spécifieur, ou null pour un paquet. */
export function resoudre(fichier: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith(".")) base = posix.normalize(posix.join(posix.dirname(fichier), spec));
  else return null;
  return base.replace(/\.[cm]?[tj]sx?$/, "").replace(/\/index$/, "");
}

const specifieur = (n: ts.Expression | undefined): string | null =>
  n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;

/**
 * Ce que le fichier IMPORTE (ou ré-exporte) : le nom, renommé ou non, pour un import nommé ; le
 * nom de l'action ou `*` pour toute forme qui prend le MODULE entier (import dynamique,
 * `import * as`, import par défaut, `export *`, `export * as`) vers un module de `modules`.
 * Un import dynamique déstructuré (ou lu par propriété) qui ne prend aucun des noms ne compte pas.
 */
export function importe(
  fichier: string,
  source: string,
  noms: ReadonlySet<string>,
  modules: ReadonlySet<string> = new Set(),
): string[] {
  const trouves: string[] = [];
  const sf = arbre(fichier, source);
  const duModule = (spec: ts.Expression | undefined): boolean => {
    const t = specifieur(spec);
    const r = t === null ? null : resoudre(fichier, t);
    return r !== null && modules.has(r);
  };
  const visite = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) && n.importClause) {
      const { name, namedBindings } = n.importClause;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const el of namedBindings.elements)
          if (noms.has((el.propertyName ?? el.name).text))
            trouves.push((el.propertyName ?? el.name).text);
      } else if (
        namedBindings &&
        ts.isNamespaceImport(namedBindings) &&
        duModule(n.moduleSpecifier)
      )
        trouves.push("*");
      if (name && duModule(n.moduleSpecifier)) trouves.push("default");
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier) {
      if (n.exportClause && ts.isNamedExports(n.exportClause)) {
        for (const el of n.exportClause.elements)
          if (noms.has((el.propertyName ?? el.name).text))
            trouves.push((el.propertyName ?? el.name).text);
      } else if (duModule(n.moduleSpecifier)) trouves.push("*");
    } else if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      duModule(n.arguments[0])
    ) {
      // `await import(...)` : on regarde comment le module est consommé.
      let cible: ts.Node = n;
      if (cible.parent && ts.isAwaitExpression(cible.parent)) cible = cible.parent;
      while (cible.parent && ts.isParenthesizedExpression(cible.parent)) cible = cible.parent;
      const p = cible.parent;
      let prend = true;
      if (p && ts.isVariableDeclaration(p) && ts.isObjectBindingPattern(p.name)) {
        prend = p.name.elements.some(
          (el) => el.dotDotDotToken || noms.has((el.propertyName ?? el.name).getText(sf)),
        );
      } else if (p && ts.isPropertyAccessExpression(p) && p.expression === cible) {
        // `.then` / `.catch` / `.finally` ne lisent pas une propriété du module : ils reçoivent
        // le module entier dans leur rappel (`import(x).then((m) => m.createDevisAction(y))`).
        prend = PROMESSE.has(p.name.text) || noms.has(p.name.text);
      } else if (p && ts.isElementAccessExpression(p) && p.expression === cible) {
        const a = p.argumentExpression;
        prend = !ts.isStringLiteral(a) || PROMESSE.has(a.text) || noms.has(a.text);
      }
      if (prend) trouves.push("*");
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return trouves;
}

/** Nom d'une propriété lue par `.x` ou `["x"]`, sinon null. */
function nomAcces(e: ts.Expression): string | null {
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  if (ts.isElementAccessExpression(e) && ts.isStringLiteralLike(e.argumentExpression))
    return e.argumentExpression.text;
  return null;
}

/**
 * Écritures de la table : `<x>.devis.create(` / `createMany(` / `createManyAndReturn(` /
 * `upsert(`, avec accès par crochets (`tx["devis"].create`, `prisma["devis"]["upsert"]`), et
 * écriture imbriquée simple `{ devis: { create | createMany | upsert | connectOrCreate: … } }`.
 * LIMITE : une écriture imbriquée par un alias ou une variable intermédiaire
 * (`const w = { create: … }; … devis: w`) n'est pas vue.
 */
export function ecritures(fichier: string, source: string): string[] {
  const trouves: string[] = [];
  const sf = arbre(fichier, source);
  const note = (n: ts.Node, nom: string) =>
    trouves.push(`${nom}@${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
  const visite = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const nom = nomAcces(n.expression);
      if (nom !== null && ECRITURES.has(nom)) {
        const cible = (n.expression as ts.PropertyAccessExpression | ts.ElementAccessExpression)
          .expression;
        if (nomAcces(cible) === "devis") note(n, nom);
      }
    } else if (
      ts.isPropertyAssignment(n) &&
      (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) &&
      n.name.text === "devis" &&
      ts.isObjectLiteralExpression(n.initializer)
    ) {
      for (const p of n.initializer.properties)
        if (
          p.name &&
          (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
          (ECRITURES.has(p.name.text) || p.name.text === "connectOrCreate")
        )
          note(p, `imbriquee:${p.name.text}`);
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return trouves;
}

const PRODUIT = parcourir(join(RACINE, "src")).filter((f) => !estTest(f));
const SOURCES = new Map(PRODUIT.map((f) => [f, readFileSync(join(RACINE, f), "utf8")]));

function fichiersQui(pred: (f: string, s: string) => boolean, sources: Map<string, string>) {
  return [...sources]
    .filter(([f, s]) => pred(f, s))
    .map(([f]) => f)
    .sort();
}

const importeursActions = (m: Map<string, string>) =>
  fichiersQui((f, s) => importe(f, s, ACTIONS, MODULES_ACTIONS).length > 0, m);
const ecrivainsTable = (m: Map<string, string>) =>
  fichiersQui((f, s) => /\bdevis\b/.test(s) && ecritures(f, s).length > 0, m);
const importeursDevisForm = (m: Map<string, string>) =>
  fichiersQui((f, s) => importe(f, s, new Set(["DevisForm"]), MODULES_DEVIS_FORM).length > 0, m);

/** Un seul passage sur le dépôt, partagé par les trois assertions réelles. */
let reelMemo: { actions: string[]; tables: string[]; form: string[] } | undefined;
function reel() {
  reelMemo ??= {
    actions: importeursActions(SOURCES),
    tables: ecrivainsTable(SOURCES),
    form: importeursDevisForm(SOURCES),
  };
  return reelMemo;
}

describe("S15 — un seul chemin de création de devis (dépôt réel)", () => {
  it("la garde parcourt bien le code produit (pas de passage à vide)", () => {
    expect(PRODUIT.length).toBeGreaterThan(1000);
  });

  it("(a) seuls trois fichiers importent createDevisAction ou creerDevisFormulesAction", () => {
    expect(reel().actions).toEqual([...IMPORTEURS_ACTIONS].sort());
  });

  it("(b) seuls devis.ts et devis-formules.ts appellent devis.create / createMany / createManyAndReturn / upsert", () => {
    expect(reel().tables).toEqual([...ECRIVAINS_TABLE].sort());
  });

  it("(c) DevisForm n'est importé que par les pages « nouveau » et « corriger »", () => {
    expect(reel().form).toEqual([...IMPORTEURS_DEVIS_FORM].sort());
  });

  it("(d) chaque entrée autorisée existe encore (sinon la liste est périmée)", () => {
    const perimees = [...IMPORTEURS_ACTIONS, ...ECRIVAINS_TABLE, ...IMPORTEURS_DEVIS_FORM].filter(
      (f) => !existsSync(join(RACINE, f)),
    );
    expect(perimees).toEqual([]);
  });
});

describe("S15 — face ROUGE : des sources fictives sont détectées", () => {
  const base = new Map<string, string>([
    [IMPORTEURS_ACTIONS[0]!, `import { createDevisAction } from "${ACTIONS_MOD}";`],
    [ECRIVAINS_TABLE[0]!, "await tx.devis.create({ data });"],
  ]);
  const avec = (f: string, s: string) => new Map([...base, [f, s]]);

  it("un import en trop est nommé", () => {
    const m = avec("src/x/Nouveau.tsx", 'import { creerDevisFormulesAction } from "@/a";');
    expect(importeursActions(m)).toContain("src/x/Nouveau.tsx");
    expect(importeursActions(m)).not.toEqual([...IMPORTEURS_ACTIONS.slice(0, 1)]);
  });

  it("un import renommé (`as c`) ou multi-lignes est détecté", () => {
    expect(
      importeursActions(avec("src/x/A.tsx", 'import { createDevisAction as c } from "@/a";')),
    ).toContain("src/x/A.tsx");
    expect(
      importeursActions(
        avec("src/x/B.tsx", 'import {\n  autre,\n  createDevisAction,\n} from "@/a";'),
      ),
    ).toContain("src/x/B.tsx");
  });

  it("une ré-exportation nommée est détectée", () => {
    expect(
      importeursActions(avec("src/x/C.ts", 'export { createDevisAction } from "@/a";')),
    ).toContain("src/x/C.ts");
  });

  it("une mention en commentaire, en chaîne ou en type n'est pas un import", () => {
    const m = avec(
      "src/x/D.ts",
      [
        "// import { createDevisAction } from '@/a';",
        "/** voir `creerDevisFormulesAction` */",
        'const s = "createDevisAction";',
        'type T = typeof import("@/a");',
        "type U = { createDevisAction: string };",
      ].join("\n"),
    );
    expect(importeursActions(m)).not.toContain("src/x/D.ts");
  });

  it("un import dynamique du module (destructuré ou par propriété) est détecté", () => {
    for (const src of [
      `const { createDevisAction } = await import("${ACTIONS_MOD}");`,
      `const m = await import("${ACTIONS_MOD}"); await m.createDevisAction(x);`,
      `const f = (await import("${ACTIONS_MOD}-formules")).creerDevisFormulesAction;`,
      `const m = await import("${ACTIONS_MOD}");`,
    ])
      expect(importeursActions(avec("src/x/I.ts", src))).toContain("src/x/I.ts");
  });

  it("un import dynamique suivi de `.then` / `.catch` / `.finally` est détecté", () => {
    for (const src of [
      `const X = dynamic(() => import("@/components/admin/qualiopi/DevisForm").then((m) => m.DevisForm));`,
      `import("${ACTIONS_MOD}").then((m) => m.createDevisAction(x));`,
      `import("${ACTIONS_MOD}").catch(() => null);`,
      `import("${ACTIONS_MOD}").finally(() => {});`,
    ])
      expect(
        importeursActions(avec("src/x/T.ts", src)).length +
          importeursDevisForm(avec("src/x/T.ts", src)).length,
      ).toBeGreaterThan(0);
    // Les deux formes exigées, nommément, chacune sur sa garde.
    expect(
      importeursDevisForm(
        avec(
          "src/x/T1.tsx",
          'const X = dynamic(() => import("@/components/admin/qualiopi/DevisForm").then((m) => m.DevisForm));',
        ),
      ),
    ).toEqual(["src/x/T1.tsx"]);
    expect(
      importeursActions(
        avec("src/x/T2.ts", `import("${ACTIONS_MOD}").then((m) => m.createDevisAction(x));`),
      ),
    ).toContain("src/x/T2.ts");
  });

  it("un import d'espace de noms du module est détecté (alias ou relatif)", () => {
    expect(
      importeursActions(avec("src/x/J.ts", `import * as A from "${ACTIONS_MOD}"; A.x();`)),
    ).toContain("src/x/J.ts");
    expect(
      importeursActions(
        avec("src/server/actions/qualiopi/K.ts", 'import * as A from "./devis-formules";'),
      ),
    ).toContain("src/server/actions/qualiopi/K.ts");
  });

  it("`export * from` le module est détecté", () => {
    expect(importeursActions(avec("src/x/L.ts", `export * from "${ACTIONS_MOD}";`))).toContain(
      "src/x/L.ts",
    );
  });

  it("face verte : un import qui ne prend aucune des deux actions n'est pas un importeur", () => {
    for (const src of [
      `import { reviseDevisAction } from "${ACTIONS_MOD}";`,
      `const { reviseDevisAction } = await import("${ACTIONS_MOD}");`,
      `const f = (await import("${ACTIONS_MOD}")).reviseDevisAction;`,
      'const { x } = await import("@/components/admin/qualiopi/devis-classique-modifier");',
      'import * as A from "@/autre/module";',
      'export * from "@/autre/module";',
    ])
      expect(importeursActions(avec("src/x/M.ts", src))).not.toContain("src/x/M.ts");
  });

  it("`import * as`, import dynamique et `export *` de DevisForm sont détectés", () => {
    const mod = "@/components/admin/qualiopi/DevisForm";
    for (const src of [
      `import * as F from "${mod}";`,
      `const { DevisForm } = await import("${mod}");`,
      `const m = await import("${mod}");`,
      `export * from "${mod}";`,
    ])
      expect(importeursDevisForm(avec("src/x/N.tsx", src))).toEqual(["src/x/N.tsx"]);
    expect(
      importeursDevisForm(
        avec(
          "src/x/O.tsx",
          'const m = await import("@/components/admin/qualiopi/devis-classique-modifier");',
        ),
      ),
    ).toEqual([]);
  });

  it("createManyAndReturn, accès par crochets et écriture imbriquée sont nommés", () => {
    for (const src of [
      "await tx.devis.createManyAndReturn({ data });",
      'await tx["devis"].create({ data });',
      'await prisma["devis"]["upsert"]({ data });',
      "await tx.projet.create({ data: { devis: { create: { x: 1 } } } });",
      "await tx.projet.update({ data: { devis: { createMany: { data: [] } } } });",
    ])
      expect(ecrivainsTable(avec("src/x/P.ts", src))).toContain("src/x/P.ts");
    expect(
      ecrivainsTable(
        avec(
          "src/x/Q.ts",
          'await tx["devis"].findMany({}); const o = { devis: { connect: { id } } };',
        ),
      ),
    ).not.toContain("src/x/Q.ts");
  });

  it("un `tx.devis.create(` ailleurs est nommé, comme createMany et upsert", () => {
    for (const appel of ["create", "createMany", "upsert"]) {
      const m = avec("src/x/E.ts", `await tx.devis.${appel}({ data });`);
      expect(ecrivainsTable(m)).toContain("src/x/E.ts");
    }
    expect(ecrivainsTable(avec("src/x/F.ts", "await prisma.devis.create({});"))).toContain(
      "src/x/F.ts",
    );
  });

  it("un autre modèle, une lecture ou un commentaire ne sont pas une écriture", () => {
    const m = avec(
      "src/x/G.ts",
      [
        "// tx.devis.create({})",
        "await tx.devisLigne.create({});",
        "await tx.devis.findMany({});",
        'const s = "tx.devis.create(";',
      ].join("\n"),
    );
    expect(ecrivainsTable(m)).not.toContain("src/x/G.ts");
  });

  it("un import de DevisForm en trop est nommé (renommé compris)", () => {
    const m = avec("src/x/H.tsx", 'import { DevisForm as F } from "@/c/DevisForm";');
    expect(importeursDevisForm(m)).toEqual(["src/x/H.tsx"]);
  });
});
