// Parcours 7 (campagne) — changement de RIB et masquage de l'IBAN.
//
// ⚠️ ÉTAT DU CODE SUR main : seul le CŒUR SERVEUR du changement de RIB existe (`changement-iban.ts`,
// « Aucun écran, aucune route » — lots 5 (espace) et 6 (console) non livrés). Il n'y a donc, aujourd'hui,
// NI formulaire « nouveau RIB » dans l'espace, NI écran de validation/refus dans la console. Cette spec :
//   · joue ce qui existe : l'IBAN reste masqué partout (console, espace, file d'e-mails, base), cloisonnement
//     entre apporteurs, accès sans session ;
//   · détecte l'ABSENCE des écrans (7.2) — ce test échouera le jour où les lots 5 et 6 arrivent, signal pour
//     activer les scénarios 7.3 (demande, validation, refus) laissés en `test.fixme`.
// IBAN d'exemple public, clé de contrôle valide ; aucune donnée réelle.
import { expect, test } from "@playwright/test";
import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";
import { emailsCaptures, refuserCookies } from "./outillage/aides";
import { apporteurMonde, capturer, monde, type ApporteurMonde } from "./outillage/campagne";

test.describe.configure({ timeout: 300_000 });
test.skip(
  process.env["APPORTEUR_BAC_A_SABLE"] !== "1",
  "bac à sable seulement : poser APPORTEUR_BAC_A_SABLE=1",
);
test.use({ viewport: { width: 1280, height: 900 } });

const IBAN = "FR7630006000011234567890189";
const IBAN_AUTRE = "FR7630004000031234567890143";
const NU = (i: string): string => i.replace(/\s/g, "");
const AVEC_ESPACES = (i: string): string => i.replace(/(.{4})/g, "$1 ").trim();

let a: ApporteurMonde;
let b: ApporteurMonde;

test.describe.serial("@apporteur parcours 7 — RIB et masquage de l'IBAN", () => {
  test.beforeAll(() => {
    a = apporteurMonde("rib-a", { iban: IBAN });
    b = apporteurMonde("rib-b", { iban: IBAN_AUTRE });
  });

  test("7.1 l'IBAN n'est jamais en clair : chiffré en base, masqué dans la console, absent de l'espace et des e-mails", async ({
    page,
  }) => {
    const brut = monde<{ brut: string | null }>("iban-brut", { apporteurId: a.id }).brut ?? "";
    expect(brut, "colonne IBAN renseignée").not.toBe("");
    expect(brut, "la colonne est chiffrée").not.toContain(IBAN.slice(4, 16));
    await loginAsAdmin(page);
    await page.goto(`/fr/${ADMIN_PREFIX}/apporteurs/${a.id}`, { waitUntil: "domcontentloaded" });
    const main = page.locator("main");
    await expect(main).toContainText("IBAN");
    const texte = await main.innerText();
    expect(texte).not.toContain(NU(IBAN));
    expect(texte).not.toContain(AVEC_ESPACES(IBAN));
    expect(texte).not.toContain(IBAN.slice(4)); // ni la partie numérotée entière
    expect(texte, "ni le RIB d'un autre apporteur").not.toContain(IBAN_AUTRE.slice(4));
    expect(texte, "un masque est affiché").toMatch(/•|\*|X{2,}|\d{4}\s*$/m);
    await capturer(page, "p7-01-console-iban-masque");
    // Espace : aucune page ne montre l'IBAN.
    for (const chemin of ["", "/mes-commissions", "/documents", "/aide"]) {
      await page.goto(`${a.lien}${chemin}`, { waitUntil: "domcontentloaded" });
      await refuserCookies(page);
      const corps = await page.locator("body").innerText();
      expect(corps, `espace${chemin}`).not.toContain(IBAN.slice(4, 20));
    }
    await capturer(page, "p7-02-espace-sans-iban");
    // File BullMQ du Redis local : aucun e-mail ne porte l'IBAN entier.
    expect((await emailsCaptures(IBAN.slice(4, 20))).length).toBe(0);
    expect((await emailsCaptures(IBAN_AUTRE.slice(4, 20))).length).toBe(0);
  });

  test("7.2 cloisonnement (IDOR) : le lien d'un apporteur n'ouvre pas le dossier d'un autre ; la console sans session renvoie à la connexion", async ({
    page,
    browser,
  }) => {
    const jetonB = b.lien.split("/").pop()!;
    const r = await page.goto(`/apporteur/dossier/${a.id}/${jetonB}`, {
      waitUntil: "domcontentloaded",
    });
    expect(r?.status()).toBe(404);
    await expect(page.locator("body")).not.toContainText(IBAN_AUTRE.slice(4, 20));
    await capturer(page, "p7-03-idor-jeton-d-un-autre");
    const anonyme = await browser.newContext();
    const p = await anonyme.newPage();
    await p.goto(`/fr/${ADMIN_PREFIX}/apporteurs/${a.id}`, { waitUntil: "domcontentloaded" });
    expect(p.url()).toMatch(/login/);
    await expect(p.locator("body")).not.toContainText(IBAN.slice(4, 20));
    await capturer(p, "p7-04-console-sans-session");
    await anonyme.close();
  });

  test("7.3 ÉTAT ACTUEL : aucun écran de demande de nouveau RIB dans l'espace ni de validation dans la console (lots 5 et 6 non livrés)", async ({
    page,
  }) => {
    await page.goto(a.lien, { waitUntil: "domcontentloaded" });
    await refuserCookies(page);
    const motif = /nouveau (RIB|compte)|changer (mon|de) (RIB|IBAN|compte)|changement d'IBAN/i;
    await expect(page.getByRole("link", { name: motif })).toHaveCount(0);
    await expect(page.getByRole("button", { name: motif })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(motif);
    await loginAsAdmin(page);
    await page.goto(`/fr/${ADMIN_PREFIX}/apporteurs/${a.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).not.toContainText(
      /demande de (changement|nouveau)|valider le (RIB|nouvel IBAN)/i,
    );
    await capturer(page, "p7-05-console-sans-ecran-rib");
  });

  test.fixme("7.4 demande de nouveau RIB dans l'espace, validation dans la console, refus, masquage sur l'écran de validation (à jouer quand les lots 5 et 6 seront livrés)", async () => {
    // Scénario cible : demande (RIB fictif FR76 valide) → e-mail de confirmation en file → confirmation par lien →
    // délai d'opposition → console : écran de validation (l'IBAN saisi n'est que comparé par empreinte, jamais
    // affiché en entier : seule la fin, 4 caractères) → valider / refuser → la fiche porte le nouvel IBAN masqué ;
    // un autre apporteur ne voit rien de la demande ; double clic = une seule demande ; champ vide refusé.
  });
});
