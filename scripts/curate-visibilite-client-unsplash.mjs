// One-shot curation — vraies photos Unsplash pour la page /visibilite-client
// (bénéfices visibilité offerts aux clients Axion-IA). 100 % conforme CGU :
// free-tier only, orientation=landscape, content_filter=high, download-trigger
// §6 déclenché, attribution via <UnsplashCredit>. Hotlink images.unsplash.com
// (whitelisté next.config), re-optimisé par next/image.
//
// Usage : UNSPLASH_ACCESS_KEY=xxx node scripts/curate-visibilite-client-unsplash.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

const SLOTS = [
  {
    slot: "hero",
    query: "business team success celebration office bright",
    label: "Vos équipes mises en lumière",
  },
  {
    slot: "podcast",
    query: "podcast microphone studio recording professional",
    label: "Podcast dirigeant ou collaborateur",
  },
  {
    slot: "interview",
    query: "video interview filming camera business person",
    label: "Interviews des participants",
  },
  {
    slot: "page",
    query: "modern website homepage laptop screen business",
    label: "Page dédiée sur axion-ia.com",
  },
  {
    slot: "backlink",
    query: "seo growth analytics dashboard screen chart",
    label: "Backlink dofollow — autorité SEO",
  },
  {
    slot: "linkedin",
    query: "professional networking smartphone social business",
    label: "Relais LinkedIn",
  },
  {
    slot: "notoriete",
    query: "handshake business partnership deal office",
    label: "Notoriété et confiance",
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
const out = [];
for (const s of SLOTS) {
  console.log(`\n[${s.slot}] query="${s.query}"`);
  const results = await search(s.query);
  const photo = selectBest(filterFreeOnly(results), used);
  if (!photo) {
    console.warn(`  ! no photo for ${s.slot}`);
    continue;
  }
  used.add(photo.id);
  await triggerDownload(photo.links.download_location);
  out.push({
    slot: s.slot,
    label: s.label,
    photoId: photo.id,
    width: photo.width,
    height: photo.height,
    alt: photo.alt_description || photo.description || s.query,
    src: photo.urls.regular,
    photographer: photo.user.name || photo.user.username,
    photographerUrl: photo.user.links.html,
    photoUrl: `https://unsplash.com/photos/${photo.id}`,
  });
  console.log(`  → ${photo.id} by ${photo.user.name} (${photo.likes} likes)`);
}

const header = `// AUTO-GÉNÉRÉ par scripts/curate-visibilite-client-unsplash.mjs — NE PAS éditer à la main.
// Photos Unsplash réelles conformes CGU (free-tier, download-trigger §6, attribution
// via <UnsplashCredit>). Hotlink images.unsplash.com re-optimisé par next/image.
export interface VisibiliteUnsplashImage {
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

export const VISIBILITE_UNSPLASH: readonly VisibiliteUnsplashImage[] = ${JSON.stringify(out, null, 2)} as const;
`;
writeFileSync(join(ROOT, "src/content/visibilite-client-unsplash.ts"), header, "utf8");
console.log(`\n✅ ${out.length} photos écrites dans src/content/visibilite-client-unsplash.ts`);
