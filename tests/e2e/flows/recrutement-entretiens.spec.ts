/**
 * Parcours — LES ENTRETIENS, au clic, sur données semées.
 *
 * Ce que ce fichier prouve et qu'aucun test unitaire ne peut prouver : qu'on
 * peut planifier un entretien depuis la fiche, qu'il apparaît, que le bouton de
 * débriefing REFUSE de partir sans compte rendu ni issue, et qu'une fois
 * débriefé il porte son issue.
 *
 * ## Ce qu'il ne prouve pas, et le dit
 *
 * Il n'envoie aucun rappel : ceux-ci partent d'une passe de file, pas d'un
 * clic. Leur idempotence est testée ailleurs, sur Prisma mocké — c'est le seul
 * niveau où « le marqueur n'est pas posé quand l'envoi échoue » s'observe.
 *
 * ## La règle qui a coûté un cycle
 *
 * En CI, un échec de connexion admin est un DÉFAUT et ce fichier rougit. Le
 * `skip` ne subsiste qu'en local, sur base vide — et il DIT quelle commande
 * manque. Six tests admin de ce dépôt se sont skippés en silence pendant des
 * mois derrière un `catch` défensif ; celui-ci ne le fera pas.
 */

import { test, expect, type Page } from "@playwright/test";

import { loginAsAdmin, baseSemeeAttendue, ADMIN_PREFIX } from "../fixtures/admin-auth";

/** Borne de navigation : sous `next dev`, un écran admin se COMPILE au premier appel. */
const NAVIGATION = { waitUntil: "domcontentloaded", timeout: 120_000 } as const;

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

/**
 * 🔴 LE CHOIX DE LA FICHE EST UN CHOIX D'ISOLATION.
 *
 * Les scénarios qui CRÉENT un entretien prennent la PREMIÈRE fiche ; celui qui
 * vérifie l'état vide prend la DERNIÈRE. Sans cette séparation, « aucun
 * entretien » échoue dès qu'un autre scénario en a créé un — y compris lors
 * d'une exécution PRÉCÉDENTE, puisque la base garde ce qu'on y met.
 *
 * Mesuré deux fois aujourd'hui, sur ce fichier et sur celui du journal : le test
 * passait au premier lancement et échouait au second, produit inchangé. Un test
 * qui dépend de ce qu'un autre a laissé derrière lui mesure l'ordre
 * d'exécution, pas le produit.
 */
async function ouvrirUneFiche(
  page: Page,
  position: "premiere" | "derniere" = "premiere",
): Promise<void> {
  await page.goto(`/fr/${ADMIN_PREFIX}/contacts/candidatures`, NAVIGATION);
  const liens = page.getByRole("link", { name: /détail/i });
  // `count()` est instantané et ne voit pas une table streamée — leçon déjà
  // payée deux fois dans ce dépôt.
  await liens.first().waitFor({ state: "visible", timeout: 60_000 });
  const cible = position === "premiere" ? liens.first() : liens.last();
  const adresse = await cible.getAttribute("href");
  expect(adresse, "aucune fiche ouvrable — le socle de recette a-t-il été joué ?").toBeTruthy();
  await page.goto(adresse!, NAVIGATION);
}

