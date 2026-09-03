/**
 * CLIQUET — un délai déclaré doit pouvoir EXPIRER.
 *
 * 🔴 2026-08-22 — LA FAMILLE SYMÉTRIQUE, ET LA PLUS SOURNOISE.
 *
 * La veille, on avait corrigé des attentes SANS délai, qui consommaient le
 * budget entier du test avant de rendre un message muet. La faute inverse est
 * pire, parce qu'elle a l'air d'un soin :
 *
 *     test.describe.configure({ timeout: 30_000 })   // budget de la suite
 *     await page.goto(url, { timeout: 45_000 })      // délai « soigné »
 *
 * Le `timeout: 45_000` ne peut JAMAIS expirer. C'est le budget qui rend le
 * verdict, avec son message générique — et le message précis que quelqu'un
 * avait pris la peine d'écrire est inatteignable.
 *
 * Cinq suites en souffraient, toutes trouvées le même jour :
 *
 *     public-routes            30 000 < 45 000  (goto du harnais)
 *     header-tient-dans-sa-boite 30 000 < 90 000
 *     a11y-admin               90 000 < 180 000 (loginAsAdmin hors CI)
 *     vente-parcours          180 000 = 180 000 (égal : aucune place pour le reste)
 *     admin-booking-flow      180 000 = 180 000
 *
 * 🔑 Le cliquet des budgets admin ne voyait rien : il ne contrôlait qu'un
 * PLANCHER, jamais la RELATION entre le budget et ce qui vit dedans.
 *
 * ⚠️ STATIQUE, et c'est volontaire : ces suites passent au vert tant que rien
 * n'est lent. Le défaut ne se manifeste que le jour où quelque chose ralentit
 * — c'est-à-dire le jour où l'on a le plus besoin d'un message clair.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE_E2E = join(process.cwd(), "tests", "e2e");

/** Budget par défaut, lu dans la configuration plutôt que recopié. */
function budgetParDefaut(): number {
  const cfg = readFileSync(join(process.cwd(), "playwright.config.ts"), "utf8");
  const m = /^\s*timeout:\s*([0-9_]+)/m.exec(cfg);
  expect(m?.[1], "`timeout` global introuvable dans playwright.config.ts").toBeTruthy();
  return Number((m?.[1] ?? "0").replace(/_/g, ""));
}

function specs(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...specs(chemin));
    else if (entree.endsWith(".spec.ts")) trouves.push(chemin);
  }
  return trouves;
}

/**
 * Les aides de `tests/e2e/**` qu'un fichier importe, résolues en chemins.
 *
 * 🔴 2026-08-23 — DEUX DES TROIS CHEMINS ÉTAIENT FAUX, ET LE CLIQUET S'EN
 * ACCOMMODAIT EN SILENCE.
 *
 * `audit-page` et `_communs` ont migré sous `tests/e2e/qualiopi/` ; cette liste
 * les cherchait encore à la racine. `readFileSync` levait, le `catch` en aval
 * avalait, et le cliquet ne mesurait plus que `admin-auth` — un tiers de ce
 * qu'il annonce. `_communs.ts` peut attendre 300 s (`ARRIVEE_ECRAN`) : cette
 * valeur n'a JAMAIS été comparée à un budget de suite.
 *
 * 🔑 Une garde qui ne trouve pas son objet doit ROUGIR, pas se taire : le
 * `catch` a disparu, et `LISTE_DES_AIDES` est vérifiée pour elle-même ci-dessous.
 */
const LISTE_DES_AIDES = [
  "qualiopi/_harness/audit-page",
  "fixtures/admin-auth",
  "qualiopi/parcours/_communs",
] as const;

function cheminAide(nom: string): string {
  return join(RACINE_E2E, ...nom.split("/")) + ".ts";
}

/**
 * ⚠️ On lit l'IMPORT, pas une occurrence du nom. `source.includes("audit-page")`
 * comptait `portail-garde-acces.spec.ts` comme importateur du harnais alors
 * qu'il ne fait que le CITER dans un commentaire — et lui prêtait les 45 s de
 * `page.goto` qu'il n'exécute jamais. Un test statique qui lit les commentaires
 * finit par accuser de la prose.
 */
