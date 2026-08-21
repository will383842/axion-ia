/**
 * CLIQUET — le `matcher` du proxy ne doit avaler AUCUNE route non localisée.
 *
 * 🔴 2026-08-21, NEUVIÈME occurrence du même défaut. `src/app/maintenance/`
 * n'était pas exclu du matcher : next-intl le préfixait, et `GET /maintenance`
 * répondait en production `301 → /fr/maintenance → 404`. La page de secours du
 * site — celle qui ne sert QU'AU moment où l'on n'a ni le temps ni les moyens
 * de déboguer quoi que ce soit — était injoignable.
 *
 * Le bloc de commentaires du matcher documente huit incidents identiques avant
 * celui-ci : `api/`, `manifest.webmanifest`, sitemap/robots/llms, `.txt`,
 * `.well-known/`, `widget/`, `qr/`, `.html`, `.vcf`. Huit fois le même défaut,
 * huit fois une exclusion ajoutée à la main, zéro fois un test.
 *
 * 🔑 Une exclusion de plus ne vaut rien ; ce qui vaut, c'est la RÈGLE. Toute
 * route posée directement sous `src/app/` (hors `[locale]`) est par
 * construction non localisée : le proxy ne doit jamais la voir. Ce test dérive
 * la liste du système de fichiers — une dixième route ajoutée demain est
 * couverte sans que personne ait à y penser.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const APP = join(RACINE, "src", "app");

/**
 * Le matcher est lu dans la SOURCE, pas importé : `src/proxy.ts` tire next-auth,
 * qui tire `next/server`, irrésolvable sous l'environnement node de Vitest.
 * On extrait le littéral et on le repasse par `JSON.parse` — les séquences
 * d'échappement de TypeScript et celles de JSON sont les mêmes, donc la chaîne
 * obtenue est exactement celle que Next.js compile.
 */
function matcherDuProxy(): RegExp {
  const source = readFileSync(join(RACINE, "src", "proxy.ts"), "utf8");
  const ligne = source
    .split("\n")
    .find((l) => l.trim().startsWith('"/((?!') && l.includes("_next"));
  expect(ligne, "littéral du matcher introuvable dans src/proxy.ts").toBeTruthy();
  const l = ligne as string;
  const litteral = l.slice(l.indexOf('"'), l.lastIndexOf('"') + 1);
  return new RegExp("^" + (JSON.parse(litteral) as string) + "$");
}

/** Chemins publics servis hors du segment `[locale]`. */
function routesNonLocalisees(): string[] {
  return readdirSync(APP, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((nom) => nom !== "[locale]" && nom !== "api" && !nom.startsWith("_"))
    .filter((nom) =>
      ["page.tsx", "page.ts", "route.ts", "route.tsx"].some((f) => existsSync(join(APP, nom, f))),
    )
    .map((nom) => "/" + nom);
}

describe("le proxy laisse passer les routes non localisées", () => {
  it("aucune route posée sous src/app/ n'est capturée par le matcher", () => {
    const matcher = matcherDuProxy();
    const routes = routesNonLocalisees();
    // Témoin de sanité : si le balayage rend une liste vide, le test serait vert
    // sans rien vérifier — exactement le défaut que cette session a passé la
    // journée à réparer ailleurs.
    expect(
      routes.length,
      "aucune route non localisée trouvée — le balayage est cassé",
    ).toBeGreaterThan(5);

    const avalees = routes.filter((r) => matcher.test(r));
    expect(
      avalees,
      "routes non localisées que next-intl va préfixer, donc 301 vers /fr/… puis 404 — " +
        "les exclure dans le matcher de src/proxy.ts",
    ).toEqual([]);
  });

  it("le matcher capture bien une route localisée ordinaire", () => {
    // Sans ce contre-témoin, un matcher vide ou trop permissif rendrait le test
    // ci-dessus vert tout en désactivant l'internationalisation du site entier.
    const matcher = matcherDuProxy();
    expect(matcher.test("/fr/a-propos"), "/fr/a-propos doit passer par le proxy").toBe(true);
    expect(matcher.test("/contact"), "/contact doit passer par le proxy").toBe(true);
  });
});
