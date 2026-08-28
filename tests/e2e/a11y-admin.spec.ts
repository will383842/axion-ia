// E2E a11y — LA CONSOLE ADMIN. Lot 5, « garde-fous durables ».
//
// 🔴 Le défaut : `a11y.spec.ts` couvre quinze pages, toutes PUBLIQUES. La
// console — celle où Will passe ses journées, et la seule surface dont dépend
// la certification — n'était mesurée nulle part. Zéro page admin sous axe-core.
//
// ⚠️ POURQUOI UN FICHIER ET UN TAG SÉPARÉS, et pas trois lignes ajoutées à la
// liste existante.
//
// Le job nightly `a11y-prod` lance `--grep @a11y` **contre la production**
// (`E2E_BASE_URL` pointe le site live). Ajouter des chemins admin à ce tag
// ferait tenter, chaque nuit, une CONNEXION EN PRODUCTION avec des
// identifiants de seed. Elle échouerait — et un gate qui rougit toutes les
// nuits pour une raison qui n'est pas la sienne finit ignoré. C'est
// littéralement l'avertissement écrit en tête de `a11y.spec.ts` : « un rouge
// qu'on n'arrive pas à qualifier finit ignoré. C'est comme ça qu'un gate
// meurt. »
//
// D'où : tag `@a11y-admin`, et un refus explicite de tourner contre une cible
// distante.

import AxeBuilder from "@axe-core/playwright";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { loginAsAdmin, ADMIN_PREFIX } from "./fixtures/admin-auth";

/**
 * Les trois surfaces que le plan désigne (Lot 5), plus celle qui porte le
 * parcours guidé.
 */
/**
 * 🔴 LOT 1 D'ÉLARGISSEMENT (2026-08-28) — de 4 écrans à 18.
 *
 * ## Le défaut que cet élargissement ferme
 *
 * Cette suite couvrait **4 pages sur 305**. Les 40 violations corrigées par #864
 * vivaient sur `/qualiopi/mode-auditeur` pendant que la suite visitait
 * `/qualiopi/mode-auditeur/signatures` — **un répertoire d'écart**.
 *
 * Et `contrast:check` ne pouvait pas les voir : il compare 42 paires de jetons
 * DÉCLARÉS, sur la palette publique, alors que la console se style avec
 * `--color-admin-*` à 4 131 endroits. Cinq violations de contraste et 48 cibles
 * tactiles trop petites vivaient dans cet écart (corrigées par #872).
 *
 * ## 🔑 Pourquoi ces 14-là et pas les 301 autres
 *
 * **On n'ajoute à une gate bloquante que du vert VÉRIFIÉ.** Les 14 ont été
 * mesurés à **0 violation serious/critical** juste avant d'être inscrits ici —
 * pas hier, pas « en principe ». Ajouter des écrans non mesurés ouvrirait un
 * rouge que personne ne peut fermer dans sa propre PR : c'est la doctrine du
 * dépôt, « seuil aligné d'abord, blocage ensuite ».
 *
 * ⚠️ Trois d'entre eux — `financements`, `alertes`, `cockpit-financier` —
 * portaient encore des violations la veille. Leur passage à 0 est le **témoin
 * positif** de ce lot : la mesure sait voir, elle ne rend pas 0 faute de sujet.
 *
 * ## Ce qui reste dehors
 *
 * ~287 pages. Le prochain lot devra les MESURER avant de les inscrire, et
 * corriger ce qu'il trouve **avant** de les rendre bloquantes. Ne jamais
 * inscrire un écran sur la foi d'un relevé ancien : le code bouge.
 */
