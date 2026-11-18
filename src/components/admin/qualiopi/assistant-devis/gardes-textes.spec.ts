// @vitest-environment node
/**
 * E18 — gardes de textes de l'assistant de devis, sur tous les fichiers non-test du dossier.
 *
 *  - textes visibles : ni ville, ni promesse de gain, ni capital social, ni prénom du fondateur,
 *    ni montant en euros écrit en dur ;
 *  - source (hors commentaires) : aucune teinte bleue/sky/indigo/cyan du thème par défaut, aucune
 *    couleur littérale (le thème de la console porte les couleurs, jamais l'écran) ;
 *  - page « nouveau devis » : seulement le texte JSX et les attributs de texte, avec en plus les
 *    mots interdits tant que la certification n'est pas obtenue.
 *
 * Chaque règle a sa face ROUGE synthétique. Aucune exception générique : une exception est un
 * couple (fichier, texte) nommé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import ts from "typescript";

import { ATTRIBUTS_TEXTE, fichiers, textesVisibles } from "./__tests__/textes-visibles";

const RACINE = join(process.cwd(), "src/components/admin/qualiopi/assistant-devis");
const PAGE = join(
  process.cwd(),
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis/new/page.tsx",
);

const INTERDITS_TEXTE: ReadonlyArray<[string, RegExp]> = [
  ["ville", /grenoble/i],
  ["gain garanti", /aucun gain garanti/i],
  ["capital social", /capital social/i],
  ["prénom du fondateur", /\bWill\b/],
  ["montant en dur", /\d\s*(?:€|EUR)/],
];
const INTERDITS_PAGE: ReadonlyArray<[string, RegExp]> = [
  ...INTERDITS_TEXTE,
  [
    "mot de la certification",
    /opco|cpf|france travail|financ|prise en charge|qualiopi|certification/i,
  ],
];
const INTERDITS_SOURCE: ReadonlyArray<[string, RegExp]> = [
  ["teinte bleue", /\b(?:blue|sky|indigo|cyan)-\d/],
  ["rgba du bleu de marque", /rgba\(\s*26\s*,\s*77\s*,\s*217/],
  ["couleur littérale", /#[0-9a-fA-F]{3,8}\b/],
];

/**
 * Exceptions NOMMÉES (fichier relatif au dossier + texte exact), jamais génériques.
 * Une exception sur un fichier réservé aux routines R1/R2 porterait « à retirer après R1/R2 » ;
 * il n'y en a aucune.
 */
const EXCEPTIONS: ReadonlyArray<{ fichier: string; texte: string; pourquoi: string }> = [
  {
    fichier: "/fixtures.ts",
    texte: "12 €",
    // Jeu d'essai du cas T6 (saisie invalide qui DOIT être refusée) : lu par les specs seulement,
    // jamais affiché, et le littéral est la donnée testée. Le modifier changerait le test.
    pourquoi: "saisie invalide du cas T6, donnée de test jamais affichée",
  },
];

