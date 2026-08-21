/**
 * PARCOURS 7 — LE FORMATEUR le jour J, puis L'AUDITEUR.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md` :
 * « Formateur le jour J, puis auditeur (mode-auditeur, export du manifeste,
 * vérification publique d'attestation) ».
 *
 * Trois regards, trois moments, et c'est la même donnée qui doit tenir :
 *
 *  1. Le formateur ouvre son kit d'animation — sur place, souvent sans réseau
 *     confortable. Une page qui ne rend pas, c'est une journée qui commence mal.
 *  2. L'auditrice ouvre le mode auditeur et exporte le manifeste. C'est la
 *     pièce qu'elle emporte : si le bouton ne produit rien, l'audit s'arrête.
 *  3. N'IMPORTE QUI vérifie une attestation par son jeton public. C'est la
 *     promesse faite au stagiaire et à son financeur.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import { admin, ENREGISTREMENT } from "./_communs";

/**
 * Jeton de l'attestation du dossier de démonstration.
 *
 * Valeur STABLE posée par `prisma/seeds/qualiopi/demo.ts` (`ATTESTATION_QR`) :
 * on la reprend telle quelle plutôt que de la lire en base — un parcours ne
 * doit pas avoir besoin d'un accès SQL pour jouer.
 */
const JETON_DEMO = "DEMO-QR-TOKEN-AXION-IA-2026-001-STABLE-HASH-CHECK-OK";

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 7 — formateur le jour J, puis auditeur", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test("le formateur ouvre le kit d'animation d'une formation publiée", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    await page.goto(admin("qualiopi/formations"), { waitUntil: "networkidle", timeout: 90_000 });
    const ligne = page.locator("tr").filter({ hasText: "AXI-FOR-DEMO-001" }).first();
    expect(
      await ligne.count(),
      "formation de démonstration absente de la liste — `pnpm qualiopi:seed-demo`",
    ).toBeGreaterThan(0);

    // On suit le lien de la ligne plutôt que de composer l'URL : composer une
    // URL, c'est tester sa propre construction, pas la navigation du produit.
    await ligne.getByRole("link").first().click();
    await page.waitForURL(/\/qualiopi\/formations\/[0-9a-f-]{36}/, { timeout: 60_000 });
    const id = /\/formations\/([0-9a-f-]{36})/.exec(page.url())?.[1] as string;

    const reponse = await page.goto(admin(`qualiopi/formations/${id}/animer`), {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    expect(reponse?.status(), "le kit d'animation doit répondre").toBe(200);

    const texte = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    await info.attach("kit-animation.txt", {
      body: texte.slice(0, 4000),
      contentType: "text/plain",
    });
    expect(
      texte.length,
      `le kit d'animation répond 200 mais n'affiche presque rien : « ${texte.slice(0, 200)} »`,
    ).toBeGreaterThan(300);
    expect(
      /introuvable|Une erreur est survenue|Erreur serveur/i.test(texte),
      "le kit d'animation annonce une erreur",
    ).toBe(false);
  });

  test("l'auditrice ouvre le mode auditeur et le manifeste s'exporte", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    const reponse = await page.goto(admin("qualiopi/mode-auditeur"), {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    expect(reponse?.status(), "le mode auditeur doit répondre").toBe(200);

    const bouton = page.getByRole("button", { name: /Exporter le manifeste/i }).first();
    await expect(
      bouton,
      "aucun bouton d'export du manifeste — l'auditrice repart sans pièce",
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      bouton,
      "le bouton d'export du manifeste est désactivé — il n'y a rien à emporter",
    ).toBeEnabled({ timeout: 30_000 });

    // 🔑 On EXIGE un téléchargement, pas un clic sans conséquence. Un bouton qui
    // ne produit aucun fichier est indiscernable, à l'œil, d'un bouton qui
    // fonctionne — et c'est précisément le genre d'écart que cet audit cherche.
    const telechargement = page.waitForEvent("download", { timeout: 90_000 });
    await bouton.click();
    const fichier = await telechargement;
    const nom = fichier.suggestedFilename();
    await info.attach("manifeste-nom-fichier.txt", { body: nom, contentType: "text/plain" });
    expect(nom, `le fichier exporté porte un nom inattendu : « ${nom} »`).toMatch(
      /manifest|audit/i,
    );

    // Les deux sous-écrans de l'auditrice doivent répondre eux aussi.
    const pannes: string[] = [];
    for (const sous of ["emargement", "signatures"]) {
      const r = await page.goto(admin(`qualiopi/mode-auditeur/${sous}`), {
        waitUntil: "networkidle",
        timeout: 90_000,
      });
      if (r?.status() !== 200) pannes.push(`mode-auditeur/${sous} : HTTP ${r?.status()}`);
    }
    expect(pannes, "sous-écrans du mode auditeur inaccessibles").toEqual([]);
  });

  test("n'importe qui vérifie une attestation par son jeton public", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");

    // Aucune connexion : c'est tout l'objet d'une vérification publique.
    const reponse = await page.goto(`/fr/verifier-attestation/${JETON_DEMO}`, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    expect(
      reponse?.status(),
      "la vérification publique d'attestation doit répondre 200 — c'est la promesse " +
        "faite au stagiaire et à son financeur",
    ).toBe(200);

    const texte = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    await info.attach("verification-attestation.txt", {
      body: texte.slice(0, 3000),
      contentType: "text/plain",
    });

    // La page doit RECONNAÎTRE l'attestation. Un écran qui répond 200 en
    // annonçant « introuvable » serait un faux vert : le jeton est valide.
    expect(
      /introuvable|invalide|inconnu|expiré/i.test(texte),
      `le jeton de démonstration est valide, or la page le refuse : « ${texte.slice(0, 200)} »`,
    ).toBe(false);
    expect(
      texte.length,
      `la vérification répond 200 mais n'affiche presque rien : « ${texte.slice(0, 200)} »`,
    ).toBeGreaterThan(120);

    // Et un jeton bidon doit être REFUSÉ — sans ce contre-témoin, une page qui
    // valide tout passerait le contrôle ci-dessus.
    //
    // 🔴 Un premier jet cherchait le mot « introuvable » dans le corps de la
    // page. Il lisait le corps d'une page 404, souvent vide au moment de la
    // mesure, et concluait que le jeton inventé était ACCEPTÉ. Or le produit
    // fait exactement ce qu'il faut : il répond **404**.
    //
    // 🔑 Sur un refus, le statut HTTP est le signal fort et non ambigu ; le
    // texte n'est qu'un confort. On assertait le confort.
    const refusee = await page.goto("/fr/verifier-attestation/JETON-QUI-NEXISTE-PAS-0000", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    expect(
      refusee?.status(),
      "un jeton inventé doit être refusé par la vérification publique — " +
        `elle répond ${refusee?.status()}`,
    ).toBe(404);
  });
});
