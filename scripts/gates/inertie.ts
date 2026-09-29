/**
 * scripts/gates/inertie.ts — la garde d'INERTIE du canal Axion Partners (INT-T02, REQ-INT-008).
 *
 * « Sans le drapeau d'activation, aucune ligne, aucun travail de fond, aucun appel réseau ; au
 * build, aucun code d'intégration ne s'exécute. » Les tests unitaires le MESURENT sur les points
 * d'entrée d'aujourd'hui. Cette garde empêche qu'un point d'entrée de DEMAIN y échappe : elle lit
 * le code (AST TypeScript) et refuse cinq formes.
 *
 *   R1  Un effet AU CHARGEMENT dans la zone : instruction nue, appel ou `new` hors d'une fonction.
 *       Au build, Next importe les modules des routes ; un module qui agit en se chargeant agit
 *       au build, quel que soit le drapeau.
 *   R2  Un point d'entrée exporté (fonction `async`, ou toute fonction exportée du worker) qui ne
 *       COMMENCE pas par `if (!canalPartnersOuvert()) …`. Le verrou ailleurs qu'en tête laisse
 *       passer ce qui le précède.
 *   R3  Dans `src/server/queue/worker.ts`, un démarrage du worker ou une programmation du job
 *       Partners qui n'est pas sous une condition `canalPartnersOuvert()`.
 *   R4  Un fichier de `src/app` qui importe `@/server/partners-sync` sans être une route
 *       `route.ts` déclarant `dynamic = "force-dynamic"` : une page l'exécuterait au SSG.
 *   R5  Un verrou qui a perdu l'une de ses deux moitiés : `canalPartnersOuvert` doit consulter le
 *       drapeau ET le build (`estAuBuild`).
 *
 * Le vert IMPRIME ce qu'il a confronté — fichiers, points d'entrée, appels, routes : un compte à
 * zéro est une panne de mesure, pas une réussite, et la garde rougit alors aussi.
 *
 * Lancement : `pnpm partners:inertie` (Gate A). Le contre-témoin de chaque règle est joué par
 * `src/server/partners-sync/__tests__/la-garde-d-inertie-voit-ses-rouges.spec.ts`.
 */
import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

export type Sources = ReadonlyMap<string, string>;
export type Violation = {
  regle: "R1" | "R2" | "R3" | "R4" | "R5";
  fichier: string;
  detail: string;
};
export type Bilan = {
  violations: Violation[];
  fichiersZone: number;
  pointsDEntree: number;
  appelsWorker: number;
  routes: number;
};

const ZONE_SERVEUR = "src/server/partners-sync/";
const FICHIER_WORKER_PARTNERS = "src/server/queue/workers/partners-sync-worker.ts";
const FICHIER_WORKER = "src/server/queue/worker.ts";
const FICHIER_CONFIG = "src/server/partners-sync/config.ts";
const VERROU = "canalPartnersOuvert";
const APPELS_GARDES = ["startPartnersSyncWorker", "programmerRelaisPartners"];

const normal = (p: string) => p.replace(/\\/g, "/");
const estTest = (p: string) => /\/__tests__\/|\.(spec|test)\.tsx?$/.test(p);

function estDansLaZone(p: string): boolean {
  if (estTest(p)) return false;
  return (
    (p.startsWith(ZONE_SERVEUR) && p.endsWith(".ts")) ||
    p === FICHIER_WORKER_PARTNERS ||
    (p.startsWith("src/app/") && p.endsWith("/route.ts") && importeLaZone(p))
  );
}

let sourcesCourantes: Sources = new Map();
function importeLaZone(p: string): boolean {
  const texte = sourcesCourantes.get(p) ?? "";
  return /from\s+["']@\/server\/partners-sync(\/[^"']*)?["']/.test(texte);
}

