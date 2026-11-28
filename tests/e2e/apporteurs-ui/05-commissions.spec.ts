// Parcours 5 — commissions : facture payée à 100 % → commission due → « Mes commissions » ;
// Journée IA au prorata ; coaching et conférence ; avoir (avertissement + confirmation) ; bon d'achat.
// Données fictives. Les commandes payées sont créées en base locale (`monde.ts`), le passage horaire du
// worker est joué par `monde.ts passage-horaire` ; tout le reste passe par l'interface.
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";
import { refuserCookies } from "./outillage/aides";
import { apporteurMonde, capturer, monde, type ApporteurMonde } from "./outillage/campagne";

test.describe.configure({ timeout: 300_000 });
test.skip(
  process.env["APPORTEUR_BAC_A_SABLE"] !== "1",
  "bac à sable seulement : poser APPORTEUR_BAC_A_SABLE=1",
);
test.use({ viewport: { width: 1280, height: 900 } });

interface Commande {
  presentationId: string;
  factureId: string;
  denomination: string;
}
interface Ligne {
  id: string;
  statut: string;
  montantCents: number | null;
  activite: string;
  palier: string | null;
  autofactureNumero: string | null;
  factureId: string;
}
const lignes = (id: string): Ligne[] => monde<Ligne[]>("commissions", { apporteurId: id });
const consoleCommissions = (statut: string): string =>
  `/fr/${ADMIN_PREFIX}/apporteurs/commissions?statut=${statut}`;

async function carte(page: Page, denomination: string) {
  const c = page.locator("article", { hasText: denomination }).first();
  await expect(c).toBeVisible({ timeout: 30_000 });
  return c;
}

let ap: ApporteurMonde;
let formation: Commande;