const PAGES_ADMIN = [
  // Les 4 d'origine.
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/sessions`, label: "liste des sessions" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/a-traiter`, label: "à traiter" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/dossiers`, label: "dossiers" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/mode-auditeur/signatures`, label: "registre auditeur" },
  // Lot 1 — l'écran du certificateur en tête, c'est celui qu'il ouvre en premier.
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/mode-auditeur`, label: "mode auditeur" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/indicateurs`, label: "indicateurs" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/audits`, label: "audits" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/appreciations`, label: "appréciations" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/reclamations`, label: "réclamations" },
  // Le parcours réservation.
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/devis`, label: "devis" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/clients`, label: "clients" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/formations`, label: "formations" },
  { path: `/fr/${ADMIN_PREFIX}/contacts`, label: "contacts" },
  // Les finances — dont les trois corrigés par #872.
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/facturation`, label: "facturation" },
  {
    path: `/fr/${ADMIN_PREFIX}/qualiopi/financements`,
    label: "financements (48 cibles corrigées)",
  },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/alertes`, label: "alertes (4 contrastes corrigés)" },
  {
    path: `/fr/${ADMIN_PREFIX}/qualiopi/cockpit-financier`,
    label: "cockpit financier (1 contraste corrigé)",
  },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/baremes-opco`, label: "barèmes OPCO" },
] as const;

/**
 * Les identifiants de seed sont-ils fournis ?
 *
 * 🔴 En CI ils ne le sont pas : la suite Playwright y tourne SANS base seedée,
 * dans une étape `continue-on-error`. Trois issues possibles, une seule
 * honnête :
 *
 *   · échouer  → du bruit rouge permanent dans une étape non bloquante, qu'on
 *     apprend à ignorer — et le jour où le test a raison, personne ne regarde ;
 *   · passer   → PIRE : le rapport déclarerait la console vérifiée alors
 *     qu'aucune page n'a été ouverte ;
 *   · SAUTER explicitement → le rapport dit « skipped », ce qui est la vérité.
 */
function identifiantsFournis(): boolean {
  return (
    (process.env["ADMIN_SEED_EMAIL"] ?? "") !== "" &&
    (process.env["ADMIN_SEED_PASSWORD"] ?? "") !== ""
  );
}

/**
 * La cible est-elle locale ?
 *
 * 🔴 Garde de sécurité, pas de confort. Ce fichier SE CONNECTE : le laisser
 * pointer une base distante ferait taper des identifiants sur un environnement
 * qui n'est pas le nôtre.
 */
function urlDeBase(): string {
  return process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
}

function cibleLocale(): boolean {
  const base = urlDeBase();
  return base.includes("localhost") || base.includes("127.0.0.1");
}

test.describe("a11y console admin WCAG 2.2 AA @a11y-admin", () => {
  // 🔴 2026-08-22 — UN DÉLAI PLUS LONG QUE SON BUDGET NE PEUT JAMAIS EXPIRER.
  //
  // Famille de défauts symétrique de celle corrigée la veille. Un `timeout:`
  // soigneusement choisi, avec un message qui nomme la cause, est INATTEIGNABLE
  // si le budget du test qui l'englobe est plus court : c'est le budget qui
  // rend le verdict, et son message ne nomme rien.
  //
  // 🔑 Règle : le budget d'une suite doit être STRICTEMENT supérieur au plus
  // grand délai qui vit dedans — helpers importés compris. Verrouillé par
  // `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`.
  //
  // Ici : 90 s était INFÉRIEUR au délai de connexion hors CI — `loginAsAdmin`
  // attend `baseSemeeAttendue() ? 60_000 : 180_000`. En local, le budget tuait
  // le test AVANT que le diagnostic (URL atteinte + texte de l'écran) puisse
  // être rendu. C'est précisément là où l'on débogue que la cause disparaissait.
  test.describe.configure({ timeout: 300_000 });

  // 🔴 2026-08-28 — UNE CONNEXION PAR ÉCRAN A FAIT TOMBER HUIT TESTS VOISINS.
  //
  // Cette suite se connectait une fois PAR test. À 4 écrans, personne ne l'a
  // remarqué. En passant à 18, elle a épuisé le limiteur anti-force-brute de
  // l'écran de connexion — « Trop de tentatives. Réessayez dans 15 minutes. » —
  // et les HUIT parcours Qualiopi qui tournaient après elle sont morts sur un
  // écran verrouillé. Gate B rouge, `main` verte sur le même code : les échecs
  // étaient entièrement notre conséquence.
  //
  // 🔑 Le défaut n'était pas dans le limiteur, qui a fait exactement son
  // travail. Il était dans une suite qui consommait une ressource PARTAGÉE
  // proportionnellement à sa taille, sans que rien ne le dise. Élargir une
  // couverture, c'est augmenter une consommation.
  //
  // On se connecte donc UNE fois par worker et on réutilise la session : 4
  // connexions au lieu de 18, et le coût cesse de croître avec la liste.
  //
  // ⚠️ `browser.newContext()` n'hérite PAS du `baseURL` de la configuration —
  // seule la fixture `page` le reçoit. Sans le passer ici, tous les
  // `goto("/fr/…")` relatifs échoueraient. On le dérive de la même source que
  // `cibleLocale()` ci-dessus, pour qu'un changement d'URL ne puisse pas rendre
  // les deux incohérents.
  let contextePartage: BrowserContext | undefined;
  let pagePartagee: Page;

  test.beforeAll(async ({ browser }) => {
    contextePartage = await browser.newContext({ baseURL: urlDeBase() });
    pagePartagee = await contextePartage.newPage();
    await loginAsAdmin(pagePartagee);
  });

  test.afterAll(async () => {
    await contextePartage?.close();
  });

  test.skip(
    !cibleLocale() || !identifiantsFournis(),
    "Cible locale ET identifiants de seed requis : le nightly mesure la prod en " +
      "lecture seule, sans authentification.",
  );

  for (const { path, label } of PAGES_ADMIN) {
    test(`${label} — 0 violation serious/critical @a11y-admin`, async () => {
      // La session vient du `beforeAll` : une connexion par worker, pas une par
      // écran. Si elle avait échoué (base non semée), `beforeAll` aurait déjà
      // fait rougir la suite en nommant la cause.
      const page = pagePartagee;

      const response = await page.goto(path);
      const status = response?.status() ?? 0;
      expect(status, `Aucune réponse exploitable sur ${path}`).toBeGreaterThanOrEqual(200);
      expect(status, `Statut inattendu sur ${path}`).toBeLessThan(400);

      // 🔴 CANARI — obligatoire, et DIFFÉRENT de celui des pages publiques.
      //
      // `a11y.spec.ts` vérifie `header[data-tone]`, qui n'existe que sur le
      // header PUBLIC : le réutiliser ici échouerait sur toutes les pages
      // admin. Sans canari du tout, une redirection vers `/login` renverrait
      // 200, axe analyserait un formulaire de connexion — presque sans
      // violation — et le job déclarerait la console conforme. Un gate doit
      // d'abord prouver QU'IL EST SUR LA BONNE PAGE.
      //
      // 🔴 2026-08-21 — CE CANARI N'AVAIT JAMAIS PU PASSER.
      //
      // Il visait `nav[aria-label="Navigation admin"]`. Ce libellé existe bien —
      // mais il est porté par un `<aside>` (`AdminSidebarNav.tsx`), et le `<nav>`
      // qu'il contient porte « Sections admin ». Le sélecteur croisait donc une
      // balise et un libellé qui ne se rencontrent jamais : les QUATRE tests de
      // ce fichier échouaient sur « element(s) not found », sans qu'aucune page
      // admin n'ait jamais été analysée par axe.
      //
      // 🔑 Un canari écrit de mémoire est un canari mort. Celui-ci a été posé
      // pour empêcher un faux vert et il produisait un rouge permanent — le
      // même résultat pratique : personne n'apprend rien de ce fichier. On vise
      // désormais le RÔLE et le NOM ACCESSIBLES, qui sont ce que le canari veut
      // vraiment prouver (« la navigation de la console est là »), et qui
      // survivent à un changement de balise.
      await expect(
        page.getByRole("navigation", { name: "Sections admin" }),
        `navigation de la console absente sur ${path} — page probablement non rendue`,
      ).toBeVisible();
      // …et qu'on n'a pas été renvoyé au login malgré tout.
      expect(new URL(page.url()).pathname, `Redirigé hors de ${path}`).not.toContain("/login");

      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {
        console.warn(`[a11y-admin] ${path} — networkidle non atteint en 15 s`);
      });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();

      const bloquantes = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );

      if (bloquantes.length > 0) {
        console.error(
          `[a11y-admin] ${path} — ${bloquantes.length} violations bloquantes :`,
          bloquantes.map((v) => ({ id: v.id, impact: v.impact, help: v.help })),
        );
      }
      expect(bloquantes, `0 violation serious/critical attendue sur ${path}`).toEqual([]);

      const mineures = results.violations.filter(
        (v) => v.impact === "moderate" || v.impact === "minor",
      );
      if (mineures.length > 0) {
        console.warn(
          `[a11y-admin] ${path} — ${mineures.length} mineures/modérées (revue) :`,
          mineures.map((v) => ({ id: v.id, impact: v.impact })),
        );
      }
    });
  }
});
