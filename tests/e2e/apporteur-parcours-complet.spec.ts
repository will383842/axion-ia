// PARCOURS COMPLET D'UN APPORTEUR, COMME UN VRAI UTILISATEUR DANS UN NAVIGATEUR.
// DONNÉES ENTIÈREMENT FICTIVES — aucun appel vers la production ni un service réel.
//
//   1. page de recrutement `/fr/apporteur-affaires` : formulaire court → merci ;
//   2. console admin : la fiche candidat est retrouvée, « Nouvel apporteur » ouvre le dossier et
//      envoie le lien (e-mail simulé : lu dans la file Redis locale, jamais envoyé) ;
//   3. dossier en ligne (lien reçu) : coordonnées, SIRET (registre simulé « actif »), IBAN de test,
//      pièce d'identité (PNG fictif) et RIB, contrat lu, deux cases, signature ;
//   4. console admin : pièces jugées conformes, puis contresignature ;
//   5. espace apporteur : « Mes documents » ; réservation d'une entreprise fictive.
//
// Services simulés (voir `apporteur-parcours-complet/outillage/`) : stockage R2, registre SIRENE et
// antivirus répondent depuis 127.0.0.1 (hôtes renvoyés par /etc/hosts du bac à sable) ; l'e-mail
// reste dans la file Redis locale (aucun worker). Pré-requis : serveur sur une base SEMÉE,
// `E2E_BASE_URL` posé. Captures : `apporteur-parcours-complet/NN-etape.png`.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import Redis from "ioredis";
import sharp from "sharp";
import { ADMIN_PREFIX, loginAsAdmin } from "./fixtures/admin-auth";

const DOSSIER_CAPTURES = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "apporteur-parcours-complet",
);
mkdirSync(DOSSIER_CAPTURES, { recursive: true });

const PRENOM = "Camille";
const NOM = "Exemplaire";
const EMAIL = `camille.exemplaire.${Date.now()}@exemple.invalid`;
const TELEPHONE = "0612345678";
/** IBAN d'exemple public, clé de contrôle valide. */
const IBAN = "FR76 3000 6000 0112 3456 7890 189";
const SIREN = "123456782";

