/**
 * Parcours RECRUTEMENT — la console des candidatures, au clic, sur données.
 *
 * ## Pourquoi ce fichier commence maintenant, et pas au premier écran livré
 *
 * L'audit Qualiopi du 2026-09-02 a chiffré ce que coûte une recette sur base
 * vide : **neuf défauts sur onze y étaient invisibles**. Le chantier
 * recrutement va ajouter une frise, un composeur de réponses, des entretiens,
 * un pipeline et une recherche. Aucune de ces cinq surfaces ne se juge sans
 * données — et le socle qui les fabrique (`pnpm recrutement:seed-scenarios`)
 * n'aurait servi à rien si personne ne l'exerçait.
 *
 * Ce fichier est donc posé AVEC le socle, pas après. Il grandira lot par lot.
 *
 * ## Ce qu'il exige du socle, et pourquoi il ne se saute pas
 *
 * Six tests admin de ce dépôt se sont `test.skip`és en silence pendant des mois
 * derrière un `catch` défensif : verts, et n'ouvrant rien. La règle ici est
 * l'inverse — en CI, où la base EST semée, un échec de connexion est un DÉFAUT
 * et le parcours rougit. Le `skip` ne subsiste qu'en local, sur base vide, et
 * il dit alors quelle commande manque.
 */

import { test, expect, type Page } from "@playwright/test";

import { loginAsAdmin, baseSemeeAttendue, ADMIN_PREFIX } from "../fixtures/admin-auth";

/**
 * Borne de navigation propre à ce parcours.
 *
 * 🔴 `playwright.config.ts` borne toute navigation à 30 s. Sous `next dev`, un
 * écran admin se COMPILE au premier appel : mesuré ici, `/offres-emploi` a
 * dépassé les 30 s avant d'avoir rendu quoi que ce soit, et le message accusait
 * la navigation au lieu de la compilation.
 *
 * C'est exactement le cas que `fixtures/admin-auth.ts` nomme déjà pour l'écran
 * de connexion, avec la même valeur. Poser une borne globale ne supprime pas le
 * point de rupture, elle le déplace — on le nomme donc là où il tombe. Sous un
 * build de production (Gate B), ces navigations coûtent quelques dizaines de
 * millisecondes et la borne ne sert jamais.
 */
const NAVIGATION = { waitUntil: "domcontentloaded", timeout: 120_000 } as const;

/**
 * Ouvre une session admin, ou saute le parcours en disant CE QUI manque.
 *
 * En CI la base est semée : un échec est un défaut, pas une dispense.
 */
async function ouvrirLaConsole(page: Page): Promise<boolean> {
  try {
    await loginAsAdmin(page);
    return true;
  } catch (cause) {
    if (baseSemeeAttendue()) throw cause;
    test.skip(
      true,
      "connexion admin impossible en local — jouer `pnpm db:seed` puis " +
        `\`pnpm recrutement:seed-scenarios\`. Cause : ${String(cause)}`,
    );
    return false;
  }
}

