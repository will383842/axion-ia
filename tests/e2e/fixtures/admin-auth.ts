// Playwright fixture — login admin via UI (Sprint D — Booking V1).
//
// Helper réutilisable pour authentifier un test E2E en tant qu'admin.
//
// Pré-requis :
//   - Dev server lancé (`pnpm dev`)
//   - DB seed avec AdminUser existant (ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD set)
//   - 2FA désactivé pour l'admin de test (ou test E2E adapté pour saisir TOTP)
//
// Usage :
//   import { test, expect } from "@playwright/test";
//   import { loginAsAdmin } from "../fixtures/admin-auth";
//   test("scénario admin", async ({ page }) => {
//     await loginAsAdmin(page);
//     await page.goto(`/fr/${ADMIN_PREFIX}/reservations`);
//     // ...
//   });

import { expect, type Page } from "@playwright/test";

import { ADMIN_DEV_EMAIL, ADMIN_DEV_PASSWORD } from "../../../prisma/seeds/identifiants-admin-dev";

export const ADMIN_PREFIX = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";
// 🔴 Le repli était écrit en dur, et ne correspondait à AUCUN compte semé :
// `prisma/seed.ts` crée une autre adresse. Comme `ADMIN_SEED_EMAIL` n'était
// défini nulle part dans le dépôt, ce repli était le chemin EMPRUNTÉ, toujours —
// donc `loginAsAdmin` échouait, donc les specs se `test.skip`aient, donc
// personne ne voyait rien. Le repli pointe désormais sur la source unique.
export const ADMIN_EMAIL = process.env["ADMIN_SEED_EMAIL"] ?? ADMIN_DEV_EMAIL;
export const ADMIN_PASSWORD = process.env["ADMIN_SEED_PASSWORD"] ?? ADMIN_DEV_PASSWORD;

/**
 * Vrai quand la base EST semée par le pipeline — c'est-à-dire quand un échec de
 * connexion admin est un DÉFAUT et non une dispense.
 *
 * 🔴 Les quatre specs qui appellent `loginAsAdmin` attrapaient toute erreur pour
 * se `test.skip`. Le fixture est resté cassé des mois sous ce couvercle : six
 * tests verts qui n'ouvraient aucune page. Depuis que Gate B démarre un Postgres
 * et joue le seed, le skip n'a plus de justification en CI — il n'en garde une
 * qu'en local, sur une base vide.
 */
export function baseSemeeAttendue(): boolean {
  return process.env["CI"] === "true";
}

export interface LoginOptions {
  /** Override email pour ce login précis. */
  email?: string;
  /** Override password. */
  password?: string;
  /** Skip la vérification dashboard (utile si le test attend une redirection ailleurs). */
  skipDashboardCheck?: boolean;
}

/**
 * Authentifie un admin via UI et attend que le dashboard soit chargé.
 *
 * Throws si le login échoue (mauvais credentials, 2FA actif, rate-limit, etc.).
 * Le test appelant peut catch pour skip si la DB n'est pas seedée localement.
 */
