// T-3 — Score IA TPE-PME (`/fr/diagnostic`), Playwright (Gate B). Plan V2-10 §7 PR-3.
//
//  1. Parcours complet SANS cocher la case : on écoute TOUTES les requêtes depuis le chargement.
//     Aucune requête POST, aucune en-tête `Next-Action`, aucune URL ni aucun corps contenant un
//     slug de réponse, aucune requête vers `challenges.cloudflare.com` ; le score s'affiche.
//  2. Parcours AVEC la case : exactement UNE requête `Next-Action` ; puis le code de retrait
//     s'affiche (si la base de Gate B est joignable).
//  3. Base disponible : `count(barometer_responses)` inchangé après (1), +1 après (2).
//
// Seule exception à « aucun POST » : l'émetteur d'audience (Plausible, sans cookie), qui ne porte
// AUCUNE réponse ni score (propriétés interdites) ; il est écarté de la liste, pas des contrôles de
// contenu : ses URL et corps sont vérifiés comme les autres.

import { test, expect, type Page, type Request } from "@playwright/test";

const PAGE = "/fr/diagnostic";

const baseDisponible =
  !!process.env["DATABASE_URL"] && !process.env["DATABASE_URL"].includes("stub.invalid");

/** Slugs qui n'existent que dans les réponses : leur présence dans une requête = fuite. */
const SLUGS_DE_REPONSE = ["scaled", "formalized", "gt_100k", "strong_increase", "conseil-affaires"];

const REPONSES: Array<[string, string[]]> = [
  ["companySize", ["PME"]],
  ["maturityLevel", ["scaled"]],
  ["useCases", ["automation", "content"]],
  ["tools", ["chatgpt"]],
  ["timeSavedPerDay", ["h1_2"]],
  ["teamTrained", ["informal"]],
  ["hasStrategy", ["formalized"]],
  ["annualBudget", ["gt_100k"]],
  ["barriers", ["budget"]],
  ["rgpdConcern", ["little"]],
  ["competitorsUseAi", ["probably"]],
  ["investmentIntent", ["strong_increase"]],
  ["sector", ["conseil-affaires"]],
  ["region", ["non-precisee"]],
  ["respondentRole", ["ceo_founder"]],
];

function ecouter(page: Page): Request[] {
  const requetes: Request[] = [];
  page.on("request", (r) => requetes.push(r));
  return requetes;
}

/**
 * Âge minimal du parcours exigé par le serveur (`MIN_FILL_MS` = 3 s dans la Server Action,
 * anti-robot : en dessous, elle rend `{ ok: true }` SANS écrire). Marge de 0,5 s : l'instant
 * mesuré ici précède de quelques ms celui que l'écran retient au clic sur « Commencer ».
 */
const AGE_MINIMAL_PARCOURS_MS = 3500;

async function parcourir(page: Page): Promise<number> {
  const debut = Date.now();
  await page.getByRole("button", { name: "Commencer" }).click();
  for (const [nom, valeurs] of REPONSES) {
    for (const v of valeurs) {
      await page.locator(`input[name="${nom}"][value="${v}"]`).check();
    }
    await page.getByRole("button", { name: /Suivant|Voir mon score/ }).click();
  }
  await expect(page.getByRole("heading", { name: "Votre score" })).toBeVisible();
  return debut;
}

/** Clique au centre de l'écran : l'en-tête collant du site ne doit pas intercepter le clic. */
async function cliquerAuCentre(page: Page, nom: string): Promise<void> {
  const bouton = page.getByRole("button", { name: nom });
  await bouton.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await bouton.click();
}

async function compter(): Promise<number | null> {
  if (!baseDisponible) return null;
  const { PrismaClient } = await import("../../prisma/generated/client/index.js");
  const prisma = new PrismaClient();
  try {
    return await prisma.barometerResponse.count();
  } finally {
    await prisma.$disconnect();
  }
}

test.describe("Score IA TPE-PME — rien ne part sans la case", () => {
  test("1. parcours complet sans cocher : aucune requête d'envoi, aucune réponse dans le trafic", async ({
    page,
  }) => {
    const avant = await compter();
    const requetes = ecouter(page);

    await page.goto(PAGE);
    await parcourir(page);
    await expect(page.getByText(/sur 100/)).toBeVisible();
    await expect(page.getByText(/^Niveau :/)).toBeVisible();

    // Clic sur le bouton SANS la case : message, et toujours rien dans le réseau.
    await cliquerAuCentre(page, "Ajouter mes réponses");
    await expect(page.getByRole("alert").filter({ hasText: "Cochez la case" })).toBeVisible();
    await page.waitForTimeout(500);

    const posts = requetes.filter((r) => r.method() === "POST");
    expect(
      posts.map((r) => r.url()),
      "aucune requête POST",
    ).toEqual([]);
    expect(
      requetes.filter((r) => r.headers()["next-action"] !== undefined).map((r) => r.url()),
      "aucune Server Action",
    ).toEqual([]);
    expect(
      requetes.filter((r) => r.url().includes("challenges.cloudflare.com")).map((r) => r.url()),
      "aucun Turnstile avant la case",
    ).toEqual([]);
    for (const r of requetes) {
      const contenu = `${r.url()} ${r.postData() ?? ""}`;
      for (const slug of SLUGS_DE_REPONSE) {
        expect(contenu, `fuite de « ${slug} » dans ${r.method()} ${r.url()}`).not.toContain(slug);
      }
    }
    // Rien non plus dans l'URL de la page.
    expect(page.url()).not.toMatch(/scaled|formalized|gt_100k/);

    const apres = await compter();
    if (avant !== null) expect(apres).toBe(avant);
  });

  test("2. parcours avec la case : exactement une Server Action, puis le code de retrait", async ({
    page,
  }) => {
    const avant = await compter();
    const requetes = ecouter(page);

    await page.goto(PAGE);
    const debut = await parcourir(page);
    await page.getByRole("checkbox", { name: /J'accepte que mes réponses/ }).check();
    // Un parcours plus court que `MIN_FILL_MS` serait pris pour un robot (succès sans écriture) :
    // on attend l'âge réel du parcours, pas un délai fixe.
    await expect.poll(() => Date.now() - debut).toBeGreaterThanOrEqual(AGE_MINIMAL_PARCOURS_MS);
    // La Server Action n'est tentée qu'une fois le jeton prêt (clé de site absente : sans widget).
    await cliquerAuCentre(page, "Ajouter mes réponses");
    await expect
      .poll(() => requetes.filter((r) => r.headers()["next-action"] !== undefined).length)
      .toBe(1);

    if (baseDisponible) {
      await expect(page.getByText("Merci, vos réponses ont été ajoutées.")).toBeVisible();
      await expect(page.getByText("Votre code de retrait")).toBeVisible();
      const apres = await compter();
      expect(apres).toBe((avant ?? 0) + 1);
    }
  });

  test("la page d'accueil est indexable et le score n'est pas calculé côté serveur", async ({
    page,
  }) => {
    const reponse = await page.goto(PAGE);
    expect(reponse?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("Score IA TPE-PME");
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("button", { name: "Commencer" })).toBeVisible();
  });
});
