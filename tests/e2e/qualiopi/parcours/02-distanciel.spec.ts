/**
 * PARCOURS 2 — Formation à DISTANCE, import du relevé de connexion inclus.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md`.
 *
 * En distanciel, la preuve de présence n'est pas une signature sur une feuille :
 * c'est le relevé de connexion de la plateforme. `documents.spec.ts` le dit —
 * « c'est la trace du distanciel : elle vaut preuve au même titre qu'une
 * signature ». Ce parcours joue donc le geste qui produit cette preuve : ouvrir
 * l'émargement d'une session distancielle et y importer un export Zoom.
 *
 * ⚠️ Le fichier importé est une fixture bâtie à la main, jamais un export réel :
 * un relevé de connexion contient des données personnelles.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import { admin, creerSession, ENREGISTREMENT } from "./_communs";

/**
 * Export Zoom minimal, au format exact que `parse-zoom.ts` attend — colonnes
 * relevées dans `parse-zoom.spec.ts`, pas devinées.
 *
 * Les adresses sont celles des deux stagiaires du dossier de démonstration :
 * un relevé dont personne ne correspond ne prouverait rien de l'appariement.
 */
const RELEVE_ZOOM = [
  '"Name (Original Name)","User Email","Join Time","Leave Time","Duration (Minutes)"',
  '"Marie Martin","marie.martin@demo.axion-ia.invalid","06/10/2026 09:00:00 AM","06/10/2026 12:30:00 PM","210"',
  '"Thomas Dubois","thomas.dubois@demo.axion-ia.invalid","06/10/2026 09:05:00 AM","06/10/2026 12:00:00 PM","175"',
].join("\n");

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 2 — distanciel, relevé de connexion", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("une session distancielle se crée et son émargement accepte un relevé", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    const titre = `E2E DISTANCIEL ${Date.now()}`;
    const id = await creerSession(page, {
      modalite: "distanciel",
      titre,
      // Une session PASSÉE : un relevé de connexion se produit après coup.
      debutDansJours: -14,
      participants: 2,
      montantHt: 1800,
    });

    await expect(page.locator("body")).toContainText(/Distanciel/i, { timeout: 90_000 });

    // ── L'écran d'émargement, et ce qu'il propose en distanciel ──────────────
    const reponse = await page.goto(admin(`qualiopi/sessions/${id}/emargement`), {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    expect(reponse?.status(), "l'écran d'émargement doit répondre").toBe(200);

    // Le bouton porte « Importer le relevé » ; « Importer un relevé de connexion »
    // est le TITRE du bloc. Deux textes voisins, un seul est le bouton — et viser
    // le mauvais rend « element(s) not found », qui ressemble à une absence de
    // fonctionnalité alors que c'est une erreur de lecture.
    const bouton = page.getByRole("button", { name: /Importer le relevé/i });

    const formulaire = page.locator("#import-file");
    const nbFormulaires = await formulaire.count();
    expect(
      nbFormulaires,
      "l'écran d'émargement d'une session DISTANCIELLE n'offre pas d'import de relevé — " +
        "c'est pourtant la seule preuve de présence possible à distance",
    ).toBeGreaterThan(0);

    // Un `<input type="file">` se remplit par un tampon : on n'écrit pas de
    // fichier sur le disque du poste qui joue le parcours.
    await formulaire.setInputFiles({
      name: "releve-zoom.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(RELEVE_ZOOM, "utf8"),
    });

    const plateforme = page.locator("#import-plateforme");
    if ((await plateforme.count()) > 0) await plateforme.selectOption("zoom");

    // 🔴 POSER UN FICHIER AVANT L'HYDRATATION NE FAIT RIEN — et ne dit rien.
    //
    // Le `<input type="file">` accepte le fichier au niveau du DOM même si React
    // n'a pas encore attaché son `onChange` : l'état `file` reste nul, le bouton
    // reste `disabled`, et Playwright attend indéfiniment un élément qui ne
    // s'activera jamais. Le symptôme (« element is not enabled » pendant quatre
    // minutes) ne ressemble en rien à sa cause.
    //
    // On exige donc explicitement que le formulaire ait REÇU le fichier. Le
    // message dit ce que l'échec signifie, plutôt que de laisser lire un délai.
    await expect(
      bouton,
      "le bouton d'import ne s'est pas activé après dépôt du fichier — le formulaire " +
        "n'a pas reçu l'événement (page non hydratée, ou fichier refusé en amont)",
    ).toBeEnabled({ timeout: 30_000 });

    // Le bouton porte « Importer le relevé » ; « Importer un relevé de connexion »
    // est le TITRE du bloc. Deux textes voisins, un seul est le bouton — et viser
    // le mauvais donne « element(s) not found », qui ressemble à une absence de
    // fonctionnalité alors que c'est une erreur de lecture.
    await bouton.click();

    // ── Ce que l'import doit produire ───────────────────────────────────────
    //
    // On n'exige pas un libellé précis : on exige que l'écran CHANGE et nomme
    // les personnes appariées. Un import silencieux serait indiscernable d'un
    // import raté, et c'est exactement le genre de silence que cet audit
    // cherche.
    const zone = page.locator("body");
    await expect
      .poll(async () => (await zone.innerText()).replace(/\s+/g, " "), {
        timeout: 60_000,
        message:
          "après import, l'écran ne mentionne aucun des deux participants du relevé — " +
          "l'import n'a rien apparié, ou n'a rien dit",
      })
      .toMatch(/Marie Martin|Thomas Dubois|2 participants?|appari/i);

    await info.attach("ecran-apres-import.txt", {
      body: (await zone.innerText()).slice(0, 4000),
      contentType: "text/plain",
    });
  });
});