export async function loginAsAdmin(page: Page, opts: LoginOptions = {}): Promise<void> {
  const email = opts.email ?? ADMIN_EMAIL;
  const password = opts.password ?? ADMIN_PASSWORD;

  // 🔴 2026-08-22 — CONSÉQUENCE DIRECTE DU CORRECTIF DE CAUSE RACINE.
  //
  // `playwright.config.ts` borne désormais toute navigation à 30 s
  // (`navigationTimeout`) — avant, elle était ILLIMITÉE. Or c'est la SEULE
  // navigation du dépôt qui peut tomber sur une compilation à la demande :
  // sous `next dev`, l'écran de connexion admin se compile au premier appel, ce
  // qui dépasse 30 s sur un poste chargé. Sans borne propre, la connexion
  // échouerait désormais AVANT d'avoir saisi le moindre identifiant, et le
  // message d'échec accuserait la connexion au lieu de la compilation.
  //
  // 🔑 Poser une borne globale déplace le point de rupture. On nomme donc ce
  // cas ici, avec sa cause probable, plutôt que de relever la borne globale —
  // ce qui redonnerait à toutes les autres navigations un délai trop long.
  await page
    .goto(`/fr/${ADMIN_PREFIX}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 })
    .catch((cause: unknown) => {
      throw new Error(
        `l'écran de connexion admin (/fr/${ADMIN_PREFIX}/login) n'a pas répondu en 120 s — ` +
          "sous `next dev` cette route se compile à la demande au premier appel. " +
          `Aucun identifiant n'a été saisi. Cause : ${String(cause)}`,
        { cause },
      );
    });
  // 🔴 2026-08-21 — `getByLabel(/mot de passe/i)` résolvait DEUX éléments :
  // le champ, et le bouton `aria-label="Afficher le mot de passe"` ajouté
  // depuis. Playwright lève alors une strict mode violation, `loginAsAdmin`
  // échoue, et les quatre specs appelantes l'attrapaient en `test.skip`.
  //
  // 🔑 Résultat : la TOTALITÉ de la couverture E2E de la console admin —
  // accessibilité WCAG, ouverture des 50+ entrées de navigation, parcours de
  // vente, parcours de réservation — se skippait en silence, y compris après
  // que la base de CI a été semée. Six tests verts qui n'ouvraient rien.
  //
  // On cible le RÔLE, pas le texte : un bouton n'est pas une zone de saisie,
  // et aucun libellé décoratif ajouté demain ne pourra plus rendre ce
  // sélecteur ambigu.
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("textbox", { name: /mot de passe/i }).fill(password);
  // 🔴 2026-08-23 — CE CLIC A SA PROPRE BORNE, ET C'EST LA MÊME RAISON QUE
  // CELLE DÉJÀ ÉCRITE VINGT LIGNES PLUS HAUT POUR LE `goto`.
  //
  // La borne globale `actionTimeout` vaut quinze secondes
  // (playwright.config.ts:36). Or `click()` ne rend pas la main au clic : il
  // attend « les navigations programmées ». Sous `next dev`, cette soumission
  // COMPILE l'action serveur à la demande PUIS vérifie le mot de passe — une
  // vérification délibérément coûteuse. Mesuré le 2026-08-23 : quinze secondes
  // dépassées sur « waiting for scheduled navigations to finish », alors que le
  // clic lui-même avait abouti.
  //
  // 🔑 Le commentaire du `waitForURL` plus bas nommait déjà ce coût, mais seule
  // l'ATTENTE avait été rallongée, pas le GESTE. Une borne posée sur une moitié
  // du chemin déplace le point de rupture au lieu de le supprimer.
  await page
    .getByRole("button", { name: /continuer|connexion/i })
    .first()
    .click({ timeout: 120_000 });

  if (opts.skipDashboardCheck) return;

  // Le login peut rediriger vers :
  //   - / (dashboard) si pas de 2FA configuré
  //   - /2fa si 2FA requis
  //   - rester sur /login avec erreur si credentials invalides
  try {
    await page.waitForURL(
      (url) => {
        const pathname = new URL(url).pathname;
        return (
          pathname === `/fr/${ADMIN_PREFIX}` ||
          pathname === `/fr/${ADMIN_PREFIX}/` ||
          pathname.startsWith(`/fr/${ADMIN_PREFIX}/2fa`)
        );
      },
      // 🔴 15 s NE SUFFISENT PAS EN CI — mesuré, pas supposé.
      //
      // Sur le run 32498161324, 42 connexions ont échoué, toutes avec la même
      // cause (`Timeout 15000ms exceeded`) et le même texte d'écran : le bouton
      // figé sur « Connexion… ». Autrement dit l'action tournait encore.
      //
      // La raison est structurelle et souhaitable : la vérification du mot de
      // passe est DÉLIBÉRÉMENT coûteuse, et Gate B lance quatre workers qui se
      // connectent en même temps. Quatre hachages concurrents sur un runner
      // partagé dépassent 15 s sans que rien ne soit cassé.
      //
      // 🔑 Un délai d'attente n'est pas une assertion : le raccourcir ne rend
      // pas le produit meilleur, il rend le journal faux. On mesure ce que la
      // connexion coûte réellement sous charge, et on laisse de la marge.
      //
      // Sous `next dev`, la première soumission compile l'action serveur à la
      // demande et coûte davantage encore.
      { timeout: baseSemeeAttendue() ? 60_000 : 180_000 },
    );
  } catch (cause) {
    // 🔴 L'appelant attrape cette erreur pour se `test.skip`. Si elle ne dit pas
    // CE QUI a échoué, le skip devient un trou noir : c'est précisément par là
    // que la couverture admin a disparu pendant des mois. Le message porte donc
    // l'URL atteinte et le texte visible — de quoi distinguer « base non semée »
    // de « sélecteur cassé », qui n'appellent pas la même réaction.
    const visible = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    throw new Error(
      `loginAsAdmin a échoué pour ${email} — URL atteinte : ${page.url()}\n` +
        `Texte de la page : ${visible.replace(/\s+/g, " ").slice(0, 400)}`,
      { cause },
    );
  }

  // La bannière de consentement recouvre les boutons d'action de la console :
  // toute spec admin la rencontrerait. On l'écarte une fois, ici, en refusant.
  await refuserLesCookies(page);
}

/** Clé de `localStorage` où `CookieConsent` inscrit la décision. */
const CLE_CONSENTEMENT = "axion-cookie-consent-v1";

