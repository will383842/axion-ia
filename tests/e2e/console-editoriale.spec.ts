/**
 * Console éditoriale — E2E du lot 0 (passe 3 du protocole).
 *
 * Le protocole exige, pour chaque écran : le parcours nominal, l'état vide,
 * l'état d'erreur, l'état de chargement, et la navigation entièrement au
 * clavier.
 *
 * ⚠️ Ce que ce fichier couvre HONNÊTEMENT, et ce qu'il ne couvre pas :
 *
 * - Les tests de garde (redirection vers `/login` sans session) tournent
 *   partout, sans base ni compte — c'est la convention des autres smokes
 *   admin du dépôt.
 * - Les tests authentifiés dépendent d'un `AdminUser` semé ET de la console
 *   amorcée. Ils se SAUTENT proprement si le login échoue, plutôt que de
 *   rougir sur une machine sans seed : un faux rouge apprend à ignorer le
 *   rouge, et le protocole en fait un principe.
 * ⚠️ **INSTABILITÉ CONNUE EN LOCAL — et ce n'est pas le produit.**
 *
 * En local, `playwright.config.ts` lance `pnpm dev`. Next compile chaque
 * route à sa première requête et, pendant qu'il reconstruit son arbre, il
 * répond **404** sur des routes pourtant valides. Résultat : à chaque
 * exécution, un test DIFFÉRENT rougit — le tableau de bord, puis le
 * calendrier, puis le kit — avec une capture montrant le 404 du site public.
 *
 * Mesuré sur six exécutions : une passe à 15/17 avait TOUS les écrans du lot 1
 * au vert. Les routes ont par ailleurs été sondées directement (302 vers
 * `/login` sans session, 200 avec), donc elles existent et répondent.
 *
 * Un préchauffage des routes (`test.beforeAll`) réduit le phénomène sans le
 * supprimer. **En CI, rien de tout cela ne s'applique** : `pnpm start` sert un
 * build déjà fait, où aucune compilation n'a lieu.
 *
 * 🔑 À retenir : un rouge de ce fichier en LOCAL doit d'abord être vérifié en
 * regardant la capture. Si elle montre « Erreur d'aiguillage », c'est le
 * serveur de dev, pas le code. Relancer suffit.
 *
 * - **L'état de chargement n'est pas asserté** : les deux écrans sont rendus
 *   d'un bloc côté serveur, sans squelette ni frontière `Suspense`. Il n'y a
 *   donc pas d'état de chargement à vérifier — et en inventer un
 *   « pour cocher la case » serait précisément la garde qui ne garde rien.
 *   À reprendre au lot 1, quand les écrans deviendront interactifs.
 */

import { test, expect as expectBase, type Page, type BrowserContext } from "@playwright/test";
import { loginAsAdmin, ADMIN_PREFIX } from "./fixtures/admin-auth";

// 🔴 Le délai d’assertion passe de 5 s à 15 s, pour TOUT le fichier.
//
// En local, Playwright lance `pnpm dev` : chaque route est compilée à la
// première requête, et le rendu d’un écran froid dépasse régulièrement les
// 5 s par défaut. Corriger assertion par assertion aurait masqué le vrai
// motif ; ce réglage le nomme. En CI, `pnpm start` sert un build déjà fait
// et rien de tout cela ne s’applique — le délai est une marge, pas un aveu.
const expect = expectBase.configure({ timeout: 15_000 });

const BASE = `/fr/${ADMIN_PREFIX}/console-editoriale`;

// 🔴 Sérialisé, et le délai élargi — sinon ce fichier rougit pour rien.
//
// En local, Playwright démarre `pnpm dev`, qui compile la route À LA PREMIÈRE
// REQUÊTE. Sur une application de cette taille, quatre workers qui se
// disputent cette première compilation dépassent tous les 30 s par défaut :
// neuf tests au rouge, aucun défaut de code. Un faux rouge apprend à ignorer
// le rouge — le protocole en fait un principe.
// 🔴 Le BUDGET, exige par `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts`.
//
// Cette suite ouvre une session admin, et la verification de mot de passe est
// deliberement couteuse (Argon2id) : quatre workers se la disputent en CI. Le
// defaut de `playwright.config.ts` est de 30 s — jamais suffisant.
//
// ⚠️ 300 s et non 90 s : cette suite porte des `page.goto` a 180 s, parce que
// la premiere visite d une route admin la fait COMPILER. Un delai interne plus
// long que le budget qui le contient ne peut jamais expirer — c est le budget
// qui rend le verdict, et son message ne nomme rien. La garde
// `delai-interne-sous-le-budget.spec.ts` verrouille exactement ca.
test.describe.configure({ mode: "serial", timeout: 300_000 });
test.beforeEach(({}, testInfo) => {
  testInfo.setTimeout(120_000);
});

