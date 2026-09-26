// Le guide IA, DE BOUT EN BOUT — demande → e-mail → POST → PDF (lot L2, 2026-09-24).
//
// Ce que ce fichier prouve et qu'aucun test unitaire ne peut prouver :
//   · la page du guide sert un formulaire « Votre e-mail » ; pour une adresse
//     professionnelle, aucune case, et la mention d'information (amendement de
//     Will du 24/09) avec le lien vers la politique ;
//   · le lien personnel de l'e-mail, servi par le vrai serveur sur une vraie
//     base : un GET pose « vu » et JAMAIS « cliqué » (un antivirus suit les GET) ;
//     le POST du bouton pose « cliqué » et redirige (303) vers le PDF, qui existe ;
//   · un jeton inconnu répond 404.
//
// ⚠️ L'étape « e-mail » est représentée par la LIGNE `guide_requests` et son
// jeton — exactement ce que l'e-mail transporte. Le formulaire lui-même exige
// un Turnstile réel (décision D3 : bloquant), que la CI ne peut pas résoudre ;
// la chaîne « formulaire → ligne » est couverte par le test d'intégration
// `tests/integration/server-actions.test.ts` et par les tests de l'action.
//
// Pré-requis : serveur sur une base réelle migrée, `E2E_BASE_URL` ou webServer.
// Adresses en `@example.invalid` uniquement (dépôt public).

import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../prisma/generated/client/index.js";
import { hashEmailForLookup } from "../../../src/lib/security/email-hash";

const prisma = new PrismaClient();
const creees: string[] = [];

test.afterAll(async () => {
  if (creees.length > 0) {
    await prisma.guideRequest.deleteMany({ where: { id: { in: creees } } });
  }
  await prisma.$disconnect();
});

async function semerDemande(): Promise<{ id: string; jeton: string }> {
  const email = `recette-guide-${Date.now()}-${randomBytes(3).toString("hex")}@example.invalid`;
  const jeton = randomBytes(32).toString("hex");
  const ligne = await prisma.guideRequest.create({
    data: {
      email,
      emailKey: hashEmailForLookup(email) as string,
      aimant: "guide-ia",
      origine: "formulaire",
      source: "guide-ia",
      locale: "fr",
      version: "guide-mention-pro-v1-2026-09-24",
      downloadToken: jeton,
      queuedAt: new Date(),
    },
    select: { id: true },
  });
  creees.push(ligne.id);
  return { id: ligne.id, jeton };
}

test.describe("@guide-ia parcours du guide", () => {
  test.setTimeout(240_000);

  test("la page sert le formulaire : « Votre e-mail », mention d'information et politique visibles", async ({
    page,
  }) => {
    await page.goto("/fr/guide-ia");
    const champ = page.locator('input[name="email"]').first();
    await expect(champ).toBeVisible();
    await expect(page.getByText("Votre e-mail").first()).toBeVisible();
    // Adresse professionnelle (amendement de Will du 24/09) : AUCUNE case, la
    // mention annonce l'inscription et la désinscription en un clic. La case
    // des adresses personnelles est couverte par les tests unitaires (liste
    // des webmails testée par domaine : aucune adresse réelle dans un test).
    await champ.fill("recette@example.invalid");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(
      page.getByText("En recevant le guide, vous recevrez aussi 1 à 2 e-mails par mois").first(),
    ).toBeVisible();
    await expect(page.getByText("Politique de confidentialité").first()).toBeVisible();
    const html = await page.content();
    expect(html).not.toMatch(/newsletter mensuelle/i);
  });

  test("🔴 lien personnel : GET = vu (jamais cliqué), POST = cliqué puis 303 vers le PDF", async ({
    request,
  }) => {
    const { id, jeton } = await semerDemande();

    // 1. Le GET (ce que fait un antivirus en ouvrant le lien).
    const vu = await request.get(`/api/guide-ia/telecharger?t=${jeton}`);
    expect(vu.status()).toBe(200);
    expect(vu.headers()["x-robots-tag"]).toContain("noindex");
    const html = await vu.text();
    expect(html).toContain('method="post"');
    expect(html).not.toMatch(/<script/i);

    let ligne = await prisma.guideRequest.findUniqueOrThrow({
      where: { id },
      select: { firstSeenAt: true, firstClickAt: true },
    });
    expect(ligne.firstSeenAt, "le GET doit poser « vu »").not.toBeNull();
    expect(ligne.firstClickAt, "🔴 un GET ne vaut JAMAIS clic").toBeNull();

    // 2. Le POST du bouton (le geste humain).
    const clic = await request.post("/api/guide-ia/telecharger", {
      form: { t: jeton },
      maxRedirects: 0,
    });
    expect(clic.status()).toBe(303);
    const cible = clic.headers()["location"] ?? "";
    expect(cible).toContain("/imprimes/guide-ia-entreprise-2026-axion-ia.pdf");

    ligne = await prisma.guideRequest.findUniqueOrThrow({
      where: { id },
      select: { firstSeenAt: true, firstClickAt: true },
    });
    expect(ligne.firstClickAt, "le POST doit poser « cliqué »").not.toBeNull();

    // 3. Le PDF visé existe bien sur ce serveur.
    const pdf = await request.get(new URL(cible).pathname);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
  });

  test("jeton inconnu : 404", async ({ request }) => {
    const r = await request.get(`/api/guide-ia/telecharger?t=${randomBytes(32).toString("hex")}`);
    expect(r.status()).toBe(404);
  });
});