function analyser(p: string, texte: string): ts.SourceFile {
  return ts.createSourceFile(p, texte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Vrai si `noeud` contient un appel, un `new`, un `await` ou un gabarit étiqueté hors fonction. */
function agitHorsFonction(noeud: ts.Node): boolean {
  let agit = false;
  const visiter = (n: ts.Node): void => {
    if (agit) return;
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n)) return;
    if (ts.isClassDeclaration(n) || ts.isClassExpression(n)) return;
    if (
      ts.isCallExpression(n) ||
      ts.isNewExpression(n) ||
      ts.isAwaitExpression(n) ||
      ts.isTaggedTemplateExpression(n)
    ) {
      agit = true;
      return;
    }
    ts.forEachChild(n, visiter);
  };
  visiter(noeud);
  return agit;
}

function r1(p: string, sf: ts.SourceFile, violations: Violation[]): void {
  for (const st of sf.statements) {
    const permis =
      ts.isImportDeclaration(st) ||
      ts.isExportDeclaration(st) ||
      ts.isTypeAliasDeclaration(st) ||
      ts.isInterfaceDeclaration(st) ||
      ts.isFunctionDeclaration(st) ||
      ts.isClassDeclaration(st) ||
      (ts.isVariableStatement(st) &&
        !st.declarationList.declarations.some(
          (d) => d.initializer && agitHorsFonction(d.initializer),
        ));
    if (!permis) {
      const ligne = sf.getLineAndCharacterOfPosition(st.getStart()).line + 1;
      violations.push({
        regle: "R1",
        fichier: p,
        detail: `ligne ${ligne} : instruction exécutée au chargement du module`,
      });
    }
  }
}

function commenceParLeVerrou(corps: ts.Block | undefined): boolean {
  const premiere = corps?.statements[0];
  if (!premiere || !ts.isIfStatement(premiere)) return false;
  const c = premiere.expression;
  return (
    ts.isPrefixUnaryExpression(c) &&
    c.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isCallExpression(c.operand) &&
    c.operand.expression.getText() === VERROU
  );
}

function r2(p: string, sf: ts.SourceFile, violations: Violation[]): number {
  if (p.startsWith("src/app/")) return 0;
  let comptes = 0;
  for (const st of sf.statements) {
    if (!ts.isFunctionDeclaration(st) || !st.name) continue;
    const exportee = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!exportee) continue;
    const asynchrone = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    if (!asynchrone && p !== FICHIER_WORKER_PARTNERS) continue;
    comptes += 1;
    if (!commenceParLeVerrou(st.body)) {
      violations.push({
        regle: "R2",
        fichier: p,
        detail: `${st.name.text}() ne commence pas par \`if (!${VERROU}()) …\``,
      });
    }
  }
  return comptes;
}

function sousLeVerrou(n: ts.Node): boolean {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    const gardee = ts.isConditionalExpression(p)
      ? { condition: p.condition, cote: p.whenTrue }
      : ts.isIfStatement(p)
        ? { condition: p.expression, cote: p.thenStatement }
        : null;
    // La condition doit être le verrou LUI-MÊME, pas sa négation ni un « || » qui le contourne.
    if (gardee && gardee.condition.getText() === `${VERROU}()`) {
      if (n.pos >= gardee.cote.pos && n.end <= gardee.cote.end) return true;
    }
  }
  return false;
}

function r3(sources: Sources, violations: Violation[]): number {
  const texte = sources.get(FICHIER_WORKER);
  if (texte === undefined) return 0;
  const sf = analyser(FICHIER_WORKER, texte);
  let appels = 0;
  const visiter = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && APPELS_GARDES.includes(n.expression.getText())) {
      appels += 1;
      if (!sousLeVerrou(n)) {
        const ligne = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        violations.push({
          regle: "R3",
          fichier: FICHIER_WORKER,
          detail: `ligne ${ligne} : ${n.expression.getText()}() hors d'une condition ${VERROU}()`,
        });
      }
    }
    ts.forEachChild(n, visiter);
  };
  visiter(sf);
  return appels;
}

