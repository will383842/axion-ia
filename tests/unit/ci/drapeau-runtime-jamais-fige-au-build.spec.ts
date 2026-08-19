/**
 * Garde — UN DRAPEAU LU AU RUNTIME NE PEUT PAS ÊTRE FIGÉ AU BUILD.
 *
 * ## Le défaut que cette garde ferme
 *
 * Constat `P3-01`, mesuré **en production** le 2026-08-19, après le déploiement
 * de la PR n°739. Cette PR avait posé une garde sur `sitemap-images-services.xml`
 * pour cesser de pousser à Google Images des légendes affirmant une certification
 * Qualiopi non délivrée. Le `curl` de recette a montré que **rien n'avait
 * changé** : 3 occurrences de `certification-qualiopi`, 4 légendes « certifié
 * Qualiopi », 19 lignes « Qualiopi ».
 *
 * La garde n'était pas absente. Elle était **inerte**.
 *
 * `QUALIOPI_CERTIFICATION_OBTENUE` n'est pas seulement une variable
 * d'environnement Coolify : c'est **aussi une variable de dépôt GitHub Actions**
 * (`gh variable list`, posée le 2026-08-10), injectée en build-arg par
 * `deploy-coolify.yml`. La route étant `force-static`, sa valeur a été figée AU
 * BUILD, avec le drapeau à `true`. Le filtre ne pouvait donc jamais s'appliquer.
 *
 * ## La leçon, et pourquoi cette garde est GÉNÉRIQUE
 *
 * 🔑 **Un drapeau lu par `process.env` n'a pas UNE valeur : il en a DEUX** —
 * celle du build et celle du runtime. Rien dans le code ne dit laquelle
 * s'applique : c'est le MODE DE RENDU de la route qui tranche
 * (`force-static` / `revalidate` / dynamique), et il est déclaré **ailleurs que
 * la garde**, souvent trente lignes plus haut.
 *
 * Le commentaire de la route affirmait d'ailleurs le contraire : « Défaut
 * sécurisé côté build GH Actions : le drapeau est absent, donc `false`, donc le
 * bloc n'est pas émis. » Il était faux — et un commentaire qui ment sur
 * l'environnement est pire qu'une absence de commentaire : il fait passer le
 * défaut pour une protection. C'est ce qui a fait valider ce correctif sans le
 * vérifier.
 *
 * Cette garde ne vise donc pas un fichier : elle interdit la COMBINAISON
 * « je lis un drapeau d'exécution » + « je suis figé au build », quel que soit le
 * drapeau et quelle que soit la route.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const RACINE = process.cwd();
const APP = path.join(RACINE, "src", "app");

/** Fichiers de route ou de sitemap, récursivement. */
function fichiersDeRoute(dossier: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = path.join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      out.push(...fichiersDeRoute(complet));
    } else if (entree === "route.ts" || entree === "sitemap.ts" || entree === "robots.ts") {
      out.push(complet);
    }
  }
  return out;
}

/**
 * Drapeaux d'EXÉCUTION : ils changent d'état sans redéploiement (variable
 * Coolify + restart). Les figer au build revient à ignorer le geste.
 *
 * ⚠️ On cible les helpers, pas `process.env` en général : beaucoup de routes
 * lisent des constantes de build légitimes (`NEXT_PUBLIC_SITE_URL`, clés d'API)
 * qu'il serait absurde de rendre dynamiques.
 */
const DRAPEAUX_RUNTIME = [
  "isQualiopiCertificationObtenue",
  "isQualiopiPublicDisclosureEnabled",
  "isFacturationHubEnabled",
  "EN_LOCALE_ENABLED",
];

describe("🔴 aucun drapeau d'exécution n'est figé au build", () => {
  const routes = fichiersDeRoute(APP).map((chemin) => ({
    chemin: path.relative(RACINE, chemin).replace(/\\/g, "/"),
    contenu: readFileSync(chemin, "utf8"),
  }));

  it("le recensement des routes n'est pas vide (sinon ce fichier ne garde rien)", () => {
    // Témoin de non-vacuité : si le parcours de `src/app` cassait, tous les tests
    // ci-dessous passeraient en ne vérifiant plus rien.
    expect(routes.length).toBeGreaterThan(10);
  });

  it("au moins une route lit réellement un drapeau d'exécution", () => {
    // Second témoin : si les helpers étaient renommés, `DRAPEAUX_RUNTIME`
    // deviendrait obsolète et la garde s'éteindrait en silence.
    const lectrices = routes.filter(({ contenu }) =>
      DRAPEAUX_RUNTIME.some((d) => contenu.includes(d)),
    );
    expect(lectrices.length).toBeGreaterThan(0);
  });

  it("aucune route ne combine `force-static` et lecture d'un drapeau d'exécution", () => {
    const figees = routes
      .filter(({ contenu }) => {
        // On dépouille les commentaires : une route qui MENTIONNE un drapeau
        // pour expliquer pourquoi elle ne le lit pas ne doit pas rougir.
        const code = contenu.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
        const litUnDrapeau = DRAPEAUX_RUNTIME.some((d) => code.includes(d));
        const figeeAuBuild = /dynamic\s*=\s*["']force-static["']/.test(code);
        return litUnDrapeau && figeeAuBuild;
      })
      .map(({ chemin }) => chemin);

    expect(
      figees,
      `Ces routes lisent un drapeau d'EXÉCUTION tout en étant figées au BUILD. ` +
        `La valeur retenue sera celle du build (variable GitHub Actions), pas celle ` +
        `du conteneur : basculer le drapeau côté Coolify n'aura AUCUN effet, et la ` +
        `garde qui en dépend sera inerte sans que rien ne le signale. ` +
        `Voir l'en-tête de ce fichier (constat P3-01, mesuré en production).`,
    ).toStrictEqual([]);
  });
});
