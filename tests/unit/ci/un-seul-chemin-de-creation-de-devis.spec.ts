// @vitest-environment node
/**
 * S15 — UN SEUL CHEMIN de création de devis.
 *
 * Un devis ne naît que par `createDevisAction` (classique) ou `creerDevisFormulesAction`
 * (formules), et ces deux actions sont les seuls écrivains de `devis.create/createMany/upsert`.
 * Un nouvel écran qui importerait l'une des deux actions, ou qui écrirait la table lui-même,
 * contournerait la conversion rejouée côté serveur : ce test rougit et nomme le fichier.
 *
 * Lecture par arbre syntaxique TypeScript : une mention dans un commentaire, une chaîne ou un
 * type n'est pas un import, un appel `.devis.create(` n'est pas un texte.
 *
 * Code produit = `src/**` hors `*.spec.*`, `*.test.*`, `__tests__` et `*.spec-util.ts`.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

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
const ECRITURES = new Set(["create", "createMany", "upsert"]);

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

/** Ce que le fichier IMPORTE (ou ré-exporte) sous l'un des noms, renommé ou non. */
export function importe(fichier: string, source: string, noms: ReadonlySet<string>): string[] {
  const trouves: string[] = [];
  const sf = arbre(fichier, source);
  const visite = (n: ts.Node): void => {
    if (
      ts.isImportDeclaration(n) &&
      n.importClause?.namedBindings &&
      ts.isNamedImports(n.importClause.namedBindings)
    ) {
      for (const el of n.importClause.namedBindings.elements)
        if (noms.has((el.propertyName ?? el.name).text))
          trouves.push((el.propertyName ?? el.name).text);
    } else if (
      ts.isExportDeclaration(n) &&
      n.moduleSpecifier &&
      n.exportClause &&
      ts.isNamedExports(n.exportClause)
    ) {
      for (const el of n.exportClause.elements)
        if (noms.has((el.propertyName ?? el.name).text))
          trouves.push((el.propertyName ?? el.name).text);
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return trouves;
}

/** Appels `<x>.devis.create(` / `.createMany(` / `.upsert(`. */
export function ecritures(fichier: string, source: string): string[] {
  const trouves: string[] = [];
  const sf = arbre(fichier, source);
  const visite = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ECRITURES.has(n.expression.name.text)
    ) {
      const cible = n.expression.expression;
      if (ts.isPropertyAccessExpression(cible) && cible.name.text === "devis")
        trouves.push(
          `${n.expression.name.text}@${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`,
        );
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
  fichiersQui(
    (f, s) =>
      /createDevisAction|creerDevisFormulesAction/.test(s) && importe(f, s, ACTIONS).length > 0,
    m,
  );
const ecrivainsTable = (m: Map<string, string>) =>
  fichiersQui((f, s) => /\bdevis\b/.test(s) && ecritures(f, s).length > 0, m);
const importeursDevisForm = (m: Map<string, string>) =>
  fichiersQui((f, s) => importe(f, s, new Set(["DevisForm"])).length > 0, m);

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

  it("(b) seuls devis.ts et devis-formules.ts appellent devis.create / createMany / upsert", () => {
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
    [
      IMPORTEURS_ACTIONS[0]!,
      'import { createDevisAction } from "@/server/actions/qualiopi/devis";',
    ],
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
