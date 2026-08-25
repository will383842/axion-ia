// Génère le PDF du communiqué à partir de communique.html.
// Usage : node _PRESSE/communique-memorial/generer-pdf.mjs
// ⚠️ Sortie RVB (pas de conversion CMJN possible sur ce poste : ni Ghostscript ni qpdf).
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "communique.html");
const target = join(here, "Axion-IA-communique-presse-Memorial-de-l-Isere-2026-08-25.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(source).href, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
await page.pdf({
  path: target,
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();
console.log("PDF écrit :", target);