function aidesImportees(source: string): string[] {
  const aides: string[] = [];
  for (const nom of LISTE_DES_AIDES) {
    const feuille = nom.split("/").pop() ?? "";
    // Le SPÉCIFICATEUR d'import se termine par `/<feuille>` suivi du guillemet
    // fermant. Une mention en prose (« `_harness/audit-page.ts` ») ne le fait pas.
    const importe = source.includes(`/${feuille}"`) || source.includes(`/${feuille}'`);
    if (importe) aides.push(cheminAide(nom));
  }
  return aides;
}

/**
 * Le plus grand délai littéral d'un source. Pour un ternaire
 * `CI ? 60_000 : 180_000`, les deux branches sont lues — on retient la plus
 * grande, puisque c'est elle qui peut se produire.
 */
function delaiMaximal(source: string): number {
  let max = 0;
  for (const m of source.matchAll(/timeout:\s*([0-9_]+)/g)) {
    max = Math.max(max, Number((m[1] ?? "0").replace(/_/g, "")));
  }
  for (const m of source.matchAll(/\?\s*([0-9_]+)\s*:\s*([0-9_]+)/g)) {
    max = Math.max(
      max,
      Number((m[1] ?? "0").replace(/_/g, "")),
      Number((m[2] ?? "0").replace(/_/g, "")),
    );
  }
  return max;
}

