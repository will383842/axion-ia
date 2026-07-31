/**
 * Garde d'accès du portail stagiaire — audit de certification Qualiopi (constat X3).
 *
 * Ce que ce fichier verrouille : l'écran de refus du portail n'est plus servi en
 * HTTP 200. Avant le bloc 0sexies de `src/proxy.ts`, `/fr/portail/mon-espace`
 * répondait 200 à un visiteur sans cookie, parce que le refus était un `return`
 * de JSX dans un Server Component — un rendu réussi, par construction.
 *
 * ⚠️ `maxRedirects: 0` partout, et ce n'est pas un détail : `page.goto` (utilisé
 * par `_harness/audit-page.ts`) SUIT les redirections et renvoie le statut de la
 * dernière réponse. C'est précisément pour cela que l'entrée `/fr/portail/mon-espace`
 * a été retirée de `routes-publiques.json` : elle y passait au vert en auditant
 * `demander-acces` sous un faux nom.
 *
 * Cible par défaut : http://localhost:3000 (`use.baseURL` de playwright.config.ts).
 * Pour la production :
 *   E2E_BASE_URL=https://axion-ia.com npx playwright test tests/e2e/qualiopi/portail-garde-acces.spec.ts --project=chromium
 */

import { test, expect } from "@playwright/test";

test.describe("@qualiopi-portail garde d'accès", () => {
  test("mon-espace sans cookie → 307 vers demander-acces, jamais 200", async ({ request }) => {
    const r = await request.get("/fr/portail/mon-espace", { maxRedirects: 0 });
    expect(r.status(), "statut HTTP").toBe(307);
    expect(r.headers()["location"] ?? "", "cible").toContain("/fr/portail/demander-acces");
  });

  test("la redirection est incachable — un 307 mis en cache enfermerait un stagiaire connecté dehors", async ({
    request,
  }) => {
    const r = await request.get("/fr/portail/mon-espace", { maxRedirects: 0 });
    expect(r.headers()["cache-control"] ?? "", "Cache-Control").toContain("no-store");
  });

  test("non-régression : demander-acces reste publique en 200", async ({ request }) => {
    const r = await request.get("/fr/portail/demander-acces", { maxRedirects: 0 });
    expect(r.status()).toBe(200);
  });

  test("non-régression : acces-invalide reste en 200 — information, pas ressource protégée", async ({
    request,
  }) => {
    const r = await request.get("/fr/portail/acces-invalide", { maxRedirects: 0 });
    expect(r.status()).toBe(200);
  });

  test("emarger n'est PAS gardé par cookie — sinon toute signature devient impossible", async ({
    request,
  }) => {
    // Assertion volontairement NÉGATIVE : on n'affirme rien sur le statut exact
    // (aujourd'hui 200 « Lien invalide » — le durcissement de cette page a été
    // écarté du lot, voir specs_a_corriger). Ce qui compte ici, c'est que la garde
    // Edge ne l'intercepte pas : le stagiaire arrive par e-mail SANS aucun cookie.
    const r = await request.get("/fr/portail/emarger/jeton-forge-sans-signature", {
      maxRedirects: 0,
    });
    expect(r.status(), "emarger ne doit jamais être redirigé vers demander-acces").not.toBe(307);
  });

  test("non-régression : l'espace formateur garde sa propre redirection", async ({ request }) => {
    const r = await request.get("/fr/espace-formateur/tableau-de-bord", { maxRedirects: 0 });
    expect(r.status()).toBe(307);
  });
});
