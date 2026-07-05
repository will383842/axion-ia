// One-shot curation — vraies photos Unsplash pour la bande visuelle « En images »
// de la landing /formations/entreprise. 100 % conforme CGU (réplique la logique de
// src/server/content-gen/providers/unsplash.ts SANS la dépendance DB) :
//   - free-tier only (premium/paid filtré, doctrine v3)
//   - orientation=landscape, content_filter=high (anti-NSFW)
//   - déclenche /photos/:id/download_location (CGU API §6) avant tout « usage »
//   - attribution photographe (le composant <UnsplashCredit> ajoute l'UTM)
//
// Sortie : src/content/formations-entreprise-unsplash.ts (manifeste statique de
// photos RÉELLES). Le hotlink images.unsplash.com est whitelisté next.config et
// re-optimisé (webp/avif/responsive) par next/image.
//
// Usage :  UNSPLASH_ACCESS_KEY=xxx node scripts/curate-formations-entreprise-unsplash.mjs
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
      /* file absent */
    }
  }
  throw new Error("UNSPLASH_ACCESS_KEY not found in env or .env.local");
}

const API = "https://api.unsplash.com";
const KEY = loadKey();

// Slots = photos de la bande « En images » de la page formations entreprise.
const SLOTS = [
  {
    slot: "equipe",
    query: "team training workshop office",
    label: "Vos équipes, formées en présentiel",
  },
  {
    slot: "atelier",
    query: "business people laptop collaboration workshop",
    label: "Des ateliers pratiques sur vos outils",
  },
  {
    slot: "formateur",
    query: "business presenter seminar whiteboard",
    label: "Un formateur IA expert dédié",
  },
  {
    slot: "dirigeants",
    query: "executives meeting modern office",
    label: "Dirigeants & managers embarqués",
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
    src: photo.urls.regular,
    photographer,
    photographerUrl: photo.user.links.html,
    photoUrl: `https://unsplash.com/photos/${photo.id}`,
  });
  console.log(
    `  → ${photo.id} by ${photographer} (${photo.likes} likes, ${photo.width}x${photo.height})`,
  );
}

const header = `// AUTO-GÉNÉRÉ par scripts/curate-formations-entreprise-unsplash.mjs — NE PAS éditer à la main.
// Photos Unsplash réelles, conformes CGU (free-tier, download-trigger §6 déclenché à
// la curation, attribution + UTM via <UnsplashCredit>). Hotlink images.unsplash.com
// (whitelisté next.config), re-optimisé par next/image. Re-curer = relancer le script.
export interface FormationsEntrepriseUnsplashImage {
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

export const FORMATIONS_ENTREPRISE_UNSPLASH: readonly FormationsEntrepriseUnsplashImage[] = ${JSON.stringify(out, null, 2)} as const;
`;

const target = join(ROOT, "src/content/formations-entreprise-unsplash.ts");
writeFileSync(target, header, "utf8");
console.log(`\n✅ ${out.length} photos écrites dans src/content/formations-entreprise-unsplash.ts`);
