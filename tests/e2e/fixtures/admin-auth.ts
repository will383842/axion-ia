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
import {
  ecrireSessionPartagee,
  lireSessionPartagee,
  oublierSessionPartagee,
  rejouer,
} from "./session-admin-partagee";

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
  /**
   * Force une connexion PAR LE FORMULAIRE, sans rejouer ni alimenter le cache.
   *
   * Réservé aux specs qui éprouvent l'écran de connexion lui-même : pour elles,
   * la connexion EST l'objet du test, et la rejouer depuis un cache la viderait
   * de son sens.
   */
  sansCachePartage?: boolean;
}

/**
 * Rejoue la session partagée si elle existe, et VÉRIFIE qu'elle vaut encore.
 *
 * Rend `true` seulement quand on a constaté l'arrivée sur le tableau de bord.
 * Tout le reste — pas de cache, cookies périmés, base re-semée entre-temps —
 * rend `false`, jette le cache, et laisse l'appelant se connecter pour de bon.
 * Le pire cas est donc le comportement d'avant ce cache, jamais un test vert
 * qui n'aurait pas de session.
 */
async function rejouerLaSessionPartagee(page: Page, email: string): Promise<boolean> {
  const cookies = lireSessionPartagee(email, ADMIN_PREFIX);
  if (!cookies) return false;

  try {
    await rejouer(page, cookies);
    await page.goto(`/fr/${ADMIN_PREFIX}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    // 🔑 LA VÉRIFICATION EST UNE ABSENCE DE REDIRECTION, PAS UN SÉLECTEUR.
    // Le tableau de bord change ; la garde d'authentification, elle, renvoie
    // toujours vers `/login`. C'est le seul signal stable.
    if (new URL(page.url()).pathname.includes("/login")) {
      oublierSessionPartagee(email, ADMIN_PREFIX);
      return false;
    }
    await refuserLesCookies(page);
    return true;
  } catch {
    oublierSessionPartagee(email, ADMIN_PREFIX);
    return false;
  }
}

/**
 * Authentifie un admin — depuis la session partagée si elle existe, par le
 * formulaire sinon.
 *
 * 🔴 LE NOMBRE DE CONNEXIONS RÉELLES NE DÉPEND PLUS DU NOMBRE D'APPELS.
 * Voir `session-admin-partagee.ts` pour l'arithmétique du limiteur de débit :
 * 28 appels valaient 56 hits contre un plafond de 50, et Gate B tombait sur
 * « Trop de tentatives » — un message qui accuse la connexion alors que rien
 * n'est cassé dans le produit.
 *
 * Throws si le login échoue (mauvais credentials, 2FA actif, rate-limit, etc.).
 * Le test appelant peut catch pour skip si la DB n'est pas seedée localement.
 */
export async function loginAsAdmin(page: Page, opts: LoginOptions = {}): Promise<void> {
  const email = opts.email ?? ADMIN_EMAIL;
  const password = opts.password ?? ADMIN_PASSWORD;

  // Le cache ne sert QUE le compte par défaut. Une spec qui se connecte sous
  // une autre adresse doit obtenir CETTE session-là, pas celle de l'admin de
  // recette : rejouer les cookies du voisin serait un test faussement vert.
  const cacheUtilisable =
    !opts.sansCachePartage && !opts.skipDashboardCheck && email === ADMIN_EMAIL;

  // 🔴 AUCUNE ATTENTE ENTRE WORKERS, ET C'EST UNE LECON DE LA CI.
  //
  // Une premiere version prenait un verrou : un seul worker se connectait, les
  // autres attendaient qu'il publie, jusqu'a 90 s. `a11y-admin.spec.ts` se
  // connecte dans un `beforeAll`, dont le budget Playwright est de **30 s** :
  // le crochet expirait avant la publication, et les trois tests du fichier
  // tombaient — remplaçant une panne par une autre.
  //
  // 🔑 L'attente n'etait pas mal reglee, elle etait fausse par nature. Ce
  // fichier documente lui-meme qu'une connexion coute 60 a 180 s en CI sous
  // quatre workers : un attendeur ne peut JAMAIS tenir dans un budget de
  // crochet qu'il ne controle pas.
  //
  // Ce que le verrou achetait : 4 connexions au lieu d'1. Contre un plafond de
  // 50 hits, la difference est 8 contre 2 — sans objet. Les tests d'un worker
  // sont serialises, donc chaque worker se connecte AU PLUS une fois, puis lit
  // le cache. On garde le cache, on jette le verrou.
  if (cacheUtilisable && (await rejouerLaSessionPartagee(page, email))) return;

  await connexionParLeFormulaire(page, opts, email, password);
  // 🔑 ON NE PUBLIE QU'APRÈS AVOIR CONSTATÉ LE TABLEAU DE BORD — c'est-à-dire
  // seulement quand `connexionParLeFormulaire` est revenue sans lever, et que
  // `cacheUtilisable` exclut déjà `skipDashboardCheck`. Publier plus tôt
  // exposerait aux autres workers des cookies dont on ne sait pas encore s'ils
  // ouvrent quoi que ce soit ; un cache faux coûte plus cher que pas de cache,
  // puisqu'il rend vertes des specs qui n'ont aucune session.
  if (cacheUtilisable) {
    ecrireSessionPartagee(email, ADMIN_PREFIX, await page.context().cookies());
  }
}

/**
 * La connexion PAR L'ÉCRAN — le chemin d'origine, inchangé.
 *
 * Séparée de `loginAsAdmin` pour que la décision « rejouer ou se connecter »
 * tienne en trois lignes lisibles au-dessus, plutôt que d'être noyée en tête
 * des cent lignes de bornes et de sélecteurs que ce chemin a accumulées.
 */
async function connexionParLeFormulaire(
  page: Page,
  opts: LoginOptions,
  email: string,
  password: string,
): Promise<void> {
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
      {
        waitUntil: "domcontentloaded", // défaut = `"load"` ; cf. la note de `creerSession` dans `_communs.ts`.
        timeout: baseSemeeAttendue() ? 60_000 : 180_000,
      },
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
 * pas son absence : il mesure sa propre précipitation. On distingue donc TROIS
 * cas là où il n'y en avait qu'un : décision DÉJÀ prise (rien à faire) ;
 * bannière attendue, refusée, disparition VÉRIFIÉE ; ou bannière jamais parue,
 * auquel cas on exige qu'AUCUN dialogue ne soit resté à l'écran.
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

  // 🔴 ON ATTEND LA BANNIÈRE, MAIS ON N'EXIGE PAS QU'ELLE VIENNE.
  //
  // `CookieConsent` ne se rend QUE si la page est hydratée
  // (`if (!isHydrated || consent !== "unknown") return null;`, CookieConsent.tsx:250) :
  // sous `next dev`, elle peut donc n'apparaître qu'après plusieurs secondes — ou
  // pas du tout si l'hydratation traîne. Mesuré le 2026-08-23 : elle est apparue
  // aux deux premiers tests d'un même fichier et pas au troisième.
  //
  // Une première version EXIGEAIT sa présence. C'était trop fort, et pour une
  // mauvaise raison : ce qu'on a besoin de garantir n'est pas « la bannière
  // s'affiche » — ce n'est pas l'objet de ces parcours — mais « AUCUN dialogue
  // ne recouvre les boutons d'action ». Un parcours métier ne doit pas rougir
  // pour un composant qu'il ne teste pas.
  //
  // 🔑 Ce qui reste garanti, et qui ne peut pas passer en silence : si la
  // bannière n'a pas paru, on EXIGE qu'aucun dialogue ne soit là. Un dialogue
  // présent SANS bouton « Refuser » reconnaissable — libellé changé, rôle changé —
  // est exactement le cas qui intercepterait les clics suivants, et il rougit ici,
  // avec sa cause, plutôt que trente secondes plus tard sur un délai muet.
  const apparue = await refuser
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);

  if (!apparue) {
    await expect(
      banniere,
      "aucun bouton « Refuser » n'est apparu en 20 s, ET un dialogue de consentement est " +
        "pourtant à l'écran : il recouvrira les boutons d'action de la console et le clic " +
        "suivant expirera sur un délai qui ne dira pas pourquoi. Causes possibles : le " +
        "libellé du bouton a changé (CookieConsent.tsx:286), ou son rôle. " +
        `URL : ${page.url()}`,
    ).toHaveCount(0, { timeout: 5_000 });
    // 🔴 2026-09-03 — LA BANNIÈRE NE PARAÎT PLUS SUR LA CONSOLE, ET LE REFUS
    // DISPARAISSAIT AVEC ELLE.
    //
    // Depuis l'audit certificateur, la console masque le bandeau de
    // consentement : elle ne charge aucun script tiers, il n'y a donc rien à
    // consentir (`lib/analytics/surface-console.ts`). Ce chemin-ci devient donc
    // le cas NORMAL en admin — et il repartait sans rien inscrire.
    //
    // Or c'est le CONTEXTE de navigateur qui porte la décision. Tant que la
    // console affichait le bandeau, le clic « Refuser » posé ici valait aussi
    // pour les pages PUBLIQUES ouvertes ensuite dans la même session. Il ne vaut
    // plus rien : le parcours 6 ouvre le portail stagiaire à 360 px, y retrouve
    // un bandeau jamais refusé, ancré en bas — exactement là où le portail ancre
    // sa barre d'onglets — et le clic de navigation était intercepté soixante
    // secondes durant. Trois tentatives, trois échecs, sur un test qui ne parle
    // pas de cookies.
    //
    // 🔑 Masquer un bandeau ne pose AUCUNE décision. On inscrit donc le refus
    // explicitement, avec les mêmes clés et le même format que
    // `writeAnalyticsConsent` (CookieConsent.tsx) — refus, jamais acceptation :
    // aucun traceur ne doit s'armer pendant les tests.
    await page
      .evaluate((cle) => {
        try {
          window.localStorage.setItem(cle, "declined");
          window.localStorage.setItem(`${cle}:ts`, String(Date.now()));
        } catch {
          /* mode privé : le cookie ci-dessous suffit */
        }
        document.cookie = `${cle}=${encodeURIComponent(`declined|${Date.now()}`)}; path=/; max-age=33696000; SameSite=Lax`;
      }, CLE_CONSENTEMENT)
      .catch(() => undefined);
    return;
  }

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
