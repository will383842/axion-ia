/**
 * Ouvrir une fiche de candidature EMPLOI depuis la liste de la console.
 *
 * 🔴 LE CHOIX DE LA FICHE EST UN CHOIX D'ISOLATION, pas de commodité.
 *
 * Les scénarios qui ÉCRIVENT (planifier un entretien, consigner un fait)
 * prennent la PREMIÈRE fiche ; ceux qui vérifient un état VIDE prennent la
 * DERNIÈRE. Sans cette séparation, « aucun entretien » échoue dès qu'un autre
 * scénario en a créé un — y compris lors d'une exécution PRÉCÉDENTE, puisque la
 * base garde ce qu'on y met. Mesuré deux fois : le test passait au premier
 * lancement et échouait au second, produit inchangé.
 *
 * 🔴 ET C'EST UN CHOIX DE TABLE. L'onglet « Toutes » fusionne les candidatures
 * emploi et celles des apporteurs d'affaires, triées ensemble par date. Prendre
 * « le premier lien Détail » revenait donc à prendre la ligne la plus récente
 * des DEUX tables — donc, dès qu'un parcours soumet le tunnel apporteurs, une
 * fiche `/contacts/commercial/…` qui ne porte ni entretiens ni journal. Sept
 * tests de recrutement ont échoué ainsi le 2026-09-04, sur un produit intact :
 * le nouveau parcours de capture avait simplement écrit une ligne plus récente
 * que toutes celles du socle.
 *
 * On filtre donc sur l'adresse, et le motif est vérifié par sa propre garde
 * (`tests/unit/ci/href-fiche-candidature-emploi.spec.ts`).
 */

import { expect, type Page } from "@playwright/test";

import { ADMIN_PREFIX } from "./admin-auth";
import { estFicheCandidatureEmploi } from "./href-candidature";

/** Borne de navigation : sous `next dev`, un écran admin se COMPILE au premier appel. */
const NAVIGATION = { waitUntil: "domcontentloaded", timeout: 120_000 } as const;

/**
 * Adresses des fiches de candidature EMPLOI présentes sur la première page de
 * la liste, dans l'ordre affiché (le plus récent d'abord).
 *
 * 🔑 On attend la première ligne AVANT de collecter : `evaluateAll` est
 * instantané et ne réessaie pas. La page est un composant serveur streamé — à
 * `domcontentloaded`, la table n'est pas encore dans le document, la collecte
 * rend un tableau vide, et le parcours conclut « aucune fiche ouvrable » sur un
 * écran qui en porte soixante. Leçon déjà payée deux fois dans ce dépôt.
 */
export async function adressesDesFichesCandidature(page: Page): Promise<string[]> {
  await page.goto(`/fr/${ADMIN_PREFIX}/contacts/candidatures`, NAVIGATION);
  const liens = page.getByRole("link", { name: /détail/i });
  await liens.first().waitFor({ state: "visible", timeout: 60_000 });

  const toutes = await liens.evaluateAll((noeuds) =>
    noeuds.map((n) => (n as HTMLAnchorElement).getAttribute("href")),
  );
  return toutes.filter(estFicheCandidatureEmploi);
}

/**
 * Ouvre une fiche de candidature emploi — la première ou la dernière de la page.
 *
 * Échoue en NOMMANT la cause si la page ne porte que des fiches d'apporteurs :
 * « aucune fiche ouvrable » se lirait comme une base vide, et on chercherait le
 * défaut dans le seed.
 */
export async function ouvrirUneFicheCandidature(
  page: Page,
  position: "premiere" | "derniere" = "premiere",
): Promise<void> {
  const adresses = await adressesDesFichesCandidature(page);

  expect(
    adresses.length,
    "aucune fiche de CANDIDATURE EMPLOI sur la première page de la liste — " +
      "soit le socle de recette n'a pas été joué (`pnpm recrutement:seed-scenarios`), " +
      "soit les lignes d'apporteurs d'affaires occupent toute la page",
  ).toBeGreaterThan(0);

  const adresse = position === "premiere" ? adresses[0]! : adresses[adresses.length - 1]!;
  // Témoin : on n'ouvre jamais une fiche d'apporteur, même si le filtre ci-dessus
  // devenait trop permissif un jour.
  expect(adresse, "la fiche ouverte doit être une candidature emploi").not.toContain(
    "/contacts/commercial/",
  );
  await page.goto(adresse, NAVIGATION);
}
