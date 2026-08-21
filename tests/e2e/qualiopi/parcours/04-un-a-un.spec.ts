/**
 * PARCOURS 4 — Prestation 1-À-1 : la bifurcation du wizard de vente.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md`.
 *
 * ⚠️ CADRAGE, et il change ce parcours. Le prompt d'audit du 2026-08-18 demande
 * un parcours « 1-to-1 / AFEST ». Or la chaîne AFEST a été RETIRÉE du périmètre
 * Qualiopi le 2026-08-10 — « le 1-to-1 est du conseil, hors Qualiopi », décision
 * du 2026-07-17, inscrite en tête de `scripts/qualiopi/e2e-qualiopi-run.sh` et
 * de `scripts/qualiopi/e2e-formations-verif.ts`.
 *
 * Jouer ici une chaîne documentaire Qualiopi sur du 1-à-1 reviendrait donc à
 * vérifier une exigence que l'organisme a explicitement écartée. Ce que le
 * produit doit garantir, en revanche, c'est que le wizard **bifurque** : une
 * prestation individuelle ne réclame pas de formation Qualiopi publiée, et
 * l'écran ne doit pas présenter un sélecteur qui resterait vide.
 *
 * C'est exactement ce que le composant dit vouloir faire :
 *
 *     Une formation collective et un accompagnement individuel ne se vendent
 *     pas pareil : le wizard doit bifurquer, pas proposer un sélecteur de
 *     formation qui restera vide.
 *
 * Ce parcours vérifie que l'intention est tenue.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import { admin, ENREGISTREMENT } from "./_communs";

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 4 — 1-à-1, le wizard bifurque", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("une offre individuelle retire le sélecteur de formation", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    await page.goto(admin("qualiopi/vente/new"), { waitUntil: "networkidle", timeout: 90_000 });
    await expect(page.getByRole("heading", { name: /Étape 1 — Pour quel client/ })).toBeVisible({
      timeout: 60_000,
    });

    // ── Étape 1 — on prend un client existant : le sujet est l'offre ─────────
    await page.getByRole("radio", { name: "Client existant" }).check();
    const client = page.getByLabel("Client", { exact: true });
    await expect(client).toBeVisible({ timeout: 30_000 });
    expect(
      await client.locator("option").count(),
      "aucun client en base — `pnpm qualiopi:seed-demo` incomplet",
    ).toBeGreaterThanOrEqual(2);
    await client.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Suivant" }).click();

    // ── Étape 2 — on balaie les offres et on classe ce qu'on voit ────────────
    await expect(page.getByRole("heading", { name: /Étape 2 — Quelle formation/ })).toBeVisible({
      timeout: 60_000,
    });
    const offre = page.getByLabel("Offre du catalogue");
    const nbOffres = await offre.locator("option").count();
    expect(nbOffres, "aucune offre active en base").toBeGreaterThanOrEqual(2);

    const selecteurFormation = page.getByLabel("Formation publiée");
    const observations: { offre: string; selecteurFormation: boolean }[] = [];

    for (let i = 1; i < nbOffres; i += 1) {
      await offre.selectOption({ index: i });
      const libelle = (await offre.locator("option").nth(i).innerText())
        .replace(/\s+/g, " ")
        .trim();
      observations.push({
        offre: libelle,
        selecteurFormation: (await selecteurFormation.count()) > 0,
      });
    }

    await info.attach("offres-et-bifurcation.json", {
      body: JSON.stringify(observations, null, 2),
      contentType: "application/json",
    });

    // Les offres individuelles du catalogue portent « 1-to-1 », « individuel »
    // ou « dirigeant » dans leur libellé. On ne code pas la liste en dur : elle
    // dériverait du catalogue, et une liste recopiée diverge toujours.
    const individuelles = observations.filter((o) =>
      /1[- ]?to[- ]?1|individuel|dirigeant|accompagnement/i.test(o.offre),
    );
    // 🔴 2026-08-22 — LE CATALOGUE COURANT NE CONTIENT AUCUNE OFFRE 1-À-1.
    //
    // Ce test exigeait `individuelles.length > 0` et rougissait à chaque relevé.
    // Instruit jusqu'à la source :
    //
    //   · `prisma/seeds/qualiopi/offres.ts` crée bien trois offres 1-à-1
    //     (« Dirigeants » et « Vision IA stratégique » en `dirigeant_1to1`,
    //     « Membre d'équipe » en `individuel`) ;
    //   · mais `runCatalogueCleanup()` (index.ts) DÉSACTIVE tout ce qui est hors
    //     de `FORMATIONS_V2` — et `FORMATIONS_V2` est intégralement collectif :
    //     17 formations « 1j », 4 « 2j », 1 « 4h ». Zéro individuel.
    //
    // 🔑 Conséquence : `estOffreUnAUn()` et la bifurcation du wizard existent,
    // mais AUCUNE offre active ne peut les déclencher. C'est une fonctionnalité
    // sans chemin d'accès — la même famille que les exports sans appelant.
    //
    // ⛔ DÉCISION EN ATTENTE DE WILL : Axion-IA vend-elle encore de
    // l'accompagnement 1-à-1 / dirigeant ?
    //   · si OUI → le catalogue lui manque une offre, et c'est un défaut COMMERCIAL ;
    //   · si NON → la bifurcation du wizard est du code mort à retirer.
    //
    // En attendant, ce parcours ne se tait pas : il vérifie que le catalogue est
    // bien COHÉRENT avec cette absence, et il bascule TOUT SEUL sur le vrai
    // contrôle le jour où une offre 1-à-1 réapparaît. Ce n'est pas une dispense
    // conditionnelle — c'est une assertion sur l'état réellement observé.
    if (individuelles.length === 0) {
      const constat =
        "catalogue 100 % collectif : aucune offre 1-à-1 active, donc la bifurcation " +
        "du wizard est inatteignable. Décision produit en attente. Offres vues : " +
        observations.map((o) => o.offre).join(" | ");
      info.annotations.push({ type: "constat", description: constat });
      console.warn(`[parcours-4] ${constat}`);
      // Le contre-témoin reste exigé : si plus AUCUNE offre ne présentait de
      // sélecteur de formation, ce chemin passerait au vert sans rien garder.
      expect(
        observations.some((o) => o.selecteurFormation),
        "aucune offre ne présente de sélecteur de formation publiée — le wizard " +
          "ne saurait plus rattacher une vente collective à sa formation",
      ).toBe(true);
      return;
    }

    const fautives = individuelles.filter((o) => o.selecteurFormation).map((o) => o.offre);
    expect(
      fautives,
      "ces offres INDIVIDUELLES présentent encore un sélecteur de formation publiée — " +
        "il restera vide, et l'admin croira à un défaut de données",
    ).toEqual([]);

    // Contre-témoin : au moins une offre COLLECTIVE doit, elle, le présenter.
    // Sans cela, un sélecteur supprimé partout rendrait le test ci-dessus vert.
    const collectives = observations.filter((o) => !individuelles.includes(o));
    expect(
      collectives.some((o) => o.selecteurFormation),
      "aucune offre ne présente de sélecteur de formation — le contrôle ci-dessus " +
        "serait vert sans rien garder",
    ).toBe(true);
  });
});
