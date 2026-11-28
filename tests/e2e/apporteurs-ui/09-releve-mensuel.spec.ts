// Parcours 9 — relevé mensuel : pages de la console (liste des périodes, relevés d'une période, PDF),
// fiche de l'apporteur, RIEN d'envoyé (file BullMQ du Redis LOCAL), cloisonnement entre apporteurs.
// Les relevés FICTIFS sont créés par `monde.ts releve` (contenu calculé par le code de production,
// PDF rendu et déposé dans le faux R2) : la « préparation » n'a pas d'écran dans le code actuel (cf. rapport).
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

const base = `/fr/${ADMIN_PREFIX}/apporteurs/releves`;
let a: ApporteurMonde;
let b: ApporteurMonde;
let ra: { numero: string };
let rb: { numero: string };

test.describe.serial("@apporteur parcours 9 — relevé mensuel", () => {
  test.beforeAll(() => {
    a = apporteurMonde("rel-a");
    b = apporteurMonde("rel-b");
    ra = monde<{ numero: string }>("releve", { apporteurId: a.id, periode: "2026-10" });
    rb = monde<{ numero: string }>("releve", {
      apporteurId: b.id,
      periode: "2026-10",
      montantCents: 25_000,
    });
  });

  test("9.1 console : la période d'octobre 2026 liste les deux relevés, en lecture seule, avec leur PDF", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Périodes" })).toBeVisible();
    await capturer(page, "p9-01-console-periodes");
    await page.goto(`${base}/2026-10`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toContainText(/octobre 2026/i);
    await expect(page.locator("main")).toContainText(ra.numero);
    await expect(page.locator("main")).toContainText(rb.numero);
    await expect(page.locator("main")).toContainText("Lecture seule");
    // « Rien n'est envoyé sans clic » : aucune commande d'envoi ni de préparation n'est offerte.
    await expect(page.getByRole("button", { name: /envoyer|préparer|expédier/i })).toHaveCount(0);
    await capturer(page, "p9-02-console-releves-de-la-periode");
  });

  test("9.2 le PDF stocké s'ouvre (application/pdf) ; numéro inconnu, période invalide, sans session : refus nets", async ({
    page,
    browser,
  }) => {
    await loginAsAdmin(page);
    const ok = await page.request.get(`${base}/2026-10/pdf?numero=${ra.numero}`);
    expect(ok.status()).toBe(200);
    expect(ok.headers()["content-type"]).toContain("application/pdf");
    expect((await ok.body()).subarray(0, 4).toString()).toBe("%PDF");
    expect((await page.request.get(`${base}/2026-10/pdf?numero=REL-2026-10-0000`)).status()).toBe(
      404,
    );
    expect((await page.request.get(`${base}/2026-10/pdf?numero=n-importe-quoi`)).status()).toBe(
      400,
    );
    expect((await page.request.get(`${base}/2026-13/pdf?numero=${ra.numero}`)).status()).toBe(400);
    // La console répond « Page introuvable » (le statut HTTP est 200 : page d'erreur rendue dans le gabarit en flux).
    await page.goto(`${base}/2026-13`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Page introuvable")).toBeVisible();
    await capturer(page, "p9-03-console-periode-invalide");
    const anonyme = await browser.newContext();
    const sans = await anonyme.request.get(`${base}/2026-10/pdf?numero=${ra.numero}`, {
      maxRedirects: 0,
    });
    expect([401, 302, 307, 308, 403, 404]).toContain(sans.status());
    expect((await sans.body()).subarray(0, 4).toString()).not.toBe("%PDF");
    const p = await anonyme.newPage();
    await p.goto(`${base}/2026-10`, { waitUntil: "domcontentloaded" });
    expect(p.url()).toMatch(/login/);
    await capturer(p, "p9-04-console-sans-session");
    await anonyme.close();
  });

  test("9.3 fiche de l'apporteur : seulement ses relevés ; rien n'a été envoyé (file BullMQ vide de relevé)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`/fr/${ADMIN_PREFIX}/apporteurs/${a.id}`, { waitUntil: "domcontentloaded" });
    const main = page.locator("main");
    await expect(main).toContainText("Relevés mensuels (1)");
    await expect(main).toContainText(ra.numero);
    await expect(main).not.toContainText(rb.numero);
    await capturer(page, "p9-05-console-fiche-releves");
    expect((await emailsCaptures(ra.numero)).length, "aucun e-mail du relevé A en file").toBe(0);
    expect((await emailsCaptures(rb.numero)).length, "aucun e-mail du relevé B en file").toBe(0);
    expect(
      (await emailsCaptures(/apporteur-releve-mensuel/)).length,
      "aucune tâche de relevé en file",
    ).toBe(0);
    const rel = monde<Array<{ statut: string; envoyeAt: string | null }>>("releves-de", {
      apporteurId: a.id,
    });
    expect(rel.map((x) => x.statut)).toEqual(["prepare"]);
    expect(rel[0]!.envoyeAt).toBeNull();
  });

  test("9.4 l'espace de l'apporteur n'expose aucun relevé : ni page, ni numéro d'un autre ; lien d'un autre apporteur refusé", async ({
    page,
  }) => {
    await page.goto(a.lien, { waitUntil: "domcontentloaded" });
    await refuserCookies(page);
    await expect(page.locator("body")).not.toContainText(rb.numero);
    await expect(page.locator("body")).not.toContainText(ra.numero);
    const r = await page.goto(`${a.lien}/releves`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
    await capturer(page, "p9-06-espace-sans-releves");
    // Le jeton de B ne donne pas accès au dossier de A (IDOR).
    const jetonB = b.lien.split("/").pop()!;
    const idor = await page.goto(`/apporteur/dossier/${a.id}/${jetonB}`, {
      waitUntil: "domcontentloaded",
    });
    expect(idor?.status()).toBe(404);
    await expect(page.locator("body")).not.toContainText(rb.numero);
    await capturer(page, "p9-07-espace-jeton-d-un-autre");
  });
});
