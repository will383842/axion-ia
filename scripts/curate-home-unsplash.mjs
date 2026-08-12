// One-shot curation — photos Unsplash réelles pour les bandes média de l'accueil.
//
// Réplique le pattern CGU-compliant des autres curate-*-unsplash.mjs :
//   - free-tier only (premium/paid filtré, doctrine v3)
//   - orientation + content_filter=high (anti-NSFW)
//   - déclenche /photos/:id/download_location (CGU API §6) avant "use"
//   - télécharge en AVIF local (0 hotlink) via sharp
//   - écrit un SSOT crédits src/content/home/home-photos.ts (attribution §9)
//
// Sortie : public/illustrations/home/{slot}.avif + home-photos.ts
// Usage :  UNSPLASH_ACCESS_KEY=... node scripts/curate-home-unsplash.mjs
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

// Bandes média 16:9 (cf. FeatureMediaCard / AudienceSegments) — 1600×900 pour
// rester net sur une carte pleine largeur mobile comme en 3 colonnes desktop.
const W = 1600;
const H = 900;

// `slot` = clé stable, alignée sur les `imageTarget` déjà écrits dans les
// composants. `query` = recherche éditoriale ; on cherche des scènes de travail
// réelles et chaleureuses, pas des rendus 3D ni des « robots IA ».
const SLOTS = [
  {
    slot: "why-01-aucun-intermediaire",
    query: "two professionals working together laptop office warm daylight",
  },
  { slot: "why-02-cinq-metiers", query: "diverse creative team collaborating studio office" },
  { slot: "why-03-couverture", query: "aerial view european city rooftops daylight" },
  { slot: "why-04-meme-expert", query: "focused professional working laptop desk portrait" },
  { slot: "why-05-votre-rythme", query: "person planning notes desk workspace organised" },
  { slot: "why-06-meme-exigence", query: "artisan craftsman hands precision workshop detail" },
  { slot: "audience-01-tpe", query: "small business owner shop counter artisan" },
  { slot: "audience-02-pme", query: "small team meeting office table discussion" },
  { slot: "audience-03-eti", query: "modern open space office employees working" },
  {
    slot: "audience-04-grands-comptes",
    query: "corporate office building glass business district",
  },
];

function filterFreeOnly(photos) {
  return photos.filter((p) => p.premium !== true && (p.tier === undefined || p.tier === "free"));
}

function selectBest(photos, usedIds) {
  const fresh = photos.filter((p) => !usedIds.has(p.id));
  const pool = fresh.length ? fresh : photos;
  const sorted = [...pool].sort((a, b) => b.likes - a.likes).slice(0, 12);
  // Privilégie le paysage franc (ratio > 1.4) : la bande est en 16:9, un
  // 4:3 recadré perd trop de sujet en haut et en bas.
  const oriented = sorted.filter((p) => p.width / p.height > 1.4);
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

const OUT_DIR = join(ROOT, "public/illustrations/home");
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

const target = join(ROOT, "src/content/home/home-photos.ts");
mkdirSync(dirname(target), { recursive: true });
const out = `/**
 * SSOT — Photos Unsplash des bandes média de l'accueil (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-home-unsplash.mjs. Photos téléchargées en local
 * (\`public/illustrations/home/{slot}.avif\`) → 0 hotlink externe.
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe rendue (§9) via <UnsplashCreditList>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 *
 * \`slot\` = clé stable alignée sur les blocs de la home :
 *   why-01…06        → WhyDifferentiators
 *   audience-01…04   → AudienceSegments
 */

export interface HomePhotoCredit {
  readonly slot: string;
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly alt: string;
}

export const HOME_PHOTO_CREDITS: Record<string, HomePhotoCredit> = ${JSON.stringify(
  Object.fromEntries(credits.map((c) => [c.slot, c])),
  null,
  2,
)} as const;

export function getHomePhotoCredit(slot: string): HomePhotoCredit | undefined {
  return HOME_PHOTO_CREDITS[slot];
}

/** Chemin public du visuel d'un slot. */
export function homePhotoSrc(slot: string): string {
  return \`/illustrations/home/\${slot}.avif\`;
}
`;
writeFileSync(target, out, "utf8");
console.log(`\n✅ ${credits.length} photos écrites + home-photos.ts`);
