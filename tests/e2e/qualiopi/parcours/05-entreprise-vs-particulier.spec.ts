/**
 * PARCOURS 5 — Client ENTREPRISE puis client PARTICULIER, joués côte à côte.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md` :
 * « joués côte à côte pour exposer les divergences ».
 *
 * ⚠️ CADRAGE — le B2C n'est pas pratiqué par l'organisme (décision Will). Ce
 * parcours vérifie donc que l'écran ne MENT pas sur ce qu'il propose : si le
 * type « Particulier (B2C — CPF perso) » existe dans le formulaire, il doit
 * mener quelque part. Il ne conclut RIEN sur la couverture réglementaire du
 * B2C — cette question se pose à Will avant d'être rapportée, pas après.
 *
 * Ce qui est vérifié ici :
 *  - les deux types de clients se créent réellement ;
 *  - le formulaire ADAPTE ses libellés (« Raison sociale » ↔ « Nom complet »),
 *    car demander une raison sociale à une personne physique est le genre de
 *    détail qui traverse jusqu'à la convention et la facture.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import { admin, champEtiquete, ENREGISTREMENT } from "./_communs";

async function creerClient(
  page: import("@playwright/test").Page,
  type: "entreprise" | "particulier",
  nom: string,
): Promise<string> {
  await page.goto(admin("qualiopi/clients/new"), { waitUntil: "networkidle", timeout: 90_000 });

  const selecteur = await champEtiquete(page, "c-type", /Type de client/);
  await selecteur.selectOption(type);

  // 🔴 Le libellé du champ suivant DÉPEND du type, et React le recalcule au
  // rendu SUIVANT. Le lire immédiatement après `selectOption` renvoyait celui de
  // l'état PRÉCÉDENT : le parcours accusait le formulaire de demander une
  // « Raison sociale » à un particulier alors qu'il ne le fait pas.
  //
  // 🔑 Lire une valeur dérivée d'un état React juste après l'avoir changé, c'est
  // lire l'ancien état. On attend que la valeur ait bougé — et le message dit
  // quoi faire si elle ne bouge jamais.
  const lireLibelle = async (): Promise<string> =>
    page.evaluate(() => {
      const l = document.querySelector('label[for="c-raison"]');
      return (l?.textContent ?? "").replace(/\s+/g, " ").trim();
    });
  const attendu = type === "particulier" ? /Nom complet|Prénom/i : /Raison sociale/i;
  await expect
    .poll(lireLibelle, {
      timeout: 15_000,
      message:
        `le libellé du champ principal ne s'est jamais adapté au type « ${type} » — ` +
        "soit le formulaire ne distingue pas les deux, soit il n'est pas hydraté",
    })
    .toMatch(attendu);
  const libelle = await lireLibelle();

  await page.locator("#c-raison").fill(nom);
  await page.getByRole("button", { name: "Créer le client" }).click();
  await page.waitForURL(/\/qualiopi\/clients(\/[0-9a-f-]{36})?/, { timeout: 60_000 });
  return libelle;
}

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 5 — entreprise et particulier, côte à côte", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("les deux types de clients se créent, et le formulaire s'adapte", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    const marque = Date.now();
    const libelleEntreprise = await creerClient(page, "entreprise", `E2E ENTREPRISE ${marque}`);
    const libelleParticulier = await creerClient(page, "particulier", `E2E Particulier ${marque}`);

    await info.attach("libelles-par-type.json", {
      body: JSON.stringify({ libelleEntreprise, libelleParticulier }, null, 2),
      contentType: "application/json",
    });

    // 🔑 La divergence attendue : on ne demande pas une « raison sociale » à une
    // personne physique. Si les deux libellés sont identiques, l'écran traite un
    // particulier comme une entreprise — et cette confusion voyage jusqu'à la
    // convention et la facture.
    expect(
      libelleParticulier,
      `le formulaire demande « ${libelleParticulier} » à un PARTICULIER — ` +
        `même libellé que pour une entreprise (« ${libelleEntreprise} »)`,
    ).not.toBe(libelleEntreprise);
    expect(libelleEntreprise).toMatch(/Raison sociale/i);
    expect(libelleParticulier).toMatch(/Nom complet|Prénom/i);

    // Les deux fiches doivent exister dans la liste : un formulaire qui accepte
    // sans écrire est le défaut que cet audit a déjà rencontré ailleurs.
    await page.goto(admin("qualiopi/clients"), { waitUntil: "networkidle", timeout: 90_000 });
    const corps = page.locator("body");
    await expect(corps, "le client entreprise n'apparaît pas dans la liste").toContainText(
      `E2E ENTREPRISE ${marque}`,
    );
    await expect(corps, "le client particulier n'apparaît pas dans la liste").toContainText(
      `E2E Particulier ${marque}`,
    );
  });
});
