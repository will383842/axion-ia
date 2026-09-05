// L'envoi groupé d'e-mails aux postulants — recette par l'INTERFACE.
//
// Pourquoi ce fichier existe alors que le domaine a déjà 15 tests unitaires :
// ces 15 tests prouvent que `preparerEnvois` écarte le bon dossier et substitue
// depuis LE BON dossier. Ils ne prouvent RIEN de ce qui suit, et qui n'existe
// que dans un navigateur :
//
//   1. `<button formAction={action}>` — l'action d'un `useActionState` posée sur
//      un bouton, dans un `<form>` qui porte DÉJÀ une autre action. C'est
//      idiomatique en React 19, et personne ne l'avait vu tourner ici. Si la
//      délégation ne marchait pas, le clic déclencherait AUSSI le geste de
//      STATUT : cinquante dossiers rebasculés en plus de l'e-mail.
//
//      ✅ Elle marche — mesuré. Mais le témoin qui le prouve n'est pas celui
//      qu'on croit, et se tromper de témoin fait conclure l'inverse : répondre
//      à un dossier `new` le fait LÉGITIMEMENT passer à « En revue »
//      (`envoyer-reponse.ts`). Seul un dossier ÉCARTÉ, et dont le statut n'est
//      pas `new`, discrimine — rien ne lui est écrit, donc rien ne doit le
//      faire bouger. Cf. l'étape 6.
//
//   2. La SOUMISSION IMPLICITE de HTML. Le champ « Objet » est le premier champ
//      texte d'une ligne de ce formulaire, qui n'avait jusque-là que des cases à
//      cocher et deux `select`. Une touche Entrée y activait le premier bouton
//      `submit` EN ORDRE DE DOCUMENT — « Appliquer à la sélection » — et
//      rebasculait la sélection au statut par défaut en effaçant ses motifs de
//      refus. Aucun test unitaire ne voit cela : le défaut ne naît pas d'un
//      composant, il naît de la COHABITATION de deux composants corrects.
//
// Pré-requis : serveur de dev lancé sur une base semée, `E2E_BASE_URL` pointant
// dessus, et au moins trois candidatures emploi en base.

import { expect, test, type Page } from "@playwright/test";

import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";

// 🔴 BUDGET DÉCLARÉ, forme exigée par le cliquet
// `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts` : toute suite qui
// ouvre une session admin l'annonce, et au moins 90 s. `test.setTimeout()` ne
// compte PAS — le cliquet lit `describe.configure`, et il a raison : un budget
// posé test par test se perd au premier test ajouté sans lui.
//
// Pourquoi si haut : la vérification du mot de passe est délibérément coûteuse
// (Argon2id), et sous `next dev` la PREMIÈRE navigation vers chaque route la
// COMPILE — 15 s à 3 min sur un poste chargé.

const CHEMIN = `/fr/${ADMIN_PREFIX}/contacts/candidatures?view=standard`;

/** Coche les `n` premières lignes emploi, et rend leur nombre réel. */
async function cocher(page: Page, n: number): Promise<number> {
  const cases = page.locator('input[type="checkbox"][name="ids"]');
  const total = await cases.count();
  const pris = Math.min(n, total);
  for (let i = 0; i < pris; i += 1) await cases.nth(i).check();
  return pris;
}

