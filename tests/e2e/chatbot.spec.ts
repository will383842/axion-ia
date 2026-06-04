import { test, expect } from "@playwright/test";

// E2E du widget chatbot (T-09 — gate d'intégration MVP1).
//
// GATING : le widget ne se monte QUE si `NEXT_PUBLIC_CHATBOT_ENABLED === "true"`
// (île idle, cf. ChatWidgetMount) ET la route SSE ne répond QUE si
// `CHATBOT_ENABLED === "true"` (kill-switch serveur). Tant que Will n'a pas
// activé les deux flags (D-PROD), ces specs sont SKIPPÉES — elles ne cassent
// donc pas les runs CI où le chatbot est éteint. Pour les jouer en local :
//   CHATBOT_ENABLED=true NEXT_PUBLIC_CHATBOT_ENABLED=true pnpm dev
//   E2E_BASE_URL=http://localhost:3000 pnpm test:e2e --grep @chatbot
//
// Le scénario d'envoi utilise une requête « fourchette de prix » qui emprunte
// le chemin catalogue DÉTERMINISTE de l'orchestrateur (T-07) → pas d'appel LLM
// requis, donc rejouable sans clé Anthropic, juste la dev DB ingérée.

const CHATBOT_ON = process.env["NEXT_PUBLIC_CHATBOT_ENABLED"] === "true";

test.describe("Chatbot widget @chatbot", () => {
  test.skip(!CHATBOT_ON, "Chatbot désactivé (NEXT_PUBLIC_CHATBOT_ENABLED != true)");

  test("la bulle s'ouvre, affiche la mention IA et se ferme au clavier", async ({ page }) => {
    await page.goto("/fr");

    const bubble = page.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" });
    // Île idle : la bulle apparaît après requestIdleCallback (≤ 3 s).
    await expect(bubble).toBeVisible({ timeout: 8000 });

    await bubble.click();
    const dialog = page.getByRole("dialog", { name: "Assistant Axion-IA" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Vous dialoguez avec une IA/i)).toBeVisible();

    // A11y : Échap ferme et rend le focus à la bulle.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(bubble).toBeFocused();
  });

  test("envoie une question et reçoit une réponse streamée citée", async ({ page }) => {
    await page.goto("/fr");
    await page.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" }).click();

    const input = page.getByPlaceholder("Posez votre question…");
    await input.fill("Quelles formations entre 2000 et 3000 € ?");
    await page.getByRole("button", { name: "Envoyer" }).click();

    // La réponse (prose, carte d'offre, ou escalade) apparaît dans le panneau.
    const dialog = page.getByRole("dialog");
    await expect
      .poll(async () => (await dialog.textContent())?.length ?? 0, { timeout: 20000 })
      .toBeGreaterThan(120); // au-delà de l'intro + disclaimer seuls
  });

  test("le widget ne provoque pas de décalage de mise en page (CLS proxy)", async ({ page }) => {
    await page.goto("/fr");
    // La bulle est en position:fixed → son apparition ne doit pas pousser le
    // contenu. On vérifie que le <main> garde la même boîte avant/après montage.
    const main = page.locator("#main");
    const before = await main.boundingBox();
    await expect(page.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" })).toBeVisible({
      timeout: 8000,
    });
    const after = await main.boundingBox();
    expect(after?.y).toBe(before?.y);
    expect(after?.height).toBe(before?.height);
  });
});
