#!/usr/bin/env tsx
/**
 * Extrait les données du 06-sitemap-images-services.xml vers un module TypeScript.
 * Sortie : src/server/image-bank/data/service-sitemap-data.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const xmlPath = path.resolve(
  __dirname,
  "../../_AUDIT/image-bank-complet-2026/06-sitemap-images-services.xml",
);
const outPath = path.resolve(__dirname, "../src/server/image-bank/data/service-sitemap-data.ts");

const xml = fs.readFileSync(xmlPath, "utf8");

// Parse page groups
const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];

interface ImageEntry {
  loc: string;
  title: string;
  caption: string;
}
interface PageEntry {
  pageUrl: string;
  images: ImageEntry[];
}

const pages: PageEntry[] = [];

for (const block of urlBlocks) {
  const pageMatch = block.match(/<loc>(https:\/\/axion-ia\.com[^<]*)<\/loc>/);
  if (!pageMatch?.[1]) continue;
  const pageUrl = pageMatch[1].replace("https://axion-ia.com", "");

  const imageBlocks = block.match(/<image:image>[\s\S]*?<\/image:image>/g) ?? [];
  const images: ImageEntry[] = [];

  for (const img of imageBlocks) {
    const locMatch = img.match(
      /<image:loc>(https:\/\/axion-ia\.com\/images\/([^<]+))<\/image:loc>/,
    );
    const titleMatch = img.match(/<image:title>([^<]+)<\/image:title>/);
    const captionMatch = img.match(/<image:caption>([\s\S]*?)<\/image:caption>/);

    if (!locMatch?.[1] || !titleMatch?.[1] || !captionMatch?.[1]) continue;
    images.push({
      loc: locMatch[1],
      title: titleMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'"),
      caption: captionMatch[1]
        .trim()
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'"),
    });
  }

  if (images.length > 0) pages.push({ pageUrl, images });
}

// Generate TypeScript module
const totalImages = pages.reduce((s, p) => s + p.images.length, 0);

const lines: string[] = [
  "// Auto-généré par scripts/extract-service-sitemap-data.ts — 2026-05-20",
  "// Source : _AUDIT/image-bank-complet-2026/06-sitemap-images-services.xml",
  "// NE PAS ÉDITER À LA MAIN. Régénérer via le script si les images changent.",
  "",
  `// ${pages.length} pages de services — ${totalImages} images au total`,
  "",
  "export interface ServiceImageEntry {",
  "  loc: string",
  "  title: string",
  "  caption: string",
  "}",
  "",
  "export interface ServicePageEntry {",
  "  pageUrl: string",
  "  images: ServiceImageEntry[]",
  "}",
  "",
  "export const SERVICE_SITEMAP_PAGES: ReadonlyArray<ServicePageEntry> = [",
];

for (const page of pages) {
  lines.push(`  {`);
  lines.push(`    pageUrl: ${JSON.stringify(page.pageUrl)},`);
  lines.push(`    images: [`);
  for (const img of page.images) {
    lines.push(`      {`);
    lines.push(`        loc: ${JSON.stringify(img.loc)},`);
    lines.push(`        title: ${JSON.stringify(img.title)},`);
    lines.push(`        caption: ${JSON.stringify(img.caption)},`);
    lines.push(`      },`);
  }
  lines.push(`    ],`);
  lines.push(`  },`);
}

lines.push("]");
lines.push("");

const ts = lines.join("\n");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, ts, "utf8");
console.log(`✅ Écrit : ${outPath}`);
console.log(`   ${pages.length} pages — ${totalImages} images`);
