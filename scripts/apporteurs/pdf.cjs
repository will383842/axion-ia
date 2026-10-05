// Génère le PDF public « Comment ça marche » (fiche apporteur) depuis fiche-apporteur.html.
//
//   node scripts/apporteurs/pdf.cjs            → public/documents/apporteurs/comment-ca-marche.pdf
//
// Chrome headless via Playwright (déjà dans les dépendances du dépôt). Le texte de la fiche
// vit dans `fiche-apporteur.html` ; le formulaire de déclaration est sur le lien personnel.
const path = require("node:path");
const { chromium } = require("playwright");

const dossier = __dirname;
const sortie = path.join(__dirname, "..", "..", "public", "documents", "apporteurs", "comment-ca-marche.pdf");
const chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const b = await chromium.launch({ executablePath: chrome });
  const p = await b.newPage();
  await p.goto("file:///" + dossier.split(path.sep).join("/") + "/fiche-apporteur.html", { waitUntil: "load" });
  await p.waitForTimeout(500);
  await p.pdf({ path: sortie, format: "A4", printBackground: true, preferCSSPageSize: true });
  console.log("pdf", sortie);
  await b.close();
})();
