// Le tunnel apporteurs, DE BOUT EN BOUT — du formulaire à la ligne en base.
//
// Ce que ce fichier prouve et qu'aucun test unitaire ne peut prouver :
//   · la page publique s'affiche et le formulaire est réellement utilisable ;
//   · la soumission écrit une ligne, et le visiteur atterrit sur « merci » ;
//   · cette ligne porte `contactEmailHash` — la clé sans laquelle l'export
//     art. 15 et l'effacement art. 17 « renvoyaient VIDE en répondant succès ».
//     Deux formulaires sur six l'oubliaient jusqu'au 2026-09-04.
//   · l'ancienne URL `/facebook` redirige au lieu de rendre une page.
//
// 🔑 Le troisième point est le seul qui compte vraiment : une garde de code
// prouve que la LIGNE EST ÉCRITE dans le fichier source. Elle ne prouve pas que
// la colonne est REMPLIE une fois la chaîne complète traversée — encryptage,
// Prisma, Postgres. C'est ce que ce test regarde, et rien d'autre ne le regarde.
//
// Pré-requis : serveur de dev sur une base réelle SEMÉE, `E2E_BASE_URL` posé.

import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../prisma/generated/client/index.js";
import { hashEmailForLookup } from "../../../src/lib/security/email-hash";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("@tunnel-apporteur parcours public", () => {
  // Sous `next dev`, chaque route se compile au premier appel.
  test.setTimeout(240_000);

  test("l'ancienne URL redirige, elle ne rend plus de page", async ({ page }) => {
    // Une publicité déjà diffusée pointe encore `/fr/facebook`. Si cette URL
    // rendait une page, on aurait DEUX pages concurrentes pour le même tunnel —
    // et le gating du pixel Meta ne couvrirait que l'une des deux.
    await page.goto("/fr/facebook");
    await expect(page).toHaveURL(/\/fr\/apporteur-affaires$/);
  });

  test("la page affiche le montant, le formulaire, et ne nomme aucun statut de mandataire", async ({
    page,
  }) => {
    await page.goto("/fr/apporteur-affaires");

    // Le montant est l'accroche des deux premières secondes.
    await expect(page.getByText("500", { exact: false }).first()).toBeVisible();

    // ⛔ « agent commercial » est un statut de MANDATAIRE. L'article 1.2 du
    // contrat repose sur « aucun mandat », et le registre des risques du contrat
    // dit qu'une telle mention « détruirait la portée des articles 1 et 2 ».
    //
    // 🔴 ON LIT LE HTML SERVI, PAS LE TEXTE VISIBLE. Ma première version lisait
    // `body.innerText()` — et la FAQ vit dans des `<details>` REPLIÉS, dont
    // `innerText` ne rend rien. Les deux assertions négatives étaient donc
    // VIDES : elles auraient passé même avec « agent commercial » écrit dans la
    // réponse, puisqu'elles ne le voyaient pas. C'est l'assertion positive qui
    // a trahi le défaut, en échouant sur un texte pourtant bien présent.
    //
    // La leçon vaut au-delà de ce fichier : une garde qui lit le texte VISIBLE
    // ne garde rien de ce qui est replié, masqué ou hors écran — et elle est
    // verte en le taisant.
    const html = (await page.content()).toLowerCase();
    expect(html, "statut de mandataire nommé dans la page").not.toContain("agent commercial");
    expect(html).toContain("micro-entreprise ou soci");

    // Les quatre champs annoncés — « 4 champs, 30 secondes ».
    // Ciblés par leur `name` : c'est le contrat que la Server Action lit, donc
    // le seul repère qui casse si le formulaire change vraiment. Un libellé se
    // reformule sans rien casser côté serveur.
    for (const champ of ["prenom", "email", "telephone", "ville"]) {
      await expect(page.locator(`[name="${champ}"]`), `champ ${champ}`).toBeVisible();
    }
    // ⛔ Et la case de consentement : sans elle, la preuve d'opt-in n'existe pas.
    await expect(page.locator('[name="consent"]')).toBeVisible();
  });

  test("une candidature envoyée arrive en base AVEC sa clé de personne", async ({ page }) => {
    const email = `recette-${Date.now()}@exemple-test.invalid`;

    await page.goto("/fr/apporteur-affaires");
    await page.locator('[name="prenom"]').fill("Recette");
    await page.locator('[name="email"]').fill(email);
    await page.locator('[name="telephone"]').fill("0612345678");
    await page.locator('[name="ville"]').fill("Grenoble");
    // 🔑 La case de consentement est OBLIGATOIRE. Ma première version du test
    // l'oubliait et la soumission ne partait pas — le formulaire avait raison,
    // c'est le test qui était faux. Sans opt-in, aucune preuve de consentement
    // n'est enregistrée, et la candidature ne doit pas exister.
    await page.locator('[name="consent"]').check();
    await page.locator('[data-cta="facebook-lead-submit"]').click();

    // Le visiteur atterrit sur la page « merci ».
    await page.waitForURL(/\/apporteur-affaires\/merci/, { timeout: 120_000 });

    // ── Ce que la base a réellement écrit.
    const empreinte = hashEmailForLookup(email);
    expect(empreinte, "IP_HASH_SALT absent : l'empreinte ne peut pas être calculée").not.toBeNull();

    const ligne = await prisma.submission.findFirst({
      where: { contactEmailHash: empreinte },
      select: { id: true, contactEmailHash: true, details: true },
      orderBy: { submittedAt: "desc" },
    });

    // 🔑 C'est L'ASSERTION QUI COMPTE. Avant le correctif du 2026-09-04, cette
    // recherche par empreinte ne rendait RIEN — la ligne existait, mais était
    // introuvable par son adresse. L'effacement RGPD répondait « succès » en
    // n'effaçant rien.
    expect(
      ligne,
      "candidature introuvable par son empreinte d'e-mail — `contactEmailHash` n'a pas été écrit, " +
        "donc l'export art. 15 et l'effacement art. 17 la rateront en silence",
    ).not.toBeNull();
    expect(ligne?.contactEmailHash).toBe(empreinte);

    // Et elle est bien rangée dans la file console du tunnel.
    const details = ligne?.details as unknown as { unifiedType?: string; etape?: string };
    expect(details?.unifiedType).toBe("recrutement");
    expect(details?.etape).toBe("premier-contact");
  });
});
