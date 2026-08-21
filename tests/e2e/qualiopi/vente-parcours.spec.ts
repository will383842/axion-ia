/**
 * E2E — wizard « Nouvelle vente » (plan 2026-08-05, stratégie de test §1a).
 *
 * Parcours réel dans le navigateur : connexion admin → création d'un client
 * neuf → choix d'une offre et d'une formation publiée → création du devis
 * (brouillon) → checklist du dossier à l'étape 4. Tourne aussi sous le projet
 * `mobile-chrome` (playwright.config.ts) — le wizard est utilisé au téléphone.
 *
 * ## Limites assumées
 *
 * La signature du devis appartient au CLIENT (canal maison, lien e-mail) : un
 * e2e ne peut pas la produire sans fixture de signature dédiée. Le parcours
 * s'arrête donc au devis créé + checklist rendue ; la machine à états complète
 * (devis signé → session → certificats/facture, ~1 573 combinaisons) est
 * verrouillée par `src/server/qualiopi/vente/checklist-exhaustif.spec.ts`.
 *
 * Pré-requis : dev server + DB seedée (ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD,
 * 2FA off) et AU MOINS une offre active + une formation publiée. Si non seedé
 * → test.skip explicite (pas un fail), même politique que admin-booking-flow.
 */

import { test, expect } from "@playwright/test";
import { ADMIN_PREFIX, loginAsAdmin, baseSemeeAttendue } from "../fixtures/admin-auth";

test.describe("Wizard nouvelle vente — client → devis → checklist", () => {
  /**
   * 🔴 2026-08-21 — CETTE SUITE TOURNAIT AVEC LE BUDGET PAR DÉFAUT (30 s).
   *
   * Elle ouvre une session admin — vérification Argon2id délibérément coûteuse,
   * quatre workers se la disputent en CI — puis traverse un wizard en trois
   * étapes. Elle échouait sur « loginAsAdmin a échoué […] Texte de la page : »,
   * texte VIDE : la page de connexion n'avait pas fini de rendre.
   *
   * 🔑 Un message d'échec vide est le symptôme du budget, pas du produit. Ses
   * sœurs déclaraient toutes le leur (90 s à 600 s) ; celle-ci avait été
   * oubliée. Le cliquet `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts`
   * refuse désormais qu'une suite qui se connecte parte sans budget déclaré.
   */
  test.describe.configure({ timeout: 180_000 });

  test("le parcours crée le client, le devis, et rend la checklist", async ({ page }) => {
    try {
      await loginAsAdmin(page);
    } catch (e) {
      // En CI la base est semée : un échec ici est un défaut, pas une dispense.
      if (baseSemeeAttendue()) throw e;
      test.skip(true, `connexion admin impossible en local : ${String(e).slice(0, 300)}`);
      return;
    }

    await page.goto(`/fr/${ADMIN_PREFIX}/qualiopi/vente/new`);
    await expect(page.getByRole("heading", { name: /Étape 1 — Pour quel client/ })).toBeVisible();

    // ── Étape 1 — nouveau client (nom unique : le CRM de dev accumule) ──────
    await page.getByRole("radio", { name: "Nouveau client" }).check();
    const raisonSociale = `E2E VENTE ${Date.now()}`;
    await page.getByLabel("Raison sociale *").fill(raisonSociale);
    await page.getByRole("button", { name: "Créer le client" }).click();
    await expect(page.getByText(/créé — passez à l'étape suivante/)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Suivant" }).click();

    // ── Étape 2 — offre + formation publiée ─────────────────────────────────
    await expect(page.getByRole("heading", { name: /Étape 2 — Quelle formation/ })).toBeVisible();
    const selectOffre = page.getByLabel("Offre du catalogue");
    const nbOffres = await selectOffre.locator("option").count();
    if (nbOffres < 2) {
      // En CI la base est semée : une fixture manquante est un défaut du seed,
      // pas une dispense. Un skip muet ici a masqué pendant des mois le fait
      // que ce parcours ne se jouait jamais.
      if (baseSemeeAttendue())
        throw new Error("Aucune offre active en base — `pnpm qualiopi:seed-demo` incomplet");
      test.skip(true, "Aucune offre active en base — `pnpm qualiopi:seed-demo` incomplet");
      return;
    }
    // 🔴 2026-08-21 — la spec retenait l'offre d'INDEX 1, c'est-à-dire la
    // première du catalogue par ordre alphabétique de code, puis exigeait des
    // formations. Or une formation est rattachée à UNE offre : le sélecteur ne
    // se remplit que si l'offre choisie est la bonne. Sur onze offres actives,
    // la spec en tirait une au hasard — et concluait « seed incomplet ».
    //
    // 🔑 Un parcours doit chercher ce qu'un humain chercherait : l'offre qui
    // porte une formation. On parcourt donc les offres jusqu'à ce que le
    // sélecteur de formation se remplisse, et on ne déclare le seed en défaut
    // que si AUCUNE n'en a.
    const selectFormation = page.getByLabel("Formation publiée");
    let offreRetenue: string | null = null;
    for (let i = 1; i < nbOffres; i += 1) {
      await selectOffre.selectOption({ index: i });
      // Le sélecteur de formation disparaît pour une offre de type « un à un » :
      // c'est une bifurcation métier, pas une absence de données.
      if ((await selectFormation.count()) === 0) continue;
      if ((await selectFormation.locator("option").count()) >= 2) {
        offreRetenue = await selectOffre.inputValue();
        break;
      }
    }

    if (offreRetenue === null) {
      const message =
        "Aucune offre active ne porte de formation `statut=actif` + " +
        "`statutGeneration=publie` — `pnpm qualiopi:seed-demo` incomplet";
      // En CI la base est semée : une fixture manquante est un défaut du seed,
      // pas une dispense. Un skip muet ici a masqué pendant des mois le fait
      // que ce parcours ne se jouait jamais.
      if (baseSemeeAttendue()) throw new Error(message);
      test.skip(true, message);
      return;
    }
    await selectFormation.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Suivant" }).click();

    // ── Étape 3 — devis brouillon ───────────────────────────────────────────
    await expect(page.getByRole("heading", { name: /Étape 3 — Devis/ })).toBeVisible();
    await page.getByLabel("Montant HT (€)").fill("1900");
    await page.getByRole("button", { name: "Créer le devis (brouillon)" }).click();
    // Le numéro séquentiel prouve que l'action serveur a réellement écrit.
    await expect(page.getByText(/Devis AXI-DEV-\d{4}-\d+/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Suivant" }).click();

    // ── Étape 4 — checklist du dossier ──────────────────────────────────────
    await expect(page.getByRole("heading", { name: /Étape 4 — Checklist/ })).toBeVisible();
    // Le devis existe (lien vers sa fiche) ; la session reste à faire — la
    // checklist DOIT montrer les deux, pas seulement ce qui est fait.
    await expect(page.getByRole("link", { name: "Devis" })).toBeVisible();
    await expect(page.getByText("Session de formation")).toBeVisible();
  });
});
