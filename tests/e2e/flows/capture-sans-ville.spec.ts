// L'étape de CAPTURE ne demande que ce sans quoi on ne peut pas rappeler.
//
// ── Pourquoi un fichier à part ────────────────────────────────────────────
// La recette du tunnel (`tunnel-apporteur-bout-en-bout.spec.ts`) arrive par une
// PR parallèle. Y ajouter cette assertion la ferait dépendre de celle-ci, et
// chacune serait verte contre `main` en cassant à leur rencontre — le défaut
// qu'aucune CI ne voit, puisque les gates évaluent le commit de fusion avec
// `main`, jamais avec les autres PR en vol.
//
// Ce fichier ne dépend d'aucun autre. Il teste une page publique, sans session.
//
// ── Ce qu'il verrouille ───────────────────────────────────────────────────
// Décision de Will du 2026-09-04 : la ville sort de la CAPTURE et reste au
// DOSSIER, où elle est obligatoire. Ce n'est pas une suppression de donnée,
// c'est un déplacement — et la garde doit dire les deux, sinon quelqu'un la
// remettra « parce qu'elle manque ».

import { expect, test } from "@playwright/test";

// 🔑 Sous `next dev`, la PREMIÈRE navigation vers une route la COMPILE — 30 s à
// 3 min sur un poste chargé. Le délai de navigation par défaut (30 s) est plus
// court que celui du test, si bien que l'échec accuse la page au lieu de la
// compilation. Chaque `goto` porte donc sa propre borne, explicite.

test.describe("@capture le mini formulaire du tunnel", () => {
  // Sous `next dev`, la route se compile au premier appel.
  test.setTimeout(240_000);

  test("demande TROIS champs, et pas la ville", async ({ page }) => {
    await page.goto("/fr/apporteur-affaires", { timeout: 180_000 });

    // Les trois champs porteurs : sans eux, on ne peut ni rappeler ni écrire.
    for (const champ of ["prenom", "telephone", "email"]) {
      await expect(page.locator(`[name="${champ}"]`), `champ ${champ}`).toBeVisible();
    }
    // Et le consentement, sans lequel aucune preuve d'opt-in n'existe.
    await expect(page.locator('[name="consent"]')).toBeVisible();

    // ⛔ La ville N'EST PLUS demandée ici. La page promet « ta ville n'a aucune
    // importance » ; l'exiger à l'écran la contredisait, et chaque champ de
    // l'étape de capture se paie en abandons — là où la perte est TOTALE.
    await expect(
      page.locator('[name="ville"]'),
      "la ville ne doit pas être demandée à la capture : elle est demandée au DOSSIER",
    ).toHaveCount(0);
  });

  test("la page continue de promettre que la ville n'a pas d'importance", async ({ page }) => {
    // Contre-témoin de la décision : si un jour on remet le champ, cette phrase
    // devra tomber en même temps. Les deux doivent bouger ensemble ou pas du tout.
    await page.goto("/fr/apporteur-affaires", { timeout: 180_000 });
    const html = (await page.content()).toLowerCase();
    expect(html).toContain("partout en france");
  });

  test("la soumission part sans ville et mène à la page merci", async ({ page }) => {
    // 🔑 L'assertion qui compte vraiment : retirer un champ du RENDU ne sert à
    // rien si le SCHÉMA serveur l'exige encore — le formulaire refuserait sans
    // rien afficher, et l'abandon serait total et silencieux.
    const email = `recette-sans-ville-${Date.now()}@exemple-test.invalid`;
    await page.goto("/fr/apporteur-affaires", { timeout: 180_000 });
    await page.locator('[name="prenom"]').fill("Recette");
    await page.locator('[name="email"]').fill(email);
    await page.locator('[name="telephone"]').fill("0612345678");
    await page.locator('[name="consent"]').check();
    await page.locator('[data-cta="facebook-lead-submit"]').click();

    await page.waitForURL(/\/apporteur-affaires\/merci/, { timeout: 120_000 });
  });
});

test.describe("@capture le formulaire de candidature emploi", () => {
  test.setTimeout(240_000);

  test("les champs d'identité sont REMPLISSABLES par le téléphone", async ({ page }) => {
    // 🔑 Le test unitaire lit le FICHIER SOURCE. Il ne prouve pas que l'attribut
    // survit au rendu : un composant intermédiaire qui ne transmettrait pas ses
    // props le mangerait en silence, et le test resterait vert.
    // Ici on lit le DOM servi.
    await page.goto("/fr/carrieres/candidature-spontanee", { timeout: 180_000 });

    const attendus: ReadonlyArray<[string, string]> = [
      ["firstName", "given-name"],
      ["lastName", "family-name"],
      ["email", "email"],
      ["phone", "tel"],
      ["city", "address-level2"],
    ];
    for (const [champ, valeur] of attendus) {
      const el = page.locator(`[name="${champ}"]`).first();
      await expect(el, `champ ${champ} absent`).toBeVisible();
      await expect(el, `${champ} doit porter autocomplete="${valeur}"`).toHaveAttribute(
        "autocomplete",
        valeur,
      );
    }

    // Et le bon CLAVIER là où il change quelque chose.
    await expect(page.locator('[name="phone"]').first()).toHaveAttribute("inputmode", "tel");
    await expect(page.locator('[name="email"]').first()).toHaveAttribute("inputmode", "email");
  });

  test("le CV reste FACULTATIF — c'est ce que la page promet", async ({ page }) => {
    // Contre-témoin : en alignant les deux formulaires, on ne doit pas avoir
    // rendu le CV obligatoire « par cohérence ». La page dit « optionnel ».
    await page.goto("/fr/carrieres/candidature-spontanee", { timeout: 180_000 });
    const html = (await page.content()).toLowerCase();
    expect(html).toContain("optionnel");
    await expect(page.locator('[name="cv"]')).not.toHaveAttribute("required", /.*/);
  });
});
