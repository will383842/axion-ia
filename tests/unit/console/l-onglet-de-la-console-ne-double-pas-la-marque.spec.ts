/**
 * L'onglet d'une page de la console ne répète pas deux fois la marque.
 *
 * ## Le défaut mesuré le 2026-09-10, au navigateur, en production
 *
 * Sur `/fr/<préfixe>/`, l'onglet lisait **« Console admin | Axion-IA · Axion-IA »**.
 *
 * Le layout admin porte un long bloc expliquant qu'il a corrigé « 171 pages de
 * la console qui s'annonçaient comme le site marketing ». Ce correctif marchait
 * — les 171 pages ne portent plus le titre commercial — mais il laissait la
 * marque **deux fois**, et personne ne l'a vu : ça ne se lit pas dans le code,
 * il faut ouvrir un onglet.
 *
 * ## 🔑 La cause, et pourquoi le correctif évident est un piège
 *
 * Dans Next.js, le `title.default` d'un segment **enfant** subit le `template`
 * du **parent**. `src/app/[locale]/layout.tsx` déclare `template: "%s · Axion-IA"`,
 * et seul `title.absolute` y échappe. Le `template: "%s"` déclaré par le layout
 * admin gouverne ses ENFANTS ; il ne protège pas son propre `default`.
 *
 * ⚠️ **Remplacer `default` par `absolute` serait une régression**, et ce test
 * existe autant pour ça que pour la marque doublée : `absolute` ne sert PAS de
 * repli aux segments enfants. Les 171 pages sans titre propre remonteraient
 * chercher plus haut et retrouveraient le titre du site marketing — le défaut
 * même que le bloc du layout existe pour empêcher.
 *
 * On garde donc `default`, sans la marque, et le parent la pose une fois.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const RACINE = process.cwd();
const LAYOUT_LOCALE = join(RACINE, "src/app/[locale]/layout.tsx");
const LAYOUT_ADMIN = join(RACINE, "src/app/[locale]/(admin)/[adminPrefix]/layout.tsx");

/** Le gabarit de titre du layout racine, tel qu'il s'applique à ses enfants. */
function gabaritDuParent(): string {
  const src = readFileSync(LAYOUT_LOCALE, "utf8");
  const m = /template:\s*"([^"]+)"/.exec(src);
  expect(m, "`src/app/[locale]/layout.tsx` ne déclare plus de `template` de titre").not.toBeNull();
  return m?.[1] ?? "";
}

/** Le bloc `title: { … }` du layout admin, commentaires retirés. */
function titreDeLaConsole(): {
  defaut: string | undefined;
  absolu: string | undefined;
  gabarit: string | undefined;
} {
  const src = readFileSync(LAYOUT_ADMIN, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const bloc = /title:\s*\{([^}]*)\}/.exec(src);
  expect(bloc, "le layout admin ne déclare plus de `title`").not.toBeNull();
  const corps = bloc?.[1] ?? "";
  const lire = (cle: string) => new RegExp(`${cle}:\\s*"([^"]*)"`).exec(corps)?.[1];
  return { defaut: lire("default"), absolu: lire("absolute"), gabarit: lire("template") };
}

describe("l'onglet de la console ne double pas la marque", () => {
  it("🔑 CONTRE-TÉMOIN : le parent pose bien une marque dans son gabarit", () => {
    // Sans marque au parent, l'assertion principale serait vraie pour la
    // mauvaise raison — il n'y aurait rien à ne pas répéter.
    const gabarit = gabaritDuParent();
    expect(gabarit).toContain("%s");
    expect(
      gabarit.replace("%s", "").trim().length,
      `le gabarit du parent (« ${gabarit} ») n'ajoute plus rien : ce test ne mesure plus rien`,
    ).toBeGreaterThan(0);
  });

  it("le titre par défaut de la console ne répète pas ce que le parent ajoute déjà", () => {
    const gabarit = gabaritDuParent();
    const { defaut } = titreDeLaConsole();
    expect(defaut, "le layout admin ne déclare plus de `title.default`").toBeTruthy();

    // Ce que le parent colle autour du titre : « · Axion-IA » → « Axion-IA ».
    const ajoutDuParent = gabarit
      .replace("%s", "")
      .replace(/[^\p{L}\p{N} -]/gu, "")
      .trim();

    expect(
      defaut?.includes(ajoutDuParent),
      `l'onglet affichera « ${gabarit.replace("%s", defaut ?? "")} » — la marque deux fois.\n` +
        "Dans Next.js, le `title.default` d'un segment ENFANT subit le `template` du PARENT ; " +
        "seul `title.absolute` y échappe. Retirer la marque d'ici, le parent la pose.",
    ).toBe(false);
  });

  it("⚠️ la console garde un `default` et JAMAIS un `absolute`", () => {
    const { defaut, absolu } = titreDeLaConsole();
    expect(
      absolu,
      "`title.absolute` ne sert PAS de repli aux segments enfants : les ~171 pages de la " +
        "console sans titre propre remonteraient chercher plus haut et retrouveraient le " +
        "titre du SITE MARKETING. C'est le défaut que le layout dit avoir corrigé en 2026.",
    ).toBeUndefined();
    expect(defaut).toBeTruthy();
  });

  it("le gabarit de la console reste neutre pour ses enfants", () => {
    const { gabarit } = titreDeLaConsole();
    expect(
      gabarit,
      "les 91 pages qui déclarent leur propre titre ne doivent rien recevoir en plus",
    ).toBe("%s");
  });
});
