// Captures desktop + mobile d'une liste d'URL, pour juger un rendu RÉEL.
//
// Pourquoi cet outil existe : sur ce dépôt, plusieurs défauts visibles n'ont été
// trouvés ni par le typecheck, ni par les 21 000 tests, ni par une lecture du
// HTML — seulement en regardant la page. Exemples réels : un cadre pointillé
// « emplacement d'image » servi en production, une photo délavée en position
// LCP, un bandeau cookies couvrant la moitié du premier écran. Le rendu mobile,
// lui, n'avait jamais été validé (la fenêtre Chrome refusait de se redimensionner).
//
// Le viewport mobile est piloté par Playwright, pas par le navigateur de bureau :
// c'est ce qui rend le contrôle mobile fiable.
//
// Usage :
//   node scripts/capture-pages.mjs <dossier-sortie> <url|chemin> [<url|chemin> ...]
//   node scripts/capture-pages.mjs ./shots /fr /fr/methodologie
//   node scripts/capture-pages.mjs ./shots https://axion-ia.com/fr/guide-ia
//
// Options par variables d'environnement :
//   BASE_URL   base des chemins relatifs (défaut https://axion-ia.com)
//   ANCHOR     sélecteur CSS à amener à l'écran avant la capture (défaut : haut de page)
//   FULL_PAGE  "1" pour capturer la page entière au lieu du seul écran visible
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [outDir, ...targets] = process.argv.slice(2);
if (!outDir || targets.length === 0) {
  console.error("usage: node scripts/capture-pages.mjs <dossier> <url|chemin> [...]");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const BASE = process.env.BASE_URL ?? "https://axion-ia.com";
const ANCHOR = process.env.ANCHOR ?? "";
const FULL_PAGE = process.env.FULL_PAGE === "1";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const slug = (u) =>
  u
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "") || "accueil";

const browser = await chromium.launch();
let failures = 0;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    ...(vp.isMobile ? { userAgent: MOBILE_UA } : {}),
  });
  const page = await ctx.newPage();

  for (const t of targets) {
    const url = t.startsWith("http") ? t : BASE + t;
    try {
      // `domcontentloaded` et non `networkidle` : les pages riches en images
      // n'atteignent jamais le silence réseau et expirent.
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
      // Le bandeau cookies masque le premier écran : on l'écarte pour juger la
      // page, pas le bandeau.
      for (const label of ["Tout accepter", "Accepter", "J'accepte"]) {
        const b = page.getByRole("button", { name: label }).first();
        if (await b.isVisible().catch(() => false)) {
          await b.click().catch(() => {});
          await page.waitForTimeout(400);
          break;
        }
      }
      if (ANCHOR) {
        await page.locator(ANCHOR).first().scrollIntoViewIfNeeded({ timeout: 15000 });
      }
      await page.waitForTimeout(900); // laisse finir les apparitions au défilement
      await page.screenshot({ path: `${outDir}/${vp.name}-${slug(url)}.png`, fullPage: FULL_PAGE });
      console.log(`OK   ${vp.name} ${url}`);
    } catch (e) {
      failures += 1;
      console.log(`FAIL ${vp.name} ${url} : ${String(e.message).split("\n")[0].slice(0, 100)}`);
    }
  }
  await ctx.close();
}

await browser.close();
process.exit(failures > 0 ? 1 : 0);
