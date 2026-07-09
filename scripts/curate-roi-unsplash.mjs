// One-shot curation — photos Unsplash réelles pour la page /roi (simulateur).
//
// Motif : la page /roi affichait deux `IllustrationPlaceholder` (cadres pointillés
// avec l'ID de slot et le nom de fichier cible) en PRODUCTION. On remplace par de
// vraies photos, curées et servies en local.
//
// Réplique le pattern CGU-compliant des autres curate-*-unsplash.mjs :
//   - free-tier only (premium/paid filtré, doctrine v3)
//   - orientation + content_filter=high (anti-NSFW)
//   - déclenche /photos/:id/download_location (CGU API §6) avant "use"
//   - télécharge en AVIF local (0 hotlink) via sharp
//   - écrit un SSOT crédits src/content/roi/roi-photos.ts (attribution §9)
//
// Sortie : public/illustrations/roi/{slot}.avif + roi-photos.ts
// Usage :  UNSPLASH_ACCESS_KEY=... node scripts/curate-roi-unsplash.mjs
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

// `slot` = clé stable consommée par le manifeste `page-images.ts` et la page.
// `w`/`h` fixent le rendu final (les dimensions déclarées au manifeste DOIVENT
// correspondre, sinon CLS + JSON-LD faux).
const SLOTS = [
  // Héro — colonne média à droite du h1. La requête ramène une horloge murale
  // sur mur clair : le sujet « temps » de la page, sans cliché corporate.
  { slot: "hero", w: 1600, h: 1000, query: "hourglass time desk warm light minimal" },
  // Bandeau pleine largeur, sous le simulateur.
  { slot: "banner", w: 1600, h: 700, query: "team working together bright office collaboration" },
  // Les 4 familles de tâches répétitives — grille illustrée.
  { slot: "redaction", w: 1200, h: 800, query: "person writing email laptop keyboard close up" },
  { slot: "recherche", w: 1200, h: 800, query: "woman reading documents office paperwork desk" },
  { slot: "synthese", w: 1200, h: 800, query: "meeting notes notebook pen summary handwriting" },
  {
    slot: "reporting",
    w: 1200,
    h: 800,
    query: "business dashboard charts report screen analytics",
  },
];

function filterFreeOnly(photos) {
  return photos.filter((p) => p.premium !== true && (p.tier === undefined || p.tier === "free"));
}

function selectBest(photos, usedIds) {
  const fresh = photos.filter((p) => !usedIds.has(p.id));
  const pool = fresh.length ? fresh : photos;
  const sorted = [...pool].sort((a, b) => b.likes - a.likes).slice(0, 12);
  // Privilégie le paysage (ratio > 1.2) — tous nos slots sont landscape.
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

const OUT_DIR = join(ROOT, "public/illustrations/roi");
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

const target = join(ROOT, "src/content/roi/roi-photos.ts");
mkdirSync(dirname(target), { recursive: true });
const header = `/**
 * SSOT — Photos Unsplash de la page /roi (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-roi-unsplash.mjs. Photos téléchargées en local
 * (\`public/illustrations/roi/{slot}.avif\`) → 0 hotlink externe.
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe rendue (§9) via <UnsplashCredit>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 *
 * \`slot\` = "hero" | "banner" | "redaction" | "recherche" | "synthese" | "reporting".
 */

export interface RoiPhotoCredit {
  readonly slot: string;
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly alt: string;
}

export const ROI_PHOTO_CREDITS: Record<string, RoiPhotoCredit> = ${JSON.stringify(
  Object.fromEntries(credits.map((c) => [c.slot, c])),
  null,
  2,
)} as const;

export function getRoiPhotoCredit(slot: string): RoiPhotoCredit | undefined {
  return ROI_PHOTO_CREDITS[slot];
}
`;
writeFileSync(target, header, "utf8");
console.log(`\n✅ ${credits.length} photos écrites + roi-photos.ts`);
