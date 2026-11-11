// Régénère l'image de partage du Tour France IA (1200 × 630, JPEG) :
// `src/app/tour-france-ia/opengraph-image.jpg` et `twitter-image.jpg`.
// Usage : node scripts/generer-image-partage-tour.mjs   (puis mettre à jour les `*.alt.txt`)
//
// SVG rendu par `sharp` (déjà dépendance du dépôt) ; les polices viennent de
// `public/fonts/` via un `fonts.conf` temporaire, pour ne pas dépendre de la machine.
// Couleurs : jetons de `src/app/globals.css` (mocha, terracotta, primaire, ivoire).
import { mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const RACINE = resolve(import.meta.dirname, "..");
const conf = join(mkdtempSync(join(tmpdir(), "tdf-og-")), "fonts.conf");
writeFileSync(
  conf,
  `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${join(RACINE, "public/fonts")}</dir><cachedir>${tmpdir()}/tdf-og-cache</cachedir></fontconfig>`,
);
process.env.FONTCONFIG_FILE = conf;
const { default: sharp } = await import("sharp");

const C = {
  ink: "#1c1714",
  canvas: "#faf8f3",
  attenue: "#5a4f44",
  terracotta: "#b23f16",
  primaire: "#1a4dd9",
  blanc: "#ffffff",
};

// Fond clair ivoire, lueurs terracotta (haut droite) et bleue (bas gauche), comme le
// héros de la landing. Texte : le H1 validé, puis la promesse « La Journée IA »
// (réalignement du 2026-11-11 : aucun mot de gratuité, ni « ETI »).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="lueurT" cx="1150" cy="0" r="620" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.terracotta}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${C.terracotta}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lueurB" cx="0" cy="680" r="520" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.primaire}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${C.primaire}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${C.canvas}"/>
  <rect width="1200" height="630" fill="url(#lueurT)"/>
  <rect width="1200" height="630" fill="url(#lueurB)"/>
  <rect width="1200" height="12" fill="${C.terracotta}"/>

  <g font-family="Manrope" font-weight="700" fill="${C.ink}">
    <rect x="80" y="64" width="18" height="18" rx="9" fill="${C.terracotta}"/>
    <text x="114" y="81" font-size="22" letter-spacing="1">TOUR FRANCE IA</text>
    <text x="1120" y="81" font-size="22" text-anchor="end" fill="${C.attenue}" font-weight="500">Axion-IA</text>
  </g>

  <g font-family="Fraunces" font-weight="700" font-size="56" fill="${C.ink}">
    <text x="80" y="215">Vous entendez parler d’IA partout</text>
    <text x="80" y="290">et ne savez plus par où commencer ?</text>
  </g>
  <text x="80" y="378" font-family="Fraunces" font-style="italic" font-weight="700" font-size="72" fill="${C.terracotta}">Nous, si.</text>

  <rect x="80" y="430" width="636" height="68" rx="34" fill="${C.primaire}"/>
  <text x="112" y="475" font-family="Manrope" font-weight="700" font-size="30" fill="${C.blanc}">La Journée IA dans votre entreprise</text>

  <text xml:space="preserve" x="80" y="575" font-family="Manrope" font-weight="700" font-size="28" fill="${C.ink}">Audit le matin<tspan fill="${C.terracotta}">  •  </tspan>Formation de 4 h l’après-midi<tspan fill="${C.terracotta}">  •  </tspan>PME et TPE</text>
</svg>`;

const jpeg = await sharp(Buffer.from(svg), { density: 72 })
  .resize(1200, 630)
  .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toBuffer();
for (const nom of ["opengraph-image.jpg", "twitter-image.jpg"]) {
  const cible = join(RACINE, "src/app/tour-france-ia", nom);
  writeFileSync(cible, jpeg);
  console.log(`${nom} : ${(statSync(cible).size / 1024).toFixed(1)} Ko`);
}
