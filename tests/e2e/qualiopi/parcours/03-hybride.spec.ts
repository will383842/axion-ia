/**
 * PARCOURS 3 — Journée HYBRIDE : présentiel et distanciel dans la même session.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md`.
 *
 * L'hybride est le cas qui casse les raisonnements binaires : la preuve de
 * présence n'est ni « la feuille signée » ni « le relevé de connexion », mais
 * les DEUX, sur la même session. C'est aussi le cas que les écrans oublient le
 * plus facilement, parce qu'il ne correspond à aucun des deux gabarits.
 *
 * Ce parcours vérifie donc précisément cela : qu'une session hybride offre les
 * deux moyens de preuve, et pas seulement celui de sa modalité dominante.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import { admin, creerSession, ENREGISTREMENT } from "./_communs";

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 3 — hybride, les deux preuves de présence", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("une session hybride offre la grille d'émargement ET l'import de relevé", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    const titre = `E2E HYBRIDE ${Date.now()}`;
    const id = await creerSession(page, {
      modalite: "hybride",
      titre,
      debutDansJours: -7,
      dureeJours: 2,
      participants: 4,
      montantHt: 3200,
    });

    // « hybride » s'affiche « Mixte » ou « Hybride » selon l'écran : on accepte
    // les deux plutôt que de figer un libellé qu'on n'a pas choisi.
    await expect(page.locator("body")).toContainText(/Mixte|Hybride/i, { timeout: 90_000 });

    const reponse = await page.goto(admin(`qualiopi/sessions/${id}/emargement`), {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    expect(reponse?.status(), "l'écran d'émargement doit répondre").toBe(200);

    const manques: string[] = [];

    // Preuve « présentiel » : la génération de créneaux, puis la grille signable.
    const creneaux = page.getByRole("button", { name: /créneaux/i });
    if ((await creneaux.count()) === 0) {
      manques.push(
        "aucune commande de créneaux de présence — la moitié PRÉSENTIELLE de la session " +
          "n'a aucun moyen de preuve",
      );
    }

    // Preuve « distanciel » : l'import du relevé de connexion.
    if ((await page.locator("#import-file").count()) === 0) {
      manques.push(
        "aucun import de relevé de connexion — la moitié DISTANCIELLE de la session " +
          "n'a aucun moyen de preuve",
      );
    }

    await info.attach("emargement-hybride.txt", {
      body: (await page.locator("body").innerText()).slice(0, 4000),
      contentType: "text/plain",
    });

    expect(
      manques,
      "une session hybride doit porter les DEUX preuves de présence : la journée en " +
        "salle s'émarge, la journée à distance se relève",
    ).toEqual([]);
  });
});
