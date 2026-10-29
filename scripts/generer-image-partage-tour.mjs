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
  mocha: "#2a2520",
  ink: "#14100e",
  ivoire: "#f7f3ea",
  ivoireAttenue: "#b5aa9c",
  terracotta: "#b23f16",
  terracottaSurMocha: "#eb8560",
  primaire: "#1a4dd9",
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="lueurT" cx="1056" cy="-50" r="620" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.terracotta}" stop-opacity="0.7"/>
      <stop offset="1" stop-color="${C.terracotta}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lueurB" cx="-140" cy="680" r="520" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.primaire}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${C.primaire}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${C.mocha}"/>
  <rect width="1200" height="630" fill="url(#lueurT)"/>
  <rect width="1200" height="630" fill="url(#lueurB)"/>
  <rect width="1200" height="12" fill="${C.terracotta}"/>

  <g font-family="Manrope" font-weight="700" fill="${C.ivoire}">
    <rect x="80" y="64" width="16" height="16" rx="8" fill="${C.terracottaSurMocha}"/>
    <text x="110" y="79" font-size="22" letter-spacing="3">TOUR FRANCE IA</text>
    <text x="1120" y="79" font-size="22" text-anchor="end" fill="${C.ivoireAttenue}" font-weight="500">Axion-IA</text>
  </g>

  <g font-family="Fraunces" font-size="60" fill="${C.ivoire}">
    <text x="80" y="210">Vous entendez parler d’IA partout</text>
    <text x="80" y="290">et ne savez plus par où commencer ?</text>
    <text x="80" y="378" font-style="italic" fill="${C.terracottaSurMocha}" font-size="72">Nous, si.</text>
  </g>
  <rect x="80" y="394" width="262" height="7" fill="${C.terracotta}"/>

  <rect x="80" y="468" width="1040" height="2" fill="${C.ivoire}" fill-opacity="0.18"/>
  <text xml:space="preserve" x="80" y="528" font-family="Manrope" font-weight="700" font-size="32" fill="${C.ivoire}">Audit offert<tspan fill="${C.terracottaSurMocha}">  ·  </tspan>Formation de 4 h offerte<tspan fill="${C.terracottaSurMocha}">  ·  </tspan>De la TPE à l’ETI</text>
  <text x="80" y="578" font-family="Manrope" font-weight="500" font-size="24" fill="${C.ivoireAttenue}">Tour France IA, organisé par Axion-IA</text>
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
