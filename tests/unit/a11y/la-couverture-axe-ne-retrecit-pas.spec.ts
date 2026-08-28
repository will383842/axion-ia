/**
 * 🛑 CLIQUET — la couverture d'accessibilité de la console ne rétrécit pas.
 *
 * ## Le défaut que ce cliquet ferme
 *
 * `a11y-admin.spec.ts` a couvert **4 pages sur 305** pendant des mois, et
 * personne ne l'a vu : une suite qui passe au vert sur 4 écrans ressemble
 * exactement à une suite qui passe au vert sur 300.
 *
 * Le prix a été payé le 2026-08-27 : les 40 violations corrigées par #864
 * vivaient sur `/qualiopi/mode-auditeur` pendant que la suite visitait
 * `/qualiopi/mode-auditeur/signatures` — **un répertoire d'écart**. Puis 5
 * violations de contraste et 48 cibles tactiles ont été trouvées sur trois
 * écrans que rien ne regardait (#872).
 *
 * ## 🔑 Ce que ce cliquet mesure, et pourquoi c'est un COMPTE
 *
 * Le nombre d'écrans inscrits. Pas leur nom, pas leur ordre : **le compte**.
 *
 * C'est la leçon centrale de la journée du 2026-08-27, où six gardes ont été
 * trouvées vertes parce qu'elles ne regardaient rien. Le témoin à lire n'est
 * jamais la couleur d'une garde — c'est le nombre d'éléments qu'elle a
 * effectivement mesurés. « 18 écrans, 0 violation » est un constat ;
 * « 0 violation » n'en est pas un.
 *
 * ## Ce que ce cliquet ne dit PAS
 *
 * Que la console est accessible. **~287 pages restent hors couverture.** Il dit
 * seulement que ce qui est couvert ne peut plus être décrouvert sans qu'on le
 * remarque. Un futur lot devra MESURER de nouveaux écrans avant de les
 * inscrire — et corriger ce qu'il trouve avant de les rendre bloquants.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SUITE = "tests/e2e/a11y-admin.spec.ts";

/** Le plancher, posé sur la mesure du 2026-08-28 : 18 écrans à 0 violation. */
const PLANCHER = 18;

function source(): string {
  return readFileSync(join(process.cwd(), SUITE), "utf8");
}

function ecransInscrits(): string[] {
  return [...source().matchAll(/path:\s*`\/fr\/\$\{ADMIN_PREFIX\}([^`]*)`/g)].map((m) => m[1]!);
}

function pagesAdmin(): number {
  let n = 0;
  const marche = (d: string): void => {
    for (const nom of readdirSync(d)) {
      const p = join(d, nom);
      if (statSync(p).isDirectory()) marche(p);
      else if (nom === "page.tsx") n += 1;
    }
  };
  marche(join(process.cwd(), "src/app/[locale]/(admin)"));
  return n;
}

describe("🛑 la couverture d'accessibilité de la console ne rétrécit pas", () => {
  it(`couvre au moins ${PLANCHER} écrans`, () => {
    const ecrans = ecransInscrits();
    expect(
      ecrans.length,
      `La suite ne couvre plus que ${ecrans.length} écran(s), contre ${PLANCHER} au ` +
        `moment où ce cliquet a été posé. Une couverture qui rétrécit ne rougit ` +
        `nulle part ailleurs : une suite verte sur 4 écrans ressemble à une suite ` +
        `verte sur 300. Si un écran a été retiré volontairement, baisser ce ` +
        `plancher ET écrire pourquoi.`,
    ).toBeGreaterThanOrEqual(PLANCHER);
  });

  it("🔑 les écrans inscrits sont distincts — pas de doublon qui gonfle le compte", () => {
    // Sans ce témoin, on pourrait « atteindre le plancher » en inscrivant deux
    // fois la même page. Le compte serait vrai et la couverture fausse.
    const ecrans = ecransInscrits();
    expect(new Set(ecrans).size, `doublons : ${ecrans.length - new Set(ecrans).size}`).toBe(
      ecrans.length,
    );
  });

  it("🔑 …et l'écran du CERTIFICATEUR en fait partie", () => {
    // Nommé explicitement parce que c'est le seul dont l'absence a déjà coûté
    // 40 violations : `/mode-auditeur` n'était pas couvert, `/mode-auditeur/
    // signatures` l'était. Un répertoire d'écart.
    expect(
      ecransInscrits(),
      "L'écran du mode auditeur n'est plus couvert — c'est celui que le " +
        "certificateur ouvre en premier le jour de la visite.",
    ).toContain("/qualiopi/mode-auditeur");
  });

  it("🔑 …et ne se connecte qu'UNE fois par worker, pas une fois par écran", () => {
    // 🔴 Le 2026-08-28, cette suite se connectait une fois par test. À 4 écrans
    // c'était invisible ; à 18 elle a épuisé le limiteur anti-force-brute et
    // fait tomber HUIT parcours Qualiopi qui tournaient après elle.
    //
    // 🔑 Ce qui rend ce défaut traître : il ne se déclare pas dans le fichier
    // qui le subit. Les huit tests morts n'avaient rien changé. Un coût qui
    // croît avec la liste doit donc être gardé DANS le fichier qui allonge la
    // liste — ici.
    const src = source();
    expect(src, "la connexion doit se faire dans un `beforeAll` — une par worker").toMatch(
      /test\.beforeAll\([\s\S]{0,400}?loginAsAdmin\(/,
    );
    expect(
      (src.match(/\bawait loginAsAdmin\(/g) ?? []).length,
      "un seul appel à loginAsAdmin dans toute la suite : plusieurs appels " +
        "signifient qu'on s'authentifie de nouveau à chaque écran, et le " +
        "limiteur anti-force-brute fera tomber les suites voisines.",
    ).toBe(1);
  });

  it("⚠️ dit la VÉRITÉ sur ce qui reste dehors", () => {
    // Ce test ne garde rien : il refuse qu'on lise « 18 écrans verts » comme
    // « la console est accessible ». Il échouera le jour où la couverture
    // deviendra majoritaire — et ce jour-là, ce sera une bonne nouvelle à
    // écrire, pas un rouge à faire taire.
    const total = pagesAdmin();
    const couverts = ecransInscrits().length;
    expect(total, "le comptage des pages admin ne lit plus rien").toBeGreaterThan(250);
    expect(
      couverts / total,
      `${couverts}/${total} pages couvertes. Si ce ratio dépasse 50 %, relire ce ` +
        `fichier : le commentaire « ~287 pages restent dehors » sera devenu faux.`,
    ).toBeLessThan(0.5);
  });
});
