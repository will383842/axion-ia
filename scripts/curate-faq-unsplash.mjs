// One-shot curation — photos Unsplash réelles pour les pages FAQ.
// Réplique le pattern CGU-compliant des autres curate-*-unsplash.mjs :
//   - free-tier only (premium/paid filtré, doctrine v3)
//   - orientation + content_filter=high (anti-NSFW)
//   - déclenche /photos/:id/download_location (CGU API §6) avant "use"
//   - télécharge en AVIF local (0 hotlink) via sharp
//   - écrit un SSOT crédits src/content/faq/faq-photos.ts (attribution §9)
//
// Sortie : public/illustrations/faq/{slot}.avif + faq-photos.ts
// Usage :  UNSPLASH_ACCESS_KEY=... node scripts/curate-faq-unsplash.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadKey() {
  if (process.env.UNSPLASH_ACCESS_KEY) return process.env.UNSPLASH_ACCESS_KEY;
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(join(ROOT, f), "utf8");
      const m = txt.match(/^UNSPLASH_ACCESS_KEY\s*=\s*(.+)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* absent */
    }
  }
  throw new Error("UNSPLASH_ACCESS_KEY not found");
}

const API = "https://api.unsplash.com";
const KEY = loadKey();

// slot = clé stable (= hub/topics ou slug catégorie FAQ). query = recherche
// éditoriale. Toutes en 4:3 landscape 1280×960 pour la colonne média du héro.
const W = 1280;
const H = 960;
const SLOTS = [
  { slot: "hub", query: "knowledge documentation reading desk warm minimal" },
  { slot: "topics", query: "organized notes planning index desk minimal" },
  { slot: "general", query: "business office team collaboration meeting" },
  { slot: "interventions", query: "professional training class presentation people" },
  { slot: "implementation", query: "software developer coding screens automation" },
  { slot: "audit", query: "business analytics data charts dashboard laptop" },
  { slot: "pricing", query: "finance budget planning documents calculator desk" },
  { slot: "process", query: "team workflow planning whiteboard steps office" },
  { slot: "sites-web", query: "web design interface screens laptop studio" },
  { slot: "un-a-un", query: "business coaching one on one meeting two people" },
];

function filterFreeOnly(photos) {
  return photos.filter((p) => p.premium !== true && (p.tier === undefined || p.tier === "free"));
}

function selectBest(photos, usedIds) {
  const fresh = photos.filter((p) => !usedIds.has(p.id));
  const pool = fresh.length ? fresh : photos;
  const sorted = [...pool].sort((a, b) => b.likes - a.likes).slice(0, 12);
  // Privilégie le paysage (ratio > 1.2) pour la colonne média du héro.
  const oriented = sorted.filter((p) => p.width / p.height > 1.2);
  return oriented[0] ?? sorted[0];
}

async function search(query) {
  const url = new URL(`${API}/search/photos`);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  url.searchParams.set("per_page", "30");
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${KEY}`, "Accept-Version": "v1" },
  });
  if (!res.ok) throw new Error(`search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).results;
}

async function triggerDownload(loc) {
  try {
    const res = await fetch(loc, { headers: { Authorization: `Client-ID ${KEY}` } });
    console.log(res.ok ? "  ✓ download trigger OK (CGU §6)" : `  ! trigger ${res.status}`);
  } catch (e) {
    console.warn(`  ! trigger failed: ${e.message}`);
  }
}

const OUT_DIR = join(ROOT, "public/illustrations/faq");
mkdirSync(OUT_DIR, { recursive: true });

const used = new Set();
const credits = [];
for (const s of SLOTS) {
  console.log(`\n[${s.slot}] query="${s.query}"`);
  const results = await search(s.query);
  const free = filterFreeOnly(results);
  const photo = selectBest(free, used);
  if (!photo) {
    console.warn(`  ! no photo for ${s.slot}`);
    continue;
  }
  used.add(photo.id);
  await triggerDownload(photo.links.download_location);

  const rawUrl = `${photo.urls.raw}&w=${W * 2}&fit=max&fm=jpg&q=90`;
  const imgRes = await fetch(rawUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const outPath = join(OUT_DIR, `${s.slot}.avif`);
  await sharp(buf)
    .resize(W, H, { fit: "cover", position: "attention" })
    .avif({ quality: 62, effort: 5 })
    .toFile(outPath);
  const photographer = photo.user.name || photo.user.username;
  credits.push({
    slot: s.slot,
    photoId: photo.id,
    photographer,
    photographerUrl: photo.user.links.html,
    photoUrl: `https://unsplash.com/photos/${photo.id}`,
    alt: photo.alt_description || photo.description || s.query,
  });
  console.log(`  → ${photo.id} by ${photographer} (${photo.likes} likes) → ${s.slot}.avif`);
}

const target = join(ROOT, "src/content/faq/faq-photos.ts");
mkdirSync(dirname(target), { recursive: true });
const header = `/**
 * SSOT — Photos Unsplash des pages FAQ (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-faq-unsplash.mjs. Photos téléchargées en local
 * (\`public/illustrations/faq/{slot}.avif\`) → 0 hotlink externe.
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe rendue (§9) via <UnsplashCredit>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 *
 * \`slot\` = "hub" | "topics" | slug de catégorie FAQ (general, interventions,
 * implementation, audit, pricing, process, sites-web, un-a-un).
 */

export interface FaqPhotoCredit {
  readonly slot: string;
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly alt: string;
}

export const FAQ_PHOTO_CREDITS: Record<string, FaqPhotoCredit> = ${JSON.stringify(
  Object.fromEntries(credits.map((c) => [c.slot, c])),
  null,
  2,
)} as const;

export function getFaqPhotoCredit(slot: string): FaqPhotoCredit | undefined {
  return FAQ_PHOTO_CREDITS[slot];
}
`;
writeFileSync(target, header, "utf8");
console.log(`\n✅ ${credits.length} photos écrites + faq-photos.ts`);