test.describe("@recrutement écrire à plusieurs postulants d'un seul geste", () => {
  test.describe.configure({ timeout: 240_000 });

  test("le composeur envoie, écarte, et ne déclenche PAS le geste de statut", async ({ page }) => {
    await loginAsAdmin(page);
    // 🔴 BORNE EXPLICITE. `describe.configure({ timeout })` règle le budget du
    // TEST ; `page.goto` garde sa propre borne de navigation à 30 s, et sous
    // `next dev` la première compilation d'une route dépasse largement. Une
    // exécution a expiré ici SANS JAMAIS CLIQUER — et l'état de la base, laissé
    // intact, ressemblait alors trait pour trait à un succès.
    await page.goto(CHEMIN, { timeout: 180_000 });

    expect(new URL(page.url()).pathname, "renvoyé au login").not.toContain("/login");

    // ── 1. La frontière apporteur est tenue par l'ÉCRAN, pas seulement par le
    // serveur. Les cases à cocher n'existent que sur les lignes emploi : un
    // envoi groupé à N indépendants fabriquerait une pièce du faisceau de
    // requalification. On le CONSTATE ici plutôt que de le supposer.
    const cases = page.locator('input[type="checkbox"][name="ids"]');
    await expect(cases.first()).toBeAttached({ timeout: 120_000 });

    const choisis = await cocher(page, 3);
    expect(choisis, "il faut au moins 3 candidatures emploi en base").toBeGreaterThanOrEqual(3);

    // ── 2. Le composeur est REPLIÉ par défaut. C'est le seul geste de la console
    // qui écrive à cinquante personnes d'un clic : l'ouvrir doit demander une
    // intention supplémentaire.
    const bloc = page.locator("details", { has: page.getByText("Écrire à la sélection") });
    await expect(bloc, "le composeur doit être replié au chargement").not.toHaveAttribute(
      "open",
      /.*/,
    );
    await page.getByText("Écrire à la sélection").click();

    // ── 3. Le modèle remplit les deux champs, et le texte reste BRUT.
    // 🔑 C'est le cœur du lot : si l'écran substituait `{prenom}` ici, avec le
    // dossier ouvert, le prénom du premier candidat partirait à tous les autres
    // — et cette faute-là ne se voit QUE du côté des destinataires.
    await page.selectOption("#masse-modele", "refus");
    await expect(page.locator("#masse-corps")).toHaveValue(/\{prenom\}/);
    await expect(page.locator("#masse-objet")).toHaveValue(/\{poste\}/);

    // ── 4. LE POINT À ÉPROUVER : `formAction` l'emporte sur l'action du `<form>`.
    //
    // 🔴 LE TÉMOIN N'EST PAS N'IMPORTE QUELLE LIGNE, et s'être trompé de témoin
    // m'a fait conclure l'inverse de la vérité. Répondre à un dossier `new` le
    // fait légitimement passer à « En revue » — `envoyer-reponse.ts` le
    // documente : « une candidature à laquelle on vient de répondre n'est plus
    // nouvelle ». Une ligne `new` qui change de statut après un envoi ne prouve
    // donc RIEN.
    //
    // 🔑 LE TÉMOIN QUI DISCRIMINE EST LE COMPTE RENDU DU GESTE VOISIN, PAS UN
    // ÉTAT EN BASE. `FormulaireEnMasse` affiche son propre `role="status"`
    // — « N candidature(s) modifiée(s) », ou « déjà dans cet état » — dès que
    // son action tourne sur une sélection non vide. Son ABSENCE prouve donc que
    // seule l'action du bouton est partie.
    //
    // ⚠️ Ma première version cherchait un dossier ÉCARTÉ dont le statut ne
    // bougeait pas. Elle passait en local et rougissait en CI : le témoin — un
    // dossier au poste vide — je l'avais fabriqué À LA MAIN dans ma base, il
    // n'existe pas dans le seed. Une recette qui dépend d'une donnée que
    // personne d'autre n'a n'est pas une recette, c'est une mise en scène.

    await page.getByRole("button", { name: "Envoyer à la sélection" }).click();

    // Le compte rendu porte TROIS nombres qui ne se mélangent jamais. Un total
    // unique « 3 traitées » ferait croire à des messages partis qui ne le sont
    // pas, et c'est exactement ce qu'on relit quand un candidat dit « je n'ai
    // rien reçu ».
    const rendu = page.locator('[role="status"]').filter({ hasText: "envoyé" });
    await expect(rendu, "aucun compte rendu d'envoi").toBeVisible({ timeout: 120_000 });

    const texte = (await rendu.innerText()).replace(/\s+/g, " ");

    // ── 5. LES TROIS NOMBRES RENDENT COMPTE DE CHAQUE DOSSIER SÉLECTIONNÉ.
    //
    // C'est l'invariant portable, vrai quelle que soit la base : envoyées +
    // écartées + en échec = ce qu'on avait coché. Un dossier qui disparaîtrait
    // du compte rendu serait précisément le cas qu'on ne saurait pas rattraper.
    //
    // 🔑 En CI, la file d'envoi n'est pas branchée : les trois tombent en
    // « échec d'envoi, rejouable ». C'est un compte rendu JUSTE — et cela vaut
    // mieux qu'un « envoyé » optimiste, qui interdirait le rattrapage.
    const nombre = (motif: RegExp): number => Number((texte.match(motif) ?? [])[1] ?? 0);
    const envoyees = nombre(/(\d+) messages? envoyés?/);
    const ecartees = nombre(/(\d+) écartés?/);
    const echouees = nombre(/(\d+) en échec/);

    expect(
      envoyees + ecartees + echouees,
      `compte rendu incomplet : « ${texte} » ne rend pas compte des ${choisis} dossiers cochés`,
    ).toBe(choisis);

    // ── 6. ET LE GESTE DE STATUT N'A PAS TOURNÉ.
    //
    // C'est la preuve que `formAction` a bien déroute le geste : le bouton
    // voisin aurait basculé la sélection au statut par défaut et effacé ses
    // motifs de refus, en l'annonçant dans SON propre compte rendu.
    await expect(
      page.locator('[role="status"]').filter({ hasText: "modifiée" }),
      "« Appliquer à la sélection » a tourné en plus de l'envoi",
    ).toHaveCount(0);
  });

  test("Entrée dans l'objet ne rebascule PAS la sélection", async ({ page }) => {
    await loginAsAdmin(page);
    // 🔴 BORNE EXPLICITE. `describe.configure({ timeout })` règle le budget du
    // TEST ; `page.goto` garde sa propre borne de navigation à 30 s, et sous
    // `next dev` la première compilation d'une route dépasse largement. Une
    // exécution a expiré ici SANS JAMAIS CLIQUER — et l'état de la base, laissé
    // intact, ressemblait alors trait pour trait à un succès.
    await page.goto(CHEMIN, { timeout: 180_000 });

    const cases = page.locator('input[type="checkbox"][name="ids"]');
    await expect(cases.first()).toBeAttached({ timeout: 120_000 });
    await cocher(page, 2);

    await page.getByText("Écrire à la sélection").click();

    const premiereLigne = page.locator("tbody tr").first();
    const avant = (await premiereLigne.innerText()).replace(/\s+/g, " ").trim();

    // Le geste réflexe : on tape un objet, on appuie sur Entrée.
    await page.locator("#masse-objet").click();
    await page.locator("#masse-objet").fill("Un objet quelconque");
    await page.locator("#masse-objet").press("Enter");

    // 🔑 On attend VOLONTAIREMENT. Un test qui vérifie « rien ne s'est passé »
    // sans laisser le temps à la chose de se passer verdit toujours — c'est un
    // témoin négatif sans valeur.
    await page.waitForTimeout(2_500);

    // Aucun compte rendu du geste de STATUT ne doit apparaître.
    await expect(
      page.locator('[role="status"]').filter({ hasText: "modifiée" }),
      "Entrée a déclenché « Appliquer à la sélection »",
    ).toHaveCount(0);

    // Et la ligne est inchangée.
    const apres = (await premiereLigne.innerText()).replace(/\s+/g, " ").trim();
    expect(apres, "le statut a bougé sur une simple touche Entrée").toBe(avant);
  });
});