function r4(sources: Sources, violations: Violation[]): number {
  let routes = 0;
  for (const [p, texte] of sources) {
    if (!p.startsWith("src/app/") || estTest(p) || !importeLaZone(p)) continue;
    const estRoute = p.endsWith("/route.ts");
    const dynamique = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(texte);
    if (estRoute && dynamique) {
      routes += 1;
      continue;
    }
    violations.push({
      regle: "R4",
      fichier: p,
      detail: estRoute
        ? 'route sans `export const dynamic = "force-dynamic"` : elle pourrait être évaluée au build'
        : "une page ou un gabarit importe le canal Partners : il s'exécuterait au SSG",
    });
  }
  return routes;
}

function r5(sources: Sources, violations: Violation[]): void {
  const texte = sources.get(FICHIER_CONFIG);
  if (texte === undefined) {
    violations.push({ regle: "R5", fichier: FICHIER_CONFIG, detail: "fichier absent" });
    return;
  }
  const sf = analyser(FICHIER_CONFIG, texte);
  const f = sf.statements.find(
    (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === VERROU,
  );
  const corps = f?.body?.getText() ?? "";
  for (const moitie of ["estPartnersSyncActif()", "estAuBuild()"]) {
    if (!corps.includes(moitie)) {
      violations.push({
        regle: "R5",
        fichier: FICHIER_CONFIG,
        detail: `${VERROU}() ne consulte plus ${moitie}`,
      });
    }
  }
}

/** La garde, sur un jeu de sources donné (chemins relatifs à la racine du dépôt). */
export function verifierInertie(sources: Sources): Bilan {
  sourcesCourantes = sources;
  const violations: Violation[] = [];
  let fichiersZone = 0;
  let pointsDEntree = 0;
  for (const [p, texte] of sources) {
    if (!estDansLaZone(p)) continue;
    fichiersZone += 1;
    const sf = analyser(p, texte);
    r1(p, sf, violations);
    pointsDEntree += r2(p, sf, violations);
  }
  const appelsWorker = r3(sources, violations);
  const routes = r4(sources, violations);
  r5(sources, violations);
  return { violations, fichiersZone, pointsDEntree, appelsWorker, routes };
}

function lireLeDepot(racine: string): Map<string, string> {
  const sources = new Map<string, string>();
  const parcourir = (dossier: string): void => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== ".next") parcourir(complet);
      } else if (/\.tsx?$/.test(e.name)) {
        sources.set(normal(path.relative(racine, complet)), fs.readFileSync(complet, "utf8"));
      }
    }
  };
  parcourir(path.join(racine, "src"));
  return sources;
}

function principal(): void {
  const bilan = verifierInertie(lireLeDepot(process.cwd()));
  const mesureVide =
    bilan.fichiersZone === 0 || bilan.pointsDEntree === 0 || bilan.appelsWorker === 0;
  if (bilan.violations.length > 0 || mesureVide) {
    console.error("[partners:inertie] ROUGE — le canal Partners peut agir sans son drapeau :");
    for (const v of bilan.violations) console.error(`  ${v.regle}  ${v.fichier} — ${v.detail}`);
    if (mesureVide) {
      console.error(
        "  la mesure est VIDE (zone, points d'entrée ou appels du worker à 0) : panne de la garde.",
      );
    }
    process.exit(1);
  }
  console.warn(
    `[partners:inertie] OK — ${bilan.fichiersZone} fichiers de la zone, ${bilan.pointsDEntree} points ` +
      `d'entrée gardés, ${bilan.appelsWorker} appels du worker sous verrou, ${bilan.routes} route(s) ` +
      "force-dynamic, verrou à deux moitiés.",
  );
}

if (normal(process.argv[1] ?? "").endsWith("scripts/gates/inertie.ts")) principal();
