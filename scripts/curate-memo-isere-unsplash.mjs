// Curation Unsplash — photos des pages /memo-isere et /devenir-commercial-ia/candidature.
//
// Réplique le pattern CGU-compliant des autres `curate-*-unsplash.mjs` :
//   - free-tier only (premium/paid filtré)
//   - orientation + content_filter=high
//   - déclenche /photos/:id/download_location (CGU API §6) AVANT usage
//   - télécharge en AVIF local sous /public (0 hotlink → indexable Google Images
//     sous notre domaine, référençable dans `src/lib/seo/page-images.ts`)
//   - écrit un SSOT crédits `src/content/recrutement/memo-isere-photos.ts` (§9)
//
// ⚠️ Règle maison (Will 2026-08-12) : JAMAIS de nouvelle photo sans relecture
// en PLANCHE-CONTACT — l'API Unsplash ne filtre ni le N&B ni les clichés hors
// sujet. Le script est donc en DEUX temps :
//
//   1. `node scripts/curate-memo-isere-unsplash.mjs --contact`
//      → écrit `_contact/<slot>.jpg` (6 candidats numérotés) + `_contact/candidates.json`.
//        AUCUN download-trigger n'est envoyé à ce stade (rien n'est « utilisé »).
//   2. Choisir un index par slot dans `_contact/picks.json` (`{ "hero": 2, … }`)
//      puis `node scripts/curate-memo-isere-unsplash.mjs --build`
//      → trigger CGU §6 + AVIF locaux + SSOT crédits.
//
// Usage : UNSPLASH_ACCESS_KEY=... node scripts/curate-memo-isere-unsplash.mjs --contact
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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

// `slot` = clé stable consommée par la page ET par `page-images.ts`.
// `w`/`h` = rendu final : les dimensions déclarées au manifeste DOIVENT
// correspondre (sinon CLS + JSON-LD faux).
const SLOTS = [
  {
    slot: "hero",
    w: 1600,
    h: 1200,
    query: "two people talking business casual smiling meeting",
    file: "commercial-independant-ia-rendez-vous-dirigeant-pme-axion-ia.avif",
  },
  {
    slot: "territoire",
    w: 1600,
    h: 900,
    query: "french alps mountain valley village aerial landscape",
    file: "territoire-corridor-grenoble-lyon-valence-die-axion-ia.avif",
  },
  {
    slot: "terrain",
    w: 1600,
    h: 900,
    query: "corporate training workshop presentation employees room",
    file: "formation-ia-entreprise-presentation-equipe-axion-ia.avif",
  },
  {
    slot: "equipe",
    w: 1600,
    h: 900,
    query: "team collaboration bright modern office working together",
    file: "accompagnement-demarrage-commercial-equipe-axion-ia.avif",
  },
  {
    slot: "secteur-industrie",
    w: 1200,
    h: 900,
    query: "factory industrial workers manufacturing plant",
    file: "clients-industrie-site-production-axion-ia.avif",
  },
  {
    slot: "secteur-tertiaire",
    w: 1200,
    h: 900,
    query: "office professionals meeting business services company",
    file: "clients-tertiaire-siege-services-b2b-axion-ia.avif",
  },
  {
    slot: "secteur-commerce",
    w: 1200,
    h: 900,
    query: "shop owner counter customer local store",
    file: "clients-commerce-artisan-tpe-locale-axion-ia.avif",
  },
  {
    slot: "candidature",
    w: 1400,
    h: 1050,
    query: "person smiling smartphone outdoors casual portrait",
    file: "candidature-commercial-ia-sans-cv-mobile-axion-ia.avif",
  },
];

const OUT_DIR = join(ROOT, "public/illustrations/memo-isere");
const CONTACT_DIR = join(ROOT, "_contact/memo-isere");