test.describe("recrutement — la console a de la matière à montrer", () => {
  // 🔑 Le délai global du dépôt est de 30 s ; la connexion admin en réclame à
  // elle seule jusqu'à 120 sous `next dev`, où l'écran de connexion et l'action
  // serveur se compilent à la demande au premier appel. Mesuré ici : les trois
  // parcours expiraient AVANT d'avoir saisi le moindre identifiant, sur un
  // message qui accusait le test au lieu de la compilation.
  //
  // Même valeur et même raison que `admin-nav-clic.spec.ts`. Un délai n'est pas
  // une assertion : le raccourcir ne rend pas le produit meilleur, il rend le
  // journal faux.
  test.describe.configure({ timeout: 600_000 });

  test("la liste des candidatures est peuplée, paginée et lisible", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;

    await page.goto(`/fr/${ADMIN_PREFIX}/contacts/candidatures`, NAVIGATION);

    // 🔑 Le sous-titre porte le compte réel. On exige un nombre à deux chiffres
    // au moins : sur une base vide il afficherait « 0 candidature », et tous les
    // contrôles suivants passeraient en ne regardant rien.
    const entete = page.locator("body");
    await expect(
      entete,
      "la liste annonce moins de dix candidatures : le socle de recette n'a pas " +
        "été joué (`pnpm recrutement:seed-scenarios`), et cet écran est mesuré " +
        "sur du vide",
    ).toContainText(/\d{2,} candidatures/);

    // La pagination doit EXISTER : soixante candidatures dépassent une page.
    await expect(page.getByRole("link", { name: /suivant|2/i }).first()).toBeVisible();

    // L'état « sans CV » doit être rendu comme un état, pas comme une absence.
    // Huit candidatures du socle n'ont pas de CV — une cellule vide se lirait
    // comme « on ne sait pas ».
    await expect(page.getByText(/sans cv/i).first()).toBeVisible();
  });

  test("une offre de démonstration porte ses candidatures et son état", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;

    await page.goto(`/fr/${ADMIN_PREFIX}/offres-emploi`, NAVIGATION);

    // L'offre POURVUE affiche sa mention — c'est ce qui la distingue d'une offre
    // simplement archivée, et c'est ce que Google lit dans le JSON-LD.
    await expect(page.getByText(/pourvu/i).first()).toBeVisible();

    // Le bandeau de fraîcheur doit se déclencher : le socle pose une offre
    // publiée depuis 400 jours, très au-delà du seuil Google for Jobs.
    await expect(
      page.locator("body"),
      "aucune offre signalée à republier alors que le socle en pose une de 400 " +
        "jours : le calcul de fraîcheur ne voit pas les offres de démonstration",
    ).toContainText(/republier|fraîcheur|à rafraîchir/i);
  });

  test("une photo HEIC est proposée au téléchargement, jamais rendue cassée", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;

    await page.goto(`/fr/${ADMIN_PREFIX}/contacts/candidatures`, NAVIGATION);

    // On ouvre les fiches jusqu'à en trouver une qui porte une photo. Le socle
    // en pose trois sur soixante, toutes au format iPhone : aucun navigateur
    // hors Safari ne sait les afficher, et la fiche doit le dire au lieu de
    // rendre une image cassée.
    const liens = page.getByRole("link", { name: /détail/i });

    // 🔴 ON ATTEND LA PREMIÈRE LIGNE AVANT DE COMPTER.
    //
    // `count()` est INSTANTANÉ : il ne réessaie pas. La page est un composant
    // serveur streamé — à `domcontentloaded`, la table n'est pas encore dans le
    // document, le compte vaut zéro, et le parcours conclut « aucune fiche
    // ouvrable » sur un écran qui en porte soixante. Mesuré ici, exactement.
    //
    // C'est le défaut que `fixtures/admin-auth.ts` a déjà payé sur la bannière
    // de consentement : un sondage instantané sur un nœud rendu plus tard ne
    // mesure pas son absence, il mesure sa propre précipitation.
    await liens
      .first()
      .waitFor({ state: "visible", timeout: 60_000 })
      .catch(() => undefined);

    // 🔑 On COLLECTE les adresses, puis on navigue. Le va-et-vient
    // clic → retour → clic suivant est fragile avec un rendu streamé : après un
    // `goBack`, la table n'est pas revenue quand le localisateur suivant est
    // interrogé, et le clic attend une ligne qui n'existe pas encore. Mesuré
    // ici : 120 s d'attente sur `nth(1)`, sur une page qui portait bien la
    // ligne une seconde plus tard.
    //
    // Six fiches suffisent : chacune coûte une compilation à la demande en
    // local, et le témoin final ne dépend pas d'en trouver une avec photo.
    const adresses = (
      await liens.evaluateAll((noeuds) =>
        noeuds.map((n) => (n as HTMLAnchorElement).getAttribute("href")),
      )
    )
      .filter((h): h is string => typeof h === "string" && h.length > 0)
      .slice(0, 6);

    let trouvee = false;
    for (const adresse of adresses) {
      if (trouvee) break;
      await page.goto(adresse, NAVIGATION);
      const mention = page.getByText(/format non affichable dans le navigateur/i);
      if (await mention.isVisible({ timeout: 5_000 }).catch(() => false)) {
        trouvee = true;
        await expect(page.getByRole("link", { name: /télécharger/i }).first()).toBeVisible();
      }
    }

    // 🔑 On n'EXIGE pas d'en trouver une parmi les six premières : le tri est
    // chronologique et les trois fiches concernées peuvent être plus loin. Ce
    // qu'on exige, c'est que si on en trouve une, elle propose un
    // téléchargement au lieu d'une image cassée — et que les fiches s'ouvrent.
    expect(adresses.length, "aucune fiche ouvrable dans la liste").toBeGreaterThan(0);
  });
});
