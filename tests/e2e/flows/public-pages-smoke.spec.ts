// E2E flow — smoke des pages publiques stratégiques (Sprint 21 / M10).
//
// 🔴 2026-08-21 — CETTE SPEC N'AVAIT JAMAIS APPRIS QUE EN EST ÉTEINT.
//
// Elle listait 16 URLs « 8 pages × 2 langues » et exigeait de chacune un 200 et
// un fragment de titre. Or le locale EN est désactivé depuis le 2026-05-16 :
// `src/proxy.ts` intercepte tout `/en/*` et émet un 301 vers l'équivalent FR.
// Les cas EN suivaient donc la redirection et tombaient sur une page FR dont le
// titre ne pouvait pas matcher un fragment anglais — `/en/case-studies` arrive
// sur « cas concrets », qui ne contient pas « case stud ».
//
// Personne ne l'a vu pendant trois mois parce que la suite ne tournait pas : le
// calcul du delta de bundle détruisait le build avant Playwright (cf.
// `tests/unit/ci/harnais-e2e-mesure-vraiment.spec.ts`).
//
// On ne SUPPRIME pas les cas EN — ce serait perdre la couverture du jour où EN
// sera réactivé, et surtout perdre la garde sur la redirection elle-même, qui
// porte tout le link juice des URLs EN déjà indexées. On assère le CONTRAT RÉEL,
// et il est plus exigeant que l'ancien : un SEUL 301, vers la canonique FR
// EXACTE. L'ancienne version acceptait n'importe quel statut < 400 au bout de
// n'importe quelle chaîne de redirections.
//
// ⚠️ Les destinations sont écrites À LA MAIN, pas dérivées de `mapEnToFr` : un
// test qui recopie son implémentation ne prouve rien. Si le mapping change, ces
// lignes doivent changer aussi — c'est le but.

import { test, expect } from "@playwright/test";

/** Pages FR stratégiques : 200, titre attendu, aucune erreur console. */
const PAGES_FR = [
  ["/fr", /Axion-IA|cabinet IA/i],
  // 🔴 `/fr/interventions` et `/fr/interventions/essentielle` ont été RETIRÉES
  // de cette table le 2026-08-21. Elles n'existent plus : mesurées en
  // production, elles rendent **308 vers `/fr/formations`** — le module a été
  // renommé (« Module 1 — Formations IA remplace l'offre /interventions
  // collective », `routing.ts`). La spec les tenait pour des pages qui rendent
  // un titre ; elle échouait donc sur un renommage, pas sur un défaut.
  //
  // 🔑 Une table de pages écrite à la main survit au produit qu'elle décrit.
  // Elle est désormais confrontée à la réalité par
  // `tests/unit/e2e-harness/routes-publiques-existent.spec.ts`, qui garde la
  // liste d'audit dans les deux sens.
  ["/fr/formations", /formation/i],
  ["/fr/audit", /audit/i],
  ["/fr/implementation", /implémentation|implementation/i],
  ["/fr/cas-concrets", /cas concrets|case studies/i],
  ["/fr/blog", /blog/i],
  ["/fr/contact", /contact/i],
] as const;

/**
 * Les mêmes pages en EN : une redirection PERMANENTE vers la canonique FR.
 *
 * Le mapping exhaustif de `en-to-fr-redirect.ts` existe précisément pour éviter
 * les chaînes `301 → 307 → 404` que l'audit GSC du 2026-05-18 avait relevées.
 *
 * 🔴 Rectification du 2026-08-21. Cette spec exigeait « UN SEUL saut » et le
 * code 301 exactement. Deux exigences trop étroites, écrites la veille par moi :
 *
 *  - le produit rend **308** sur les chemins hérités (`next.config.ts`,
 *    `permanent: true`) — permanent, donc pas recrawlé, donc conforme à
 *    l'intention ;
 *  - un chemin renommé traverse LÉGITIMEMENT deux redirections permanentes.
 *
 * Ce qu'on garde est la propriété qui compte : chaîne courte (≤ 2), permanente,
 * et qui finit sur une page FR en 200. Figer un code là où plusieurs conviennent
 * revient à accuser le produit de ce qu'il fait correctement.
 */
const REDIRECTIONS_EN = [
  ["/en", "/fr"],
  // Chaîne réelle, mesurée : `/en/interventions` → 308 `/en/formations`
  // → 301 `/fr/formations` → 200. Deux sauts, tous deux PERMANENTS, parce que le
  // chemin hérité `/interventions` est redirigé par `next.config.ts` avant que
  // la bascule EN→FR n'entre en jeu. La destination attendue est donc la
  // canonique VIVANTE, pas celle d'avant le renommage.
  ["/en/interventions", "/fr/formations"],
  ["/en/audit", "/fr/audit"],
  ["/en/implementation", "/fr/implementation"],
  ["/en/case-studies", "/fr/cas-concrets"],
  ["/en/blog", "/fr/blog"],
  ["/en/contact", "/fr/contact"],
] as const;