function filterFreeOnly(photos) {
  return photos.filter((p) => p.premium !== true && (p.tier === undefined || p.tier === "free"));
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

/** Étiquette « n° » incrustée en haut à gauche de chaque vignette de planche. */
function badgeSvg(n) {
  return Buffer.from(
    `<svg width="360" height="60" xmlns="http://www.w3.org/2000/svg">
       <rect x="0" y="0" width="70" height="60" fill="#b23f16"/>
       <text x="35" y="42" font-family="sans-serif" font-size="34" font-weight="700"
             fill="#ffffff" text-anchor="middle">${n}</text>
     </svg>`,
  );
}

// ── Phase 1 — planche-contact ───────────────────────────────────────────────
async function contactSheets(only) {
  mkdirSync(CONTACT_DIR, { recursive: true });
  // Re-planche partielle (`--only=<slot>`) : on FUSIONNE dans le manifeste
  // existant. Le régénérer entièrement renuméroterait les candidats des autres
  // slots et invaliderait silencieusement les picks déjà arbitrés.
  const manifestPath = join(CONTACT_DIR, "candidates.json");
  const manifest =
    only && existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  for (const s of SLOTS.filter((x) => !only || x.slot === only)) {
    console.log(`\n[${s.slot}] query="${s.query}"`);
    const free = filterFreeOnly(await search(s.query));
    const cands = [...free]
      .filter((p) => p.width / p.height > 1.1)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 6);
    if (!cands.length) {
      console.warn(`  ! aucun candidat pour ${s.slot}`);
      continue;
    }
    const TW = 480;
    const TH = Math.round((TW * s.h) / s.w);
    const tiles = [];
    for (let i = 0; i < cands.length; i++) {
      const p = cands[i];
      const buf = Buffer.from(
        await (await fetch(`${p.urls.raw}&w=${TW * 2}&fit=max&fm=jpg&q=70`)).arrayBuffer(),
      );
      const tile = await sharp(buf)
        .resize(TW, TH, { fit: "cover", position: "attention" })
        .composite([{ input: badgeSvg(i + 1), top: 0, left: 0 }])
        .jpeg({ quality: 72 })
        .toBuffer();
      tiles.push({ input: tile, top: Math.floor(i / 3) * TH, left: (i % 3) * TW });
    }
    const rows = Math.ceil(cands.length / 3);
    await sharp({
      create: {
        width: TW * 3,
        height: TH * rows,
        channels: 3,
        background: { r: 250, g: 248, b: 243 },
      },
    })
      .composite(tiles)
      .jpeg({ quality: 78 })
      .toFile(join(CONTACT_DIR, `${s.slot}.jpg`));
    manifest[s.slot] = cands.map((p) => ({
      id: p.id,
      likes: p.likes,
      alt: p.alt_description || p.description || "",
      photographer: p.user.name || p.user.username,
      photographerUrl: p.user.links.html,
      raw: p.urls.raw,
      downloadLocation: p.links.download_location,
    }));
    console.log(`  → planche ${s.slot}.jpg (${cands.length} candidats)`);
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\n✅ planches dans ${CONTACT_DIR} — choisis un index par slot dans picks.json`);
}

// ── Phase 2 — build ─────────────────────────────────────────────────────────
async function build() {
  const candsPath = join(CONTACT_DIR, "candidates.json");
  const picksPath = join(CONTACT_DIR, "picks.json");
  if (!existsSync(candsPath) || !existsSync(picksPath)) {
    throw new Error("lance d'abord --contact puis renseigne _contact/memo-isere/picks.json");
  }
  const cands = JSON.parse(readFileSync(candsPath, "utf8"));
  const picks = JSON.parse(readFileSync(picksPath, "utf8"));
  mkdirSync(OUT_DIR, { recursive: true });

  const credits = [];
  for (const s of SLOTS) {
    const idx = picks[s.slot];
    if (typeof idx !== "number") {
      console.warn(`  ! pas de pick pour ${s.slot} — ignoré`);
      continue;
    }
    const photo = cands[s.slot]?.[idx - 1];
    if (!photo) {
      console.warn(`  ! pick ${idx} introuvable pour ${s.slot}`);
      continue;
    }
    console.log(`\n[${s.slot}] pick #${idx} → ${photo.id} (${photo.photographer})`);
    await triggerDownload(photo.downloadLocation);
    const buf = Buffer.from(
      await (await fetch(`${photo.raw}&w=${s.w * 2}&fit=max&fm=jpg&q=90`)).arrayBuffer(),
    );
    await sharp(buf)
      .resize(s.w, s.h, { fit: "cover", position: "attention" })
      .avif({ quality: 62, effort: 5 })
      .toFile(join(OUT_DIR, s.file));
    credits.push({
      slot: s.slot,
      file: `/illustrations/memo-isere/${s.file}`,
      width: s.w,
      height: s.h,
      photoId: photo.id,
      photographer: photo.photographer,
      photographerUrl: photo.photographerUrl,
      photoUrl: `https://unsplash.com/photos/${photo.id}`,
      unsplashAlt: photo.alt,
    });
    console.log(`  → ${s.file}`);
  }

  const target = join(ROOT, "src/content/recrutement/memo-isere-photos.ts");
  const body = `/**
 * SSOT — Photos Unsplash de /memo-isere et /devenir-commercial-ia/candidature.
 *
 * AUTO-GÉNÉRÉ par \`scripts/curate-memo-isere-unsplash.mjs --build\`.
 * Photos servies en LOCAL (\`public/illustrations/memo-isere/*.avif\`) → 0 hotlink,
 * indexables Google Images sous notre domaine (cf. \`src/lib/seo/page-images.ts\`).
 *
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe RENDUE sur la page (§9) via <UnsplashCredit>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 *
 * Le champ \`alt\` est RÉDIGÉ à la main côté page (l'alt Unsplash est en anglais
 * et décrit la photo, pas son rôle éditorial) — ici on ne garde que le crédit.
 */

export interface MemoIserePhoto {
  readonly slot: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
}

export const MEMO_ISERE_PHOTOS = ${JSON.stringify(
    Object.fromEntries(
      credits.map((c) => [
        c.slot,
        {
          slot: c.slot,
          src: c.file,
          width: c.width,
          height: c.height,
          photographer: c.photographer,
          photographerUrl: c.photographerUrl,
          photoUrl: c.photoUrl,
        },
      ]),
    ),
    null,
    2,
  )} as const satisfies Record<string, MemoIserePhoto>;

export type MemoIserePhotoSlot = keyof typeof MEMO_ISERE_PHOTOS;

export function memoPhoto(slot: MemoIserePhotoSlot): MemoIserePhoto {
  return MEMO_ISERE_PHOTOS[slot];
}
`;
  writeFileSync(target, body, "utf8");
  console.log(`\n✅ ${credits.length} photos + memo-isere-photos.ts`);
}

const onlyArg = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
await (process.argv.includes("--build") ? build() : contactSheets(onlyArg));
