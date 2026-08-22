// E2E — LA NAVIGATION ADMIN, OUVERTE POUR DE VRAI. Lot 5, « garde-fous durables ».
//
// 🔴 Le défaut : `admin-routes.spec.ts` fait `page.goto()` puis vérifie un
// statut HTTP. C'est exactement le « fetch 200 » que le plan refuse, et il
// laisse passer trois familles de pannes :
//
//   1. la page répond 200 puis **explose au rendu** (un Server Component qui
//      throw après le premier flush : le statut est déjà parti) ;
//   2. l'entrée de menu pointe une route qui existe mais renvoie au login ;
//   3. la page rend, mais **sans `<h1>`** : on ne sait pas où on est arrivé.
//
// Le pendant STATIQUE existe déjà (`scripts/check-admin-nav-routes.ts`) et
// vérifie qu'un `page.tsx` correspond à chaque `href`. Il attrape le 404 de
// renommage. Il ne peut rien dire du 500 au rendu.
//
// ⚠️ UN SEUL TEST, PAS UN PAR ENTRÉE.
//
// Un test par entrée produisait 154 cas — et 154 connexions successives, soit
// une dizaine de minutes et un déclenchement quasi certain de la limitation de
// débit sur le login. Ici : **une session, un parcours**, et surtout on
// **collecte toutes les pannes** au lieu de s'arrêter à la première. « Ces
// trois routes sont cassées » vaut mieux que « la première l'est ».
//
// ⚠️ Ce test SE CONNECTE : cible locale et identifiants de seed exigés.

import { test, expect } from "@playwright/test";
import { loginAsAdmin, ADMIN_PREFIX } from "../fixtures/admin-auth";
import { buildAdminNav } from "../../../src/lib/admin-nav";

/**
 * Les identifiants de seed sont-ils fournis ?
 *
 * 🔴 En CI ils ne le sont pas : la suite Playwright y tourne sans base seedée,
 * dans une étape `continue-on-error`. Trois issues, une seule honnête :
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
 * 🔴 Garde de sécurité, pas de confort : ce fichier SE CONNECTE. Le laisser
 * pointer une base distante ferait taper des identifiants sur un environnement
 * qui n'est pas le nôtre.
 */
function cibleLocale(): boolean {
  const base = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
  return base.includes("localhost") || base.includes("127.0.0.1");
}

/**
 * Les entrées de navigation, telles que le SSOT les déclare.
 *
 * 🔴 On les LIT depuis `buildAdminNav()` plutôt que d'en recopier une liste :
 * une liste figée se désynchronise, et le jour où quelqu'un ajoute un écran, le
 * test le déclarerait couvert sans jamais l'avoir ouvert.
 */
const ENTREES = buildAdminNav(ADMIN_PREFIX).filter(
  // Les routes dynamiques ne s'ouvrent pas sans identifiant réel : les inclure
  // fabriquerait un rouge permanent sur un défaut qui n'existe pas.
  (e) => !e.href.includes("["),
);

test.describe("navigation admin — chaque entrée s'OUVRE @admin-nav", () => {
  test.describe.configure({ timeout: 600_000 });

  test.skip(
    !cibleLocale() || !identifiantsFournis(),
    "Cible locale ET identifiants de seed requis.",
  );

  test("le SSOT n'est pas vide — sinon le parcours ci-dessous ne prouve rien", () => {
    // 🔴 Sans cette assertion, un `buildAdminNav()` qui renverrait `[]` ferait
    // passer le test au vert en n'ayant ouvert AUCUNE page. Le dépôt a déjà payé
    // ce piège : une garde qui ne garde rien parce qu'elle balaie une liste vide.
    expect(ENTREES.length).toBeGreaterThan(50);
  });

  test("chaque entrée rend un titre visible", async ({ page }, info) => {
    // Un seul navigateur suffit : on cherche des pannes de RENDU serveur, pas
    // des écarts de moteur. Les faire tourner sur cinq projets multiplierait le
    // coût par cinq sans rien apprendre de plus.
    test.skip(info.project.name !== "chromium", "Parcours de couverture : chromium suffit.");

    await loginAsAdmin(page);

    const pannes: string[] = [];

    for (const entree of ENTREES) {
      try {
        const reponse = await page.goto(entree.href, { waitUntil: "domcontentloaded" });
        const statut = reponse?.status() ?? 0;
        if (statut >= 400) {
          pannes.push(`${entree.href} — statut ${statut}`);
          continue;
        }

        // Renvoyé au login : la route existe mais reste inatteignable.
        if (new URL(page.url()).pathname.includes("/login")) {
          pannes.push(`${entree.href} — redirigé vers /login`);
          continue;
        }

        // 🔴 LE POINT DU TEST : un `<h1>` VISIBLE et non vide.
        //
        // Un Server Component qui throw après le premier flush laisse un statut
        // 200 déjà parti et une page tronquée. Le titre prouve que le rendu est
        // allé au bout — et, accessoirement, qu'un utilisateur sait où il est.
        const titre = page.locator("h1").first();
        await titre.waitFor({ state: "visible", timeout: 15_000 });
        const texte = (await titre.textContent())?.trim() ?? "";
        if (texte === "") pannes.push(`${entree.href} — <h1> vide`);
      } catch (e) {
        // 🔴 2026-08-22 — UN DÉLAI DÉPASSÉ NE DIT PAS POURQUOI.
        //
        // Quatre entrées sous `/qualiopi/facturation` rendaient
        // « locator.waitFor: Timeout 15000ms exceeded », trois relevés de suite.
        // Ce n'était pas une panne de rendu : le hub est derrière
        // `FACTURATION_HUB_ENABLED` et les pages appellent `notFound()`.
        //
        // 🔑 Le statut restait 200 parce que le dossier porte un `loading.tsx` :
        // la diffusion avait commencé, l'en-tête était parti, et `notFound()` n'a
        // fait que remplacer la suite du flux. Le contrôle `statut >= 400`
        // ci-dessus ne pouvait donc rien voir — c'est exactement le scénario que
        // le commentaire du `<h1>` anticipait, sans que rien ne le NOMME.
        //
        // On LIT la page avant de conclure. Une entrée qui mène à une page
        // introuvable reste une panne — mais une panne QUALIFIÉE, rattachable à
        // un drapeau au lieu d'envoyer chercher dans le rendu.
        const corps = (
          await page
            .locator("body")
            .innerText()
            .catch(() => "")
        )
          .replace(/\s+/g, " ")
          .slice(0, 160);
        const introuvable = /introuvable|not found|404/i.test(corps);
        const cause = introuvable
          ? "page introuvable rendue APRÈS le premier flush (statut 200 déjà parti) — " +
            `module derrière un drapeau ? corps : « ${corps} »`
          : (e as Error).message.split("\n")[0];
        pannes.push(`${entree.href} — ${cause}`);
      }
    }

    // ⚠️ On rapporte TOUT d'un coup. S'arrêter à la première panne obligerait à
    // relancer un parcours de plusieurs minutes pour découvrir la suivante.
    expect(pannes, `${pannes.length} entrée(s) de navigation en panne`).toEqual([]);
  });
});
