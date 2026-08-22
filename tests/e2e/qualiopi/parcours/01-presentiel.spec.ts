/**
 * PARCOURS 1 — Formation en PRÉSENTIEL, du devis à la facture, en cliquant.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md`.
 *
 * Deux moitiés, et c'est délibéré :
 *
 *  - **On crée** une session présentielle par l'écran, pour prouver que la
 *    création fonctionne et que la modalité choisie est bien celle rendue.
 *  - **On parcourt** ensuite la session de démonstration `AXI-SES-DEMO-001`,
 *    seule à porter un cycle complet (présences, évaluations, attestation,
 *    facture). Une session créée à l'instant n'a rien à montrer de l'aval.
 *
 * ⚠️ Ce parcours ne saute jamais en silence. Quand une pièce manque, il le DIT
 * et rougit : c'est un audit, pas une suite de fumée.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import { admin, creerSession, ouvrirSessionDemo, ENREGISTREMENT } from "./_communs";

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 1 — présentiel, du devis à la facture", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("une session présentielle se crée et rend la modalité choisie", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    const titre = `E2E PRESENTIEL ${Date.now()}`;
    const id = await creerSession(page, {
      modalite: "presentiel",
      titre,
      debutDansJours: 7,
      participants: 6,
      montantHt: 2400,
    });

    // La fiche doit porter le titre saisi ET la modalité choisie. Vérifier
    // seulement l'arrivée sur une URL ne prouverait pas que le champ a été lu.
    // La fiche est rendue EN FLUX : sans délai explicite, on mesure le
    // squelette. Les 5 s par défaut de `expect` n'y suffisent pas sous `next dev`.
    const corps = page.locator("body");
    await expect(corps).toContainText(titre, { timeout: 90_000 });
    await expect(corps).toContainText(/Présentiel/i, { timeout: 30_000 });

    // On relit la fiche par son URL : ce qui n'est pas persisté disparaît ici.
    await page.goto(admin(`qualiopi/sessions/${id}`));
    await expect(page.locator("body")).toContainText(titre, { timeout: 90_000 });
  });

  test("la session de démonstration expose ses cinq sous-pages", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    const id = await ouvrirSessionDemo(page);
    expect(
      id,
      "session AXI-SES-DEMO-001 introuvable dans la liste — `pnpm qualiopi:seed-demo` n'a pas tourné",
    ).not.toBeNull();

    // Les quatre écrans que le formateur et l'auditeur ouvrent réellement. On les
    // OUVRE : leur présence dans le menu ne prouve pas qu'ils rendent.
    //
    // 🔴 Un premier jet cherchait un mot-clé par page (« Émargement »,
    // « Évaluation »…). C'était deviner le contenu au lieu de le lire : les
    // titres réels sont « Créneaux de présence », « Feuille d'émargement à
    // jour »… et certains ne s'affichent que sous condition. Un parcours qui
    // exige un mot qu'il n'a pas vérifié rougit sur sa propre supposition.
    //
    // On vérifie donc ce qui doit être vrai de TOUTE page d'audit : elle répond,
    // elle porte au moins un titre, elle n'annonce ni erreur ni ressource
    // introuvable, et elle a du contenu. Les titres réellement rendus sont
    // ATTACHÉS au rapport — c'est la matière de l'audit, pas une supposition.
    const sousPages = ["emargement", "evaluations", "financement", "kit"];
    const pannes: string[] = [];
    const releve: Record<string, string[]> = {};

    for (const chemin of sousPages) {
      // 🔴 `domcontentloaded` mesure trop tôt : sous `next dev` la route compile
      // à la demande et le corps arrive après. `networkidle` attend le rendu réel.
      const reponse = await page.goto(admin(`qualiopi/sessions/${id}/${chemin}`), {
        waitUntil: "networkidle",
        timeout: 90_000,
      });
      const statut = reponse?.status() ?? 0;
      if (statut !== 200) {
        pannes.push(`${chemin} : HTTP ${statut}`);
        continue;
      }
      // 🔴 `main` n'est PAS un repère fiable ici, et la raison a CHANGÉ le
      // 2026-08-22. Avant ce lot, la console ouvrait son propre `<main>` à
      // l'intérieur du `<main id="main">` du layout public : deux repères
      // imbriqués, et `.last()` désignait le mauvais. La console n'ouvre plus
      // de `<main>` du tout — c'est désormais celui du SITE qui enveloppe la
      // console, rail et topbar compris.
      //
      // 🔑 Le repère reste donc `body` : viser `main` ramènerait exactement le
      // même bruit qu'avant, par le chemin inverse.
      const zone = page.locator("body");
      const titres = await zone.locator("h1, h2").allInnerTexts();
      releve[chemin] = titres.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
      const texte = (await zone.innerText()).replace(/\s+/g, " ").trim();

      if (titres.length === 0) pannes.push(`${chemin} : aucun titre (h1/h2) rendu`);
      if (texte.length < 200) pannes.push(`${chemin} : page quasi vide (${texte.length} car.)`);
      if (/introuvable|Une erreur est survenue|500|Erreur serveur/i.test(texte)) {
        pannes.push(`${chemin} : la page annonce une erreur — « ${texte.slice(0, 120)} »`);
      }
    }

    await info.attach("titres-sous-pages.json", {
      body: JSON.stringify(releve, null, 2),
      contentType: "application/json",
    });

    expect(pannes, "sous-pages de session inaccessibles ou vides").toEqual([]);
  });
});
