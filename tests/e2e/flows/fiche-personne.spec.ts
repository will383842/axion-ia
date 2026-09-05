// La fiche personne — recette par l'INTERFACE.
//
// Pourquoi ce fichier existe alors que `rapprocher-sans-fusionner.spec.ts` a
// déjà 9 tests unitaires : ces 9 tests montent des fixtures et prouvent que la
// FONCTION classe juste. Ils ne prouvent pas que l'écran s'ouvre, que la garde
// de rôle laisse passer, que l'empreinte de l'URL retrouve bien un humain, ni
// que ce qui s'affiche correspond à ce que la base contient.
//
// 🔴 ET SURTOUT : les fixtures unitaires arrivent DÉJÀ ÉTIQUETÉES. C'est
// exactement ce qui a laissé passer le défaut que ce fichier surveille — un
// message « recrutement » envoyé depuis le formulaire de contact public
// s'affichait comme « Apporteur d'affaires », avec un lien vers la file
// commerciale. Aucune fixture ne décrivait ce cas, parce qu'aucune fixture
// n'était construite depuis le producteur réel.
//
// Pré-requis : serveur de dev sur la base `axion_masse_e2e`, garnie par le jeu
// de recette (4 personnes, empreintes ci-dessous), et `E2E_BASE_URL` dessus.
// Les empreintes sont des HMAC-SHA256 calculés avec `PII_ENCRYPTION_KEY` :
// elles ne valent QUE pour la clé de développement.

import { expect, test } from "@playwright/test";

import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";

const fiche = (empreinte: string) => `/fr/${ADMIN_PREFIX}/contacts/personne/${empreinte}`;

/** Les quatre repères du jeu de recette. */
const A = "e513b9b1a1a1b73bb586f5085e3261a01c35ccfec578ca939b0f434c5a435d7c";
const B = "0916906ea5582e8ec75be1a13ce61590c28f57df9ccb00e702385676ac732ecc";
const C = "34a8c064490f733239313651c6764176dc9b4111e2e5625caeeca8d2a0d0d6e7";
/** Le témoin du défaut : un CHERCHEUR D'EMPLOI venu de /contact. */
const D = "59a6965a78e6f959cffee227fdb37c8015961dd67457ae0b25773956d0248739";

test.describe("@personne la fiche rapproche sans fusionner", () => {
  // 🔴 BUDGET DÉCLARÉ, forme exigée par le cliquet
  // `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts` : toute suite qui
  // ouvre une session admin l'annonce, et au moins 90 s. `test.setTimeout()` ne
  // compte PAS — le cliquet lit `describe.configure`.
  //
  // Pourquoi si haut : Argon2id à la connexion, et sous `next dev` la PREMIÈRE
  // navigation vers chaque route la COMPILE.
  test.describe.configure({ timeout: 240_000 });

  test("deux candidatures emploi, et AUCUN encadré « des deux côtés »", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(fiche(A));

    expect(new URL(page.url()).pathname, "renvoyé au login").not.toContain("/login");
    await expect(page.getByRole("heading", { name: /Alice Moreau/ })).toBeVisible({
      timeout: 120_000,
    });

    const corps = page.locator("main");
    await expect(corps).toContainText("Candidature emploi");

    // 🔑 L'encadré ne doit PAS apparaître : cette personne n'existe que d'un
    // côté. Un encadré affiché pour tout le monde ne dirait plus rien.
    await expect(corps, "encadré « des deux côtés » affiché à tort").not.toContainText(
      "des deux côtés",
    );
    // Et rien du monde apporteur ne doit s'être glissé là.
    await expect(corps, "vocabulaire apporteur sur une fiche purement emploi").not.toContainText(
      "Apporteur d'affaires",
    );
  });

  test("emploi ET apporteur : l'encadré paraît, sans mélanger les vocabulaires", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(fiche(B));

    await expect(page.getByRole("heading", { name: /Bruno Lef/ })).toBeVisible({
      timeout: 120_000,
    });
    const corps = page.locator("main");

    // C'est LE cas qui prouve le rapprochement.
    await expect(corps, "l'encadré des deux mondes manque").toContainText("des deux côtés");
    await expect(corps).toContainText("Candidature emploi");
    await expect(corps).toContainText("Apporteur d'affaires");

    // 🔴 ELLE RAPPROCHE, ELLE NE FUSIONNE PAS. Aucun statut de sélection emploi
    // ne doit apparaître : ni sur la ligne emploi, ni — surtout — à côté de la
    // ligne apporteur. Un statut commun aux deux mondes est précisément la
    // pièce qu'un contrôle de requalification cherche.
    for (const statut of ["shortlisted", "Présélection", "À étudier", "En revue"]) {
      await expect(corps, `un statut de sélection emploi s'affiche : ${statut}`).not.toContainText(
        statut,
      );
    }
  });

  test("un dépôt apporteur seul, sans aucune candidature", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(fiche(C));

    await expect(page.getByRole("heading", { name: /Carole Simon/ })).toBeVisible({
      timeout: 120_000,
    });
    const corps = page.locator("main");

    await expect(corps).toContainText("Apporteur d'affaires");
    await expect(
      corps,
      "une candidature emploi apparaît alors qu'il n'y en a pas",
    ).not.toContainText("Candidature emploi");
    await expect(corps, "encadré « des deux côtés » affiché à tort").not.toContainText(
      "des deux côtés",
    );
  });

  test("🔴 un message « recrutement » de /contact N'EST PAS un apporteur", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(fiche(D));

    await expect(page.getByRole("heading", { name: /David Nguyen/ })).toBeVisible({
      timeout: 120_000,
    });
    const corps = page.locator("main");

    // Cette personne a écrit « je cherche un poste » depuis le formulaire de
    // contact public. Son dépôt porte `unifiedType: "recrutement"` — comme un
    // vrai dossier apporteur — mais PAS de `subType: "candidature-commerciale"`,
    // que les quatre producteurs apporteur écrivent tous.
    //
    // Avant correction, l'écran l'annonçait « Apporteur d'affaires / Dossier
    // apporteur » et pointait vers `contacts/commercial/`. C'est l'inversion
    // même que cette fiche existe pour empêcher.
    await expect(corps, "un chercheur d'emploi est classé APPORTEUR").not.toContainText(
      "Apporteur d'affaires",
    );
    await expect(corps).toContainText("Message reçu");

    // Le lien de la trace doit mener à la boîte de réception, jamais au DOSSIER
    // commercial.
    //
    // 🔴 L'ASSERTION VISE UN IDENTIFIANT, PAS UN PRÉFIXE. Une première version
    // refusait tout href contenant `/contacts/commercial/` et rougissait sur
    // trois liens parfaitement légitimes : la file commerciale elle-même et
    // « Nouveau contact apporteur », posés par la barre de navigation, qui vit
    // dans `<main>`. Une garde qui condamne la navigation d'un écran ne dit rien
    // de ce qu'on voulait vérifier — et se fait retirer au premier faux positif.
    const liens = await page
      .locator('main a[href*="/contacts/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(
      liens.filter((h) => /\/contacts\/commercial\/[0-9a-f]{8}-/.test(h)),
      "un lien mène au DOSSIER commercial de cette personne",
    ).toEqual([]);

    // Témoin positif : la fiche porte bien un lien de trace, sinon l'assertion
    // ci-dessus serait vraie pour une page vide.
    expect(
      liens.filter((h) => h.includes("/contacts/messages/")),
      "aucun lien de trace : la fiche est-elle seulement rendue ?",
    ).not.toEqual([]);
  });
});
