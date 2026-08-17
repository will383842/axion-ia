// One-shot curation — photos Unsplash pour les emplacements éditoriaux encore
// vides du site public (cadres pointillés `Illustration` sans `src`) et pour
// la parité image/texte de /methodologie.
//
// Réplique le pattern CGU-compliant des autres curate-*-unsplash.mjs :
//   - free-tier only (premium/paid filtré, doctrine v3)
//   - orientation + content_filter=high (anti-NSFW)
//   - déclenche /photos/:id/download_location (CGU API §6) avant "use"
//   - télécharge en AVIF local (0 hotlink) via sharp
//   - écrit un SSOT crédits src/content/pages/editorial-photos.ts (attribution §9)
//
// ⚠️ Les `file` ci-dessous reprennent EXACTEMENT les `filenameTarget` déjà
// déclarés dans les composants `<Illustration>` — ne pas les renommer.
//
// Usage : UNSPLASH_ACCESS_KEY=... node scripts/curate-pages-editoriales-unsplash.mjs
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

// `slot` = clé SSOT. `file` = chemin sous public/ (sans extension), aligné sur
// le `filenameTarget` du composant. `w`/`h` = dimensions finales (ratio du slot).
const SLOTS = [
  {
    slot: "centre-aide-hero",
    file: "illustrations/centre-aide-hero",
    w: 1600,
    h: 900,
    query: "library bookshelves organised books warm reading room",
  },
  {
    slot: "cas-concrets-mid-1",
    file: "illustrations/cas-concrets-mid-1",
    w: 1600,
    h: 900,
    query: "flat lay desk workspace tools notebook organised overhead",
  },
  {
    slot: "comparaisons-mid-1",
    file: "illustrations/comparaisons-mid-1",
    w: 1200,
    h: 1200,
    query: "sticky notes wall planning strategy matrix",
  },
  {
    slot: "guide-ia-hero",
    file: "illustrations/guide-ia-hero",
    w: 1600,
    h: 900,
    query: "open book on light table minimal desk",
  },
  {
    slot: "guide-ia-closing",
    file: "illustrations/guide-ia-closing",
    w: 1600,
    h: 900,
    query: "hands turning page of book reading close up",
  },
  {
    slot: "stack-ia-closing",
    file: "illustrations/stack-ia-closing",
    w: 1600,
    h: 900,
    query: "organised workshop tools workbench craft",
  },
  {
    slot: "methodologie-demarche",
    file: "illustrations/methodologie-demarche",
    w: 1600,
    h: 900,
    query: "team whiteboard planning steps strategy meeting office",
  },
  {
    slot: "methodologie-terrain",
    file: "illustrations/methodologie-terrain",
    w: 1600,
    h: 900,
    query: "consultant working with employees on site workplace",
  },
];

function filterFreeOnly(photos) {
  return photos.filter((p) => p.premium !== true && (p.tier === undefined || p.tier === "free"));
}

function selectBest(photos, usedIds, wantSquare) {
  const fresh = photos.filter((p) => !usedIds.has(p.id));
  const pool = fresh.length ? fresh : photos;
  const sorted = [...pool].sort((a, b) => b.likes - a.likes).slice(0, 12);
  // Un 1:1 se recadre mieux depuis un cliché peu allongé ; un 16:9 depuis un
  // paysage franc. Sans candidat, on retombe sur le plus aimé.
  const oriented = wantSquare
    ? sorted.filter((p) => p.width / p.height < 1.6)
    : sorted.filter((p) => p.width / p.height > 1.4);
  return oriented[0] ?? sorted[0];
}

async function search(query, wantSquare) {
  const url = new URL(`${API}/search/photos`);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", wantSquare ? "squarish" : "landscape");
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

const used = new Set();
const credits = [];
for (const s of SLOTS) {
  const wantSquare = s.w === s.h;
  console.log(`\n[${s.slot}] query="${s.query}"`);
  const results = await search(s.query, wantSquare);
  const free = filterFreeOnly(results);
  const photo = selectBest(free, used, wantSquare);
  if (!photo) {
    console.warn(`  ! no photo for ${s.slot}`);
    continue;
  }
  used.add(photo.id);
  await triggerDownload(photo.links.download_location);

  const rawUrl = `${photo.urls.raw}&w=${s.w * 2}&fit=max&fm=jpg&q=90`;
  const imgRes = await fetch(rawUrl);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const outPath = join(ROOT, "public", `${s.file}.avif`);
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(buf)
    .resize(s.w, s.h, { fit: "cover", position: "attention" })
    .avif({ quality: 62, effort: 5 })
    .toFile(outPath);
  const photographer = photo.user.name || photo.user.username;
  credits.push({
    slot: s.slot,
    src: `/${s.file}.avif`,
    width: s.w,
    height: s.h,
    photoId: photo.id,
    photographer,
    photographerUrl: photo.user.links.html,
    photoUrl: `https://unsplash.com/photos/${photo.id}`,
    alt: photo.alt_description || photo.description || s.query,
  });
  console.log(`  → ${photo.id} by ${photographer} (${photo.likes} likes) → ${s.file}.avif`);
}

const target = join(ROOT, "src/content/pages/editorial-photos.ts");
mkdirSync(dirname(target), { recursive: true });
const out = `/**
 * SSOT — Photos Unsplash des emplacements éditoriaux des pages de contenu
 * (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-pages-editoriales-unsplash.mjs. Photos
 * téléchargées en local → 0 hotlink externe.
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe rendue (§9) via <UnsplashCredit>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 *
 * \`width\`/\`height\` sont les dimensions RÉELLES du fichier : les reprendre
 * telles quelles dans PAGE_IMAGES_MANIFEST, sinon CLS et JSON-LD faux.
 */

export interface EditorialPhoto {
  readonly slot: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly alt: string;
}

export const EDITORIAL_PHOTOS: Record<string, EditorialPhoto> = ${JSON.stringify(
  Object.fromEntries(credits.map((c) => [c.slot, c])),
  null,
  2,
)} as const;

export function getEditorialPhoto(slot: string): EditorialPhoto | undefined {
  return EDITORIAL_PHOTOS[slot];
}
`;
writeFileSync(target, out, "utf8");
console.log(`\n✅ ${credits.length} photos écrites + editorial-photos.ts`);
