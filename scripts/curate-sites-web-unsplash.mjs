// One-shot curation script — fetches real Unsplash photos for the sites-web
// hub page visual showcase, fully CGU-compliant (replicates the exact logic of
// src/server/content-gen/providers/unsplash.ts WITHOUT the DB-config dependency):
//   - free-tier only (premium/paid filtered out, doctrine v3)
//   - orientation=landscape, content_filter=high (anti-NSFW)
//   - triggers /photos/:id/download_location (CGU API §6) before "use"
//   - attribution with utm_source=axion-ia&utm_medium=referral on every link
//
// Output: writes src/content/sites-web/sites-web-unsplash.ts (a static manifest of
// REAL photos). Run once locally with the key in .env.local; the page then hotlinks
// images.unsplash.com via next/image (domain already whitelisted in next.config).
//
// Usage:  node scripts/curate-sites-web-unsplash.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// --- load UNSPLASH_ACCESS_KEY from .env.local (no dotenv dependency) ---
function loadKey() {
  if (process.env.UNSPLASH_ACCESS_KEY) return process.env.UNSPLASH_ACCESS_KEY;
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(join(ROOT, f), "utf8");
      const m = txt.match(/^UNSPLASH_ACCESS_KEY\s*=\s*(.+)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* file absent */
    }
  }
  throw new Error("UNSPLASH_ACCESS_KEY not found in env or .env.local");
}

const API = "https://api.unsplash.com";
const _UTM = "utm_source=axion-ia&utm_medium=referral";
const KEY = loadKey();

// Slots = sections visuelles de la page hub sites-web. query = recherche Unsplash,
// slot = clé stable côté code, label = légende FR courte (contextualise l'image).
const SLOTS = [
  { slot: "design", query: "ux ui design wireframe", label: "UX/UI & design produit" },
  { slot: "dev", query: "software developer coding screen", label: "Développement sur mesure" },
  { slot: "ecommerce", query: "ecommerce online shopping laptop", label: "E-commerce multi-CMS" },
  { slot: "mobile", query: "mobile app design smartphone", label: "Applications mobiles" },
  { slot: "data", query: "data dashboard analytics screen", label: "Plateformes data & SaaS" },
  {
    slot: "team",
    query: "creative tech team collaboration office",
    label: "Une équipe à vos côtés",
  },
];

function filterFreeOnly(photos) {
  return photos.filter((p) => p.premium !== true && (p.tier === undefined || p.tier === "free"));
}

function selectBest(photos, usedIds) {
  const fresh = photos.filter((p) => !usedIds.has(p.id));
  const pool = fresh.length ? fresh : photos;
  const sorted = [...pool].sort((a, b) => b.likes - a.likes).slice(0, 10);
  const landscape = sorted.filter((p) => p.width / p.height > 1.2);
  return landscape[0] ?? sorted[0];
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
  if (!res.ok)
    throw new Error(`Unsplash search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).results;
}

async function triggerDownload(downloadLocation) {
  // CGU API §6 — obligation : signaler l'utilisation avant affichage.
  try {
    const res = await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${KEY}` } });
    if (!res.ok) console.warn(`  ! download trigger non-OK ${res.status}`);
    else console.log("  ✓ download trigger OK (CGU §6)");
  } catch (e) {
    console.warn(`  ! download trigger failed: ${e.message}`);
  }
}

const used = new Set();
const out = [];
for (const s of SLOTS) {
  console.log(`\n[${s.slot}] query="${s.query}"`);
  const results = await search(s.query);
  const free = filterFreeOnly(results);
  const photo = selectBest(free, used);
  if (!photo) {
    console.warn(`  ! no photo for ${s.slot}, skipped`);
    continue;
  }
  used.add(photo.id);
  await triggerDownload(photo.links.download_location);
  const photographer = photo.user.name || photo.user.username;
  out.push({
    slot: s.slot,
    label: s.label,
    photoId: photo.id,
    width: photo.width,
    height: photo.height,
    alt: photo.alt_description || photo.description || s.query,
    // hotlink (urls.regular ~1080px) — next/image re-optimise (webp/avif/responsive)
    src: photo.urls.regular,
    photographer,
    // URL PROPRE (sans UTM) — le composant UnsplashCredit ajoute lui-même
    // ?utm_source=axion-ia&utm_medium=referral. Ne pas pré-inclure l'UTM ici.
    photographerUrl: photo.user.links.html,
    photoUrl: `https://unsplash.com/photos/${photo.id}`,
  });
  console.log(
    `  → ${photo.id} by ${photographer} (${photo.likes} likes, ${photo.width}x${photo.height})`,
  );
}

const header = `// AUTO-GÉNÉRÉ par scripts/curate-sites-web-unsplash.mjs — NE PAS éditer à la main.
// Photos Unsplash réelles, conformes CGU (free-tier, download-trigger §6 déclenché à
// la curation, attribution + UTM). Hotlink images.unsplash.com (whitelisté next.config),
// re-optimisé par next/image. Re-curer = relancer le script (re-déclenche le trigger).
export interface SitesWebUnsplashImage {
  readonly slot: string;
  readonly label: string;
  readonly photoId: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly src: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
}

export const SITES_WEB_UNSPLASH: readonly SitesWebUnsplashImage[] = ${JSON.stringify(out, null, 2)} as const;
`;

const target = join(ROOT, "src/content/sites-web-unsplash.ts");
writeFileSync(target, header, "utf8");
console.log(`\n✅ ${out.length} photos écrites dans src/content/sites-web-unsplash.ts`);