test.describe.serial("@apporteur parcours 5 — commissions", () => {
  test.beforeAll(() => {
    ap = apporteurMonde("comm");
    monde("identite-of"); // SIRET et adresse du siège FICTIFS : requis pour émettre un avoir
  });

  test("5.1 facture payée à 100 % : commission « à qualifier », qualifiée par la console, due et facturée", async ({
    page,
  }) => {
    formation = monde<Commande>("commande", {
      apporteurId: ap.id,
      activite: "formation",
      montantHtCents: 150_000,
    });
    monde("passage-horaire");
    expect(lignes(ap.id).map((l) => l.statut)).toEqual(["a_qualifier"]);
    // L'espace : « Payée par le client. Montant en cours de calcul. »
    await page.goto(`${ap.lien}/mes-commissions`, { waitUntil: "domcontentloaded" });
    await refuserCookies(page);
    await expect(page.getByText("Montant en cours de calcul")).toBeVisible();
    await capturer(page, "p5-01-espace-a-qualifier");
    await loginAsAdmin(page);
    await page.goto(consoleCommissions("a_qualifier"), { waitUntil: "domcontentloaded" });
    const c = await carte(page, formation.denomination);
    await capturer(page, "p5-02-console-a-qualifier");
    await c.getByLabel("Palier de formation").selectOption({ index: 1 });
    await c.getByRole("button", { name: "Qualifier" }).click();
    await expect.poll(() => lignes(ap.id)[0]!.statut, { timeout: 60_000 }).toBe("due");
    monde("passage-horaire");
    const l = lignes(ap.id)[0]!;
    expect(l.autofactureNumero, "l'autofacture part avec le passage horaire").toMatch(/^AXI-APP-/);
    expect(l.montantCents).toBeGreaterThan(0);
    await page.goto(`${ap.lien}/mes-commissions`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Commission due · facture n° AXI-APP/)).toBeVisible();
    await capturer(page, "p5-03-espace-commission-due");
  });

  test("5.2 « Virement fait » dans la console : l'espace passe à « Réglée le … »", async ({
    page,
  }) => {
    const numero = lignes(ap.id)[0]!.autofactureNumero!;
    await loginAsAdmin(page);
    await page.goto(consoleCommissions("due"), { waitUntil: "domcontentloaded" });
    await expect(page.getByText("💶 Virements à faire")).toBeVisible();
    const ligneVirement = page.locator("li", { hasText: numero }).first();
    await expect(ligneVirement).toBeVisible();
    await capturer(page, "p5-04-console-virement-a-faire");
    // Sans la case : la validation du navigateur bloque (rien ne part).
    await ligneVirement.getByRole("button", { name: "Virement fait" }).click();
    expect(lignes(ap.id)[0]!.statut).toBe("due");
    await ligneVirement.getByLabel(/Virement de .* fait/).check();
    await ligneVirement.getByRole("button", { name: "Virement fait" }).click();
    await expect.poll(() => lignes(ap.id)[0]!.statut, { timeout: 60_000 }).toBe("versee");
    await page.goto(`${ap.lien}/mes-commissions`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Réglée le \d/)).toBeVisible();
    await capturer(page, "p5-05-espace-reglee");
  });

  test("5.3 Journée IA : 500 € pour le prix plein, au prorata du prix payé sinon", async ({
    page,
  }) => {
    const plein = monde<Commande>("commande", {
      apporteurId: ap.id,
      journeeIa: true,
      montantHtCents: 149_000,
    });
    const moitie = monde<Commande>("commande", {
      apporteurId: ap.id,
      journeeIa: true,
      montantHtCents: 74_500,
    });
    monde("passage-horaire");
    const parFacture = new Map(lignes(ap.id).map((l) => [l.factureId, l]));
    expect(parFacture.get(plein.factureId)).toMatchObject({
      palier: "journee-ia",
      montantCents: 50_000,
    });
    expect(parFacture.get(moitie.factureId)).toMatchObject({
      palier: "journee-ia",
      montantCents: 25_000,
    });
    await page.goto(`${ap.lien}/mes-commissions`, { waitUntil: "domcontentloaded" });
    const cartePleine = page.locator("li", { hasText: plein.denomination });
    const carteMoitie = page.locator("li", { hasText: moitie.denomination });
    await expect(cartePleine).toContainText(/500[,.]00/);
    await expect(carteMoitie).toContainText(/250[,.]00/);
    await capturer(page, "p5-06-espace-journee-ia");
  });

  test("5.4 coaching (1-to-1) : aucune ligne de commission, rien dans « Mes commissions »", async ({
    page,
  }) => {
    const coaching = monde<Commande>("commande", {
      apporteurId: ap.id,
      activite: "un_a_un",
      montantHtCents: 100_000,
    });
    monde("passage-horaire");
    expect(
      lignes(ap.id).find((x) => x.factureId === coaching.factureId),
      "coaching = 0 € : aucune ligne",
    ).toBeUndefined();
    await page.goto(`${ap.lien}/mes-commissions`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Commission : [1-9]/).first()).toBeVisible(); // les autres lignes, elles, y sont
    await expect(page.locator("li", { hasText: coaching.denomination })).not.toContainText(
      /Commission : [1-9]/,
    );
    await capturer(page, "p5-07-espace-coaching");
  });

  test("5.5 conférence : qualifiée « Conférence » par la console, 0 € « ne donne pas de commission »", async ({
    page,
  }) => {
    // Facture d'activité inconnue : la console la « classe » (le palier Conférence n'existe pas dans la
    // qualification d'une formation : une conférence se classe, elle ne se qualifie pas).
    const conf = monde<Commande>("commande", {
      apporteurId: ap.id,
      activite: null,
      montantHtCents: 100_000,
      accepteIlYAJours: 0, // signée APRÈS le 26/11/2026 : plus aucune commission sur une conférence
    });
    monde("passage-horaire");
    await loginAsAdmin(page);
    await page.goto(consoleCommissions("a_qualifier"), { waitUntil: "domcontentloaded" });
    const c = await carte(page, conf.denomination);
    await capturer(page, "p5-08-console-activite-inconnue");
    await c.getByLabel("Activité de la facture (inconnue)").selectOption("conference");
    await c.getByRole("button", { name: "Classer" }).click();
    await page.waitForTimeout(4000);
    monde("passage-horaire");
    const l = lignes(ap.id).find((x) => x.factureId === conf.factureId);
    // « Aucune ligne » (règle du code) ou une ligne à 0 € : jamais un montant.
    expect(l?.montantCents ?? 0, "conférence = 0 €").toBe(0);
    await capturer(page, "p5-08b-console-apres-classement");
    await page.goto(`${ap.lien}/mes-commissions`, { waitUntil: "domcontentloaded" });
    await capturer(page, "p5-09-espace-conference");
    await expect(page.locator("li", { hasText: conf.denomination })).not.toContainText(
      /Commission : [1-9]/,
    );
  });

  test("5.6 conférence signée AVANT le 26/11/2026 : garde le forfait de l'ancien contrat (500 €)", async ({
    page,
  }) => {
    const ancienne = monde<Commande>("commande", {
      apporteurId: ap.id,
      activite: null,
      montantHtCents: 100_000,
      accepteIlYAJours: 5,
    });
    monde("passage-horaire");
    await loginAsAdmin(page);
    await page.goto(consoleCommissions("a_qualifier"), { waitUntil: "domcontentloaded" });
    const c = await carte(page, ancienne.denomination);
    await c.getByLabel("Activité de la facture (inconnue)").selectOption("conference");
    await c.getByRole("button", { name: "Classer" }).click();
    await page.waitForTimeout(4000);
    monde("passage-horaire");
    expect(lignes(ap.id).find((x) => x.factureId === ancienne.factureId)?.montantCents).toBe(
      50_000,
    );
    await capturer(page, "p5-09b-console-conference-ancienne");
  });

  test("5.7 avoir partiel dans la console : avertissement, confirmation exigée, commission reprise au prorata", async ({
    page,
  }) => {
    const f = monde<Commande>("commande", {
      apporteurId: ap.id,
      journeeIa: true,
      montantHtCents: 149_000,
    });
    monde("passage-horaire");
    const avant = lignes(ap.id).filter((x) => x.factureId === f.factureId);
    expect(avant.map((x) => x.montantCents)).toEqual([50_000]);
    // Une réduction partielle d'une commission facturée mais pas encore versée attend le virement
    // (la reprise suit) : on marque d'abord le virement fait, dans la console.
    await loginAsAdmin(page);
    const numero = avant[0]!.autofactureNumero!;
    await page.goto(consoleCommissions("due"), { waitUntil: "domcontentloaded" });
    const virement = page.locator("li", { hasText: numero }).first();
    await virement.getByLabel(/Virement de .* fait/).check();
    await virement.getByRole("button", { name: "Virement fait" }).click();
    await expect
      .poll(() => lignes(ap.id).find((x) => x.factureId === f.factureId)!.statut, {
        timeout: 60_000,
      })
      .toBe("versee");
    await page.goto(`/fr/${ADMIN_PREFIX}/qualiopi/facturation/${f.factureId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: "Émettre un avoir" }).click();
    await page.locator("#avoir-motif").fill("Remboursement partiel fictif (test)");
    await page.getByLabel("Avoir partiel (sinon avoir total)").check();
    await page.locator("#avoir-montant").fill("745.00");
    const alerte = page.getByRole("alert").filter({ hasText: "commission d'apporteur" });
    await expect(alerte).toBeVisible();
    await expect(alerte).toContainText("bon d'achat");
    await capturer(page, "p5-10-console-avoir-avertissement");
    // Sans la confirmation : refusé, rien n'est émis.
    await page.getByRole("button", { name: "Émettre l'avoir" }).click();
    await page.waitForTimeout(3000);
    await expect(page.getByText(/Avoir .* émis/)).toHaveCount(0);
    await capturer(page, "p5-11-console-avoir-sans-confirmation");
    await page.getByLabel("Je confirme : c'est un vrai remboursement").check();
    await page.getByRole("button", { name: "Émettre l'avoir" }).click();
    // Le message « Avoir … émis » disparaît au rafraîchissement : l'avoir se lit dans la section « Avoirs ».
    await expect(page.getByText(/AXI-AVO-\d{4}-\d+/).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("-894,00 €")).toBeVisible();
    await capturer(page, "p5-12-console-avoir-emis");
    monde("passage-quotidien"); // l'étape « avoirs-clients » du passage quotidien reprend la commission
    // La ligne d'origine (versée) reste ; une ligne de REPRISE (montant négatif) y renvoie par son palier.
    const toutes = lignes(ap.id);
    const origine = toutes.find((x) => x.factureId === f.factureId)!;
    const reprises = toutes.filter((x) => x.palier === `reprise-de:${origine.id}`);
    expect(reprises, "une reprise est enregistrée").toHaveLength(1);
    expect(reprises[0]).toMatchObject({ statut: "reprise", montantCents: -25_000 });
    const net = (origine.montantCents ?? 0) + (reprises[0]!.montantCents ?? 0);
    expect(net, "commission nette au prorata du remboursement").toBe(25_000);
    await page.goto(`${ap.lien}/mes-commissions`, { waitUntil: "domcontentloaded" });
    await capturer(page, "p5-13-espace-apres-avoir");
  });

  test("5.8 bon d'achat (pas d'avoir) : la commission est gardée en entier", async () => {
    const f = monde<Commande>("commande", {
      apporteurId: ap.id,
      journeeIa: true,
      montantHtCents: 149_000,
    });
    monde("passage-horaire");
    // Un bon d'achat offert ne s'émet pas comme avoir (l'avertissement du 5.7 le dit) : aucune écriture.
    monde("passage-horaire");
    const l = lignes(ap.id).filter((x) => x.factureId === f.factureId);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ statut: "due", montantCents: 50_000 });
  });
});