/** Date locale au format attendu par `datetime-local`, décalée de `jours`. */
function dansNJours(jours: number): string {
  const d = new Date(Date.now() + jours * 86_400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:30`;
}

test.describe("recrutement — les entretiens", () => {
  test.describe.configure({ timeout: 600_000 });

  test("la fiche porte un bloc entretiens, vide et qui le dit", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    // La DERNIÈRE fiche : aucun autre scénario n'y crée d'entretien.
    await ouvrirUneFiche(page, "derniere");

    await expect(page.getByRole("heading", { name: /^entretiens$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /planifier un entretien/i })).toBeVisible();

    // Un espace vide se lirait comme un écran cassé. L'écran doit DIRE qu'il
    // n'y a rien, et rappeler l'autre chemin (rattacher un rendez-vous).
    await expect(page.getByText(/aucun entretien/i)).toBeVisible();
  });

  test("planifier un entretien le fait apparaître", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    await ouvrirUneFiche(page);

    await page.getByRole("button", { name: /planifier un entretien/i }).click();
    // 🔴 Correspondance EXACTE : `/format/i` attrapait aussi une région masquée
    // du site public, `aria-label="Formations IA en entreprise"` — « Formations »
    // contient « format ». Une expression trop permissive ne désigne pas ce
    // qu'elle croit, et l'erreur ne dit pas « mauvais champ » mais « deux
    // éléments ».
    await page.getByLabel("Format", { exact: true }).selectOption("visio");
    await page.getByLabel(/^quand$/i).fill(dansNJours(3));
    await page
      .getByLabel(/lien de visioconférence/i)
      .fill("https://meet.exemple.invalid/recette-entretien");
    await page.getByRole("button", { name: /^planifier$/i }).click({ timeout: 120_000 });

    // La liste est rendue côté serveur : elle réapparaît après revalidation.
    await expect(page.getByText(/tour 1 · visioconférence/i).first()).toBeVisible({
      timeout: 60_000,
    });
    // Un lien de visio doit être CLIQUABLE — une adresse ne l'est pas.
    await expect(page.getByRole("link", { name: /meet\.exemple\.invalid/i }).first()).toBeVisible();
  });

  test("🔴 le débriefing refuse de partir sans compte rendu ni issue", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    await ouvrirUneFiche(page);

    // On planifie d'abord, pour avoir un entretien à débriefer.
    await page.getByRole("button", { name: /planifier un entretien/i }).click();
    await page.getByLabel(/^quand$/i).fill(dansNJours(4));
    await page.getByRole("button", { name: /^planifier$/i }).click({ timeout: 120_000 });
    await expect(page.getByRole("button", { name: /débriefer/i }).first()).toBeVisible({
      timeout: 60_000,
    });

    await page
      .getByRole("button", { name: /débriefer/i })
      .first()
      .click();
    const enregistrer = page.getByRole("button", { name: /enregistrer le compte rendu/i });

    // 🔑 Inactif au départ : ni compte rendu, ni issue.
    await expect(enregistrer).toBeDisabled();

    // Un compte rendu SEUL ne suffit pas — l'issue est ce qui rend la décision
    // relisible six mois plus tard.
    await page.getByLabel(/compte rendu/i).fill("Bon échange, connaît bien le secteur.");
    await expect(enregistrer).toBeDisabled();

    // Les deux ensemble, et seulement les deux.
    await page.getByLabel(/^issue$/i).selectOption("second_tour");
    await expect(enregistrer).toBeEnabled();

    await enregistrer.click({ timeout: 120_000 });
    await expect(page.getByText(/second tour/i).first()).toBeVisible({ timeout: 60_000 });
  });

  test("l’écran annonce qu’un compte rendu ne se modifie plus", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    await ouvrirUneFiche(page);

    await page.getByRole("button", { name: /planifier un entretien/i }).click();
    await page.getByLabel(/^quand$/i).fill(dansNJours(5));
    await page.getByRole("button", { name: /^planifier$/i }).click({ timeout: 120_000 });
    await expect(page.getByRole("button", { name: /débriefer/i }).first()).toBeVisible({
      timeout: 60_000,
    });
    await page
      .getByRole("button", { name: /débriefer/i })
      .first()
      .click();

    // 🔑 Ce n'est pas de la décoration : quelqu'un qui croit pouvoir corriger
    // plus tard n'écrit pas comme quelqu'un qui sait que sa ligne restera.
    await expect(page.getByText(/ne se modifie plus/i)).toBeVisible();
  });

  test("annuler et « ne s’est pas présenté » sont DEUX gestes distincts", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    await ouvrirUneFiche(page);

    await page.getByRole("button", { name: /planifier un entretien/i }).click();
    await page.getByLabel(/^quand$/i).fill(dansNJours(6));
    await page.getByRole("button", { name: /^planifier$/i }).click({ timeout: 120_000 });

    // 🔑 Deux boutons, pas un menu. « Annulé » suppose un geste, « absent » est
    // subi — les fondre ferait passer un rendez-vous manqué pour une annulation
    // convenue, et l'un se rappelle quand l'autre ne se rappelle pas.
    await expect(page.getByRole("button", { name: /^annulé$/i }).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("button", { name: /ne s.est pas présenté/i }).first(),
    ).toBeVisible();
  });
});