/** Source sans ses commentaires (les positions de ligne sont conservées). */
export function sansCommentaires(nom: string, source: string): string {
  const sf = ts.createSourceFile(nom, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const plages: Array<[number, number]> = [];
  const visite = (n: ts.Node): void => {
    if (!ts.isJsxText(n)) {
      for (const r of ts.getLeadingCommentRanges(source, n.getFullStart()) ?? [])
        plages.push([r.pos, r.end]);
      for (const r of ts.getTrailingCommentRanges(source, n.getEnd()) ?? [])
        plages.push([r.pos, r.end]);
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  let out = source;
  for (const [a, b] of plages)
    out = out.slice(0, a) + out.slice(a, b).replace(/[^\n]/g, " ") + out.slice(b);
  return out;
}

/** Texte JSX et attributs de texte (y compris les phrases d'une expression d'attribut). */
export function textesJsx(nom: string, source: string): Array<{ ligne: number; texte: string }> {
  const sf = ts.createSourceFile(nom, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Array<{ ligne: number; texte: string }> = [];
  const noter = (n: ts.Node, texte: string) =>
    out.push({ ligne: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, texte });
  const litteraux = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) noter(n, n.text);
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n))
      noter(n, n.text);
    ts.forEachChild(n, litteraux);
  };
  const visite = (n: ts.Node): void => {
    if (ts.isJsxText(n)) {
      if (n.text.trim() !== "") noter(n, n.text);
    } else if (ts.isJsxAttribute(n)) {
      const nomAttr = ts.isIdentifier(n.name) ? n.name.text : "";
      if ((ATTRIBUTS_TEXTE.has(nomAttr) || nomAttr === "description") && n.initializer)
        litteraux(n.initializer);
    } else if (
      ts.isJsxExpression(n) &&
      n.expression &&
      !ts.isJsxAttribute(n.parent) &&
      (ts.isStringLiteral(n.expression) || ts.isNoSubstitutionTemplateLiteral(n.expression))
    ) {
      noter(n.expression, n.expression.text);
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return out;
}

type Faute = string;

function fautesTextes(
  nom: string,
  textes: Array<{ ligne: number; texte: string }>,
  regles: ReadonlyArray<[string, RegExp]>,
  rel = nom,
): Faute[] {
  const fautes: Faute[] = [];
  for (const t of textes)
    for (const [regle, re] of regles)
      if (
        re.test(t.texte) &&
        !EXCEPTIONS.some((e) => e.fichier === rel && t.texte.includes(e.texte))
      )
        fautes.push(`${rel}:${t.ligne} [${regle}] « ${t.texte.trim()} »`);
  return fautes;
}

function fautesSource(nom: string, source: string, rel = nom): Faute[] {
  const fautes: Faute[] = [];
  sansCommentaires(nom, source)
    .split("\n")
    .forEach((ligne, i) => {
      for (const [regle, re] of INTERDITS_SOURCE) {
        const m = re.exec(ligne);
        if (m && !EXCEPTIONS.some((e) => e.fichier === rel && m[0].includes(e.texte)))
          fautes.push(`${rel}:${i + 1} [${regle}] ${m[0]}`);
      }
    });
  return fautes;
}

describe("E18 — gardes de textes de l'assistant (dossier réel)", () => {
  const liste = fichiers(RACINE);

  it("parcourt plus de 20 fichiers (la garde ne passe pas à vide)", () => {
    expect(liste.length).toBeGreaterThan(20);
  });

  it("aucun texte visible ne contient ville, gain garanti, capital social, prénom ni montant en dur", () => {
    const fautes = liste.flatMap((f) =>
      fautesTextes(
        f,
        textesVisibles(f, readFileSync(f, "utf8")),
        INTERDITS_TEXTE,
        f.replace(RACINE, ""),
      ),
    );
    expect(fautes).toEqual([]);
  });

  it("le source ne porte ni teinte bleue, ni rgba de marque, ni couleur littérale (hors commentaires)", () => {
    const fautes = liste.flatMap((f) =>
      fautesSource(f, readFileSync(f, "utf8"), f.replace(RACINE, "")),
    );
    expect(fautes).toEqual([]);
  });

  it("la page « nouveau devis » : texte JSX et attributs de texte sans mot interdit", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(textesJsx(PAGE, src).length).toBeGreaterThan(0);
    expect(fautesTextes("page.tsx", textesJsx(PAGE, src), INTERDITS_PAGE)).toEqual([]);
  });
});

describe("E18 — face ROUGE : chaque règle détecte une source fictive", () => {
  const texte = (src: string, regles = INTERDITS_TEXTE) =>
    fautesTextes("x.tsx", textesVisibles("x.tsx", src), regles).map(
      (f) => f.split("[")[1]!.split("]")[0],
    );

  it("ville", () =>
    expect(texte("const A = () => <p>Notre centre de Grenoble</p>;")).toEqual(["ville"]));
  it("gain garanti", () =>
    expect(texte('const A = () => <p title="Aucun gain garanti ici">x</p>;')).toEqual([
      "gain garanti",
    ]));
  it("capital social", () =>
    expect(texte('const m = "Capital social de la société";')).toEqual(["capital social"]));
  it("prénom du fondateur (mot entier, casse exacte)", () => {
    expect(texte("const A = () => <p>Merci de contacter Will demain</p>;")).toEqual([
      "prénom du fondateur",
    ]);
    expect(texte("const A = () => <p>Il le fera, willingly vraiment</p>;")).toEqual([]);
  });
  it("montant en euros écrit en dur, « € » ou « EUR »", () => {
    expect(texte("const A = () => <p>Acompte de 500 €</p>;")).toEqual(["montant en dur"]);
    expect(texte('const m = "Total 1200 EUR HT";')).toEqual(["montant en dur"]);
    expect(texte("const A = () => <p>Montant : {fmt(x)} €</p>;")).toEqual([]);
  });

  const source = (src: string) =>
    fautesSource("x.tsx", src).map((f) => f.split("[")[1]!.split("]")[0]);
  it("teinte bleue", () => {
    expect(source('const c = "bg-blue-600";')).toEqual(["teinte bleue"]);
    expect(source('const c = "text-indigo-300";')).toEqual(["teinte bleue"]);
    expect(source('const c = "ring-sky-500";')).toEqual(["teinte bleue"]);
    expect(source('const c = "border-cyan-400";')).toEqual(["teinte bleue"]);
    expect(source('const c = "bg-blue-bleu-600 sky-blue";')).toEqual([]);
  });
  it("rgba du bleu de marque", () =>
    expect(source('const s = "rgba(26, 77, 217, 0.1)";')).toEqual(["rgba du bleu de marque"]));
  it("couleur littérale", () => {
    expect(source('const s = "#1a4dd9";')).toEqual(["couleur littérale"]);
    expect(source('const s = "#fff";')).toEqual(["couleur littérale"]);
  });
  it("un commentaire n'est pas lu (ligne, bloc, fin de ligne)", () => {
    expect(
      source(
        [
          "// bg-blue-600 #fff",
          "/* rgba(26,77,217,.1) */",
          "const a = 1; // text-sky-500 #123456",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("page : le texte JSX et un attribut de texte sont lus, pas un commentaire ni un titre de métadonnée", () => {
    const src = [
      'export const metadata = { title: "Qualiopi — Nouveau devis" };',
      "// Qualiopi en commentaire",
      'export default function P() { return <section aria-label="Prise en charge OPCO"><h1>Financement CPF</h1>',
      '<Entete description={ok ? "Un devis certification" : `Pour ${x}`} /></section>; }',
    ].join("\n");
    const fautes = fautesTextes("page.tsx", textesJsx("page.tsx", src), INTERDITS_PAGE);
    expect(fautes).toHaveLength(3);
    expect(fautes.join("\n")).toMatch(/Prise en charge OPCO/);
    expect(fautes.join("\n")).toMatch(/Financement CPF/);
    expect(fautes.join("\n")).toMatch(/certification/);
    expect(fautes.join("\n")).not.toMatch(/Nouveau devis »/);
  });
  it("page : les mots de la règle commune rougissent aussi (ville, prénom, montant)", () => {
    const src = "export default function P() { return <p>Grenoble, Will, 90 €</p>; }";
    expect(fautesTextes("page.tsx", textesJsx("page.tsx", src), INTERDITS_PAGE)).toHaveLength(3);
  });

  it("une exception nommée est une paire (fichier, texte), jamais générique", () => {
    for (const e of EXCEPTIONS) {
      expect(e.fichier).toMatch(/\.tsx?$/);
      expect(e.texte.length).toBeGreaterThan(2);
      expect(e.pourquoi.length).toBeGreaterThan(10);
    }
  });
});
