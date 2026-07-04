// One-shot curation — photos Unsplash réelles pour la page /a-propos.
// Réplique la logique CGU-compliant de curate-sites-web-unsplash.mjs mais
// TÉLÉCHARGE en AVIF local (pattern secteurs, 0 hotlink) via sharp :
//   - free-tier only (premium/paid filtré, doctrine v3)
//   - orientation + content_filter=high (anti-NSFW)
//   - déclenche /photos/:id/download_location (CGU API §6) avant "use"
//   - écrit un SSOT crédits src/content/a-propos/about-photos.ts (attribution §9)
//
// Sortie : public/illustrations/a-propos/{slot}.avif + about-photos.ts
// Usage :  node scripts/curate-a-propos-unsplash.mjs
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

// slot = clé stable code, query = recherche, ratio = [w,h] cible AVIF, orient.
const SLOTS = [
  {
    slot: "valeurs",
    query: "architect studio workspace blueprint precision",
    orientation: "squarish",
    w: 1200,
    h: 1200,
  },
  {
    slot: "closing",
    query: "modern european business team collaboration office",
    orientation: "landscape",
    w: 1600,
    h: 900,
  },
];

function filterFreeOnly(photos) {
  return photos.filter((p) => p.premium !== true && (p.tier === undefined || p.tier === "free"));
}

function selectBest(photos, usedIds, minRatio) {
  const fresh = photos.filter((p) => !usedIds.has(p.id));
  const pool = fresh.length ? fresh : photos;
  const sorted = [...pool].sort((a, b) => b.likes - a.likes).slice(0, 12);
  const oriented = sorted.filter((p) =>
    minRatio >= 1 ? p.width / p.height > 1.2 : Math.abs(p.width / p.height - 1) < 0.5,
  );
  return oriented[0] ?? sorted[0];
}

async function search(query, orientation) {
  const url = new URL(`${API}/search/photos`);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", orientation);
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

const OUT_DIR = join(ROOT, "public/illustrations/a-propos");
mkdirSync(OUT_DIR, { recursive: true });

const used = new Set();
const credits = [];
for (const s of SLOTS) {
  console.log(`\n[${s.slot}] query="${s.query}"`);
  const results = await search(s.query, s.orientation);
  const free = filterFreeOnly(results);
  const photo = selectBest(free, used, s.w / s.h);
  if (!photo) {
    console.warn(`  ! no photo for ${s.slot}`);
    continue;
  }
  used.add(photo.id);
  await triggerDownload(photo.links.download_location);

  // Télécharge le raw (urls.raw haute def) → resize cover → AVIF.
  const rawUrl = `${photo.urls.raw}&w=${s.w * 2}&fit=max&fm=jpg&q=90`;
  const imgRes = await fetch(rawUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const outPath = join(OUT_DIR, `${s.slot}.avif`);
  await sharp(buf)
    .resize(s.w, s.h, { fit: "cover", position: "attention" })
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

const target = join(ROOT, "src/content/a-propos/about-photos.ts");
mkdirSync(dirname(target), { recursive: true });
const header = `/**
 * SSOT — Photos Unsplash de la page /a-propos (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-a-propos-unsplash.mjs. Photos téléchargées en
 * local (\`public/illustrations/a-propos/{slot}.avif\`) → 0 hotlink externe.
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe rendue (§9) via <UnsplashCredit>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 */

export interface AboutPhotoCredit {
  readonly slot: string;
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly alt: string;
}

export const ABOUT_PHOTO_CREDITS: Record<string, AboutPhotoCredit> = ${JSON.stringify(
  Object.fromEntries(credits.map((c) => [c.slot, c])),
  null,
  2,
)} as const;
`;
writeFileSync(target, header, "utf8");
console.log(`\n✅ ${credits.length} photos écrites + about-photos.ts`);