/**
 * Écarte la bannière de consentement en REFUSANT les cookies non essentiels.
 *
 * 🔴 2026-08-21 — `src/app/[locale]/layout.tsx` monte `CookieConsent` pour TOUT
 * ce qui vit sous `[locale]`, groupe `(admin)` compris. La bannière est un
 * `role="dialog"` posé en bas de page : dans la console, elle recouvre les
 * boutons d'action. Mesuré sur le wizard de vente — le clic sur « Créer le
 * client » a été intercepté indéfiniment :
 *
 *     <div class="mx-auto flex max-w-5xl …"> from <div role="dialog"
 *     aria-labelledby="cookie-consent-…"> intercepts pointer events
 *
 * On refuse (jamais « Accepter ») : c'est le choix qui préserve la vie privée,
 * et c'est aussi celui qui n'active pas de traceur pendant les tests.
 *
 * ## 🔴 2026-08-23 — CETTE FONCTION NE GARDAIT RIEN, ET LE PROUVAIT EN VERT
 *
 * Elle commençait par `if ((await refuser.count()) === 0) return;`. Or `count()`
 * est INSTANTANÉ, et `CookieConsent` décide de s'afficher dans un `useEffect`
 * (CookieConsent.tsx:81) : au retour de `waitForURL`, la bannière n'est pas
 * encore montée, le compte vaut zéro, et la fonction repartait en SILENCE. La
 * bannière apparaissait ensuite et interceptait le premier clic d'action.
 *
 * Mesuré le 2026-08-23 en jouant le parcours 02 : le clic sur « Créer la
 * session » a été retenté vingt-neuf fois puis a expiré sur l'`actionTimeout`,
 * avec pour seul message « Timeout 15000ms exceeded » — un délai qui ne dit pas
 * pourquoi. Trois parcours passaient par là.
 *
 * 🔑 Un sondage instantané sur un composant monté après hydratation ne mesure
 * pas son absence : il mesure sa propre précipitation. On distingue donc les
 * deux cas au lieu de les confondre — décision DÉJÀ prise (rien à faire), ou
 * bannière attendue puis refusée, puis disparition VÉRIFIÉE.
 */
export async function refuserLesCookies(page: Page): Promise<void> {
  // Cas légitime d'absence : la décision est déjà inscrite pour ce contexte.
  // C'est le SEUL cas où ne rien faire est correct, et il est observable —
  // contrairement à « le compte vaut zéro », qui confond « absente » et « pas
  // encore là ». Le repli sur `null` couvre le mode privé, où l'accès lève.
  const dejaDecide = await page
    .evaluate((cle) => window.localStorage.getItem(cle), CLE_CONSENTEMENT)
    .catch(() => null);
  if (dejaDecide !== null && dejaDecide !== "") return;

  const banniere = page.getByRole("dialog").filter({ hasText: /cookie|consentement|consent/i });
  const refuser = page.getByRole("button", { name: /^(refuser|decline)$/i });

  // 30 s : la bannière n'attend qu'un `useEffect`, mais sous `next dev` cette
  // page peut encore compiler son bundle client. Un dépassement ici est un vrai
  // défaut — soit la bannière ne s'affiche plus, soit la page n'hydrate pas —
  // et le message doit permettre de trancher.
  await expect(
    refuser,
    "la bannière de consentement n'est jamais apparue ALORS QUE `localStorage` ne porte " +
      `aucune décision (clé « ${CLE_CONSENTEMENT} », CookieConsent.tsx:40). Deux causes : ` +
      "la page n'a pas hydraté (le composant décide dans un `useEffect`, CookieConsent.tsx:81), " +
      "ou le bouton « Refuser » a changé de libellé (CookieConsent.tsx:286). Ne PAS traiter " +
      "ce cas en silence : la bannière recouvre les boutons d'action de la console, et le " +
      "clic suivant expirerait sur un délai qui ne dit pas pourquoi. " +
      `URL : ${page.url()}`,
  ).toBeVisible({ timeout: 30_000 });

  await refuser.first().click();

  // 🔑 On EXIGE la disparition. Cliquer sans le vérifier laisserait passer le
  // cas où le clic n'atteint aucun état — c'est-à-dire exactement la panne que
  // cette fonction existe pour éviter.
  await expect(
    banniere,
    "« Refuser » a été cliqué mais la bannière est toujours à l'écran : le clic n'a atteint " +
      "aucun état React, et elle interceptera les clics d'action suivants",
  ).toHaveCount(0, { timeout: 15_000 });
}

/**
 * Vérifie si le login est faisable en local — utile pour skip un test si
 * la DB n'est pas seedée (CI ou dev sans seed).
 *
 * Retourne true si le compte admin existe et accepte le password env var.
 */
export async function isAdminLoginConfigured(page: Page): Promise<boolean> {
  try {
    await loginAsAdmin(page);
    return true;
  } catch {
    return false;
  }
}