/**
 * 🔴 Préchauffage des routes, une fois pour toute la série.
 *
 * En local, Playwright lance `pnpm dev`, qui compile CHAQUE route à sa
 * première requête. Sans ce préchauffage, la suite est franchement instable :
 * à chaque exécution, c'est le test qui tombe sur une route encore froide qui
 * rougit — un test différent à chaque fois, alors que le produit va bien.
 *
 * Trois exécutions l'ont montré : d'abord le tableau de bord, puis le
 * calendrier, puis le kit. Traiter cela assertion par assertion aurait
 * indéfiniment déplacé le problème.
 *
 * En CI, `playwright.config.ts` sert `pnpm start` — un build déjà fait, où
 * rien ne se compile. Ce préchauffage y coûte alors quelques secondes, et rien
 * d'autre.
 */
async function prechaufferRoutes(page: Page): Promise<void> {
  for (const url of [BASE, `${BASE}/calendrier`, `${BASE}/publications`]) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  }

  // Les routes DYNAMIQUES ne se compilent qu'avec un identifiant réel — et
  // seulement une fois connecté. Sans cette seconde passe, `/publications/[id]`
  // et son `/kit` restaient froids, et c'est exactement là que la suite
  // rougissait, à un endroit différent à chaque exécution.
  // ⚠️ `connecte()` et NON `loginAsAdmin` : le prechauffage doit partager la
  // meme session que les tests, sinon il consomme une connexion de plus dans
  // un quota deja compte par compte.
  if (!(await connecte(page))) {
    return; // Base non amorcée : les tests concernés se sauteront d'eux-mêmes.
  }
  await page.goto(`${BASE}/publications`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const premierKit = page.getByRole("link", { name: "Kit" }).first();
  if ((await premierKit.count()) === 0) return;
  const href = await premierKit.getAttribute("href");
  if (!href) return;
  await page.goto(href, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.goto(href.replace(/\/kit$/, ""), {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
}

/**
 * La session, ouverte UNE fois et rejouée ensuite.
 *
 * 🔴 Défaut mesuré en CI le 2026-08-23, et il ne cassait pas cette suite —
 * il cassait CELLES DES AUTRES.
 *
 * `connecte()` appelait `loginAsAdmin` à chaque test : 14 tests plus le
 * préchauffage, soit **15 connexions** pour ce seul fichier, là où les
 * parcours Qualiopi en font 2 ou 3. La vérification de mot de passe est
 * délibérément coûteuse (Argon2id) et le limiteur compte les tentatives par
 * compte : `auth:login:email:admin@axion-ia.com`.
 *
 * Résultat en CI : cinq specs Qualiopi — 04, 05, 06, 07 et le parcours de
 * vente — échouaient sur `loginAsAdmin`, pas sur leur logique. Le message
 * disait « Timeout 60000ms exceeded » sur la redirection ; la cause était le
 * quota que cette suite venait d'épuiser.
 *
 * ⚠️ J'ai d'abord conclu que ces cinq rouges ne m'appartenaient pas, parce
 * qu'aucune spec ÉDITORIALE ne figurait dans la liste. C'était vrai à la
 * lettre et faux sur le fond : une suite peut casser les autres sans jamais
 * rougir elle-même.
 *
 * On ouvre donc une session, on garde ses cookies, et on les rejoue dans
 * chaque contexte de test. Une connexion au lieu de quinze.
 */
let cookiesSession: Awaited<ReturnType<BrowserContext["cookies"]>> | null = null;
let sessionImpossible = false;

async function connecte(page: Page): Promise<boolean> {
  if (sessionImpossible) return false;

  if (cookiesSession) {
    await page.context().addCookies(cookiesSession);
    return true;
  }

  try {
    await loginAsAdmin(page);
    cookiesSession = await page.context().cookies();
    return true;
  } catch {
    // Base non amorcée : on le retient, pour ne pas non plus épuiser le
    // quota en réessayant quatorze fois un login qui ne peut pas aboutir.
    sessionImpossible = true;
    return false;
  }
}

test.beforeAll(async ({ browser }) => {
  // 🔴 Le budget de `describe.configure` s applique aux TESTS, pas aux
  // crochets : un `beforeAll` garde le defaut de 30 s. Or ce prechauffage
  // porte des `page.goto` a 180 s, parce que la premiere visite d une route
  // admin la fait COMPILER.
  //
  // Un delai interne plus long que le budget qui le contient ne peut jamais
  // expirer — c est le budget qui rend le verdict, et son message ne nomme
  // rien. Ici il disait « beforeAll hook timeout of 30000ms exceeded » et
  // les dix-sept tests se sautaient, sans qu on sache lequel avait echoue.
  test.setTimeout(300_000);

  const page = await browser.newPage();
  try {
    await prechaufferRoutes(page);
  } finally {
    await page.close();
  }
});

test.describe("console éditoriale — gardes (sans session)", () => {
  test("le tableau de bord renvoie vers le login", async ({ page }) => {
    const reponse = await page.goto(BASE);
    expect(reponse?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
  });

  test("le calendrier renvoie vers le login", async ({ page }) => {
    const reponse = await page.goto(`${BASE}/calendrier`);
    expect(reponse?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
  });

  test("🔴 un mois hors bornes ne casse pas la page", async ({ page }) => {
    // Une URL n'est jamais de confiance. `lireMois` / `lireAnnee` bornent ;
    // sans elles, `MOIS[mois - 1]` rendrait `undefined` et la page blanchirait.
    for (const q of ["?month=99", "?month=-4", "?year=abcd", "?month=0&year=1"]) {
      const reponse = await page.goto(`${BASE}/calendrier${q}`);
      expect(reponse?.status(), `pour ${q}`).toBeLessThan(500);
    }
  });
});

test.describe("console éditoriale — autorisé", () => {
  test("le tableau de bord affiche ses compteurs et mène au calendrier", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(BASE);
    await expect(page.getByRole("heading", { name: /console éditoriale/i })).toBeVisible();
    await expect(page.getByText("Publications au calendrier", { exact: true })).toBeVisible();
    // `exact` : le bloc « ce que ce lot ne fait pas encore » cite lui aussi
    // « les règles de conformité ». Sans cela, le locator résout DEUX éléments
    // et Playwright refuse d'agir — un rouge dû au test, pas à la page.
    await expect(page.getByText("Règles de conformité", { exact: true })).toBeVisible();
    await expect(page.getByText("Règles d'alerte", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: /ouvrir le calendrier/i }).click();
    await page.waitForURL(/console-editoriale\/calendrier/, { timeout: 60_000 });
  });

  test("le calendrier de septembre 2026 montre les 15 publications du profil", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    // Critère 4 du §7, doublé du critère 5 : le filtre « perso » isole le
    // profil personnel, où vivent les 15 publications de septembre. Sans
    // filtre, la vue en montre 19 — les 4 échos de page tombent aux mêmes
    // dates, et ce sont bien des diffusions distinctes, pas des doublons.
    await page.goto(`${BASE}/calendrier?year=2026&month=9&identite=perso`);
    await expect(page.getByRole("heading", { name: /septembre 2026/i })).toBeVisible();
    await expect(page.getByText(/15 publications/i).first()).toBeVisible();
  });

  test("🔴 le filtre « pro » n'affiche que la page — critère 5", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/calendrier?year=2026&month=9&identite=pro&jour=2026-09-01`);
    const liste = page.locator("li", { hasText: /LinkedIn/ });
    const combien = await liste.count();
    if (combien > 0) {
      // Aucune ligne ne doit venir du profil personnel.
      await expect(page.getByText("Profil personnel Williams Jullin")).toHaveCount(0);
    }
  });

  test("l'état vide EXPLIQUE quoi faire, il ne dit pas « aucun résultat »", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    // Un mois sans aucune publication : l'écran doit orienter, pas constater.
    await page.goto(`${BASE}/calendrier?year=2030&month=4`);
    await expect(page.getByText(/aucune publication en avril 2030/i)).toBeVisible();
    await expect(page.getByText(/importez le dossier|naviguez vers un autre mois/i)).toBeVisible();
  });

  test("le filtre se parcourt entièrement au clavier", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/calendrier?year=2026&month=9`);

    // On tabule jusqu'au filtre « Professionnel », puis on l'active — sans
    // souris, comme l'exige la passe 3.
    const cible = page.getByRole("link", { name: "Professionnel" });
    await expect(cible).toBeVisible();
    await cible.focus();
    await expect(cible).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/identite=pro/, { timeout: 60_000 });
  });

  // ── Lot 1 : la liste, la fiche, et LE KIT ───────────────────────────────

  test("la liste des publications répond et affiche le dossier", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/publications`);
    await expect(page.getByRole("heading", { name: /^Publications$/ })).toBeVisible();
    // Le dossier importé compte 74 publications ; la liste en montre au plus 100.
    await expect(page.locator("li").filter({ hasText: /Kit/ }).first()).toBeVisible();
  });

  test("la recherche filtre, et son état vide EXPLIQUE quoi faire", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/publications?q=zzzintrouvablezzz`);
    await expect(page.getByText(/aucun résultat pour/i)).toBeVisible();
    await expect(page.getByText(/effacez la recherche|essayez un autre mot/i)).toBeVisible();
  });

  test("🔴 le kit s'ouvre en UN clic depuis la liste — le test des deux clics", async ({
    page,
  }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    // Le §2 bis pose : « entre l'ouverture de la publication et le collage
    // dans LinkedIn, DEUX clics maximum ». Premier clic : ouvrir le kit.
    await page.goto(`${BASE}/publications`);
    await page.getByRole("link", { name: "Kit" }).first().click();
    await page.waitForURL(/\/kit$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /kit de publication/i })).toBeVisible();
  });

  test("🔴 le kit porte des boutons DISTINCTS corps / premier commentaire — critère 2", async ({
    page,
  }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/publications`);
    await page.getByRole("link", { name: "Kit" }).first().click();

    // Deux boutons séparés, pas un seul qui ferait tout : ce sont deux
    // gestes distincts dans LinkedIn.
    await expect(page.getByRole("button", { name: "Copier le corps" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copier le premier commentaire" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tout copier" })).toBeVisible();
  });

  test("le kit affiche le récapitulatif de programmation", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/publications`);
    await page.getByRole("link", { name: "Kit" }).first().click();
    for (const libelle of ["Compte", "Date", "Heure", "Plateforme"]) {
      await expect(page.getByText(libelle, { exact: true })).toBeVisible();
    }
  });

  test("la fiche montre l'état de conformité et l'historique", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/publications`);
    await page.getByRole("link", { name: "Kit" }).first().click();
    await page.getByRole("link", { name: /ouvrir la fiche/i }).click();

    await expect(page.getByRole("heading", { name: "Conformité" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  });

  test("le tableau de bord liste ce qui presse — critère 18", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(BASE);
    await expect(page.getByRole("heading", { name: "Ce qui presse" })).toBeVisible();
    // Le seuil vient de la règle d'alerte, pas d'une constante du code.
    await expect(page.getByText(/à J-\d+, asset non prêt/)).toBeVisible();
  });

  test("une publication inexistante DIT qu'elle est introuvable, sans blanchir", async ({
    page,
  }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    // 🔴 On vérifie ce que l'utilisateur VOIT, pas le code de statut.
    //
    // Next diffuse la réponse en flux : quand `notFound()` est appelé, les
    // en-têtes sont déjà parties, et le statut reste 200 alors que l'interface
    // affichée est bien celle d'une ressource introuvable. Asserter 404 ici
    // ferait rougir un comportement CORRECT — et c'est le genre de faux rouge
    // qui apprend à ignorer le rouge.
    await page.goto(`${BASE}/publications/00000000-0000-0000-0000-000000000000`);
    await expect(page.getByText(/introuvable|n'existe (pas|plus)/i).first()).toBeVisible();
    // Et surtout : la page n'est pas vide.
    const texte = await page.locator("body").innerText();
    expect(texte.trim().length).toBeGreaterThan(50);
  });

  test("le filtre actif se signale aux technologies d'assistance", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/calendrier?year=2026&month=9&identite=pro`);
    // `aria-current` : sans lui, un lecteur d'écran ne distingue pas le
    // filtre actif des deux autres — ils ont la même apparence de lien.
    await expect(page.getByRole("link", { name: "Professionnel" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