test.describe("Pages publiques stratégiques — FR", () => {
  for (const [path, motifTitre] of PAGES_FR) {
    test(`${path} rend 200, un titre valide et aucune erreur console`, async ({ page }) => {
      const erreurs: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const texte = msg.text();
        // Bruit externe (Turnstile, DevTools) et avertissements : pas des défauts.
        if (
          texte.includes("Warning:") ||
          texte.includes("DevTools") ||
          texte.includes("turnstile") ||
          texte.includes("Failed to fetch")
        ) {
          return;
        }
        erreurs.push(texte);
      });

      const reponse = await page.goto(path);
      expect(reponse?.status(), `statut HTTP de ${path}`).toBeLessThan(400);
      await expect(page).toHaveTitle(motifTitre);
      expect(erreurs, `erreurs console sur ${path}`).toEqual([]);
    });
  }
});

test.describe("Locale EN éteint — redirection permanente vers la canonique FR", () => {
  for (const [depuis, vers] of REDIRECTIONS_EN) {
    test(`${depuis} atteint ${vers} par une chaîne permanente et courte`, async ({
      request,
      baseURL,
    }) => {
      const reponse = await request.get(depuis, { maxRedirects: 0 });

      // 🔴 2026-08-21 — CETTE ASSERTION EXIGEAIT 301 ET LE PRODUIT REND 308.
      //
      // Elle a été écrite la veille par moi, sur l'idée juste — une redirection
      // TEMPORAIRE serait recrawlée indéfiniment — mais avec un code trop
      // étroit. Mesuré en production : `/en/interventions` rend **308** vers
      // `/en/formations`, parce qu'il traverse d'abord une redirection de chemin
      // hérité déclarée dans `next.config.ts` (`permanent: true` → 308).
      //
      // 🔑 308 est permanent, exactement comme 301. Ce que la spec doit garder,
      // c'est la PROPRIÉTÉ (permanent, donc pas recrawlé), pas un nombre. Un
      // test qui fige un code là où plusieurs conviennent finit par accuser le
      // produit de ce qu'il fait correctement.
      expect(
        [301, 308],
        `${depuis} doit répondre par une redirection PERMANENTE (301 ou 308) — ` +
          "un 307 serait retesté à chaque crawl, et un 200 signifierait que EN a " +
          `été réactivé sans mettre cette spec à jour. Reçu : ${reponse.status()}`,
      ).toContain(reponse.status());

      // 🔴 On SUIT la chaîne au lieu d'exiger un saut unique.
      //
      // La version précédente exigeait que le premier `Location` soit déjà la
      // canonique FR. C'est vrai de la plupart des entrées, mais pas de celles
      // qui traversent une redirection de chemin hérité : `/en/interventions`
      // passe par `/en/formations` avant d'atterrir en FR. Exiger un saut unique
      // revenait à interdire au produit d'avoir un historique.
      //
      // Ce qui compte pour un moteur comme pour un visiteur, c'est que la chaîne
      // soit COURTE, PERMANENTE, et qu'elle finisse sur une page FR qui existe.
      const sauts: string[] = [];
      // `depuis` est un littéral figé par le `as const` de la table : on le
      // relâche en `string`, puisqu'on va justement suivre la chaîne au-delà.
      let courante: string = depuis;
      for (let i = 0; i < 5; i += 1) {
        const etape = await request.get(courante, { maxRedirects: 0 });
        if (etape.status() < 300 || etape.status() >= 400) break;
        const brut = etape.headers()["location"] ?? "";
        // `split("?")[0]` est typé `string | undefined` sous `noUncheckedIndexedAccess` :
        // un `Location` vide donnerait `undefined`, et on préfère une chaîne vide,
        // que l'assertion de destination refusera clairement.
        courante = brut.startsWith("http") ? new URL(brut).pathname : (brut.split("?")[0] ?? "");
        sauts.push(`${etape.status()} → ${courante}`);
      }

      expect(
        sauts.length,
        `${depuis} : chaîne de redirection trop longue (${sauts.join(" · ")}) — ` +
          "chaque saut coûte du budget de crawl",
      ).toBeLessThanOrEqual(2);

      expect(
        courante,
        `${depuis} doit finir sur une page FR — chaîne : ${sauts.join(" · ")}`,
      ).toMatch(/^\/fr(\/|$)/);

      const finale = await request.get(courante, { maxRedirects: 0 });
      expect(
        finale.status(),
        `${courante} (fin de chaîne depuis ${depuis}) doit répondre 200 — ` +
          "une redirection vers le vide est pire qu'un 404",
      ).toBe(200);

      // La destination ATTENDUE reste inscrite dans la table : si le produit
      // change de canonique, on veut le savoir, pas le découvrir en production.
      expect(
        [courante, ...sauts.map((s) => s.split(" → ")[1])],
        `${depuis} n'atteint jamais la canonique attendue ${vers} — ` +
          `chaîne : ${sauts.join(" · ")}`,
      ).toContain(vers);
      expect(baseURL, "baseURL doit être défini par playwright.config.ts").toBeTruthy();
    });
  }
});
