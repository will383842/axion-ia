// One-shot curation — photos Unsplash réelles pour les cartes/fiches du
// catalogue formations (refonte 2026-07-19 : 21 formations + séminaire).
// Réplique le pattern CGU-compliant des autres curate-*-unsplash.mjs :
//   - free-tier only (premium/paid filtré, doctrine v3)
//   - orientation + content_filter=high (anti-NSFW)
//   - déclenche /photos/:id/download_location (CGU API §6) avant "use"
//   - télécharge en AVIF local (0 hotlink) via sharp
//   - écrit un SSOT crédits src/content/formations/catalog-v2-photos.ts (§9)
//
// Sortie : public/illustrations/formations/fiches/{slug}/card.avif
//        + src/content/formations/catalog-v2-photos.ts
// Usage :  UNSPLASH_ACCESS_KEY=... node scripts/curate-formations-cards-unsplash.mjs
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

// slot = slugFr du catalogue (catalog-v2.ts). query = recherche éditoriale
// métier/secteur (personnes au travail, jamais de logo/marque). 16:10 landscape
// 1280×800 pour le bandeau image des cartes + héros de fiche.
const W = 1280;
const H = 800;
const SLOTS = [
  // Offres générales
  { slot: "ia-pour-bien-commencer", query: "team learning together laptop bright office workshop" },
  {
    slot: "ia-pour-bien-commencer-journee",
    query: "colleagues training session computers office day",
  },
  { slot: "ia-pour-les-equipes", query: "team collaboration desks office working together" },
  { slot: "ia-pour-l-automatisation", query: "process planning whiteboard workflow office team" },
  // Offres par métier
  { slot: "ia-pour-les-rh", query: "job interview human resources meeting office two people" },
  { slot: "ia-pour-le-marketing", query: "marketing team creative brainstorming content office" },
  {
    slot: "ia-pour-les-commerciaux",
    query: "sales meeting client presentation business handshake",
  },
  { slot: "ia-pour-la-finance", query: "accountant finance documents desk calculator office" },
  { slot: "ia-pour-le-juridique", query: "lawyer contract signing documents office professional" },
  { slot: "ia-pour-la-production", query: "operations manager tablet production factory floor" },
  { slot: "ia-pour-les-achats", query: "warehouse inventory logistics procurement manager" },
  { slot: "ia-pour-la-relation-client", query: "customer service support headset team office" },
  { slot: "ia-pour-l-it", query: "software developer code screens office team" },
  // Offres par secteur d'activité
  { slot: "ia-pour-la-sante", query: "medical clinic reception administration healthcare" },
  { slot: "ia-pour-le-btp", query: "construction site engineer blueprint helmet" },
  { slot: "ia-pour-l-immobilier", query: "real estate agent apartment visit keys" },
  { slot: "ia-pour-le-commerce", query: "retail store owner counter shop products" },
  {
    slot: "ia-pour-l-hotellerie-restauration",
    query: "hotel reception restaurant service hospitality",
  },
  { slot: "ia-pour-l-industrie", query: "industrial plant engineer machines manufacturing" },
  {
    slot: "ia-pour-le-transport-logistique",
    query: "logistics trucks shipping warehouse planning",
  },
  { slot: "ia-pour-la-banque-assurance", query: "bank advisor client meeting office finance" },
  // Séminaire (rubrique à part)
  {
    slot: "seminaire-ia-toute-l-entreprise-1j",
    query: "company seminar conference room large team meeting",
  },
];

function filterFreeOnly(photos) {
  return photos.filter((p) => p.premium !== true && (p.tier === undefined || p.tier === "free"));
}

function selectBest(photos, usedIds) {
  const fresh = photos.filter((p) => !usedIds.has(p.id));
  const pool = fresh.length ? fresh : photos;
  const sorted = [...pool].sort((a, b) => b.likes - a.likes).slice(0, 12);
  // Privilégie le paysage (ratio > 1.2) pour le bandeau des cartes.
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
  const outDir = join(ROOT, "public/illustrations/formations/fiches", s.slot);
  mkdirSync(outDir, { recursive: true });
  await sharp(buf)
    .resize(W, H, { fit: "cover", position: "attention" })
    .avif({ quality: 62, effort: 5 })
    .toFile(join(outDir, "card.avif"));
  const photographer = photo.user.name || photo.user.username;
  credits.push({
    slot: s.slot,
    photoId: photo.id,
    photographer,
    photographerUrl: photo.user.links.html,
    alt: photo.alt_description || photo.description || s.query,
  });
  console.log(`  → ${photo.id} by ${photographer} (${photo.likes} likes) → ${s.slot}/card.avif`);
}

const header = `/**
 * SSOT — Photos Unsplash des cartes/fiches formations (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-formations-cards-unsplash.mjs. Photos
 * téléchargées en local (public/illustrations/formations/fiches/<slug>/card.avif,
 * 0 hotlink). Attribution photographe OBLIGATOIRE au rendu (CGU Unsplash §9) —
 * consommé par catalog-v2-facts.ts (getFormationImage / getFormationImageCredit).
 * Clé = slugFr du catalogue (catalog-v2.ts).
 */

export interface FormationCardPhoto {
  /** Chemin public local (AVIF 1280×800). */
  src: string;
  /** Alt FR descriptif (base SEO — enrichi côté rendu par le titre). */
  alt: string;
  credit: { name: string; url: string };
}

export const FORMATION_CARD_PHOTOS: Readonly<Record<string, FormationCardPhoto>> = {
`;
const rows = credits
  .map(
    (c) =>
      `  "${c.slot}": {\n    src: "/illustrations/formations/fiches/${c.slot}/card.avif",\n    alt: ${JSON.stringify(c.alt)},\n    credit: { name: ${JSON.stringify(c.photographer)}, url: ${JSON.stringify(c.photographerUrl)} },\n  },`,
  )
  .join("\n");
writeFileSync(
  join(ROOT, "src/content/formations/catalog-v2-photos.ts"),
  `${header}${rows}\n};\n`,
  "utf8",
);
console.log(`\n✓ ${credits.length} photos + SSOT crédits catalog-v2-photos.ts`);