/** Budget effectif déclaré par un fichier, ou `null` s'il n'en déclare aucun. */
function budgetDeclare(source: string): number | null {
  const d = /describe\.configure\(\{[^}]*timeout:\s*([0-9_]+)/.exec(source);
  if (d?.[1]) return Number(d[1].replace(/_/g, ""));
  const t = /test\.setTimeout\(\s*([0-9_]+)/.exec(source);
  return t?.[1] ? Number(t[1].replace(/_/g, "")) : null;
}

/**
 * Les CROCHETS d'un source, avec leur corps — `beforeAll`, `beforeEach`,
 * `afterAll`, `afterEach`.
 *
 * 🔴 POURQUOI ILS SE MESURENT A PART, ET C'EST TOUT LE POINT DE CET AJOUT.
 *
 * `test.describe.configure({ timeout })` ne s'applique qu'aux **TESTS**. Un
 * crochet garde le defaut de `playwright.config.ts` — 30 s — sauf s'il appelle
 * `test.setTimeout()` dans son propre corps.
 *
 * Le cliquet lisait le budget PAR FICHIER : un fichier declarant 300 s au
 * `describe` passait au vert meme quand son `beforeAll` appelait une operation
 * de 180 s avec trente secondes au compteur. Mesure le 2026-09-03 sur
 * `a11y-admin.spec.ts` : « "beforeAll" hook timeout of 30000ms exceeded », trois
 * tests tombes — et le message n'accusait pas la connexion.
 *
 * ⚠️ Ce piege est devenu INTERMITTENT depuis que `loginAsAdmin` rejoue une
 * session partagee : le crochet ne se connecte vraiment que s'il est le premier
 * de son worker. Un rouge qui depend de l'ordre des tests est plus couteux
 * qu'un rouge franc — raison de plus pour le tenir par une garde.
 */
function crochets(source: string): { nom: string; corps: string }[] {
  const out: { nom: string; corps: string }[] = [];
  const motif = /test\.(beforeAll|beforeEach|afterAll|afterEach)\s*\(/g;
  let m = motif.exec(source);
  while (m !== null) {
    // 🔴 LA FLÈCHE D'ABORD, L'ACCOLADE ENSUITE. Chercher le premier `{` après
    // `test.beforeAll(` attrape la DÉSTRUCTURATION des paramètres — dans
    // `test.beforeAll(async ({ browser }) => {`, c'est `{ browser }` qui est
    // extrait, pas le corps. Le contrôle mesurait alors une accolade vide,
    // trouvait zéro délai, et passait au vert sur le cas même qu'il vise.
    //
    // 🔑 C'est le contre-témoin ci-dessous qui l'a attrapé, en exigeant que
    // l'extracteur retrouve un `setTimeout` qu'on sait présent. Sans lui,
    // j'aurais livré une garde inerte — et elle aurait eu l'air de garder.
    const flecheRel = source.slice(m.index).indexOf("=>");
    const ouvrante = flecheRel === -1 ? -1 : source.indexOf("{", m.index + flecheRel);
    if (ouvrante !== -1) {
      let profondeur = 0;
      let fin = source.length;
      for (let i = ouvrante; i < source.length; i += 1) {
        const c = source[i];
        if (c === "{") profondeur += 1;
        else if (c === "}") {
          profondeur -= 1;
          if (profondeur === 0) {
            fin = i;
            break;
          }
        }
      }
      out.push({ nom: m[1] ?? "crochet", corps: source.slice(ouvrante, fin) });
    }
    m = motif.exec(source);
  }
  return out;
}

describe("aucun délai déclaré n'est plus long que son budget", () => {
  const defaut = budgetParDefaut();
  const fichiers = specs(RACINE_E2E);

  it("chaque aide déclarée existe vraiment", () => {
    // Contre-témoin de la liste elle-même : sans lui, renommer ou déplacer une
    // aide fait retomber le cliquet à ce qu'il sait encore lire, sans un mot.
    const introuvables = LISTE_DES_AIDES.filter((nom) => !existsSync(cheminAide(nom)));
    expect(
      introuvables,
      "une aide déclarée ici mais absente du disque n'est pas mesurée : le cliquet " +
        "rendrait alors un vert sur les délais qu'elle porte",
    ).toEqual([]);
  });

  it("des specs sont bien analysées", () => {
    // Contre-témoin : une liste vide ferait passer le test suivant au vert
    // sans rien garder. Le dépôt en compte plusieurs dizaines.
    expect(fichiers.length, "aucune spec trouvée sous tests/e2e").toBeGreaterThan(20);
  });

  it("chaque suite laisse ses propres délais expirer", () => {
    const fautes: string[] = [];
    for (const chemin of fichiers) {
      const source = readFileSync(chemin, "utf8");
      const budget = budgetDeclare(source) ?? defaut;
      // Le budget de la suite ne compte pas comme un délai interne.
      const sansConfigure = source.replace(/describe\.configure\(\{[^}]*\}\)/g, "");
      let interne = delaiMaximal(sansConfigure);
      for (const aide of aidesImportees(source)) {
        // Pas de `catch` : un chemin d'aide faux est un défaut du cliquet
        // lui-même, et il doit se voir ici plutôt que se traduire par un vert.
        interne = Math.max(interne, delaiMaximal(readFileSync(aide, "utf8")));
      }
      if (interne >= budget) {
        fautes.push(
          `${relative(process.cwd(), chemin).replace(/\\/g, "/")} — budget ${budget} ms, ` +
            `délai interne ${interne} ms`,
        );
      }
    }
    expect(
      fautes,
      "un délai plus long que le budget qui le contient ne peut JAMAIS expirer : " +
        "c'est le budget qui rend le verdict, et son message ne nomme rien",
    ).toEqual([]);
  });

  it("🔴 aucun CROCHET n'appelle plus long que SON propre budget", () => {
    // `describe.configure` ne couvre pas les crochets : sans `test.setTimeout()`
    // dans son corps, un `beforeAll` a 30 s, quoi qu'annonce la suite.
    const fautes: string[] = [];
    for (const chemin of fichiers) {
      const source = readFileSync(chemin, "utf8");
      for (const { nom, corps } of crochets(source)) {
        const budget = budgetDeclare(corps) ?? defaut;
        let interne = delaiMaximal(corps);
        // Les aides appelees DEPUIS le crochet comptent : c'est par elles que le
        // depassement est arrive (`loginAsAdmin` attend jusqu'a 180 s).
        for (const aide of aidesImportees(source)) {
          const nomAide =
            aide
              .replace(/\\/g, "/")
              .split("/")
              .pop()
              ?.replace(/\.tsx?$/, "") ?? "";
          const appelee = nomAide.length > 0 && corps.includes(nomAide);
          const parFonction = /loginAsAdmin\s*\(/.test(corps);
          if (appelee || parFonction) {
            interne = Math.max(interne, delaiMaximal(readFileSync(aide, "utf8")));
          }
        }
        if (interne >= budget) {
          fautes.push(
            `${relative(process.cwd(), chemin).replace(/\\/g, "/")} — ${nom} : ` +
              `budget ${budget} ms, délai interne ${interne} ms`,
          );
        }
      }
    }
    expect(
      fautes,
      "`describe.configure` ne s'applique qu'aux TESTS : un crochet garde le budget " +
        "par défaut de la configuration. Poser `test.setTimeout()` EN PREMIÈRE " +
        "instruction du crochet, comme `console-editoriale.spec.ts`",
    ).toEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : l'extracteur de crochets en trouve, et lit leur corps", () => {
    // Sans lui, un motif casse rendrait le test ci-dessus vert en n'examinant
    // aucun crochet — la panne que ce dépôt a déjà payée cinq fois.
    // ⚠️ Seuil posé SOUS la mesure, jamais au-dessus. Compté le 2026-09-04 :
    // `tests/e2e` porte exactement QUATRE crochets, tous en forme `test.xxx(`
    // (2 `beforeAll`, 1 `beforeEach`, 1 `afterAll`). Un seuil à 5 — celui que
    // j'avais posé de mémoire — rendait ce contre-témoin rouge sur du code sain,
    // c'est-à-dire exactement le défaut qu'il prétend empêcher.
    const total = fichiers.reduce((n, f) => n + crochets(readFileSync(f, "utf8")).length, 0);
    expect(
      total,
      "aucun crochet trouvé sous tests/e2e — le motif est cassé",
    ).toBeGreaterThanOrEqual(3);

    const temoin = crochets(
      "test.beforeAll(async ({ browser }) => { test.setTimeout(300_000); await f(); });",
    );
    expect(temoin.length).toBe(1);
    expect(budgetDeclare(temoin[0]?.corps ?? "")).toBe(300000);

    const arme = crochets("test.beforeAll(async () => { await loginAsAdmin(p); });");
    expect(budgetDeclare(arme[0]?.corps ?? "")).toBeNull();
  });

  it("aucune attente réseau n'est laissée sans délai", () => {
    // Jurisprudence : `06-stagiaire-mobile.spec.ts` attendait `networkidle` sans
    // délai sur une page admin qui ne se tait jamais. L'attente a consommé les
    // 300 s du test, puis rendu « Test timeout exceeded » sans nommer la cause.
    const fautes: string[] = [];
    for (const chemin of fichiers) {
      const source = readFileSync(chemin, "utf8");
      // 🔴 CE TEST S'EST TROUVÉ LUI-MÊME. Un premier jet balayait le fichier
      // entier et comptait l'occurrence citée dans le COMMENTAIRE qui explique
      // pourquoi l'appel a été retiré. Un cliquet qui matche sa propre
      // jurisprudence rougit sur sa documentation — exactement le piège déjà
      // payé par le cliquet du seed de démonstration, la veille.
      const code = source
        .split("\n")
        .filter((l) => {
          const t = l.trim();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
        })
        .join("\n");
      for (const m of code.matchAll(/waitForLoadState\(\s*"networkidle"\s*([,)])/g)) {
        if (m[1] === ")") {
          fautes.push(relative(process.cwd(), chemin).replace(/\\/g, "/"));
        }
      }
    }
    expect(
      fautes,
      '`waitForLoadState("networkidle")` sans délai hérite du budget du test. ' +
        "Une page qui ne se tait jamais côté réseau le consomme en entier.",
    ).toEqual([]);
  });
});