let n = 0;
async function capture(page: Page, etape: string): Promise<void> {
  n += 1;
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${String(n).padStart(2, "0")}-${etape}.png`),
    fullPage: true,
  });
}

async function refuserCookies(page: Page): Promise<void> {
  const bouton = page.getByRole("button", {
    name: /refuser|continuer sans accepter|tout refuser/i,
  });
  if (
    await bouton
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false)
  ) {
    await bouton
      .first()
      .click()
      .catch(() => undefined);
  }
}

/** SIRET (clé de Luhn valide) d'un SIREN d'exemple : l'établissement siège fictif. */
function siretDe(siren: string): string {
  const luhn = (x: string): boolean =>
    [...x].reverse().reduce((a, c, i) => {
      let d = Number(c);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      return a + d;
    }, 0) %
      10 ===
    0;
  for (let i = 1; i < 100000; i++) {
    const c = `${siren}${String(i).padStart(5, "0")}`;
    if (luhn(c)) return c;
  }
  throw new Error("aucun SIRET de test");
}

/** Image fictive neutre (aplat gris, 600×400) : sert de pièce d'identité de test. */
async function imageFictive(): Promise<Buffer> {
  return sharp({
    create: { width: 600, height: 400, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .png()
    .toBuffer();
}

/** « E-mail simulé » : le lien du dossier lu dans la file Redis locale (rien n'est envoyé). */
async function lienDuDossierDansLaFile(): Promise<string> {
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://127.0.0.1:6379");
  try {
    const motif = /\/apporteur\/dossier\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{43}/;
    for (let essai = 0; essai < 20; essai++) {
      const cles = await redis.keys("bull:*");
      for (const cle of cles) {
        if ((await redis.type(cle)) !== "hash") continue;
        const data = (await redis.hget(cle, "data")) ?? "";
        if (!data.includes(EMAIL)) continue;
        const m = data.replace(/\\\//g, "/").match(motif);
        if (m) return m[0];
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("aucun lien de dossier trouvé dans la file d'e-mails simulée");
  } finally {
    redis.disconnect();
  }
}

test.describe("@apporteur parcours complet", () => {
  test.describe.configure({ timeout: 900_000 });
  test.skip(
    !process.env["APPORTEUR_BAC_A_SABLE"],
    "parcours local seulement (faux R2/SIRENE/ClamAV) : poser APPORTEUR_BAC_A_SABLE=1",
  );
  test.use({ viewport: { width: 1280, height: 900 } });

  test("inscription → dossier → signature → contresignature → espace apporteur", async ({
    page,
  }) => {
    let lien = "";
    let idApporteur = "";

    await test.step("1. page de recrutement + formulaire court", async () => {
      await page.goto("/fr/apporteur-affaires", { waitUntil: "domcontentloaded" });
      await refuserCookies(page);
      await capture(page, "recrutement-page");
      await page.getByLabel("Prénom").first().fill(PRENOM);
      await page.getByLabel("Téléphone").first().fill(TELEPHONE);
      await page.getByLabel("E-mail").first().fill(EMAIL);
      await page.locator('input[name="consent"]').first().check();
      await capture(page, "recrutement-formulaire-rempli");
      await page.locator('[data-cta="facebook-lead-submit"]').first().click();
      await page.waitForURL(/\/apporteur-affaires\/merci/, { timeout: 60_000 });
      await capture(page, "recrutement-merci");
    });

    await test.step("2. console : nouvel apporteur relié à la fiche, envoi du lien", async () => {
      await loginAsAdmin(page);
      await page.goto(`/fr/${ADMIN_PREFIX}/apporteurs`, { waitUntil: "domcontentloaded" });
      await capture(page, "console-liste-apporteurs");
      await page.getByRole("button", { name: "Nouvel apporteur" }).click();
      await page.getByLabel("Rechercher une fiche de candidat apporteur").fill(EMAIL);
      await page.getByLabel("Fiches de candidats trouvées").getByRole("button").first().click();
      await page.getByLabel("Prénom", { exact: true }).fill(PRENOM);
      await page.getByLabel("Nom", { exact: true }).fill(NOM);
      await page.getByLabel("E-mail", { exact: true }).fill(EMAIL);
      await capture(page, "console-nouvel-apporteur");
      await page.getByRole("button", { name: /Ouvrir son dossier/ }).click();
      await expect(page.getByRole("status").filter({ hasText: "Dossier ouvert" })).toBeVisible();
      await capture(page, "console-apercu-email-lien");
      await page.getByRole("button", { name: /Envoyer le lien/ }).click();
      await page.waitForURL(/\/apporteurs\/[0-9a-f-]{36}$/, { timeout: 60_000 });
      await capture(page, "console-fiche-apres-envoi");
      idApporteur = page.url().match(/apporteurs\/([0-9a-f-]{36})/)![1]!;
      lien = await lienDuDossierDansLaFile();
    });

    await test.step("3. dossier en ligne : coordonnées", async () => {
      await page.context().clearCookies();
      await page.goto(lien, { waitUntil: "domcontentloaded" });
      await refuserCookies(page);
      await expect(page.getByRole("heading", { name: "Vous" })).toBeVisible();
      await page.getByLabel("Téléphone").fill(TELEPHONE);
      await capture(page, "dossier-1-vous");
      await page.getByRole("button", { name: "Continuer" }).click();
    });

    await test.step("4. dossier en ligne : activité (SIRET, statut, TVA, IBAN)", async () => {
      await expect(page.getByRole("heading", { name: "Votre activité" })).toBeVisible();
      await page.getByLabel("Numéro SIRET").fill(siretDe(SIREN));
      await page.getByRole("button", { name: "Rechercher" }).click();
      await expect(page.getByText("✓", { exact: false }).first()).toBeVisible();
      await page.getByLabel("Votre statut").selectOption("micro_entrepreneur");
      await page.getByLabel("Non (franchise)").check();
      await page.getByLabel(/^IBAN/).fill(IBAN);
      await capture(page, "dossier-2-activite");
      await page.getByRole("button", { name: "Continuer" }).click();
    });

    await test.step("5. dossier en ligne : pièce d'identité (PNG fictif) et RIB", async () => {
      await expect(page.getByRole("heading", { name: "Vos documents" })).toBeVisible();
      const png = await imageFictive();
      await page.getByLabel(/Pièce d'identité : choisir un fichier/).setInputFiles({
        name: "identite-fictive.png",
        mimeType: "image/png",
        buffer: png,
      });
      await expect(page.getByText(/identite-fictive\.png/).first()).toBeVisible();
      await page.getByLabel(/RIB : choisir un fichier/).setInputFiles({
        name: "rib-fictif.png",
        mimeType: "image/png",
        buffer: png,
      });
      await expect(page.getByText(/rib-fictif\.png/).first()).toBeVisible();
      await capture(page, "dossier-3-pieces");
      await page.getByRole("button", { name: "Continuer" }).click();
    });

    await test.step("6. dossier en ligne : contrat lu, deux cases, signature", async () => {
      await expect(page.getByRole("heading", { name: "Votre contrat" })).toBeVisible();
      await capture(page, "dossier-4-contrat");
      const cases = page.locator('input[type="checkbox"]');
      for (let i = 0; i < (await cases.count()); i++) await cases.nth(i).check();
      await capture(page, "dossier-4-cases-cochees");
      await page.getByRole("button", { name: "Signer mon contrat" }).click();
      await expect(page.getByRole("heading", { name: /c'est signé|Dossier reçu/ })).toBeVisible({
        timeout: 120_000,
      });
      await capture(page, "dossier-5-signe-en-attente");
    });

    await test.step("7. console : pièces conformes, contresignature", async () => {
      // Les cookies ont été vidés pour jouer l'apporteur (pas de session admin) : on se reconnecte.
      await loginAsAdmin(page, { sansCachePartage: true });
      await page.goto(`/fr/${ADMIN_PREFIX}/apporteurs/${idApporteur}`, {
        waitUntil: "domcontentloaded",
      });
      await capture(page, "console-fiche-a-verifier");
      const conformes = page.getByRole("button", { name: "Conforme", exact: true });
      const nbPieces = await conformes.count();
      expect(nbPieces).toBe(2); // pièce d'identité + RIB
      for (let i = 0; i < nbPieces; i++) {
        await conformes.nth(i).click();
        await expect(page.getByText("Pièce conforme.")).toHaveCount(i + 1, { timeout: 60_000 });
      }
      await capture(page, "console-pieces-conformes");
      await page.getByRole("button", { name: "Oui, contresigner" }).click();
      await expect(
        page.getByRole("button", { name: "Contresigner et envoyer le contrat" }),
      ).toBeVisible();
      await capture(page, "console-apercu-contresignature");
      await page.getByRole("button", { name: "Contresigner et envoyer le contrat" }).click();
      await expect(page.getByText("Contrat contresigné et envoyé.")).toBeVisible({
        timeout: 120_000,
      });
      await capture(page, "console-contresigne");
    });

    await test.step("8. espace apporteur : accueil et « Mes documents »", async () => {
      await page.context().clearCookies();
      await page.goto(lien, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Votre contrat est signé" })).toBeVisible();
      await capture(page, "espace-accueil");
      await page
        .getByRole("link", { name: /Mes documents/ })
        .first()
        .click();
      await page.waitForURL(/\/documents$/);
      await expect(page.getByRole("heading", { name: /Mes documents/ }).first()).toBeVisible();
      await capture(page, "espace-mes-documents");
    });

    await test.step("9. espace apporteur : réservation d'une entreprise fictive", async () => {
      await page.goto(lien, { waitUntil: "domcontentloaded" });
      await page
        .getByLabel("Numéro SIRET de l'établissement", { exact: false })
        .first()
        .fill(siretDe("987654325"));
      await page
        .getByLabel("Nom de l'entreprise", { exact: false })
        .first()
        .fill("Entreprise Fictive Exemple");
      await page.locator('input[name="personneNom"]').fill("Dupont Fictif");
      await page.locator('input[name="personneFonction"]').fill("Directrice");
      await page.locator('input[name="personneEmail"]').fill("contact.fictif@exemple.invalid");
      await page.locator('input[name="personneTelephone"]').fill("0498765432");
      await page
        .locator('input[name="dateContact"]')
        .fill(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date()));
      await capture(page, "reservation-formulaire");
      await page.getByRole("button", { name: "Déclarer cette entreprise" }).click();
      await expect(page.getByText("Déclaration reçue")).toBeVisible({ timeout: 60_000 });
      await capture(page, "reservation-recue");
      // L'écran promet « elle apparaît ci-dessous » : après rechargement, elle doit y figurer.
      await page.reload({ waitUntil: "domcontentloaded" });
      await capture(page, "reservation-apres-rechargement");
      await expect(page.getByText("Entreprise Fictive Exemple").first()).toBeVisible();
    });

    expect(lien).not.toBe("");
  });
});
