#!/usr/bin/env tsx
/**
 * Génère _AUDIT/image-bank-complet-2026/10-sitemap-images-villes-t3-t4.xml
 * T3 = 20 000 – 49 999 hab  → image générique PME/ETI
 * T4 =  5 000 – 19 999 hab  → image générique humanisée
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import direct des données brutes (pas de copy ni economicData nécessaires)
import { VILLES_ILE_DE_FRANCE } from "../src/content/villes/data/ile-de-france";
import { VILLES_AUVERGNE_RHONE_ALPES } from "../src/content/villes/data/auvergne-rhone-alpes";
import { VILLES_PROVENCE_ALPES_COTE_D_AZUR } from "../src/content/villes/data/provence-alpes-cote-d-azur";
import { VILLES_OCCITANIE } from "../src/content/villes/data/occitanie";
import { VILLES_NOUVELLE_AQUITAINE } from "../src/content/villes/data/nouvelle-aquitaine";
import { VILLES_HAUTS_DE_FRANCE } from "../src/content/villes/data/hauts-de-france";
import { VILLES_GRAND_EST } from "../src/content/villes/data/grand-est";
import { VILLES_PAYS_DE_LA_LOIRE } from "../src/content/villes/data/pays-de-la-loire";
import { VILLES_BRETAGNE } from "../src/content/villes/data/bretagne";
import { VILLES_NORMANDIE } from "../src/content/villes/data/normandie";
import { VILLES_BOURGOGNE_FRANCHE_COMTE } from "../src/content/villes/data/bourgogne-franche-comte";
import { VILLES_CENTRE_VAL_DE_LOIRE } from "../src/content/villes/data/centre-val-de-loire";
import { VILLES_CORSE } from "../src/content/villes/data/corse";

const REGION_LABELS: Record<string, string> = {
  "ile-de-france": "Île-de-France",
  "auvergne-rhone-alpes": "Auvergne-Rhône-Alpes",
  "provence-alpes-cote-d-azur": "Provence-Alpes-Côte d'Azur",
  occitanie: "Occitanie",
  "nouvelle-aquitaine": "Nouvelle-Aquitaine",
  "hauts-de-france": "Hauts-de-France",
  "grand-est": "Grand Est",
  "pays-de-la-loire": "Pays de la Loire",
  bretagne: "Bretagne",
  normandie: "Normandie",
  "bourgogne-franche-comte": "Bourgogne-Franche-Comté",
  "centre-val-de-loire": "Centre-Val de Loire",
  corse: "Corse",
};

// Slugs images génériques (images existantes dans la banque)
const IMG_T3 = "axion-ia-formation-acculturation-ia-tpe-pme-eti-2026-photo-banniere";
const IMG_T4 = "axion-ia-formation-ia-comprendre-creer-transformer-humaine-augmentee-banniere";

const ALL_VILLES = [
  ...VILLES_ILE_DE_FRANCE,
  ...VILLES_AUVERGNE_RHONE_ALPES,
  ...VILLES_PROVENCE_ALPES_COTE_D_AZUR,
  ...VILLES_OCCITANIE,
  ...VILLES_NOUVELLE_AQUITAINE,
  ...VILLES_HAUTS_DE_FRANCE,
  ...VILLES_GRAND_EST,
  ...VILLES_PAYS_DE_LA_LOIRE,
  ...VILLES_BRETAGNE,
  ...VILLES_NORMANDIE,
  ...VILLES_BOURGOGNE_FRANCHE_COMTE,
  ...VILLES_CENTRE_VAL_DE_LOIRE,
  ...VILLES_CORSE,
];

// Filtrer T3 (20K–50K) et T4 (5K–20K)
const T3 = ALL_VILLES.filter((v) => v.population >= 20000 && v.population < 50000).sort(
  (a, b) => b.population - a.population,
);
const T4 = ALL_VILLES.filter((v) => v.population >= 5000 && v.population < 20000).sort(
  (a, b) => b.population - a.population,
);

console.log(`T3: ${T3.length} villes | T4: ${T4.length} villes | Total: ${T3.length + T4.length}`);

function renderEntry(v: (typeof ALL_VILLES)[0], imgSlug: string): string {
  const region = REGION_LABELS[v.region] ?? v.region;
  const dept = v.departementLabel ?? v.departement;
  const imgLoc = `https://axion-ia.com/images/${imgSlug}.webp`;
  const title = `Formation IA à ${v.nameFr} — Axion-IA`;
  const caption = `Axion-IA propose des formations IA, audits IA et accompagnement à ${v.nameFr} (${dept}), en ${region}. Cabinet conseil IA B2B spécialisé PME/ETI.`;
  const geo = `${v.nameFr}, ${region}, France`;
  return `
  <url>
    <loc>https://axion-ia.com/fr/ia-${v.slug}</loc>
    <image:image>
      <image:loc>${imgLoc}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${caption}</image:caption>
      <image:geo_location>${geo}</image:geo_location>
      <image:license>https://creativecommons.org/licenses/by/4.0/</image:license>
    </image:image>
  </url>`;
}

// Grouper par région pour lisibilité
function groupByRegion(villes: typeof ALL_VILLES) {
  const map = new Map<string, typeof ALL_VILLES>();
  for (const v of villes) {
    if (!map.has(v.region)) map.set(v.region, []);
    map.get(v.region)!.push(v);
  }
  return map;
}

const t3ByRegion = groupByRegion(T3);
const t4ByRegion = groupByRegion(T4);

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

  <!-- TIER 3 — population 20 000–49 999 — ${T3.length} villes -->
  <!-- Slug image générique T3 : ${IMG_T3} -->
  <!-- TIER 4 — population 5 000–19 999 — ${T4.length} villes -->
  <!-- Slug image générique T4 : ${IMG_T4} -->
  <!-- Généré le 2026-05-20 pour axion-ia.com -->
  <!-- Total : ${T3.length + T4.length} URLs -->

`;

// T3
for (const [region, villes] of t3ByRegion) {
  const label = REGION_LABELS[region] ?? region;
  xml += `\n  <!-- === T3 — ${label.toUpperCase()} === -->\n`;
  for (const v of villes) {
    xml += renderEntry(v, IMG_T3);
    xml += "\n";
  }
}

// T4
for (const [region, villes] of t4ByRegion) {
  const label = REGION_LABELS[region] ?? region;
  xml += `\n  <!-- === T4 — ${label.toUpperCase()} === -->\n`;
  for (const v of villes) {
    xml += renderEntry(v, IMG_T4);
    xml += "\n";
  }
}

xml += `\n</urlset>\n`;

const outPath = path.resolve(
  __dirname,
  "../../_AUDIT/image-bank-complet-2026/10-sitemap-images-villes-t3-t4.xml",
);
fs.writeFileSync(outPath, xml, "utf8");
const lines = xml.split("\n").length;
const kb = Math.round(Buffer.byteLength(xml, "utf8") / 1024);
console.log(`✅ Écrit : ${outPath}`);
console.log(`   ${lines} lignes — ${kb} KB — ${T3.length + T4.length} URLs`);
