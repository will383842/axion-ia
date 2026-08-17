// Re-curation ciblee de quelques slots dont le premier tirage ne convenait pas
// (noir et blanc, sujet hors propos, cadre trop vide).
//
// Ajoute au pattern des autres curate-*-unsplash.mjs un GARDE-FOU CHROMATIQUE :
// le site est en ivoire/terracotta, une photo desaturee y jure. On mesure
// l'ecart moyen entre canaux RVB sur une vignette et on rejette en dessous du
// seuil — c'est ce qui avait laisse passer une photo noir et blanc.
//
// Usage : UNSPLASH_ACCESS_KEY=... node scripts/curate-recadrage-unsplash.mjs
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

// `target` : "home" → public/illustrations/home/<slot>.avif + home-photos.ts
//            "edito" → public/illustrations/<file>.avif + editorial-photos.ts
const SLOTS = [
  {
    target: "home",
    slot: "audience-01-tpe",
    w: 1600,
    h: 900,
    query: "shop owner standing in her small store",
  },
  {
    target: "home",
    slot: "audience-04-grands-comptes",
    w: 1600,
    h: 900,
    query: "corporate office lobby people walking business",
  },
  {
    target: "edito",
    slot: "cas-concrets-mid-1",
    file: "illustrations/cas-concrets-mid-1",
    w: 1600,
    h: 900,
    query: "printed business report charts documents on desk",
  },
  {
    target: "edito",
    slot: "comparaisons-mid-1",
    file: "illustrations/comparaisons-mid-1",
    w: 1200,
    h: 1200,
    query: "comparison chart notes overhead desk",
  },
];

/** Ecart moyen max-min entre canaux RVB. < 12 ≈ image desaturee / N&B. */
async function colourfulness(buf) {
  const { data } = await sharp(buf)
    .resize(64, 64, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let total = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    total += Math.max(r, g, b) - Math.min(r, g, b);
  }
  return total / (data.length / 3);
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

const MIN_COLOUR = 12;
const picked = [];

for (const s of SLOTS) {
  console.log(`\n[${s.slot}] query="${s.query}"`);
  const results = (await search(s.query)).filter(
    (p) => p.premium !== true && (p.tier === undefined || p.tier === "free"),
  );
  const byLikes = [...results].sort((a, b) => b.likes - a.likes);
  const wellShaped = byLikes.filter((p) => p.width / p.height > 1.3);
  const ranked = (wellShaped.length >= 5 ? wellShaped : byLikes).slice(0, 20);

  let chosen = null;
  for (const photo of ranked) {
    const rawUrl = `${photo.urls.raw}&w=${s.w * 2}&fit=max&fm=jpg&q=90`;
    const buf = Buffer.from(await (await fetch(rawUrl)).arrayBuffer());
    const c = await colourfulness(buf);
    if (c < MIN_COLOUR) {
      console.log(`  – ${photo.id} rejete (desature, ecart RVB ${c.toFixed(1)})`);
      continue;
    }
    chosen = { photo, buf, c };
    break;
  }
  if (!chosen) {
    console.warn(`  ! aucun candidat colore pour ${s.slot}`);
    continue;
  }

  const { photo, buf, c } = chosen;
  await triggerDownload(photo.links.download_location);
  const outPath =
    s.target === "home"
      ? join(ROOT, "public/illustrations/home", `${s.slot}.avif`)
      : join(ROOT, "public", `${s.file}.avif`);
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(buf)
    .resize(s.w, s.h, { fit: "cover", position: "attention" })
    .avif({ quality: 62, effort: 5 })
    .toFile(outPath);

  picked.push({
    target: s.target,
    slot: s.slot,
    src: s.target === "home" ? `/illustrations/home/${s.slot}.avif` : `/${s.file}.avif`,
    width: s.w,
    height: s.h,
    photoId: photo.id,
    photographer: photo.user.name || photo.user.username,
    photographerUrl: photo.user.links.html,
    photoUrl: `https://unsplash.com/photos/${photo.id}`,
    alt: photo.alt_description || photo.description || s.query,
  });
  console.log(
    `  → ${photo.id} by ${photo.user.name} (${photo.likes} likes, couleur ${c.toFixed(1)})`,
  );
}

// Mise a jour chirurgicale des deux SSOT : on ne reecrit que les slots touches,
// les autres entrees (et leurs credits) restent intactes.
function patchSsot(file, constName, rows) {
  if (rows.length === 0) return;
  const p = join(ROOT, file);
  let src = readFileSync(p, "utf8");
  for (const r of rows) {
    const re = new RegExp(`("${r.slot}": \\{)([\\s\\S]*?)(\\n  \\})`);
    if (!re.test(src)) {
      console.warn(`  ! slot ${r.slot} absent de ${file}`);
      continue;
    }
    const body = Object.entries(r)
      .filter(([k]) => !["target"].includes(k))
      .map(([k, v]) => `\n    "${k}": ${JSON.stringify(v)},`)
      .join("")
      .replace(/,$/, "");
    src = src.replace(re, `$1${body}$3`);
  }
  writeFileSync(p, src, "utf8");
  console.log(`  ✎ ${file} mis a jour (${constName})`);
}

patchSsot(
  "src/content/home/home-photos.ts",
  "HOME_PHOTO_CREDITS",
  // Les credits de l'accueil ne portent ni src ni dimensions : ils vivent dans
  // home-images.ts. On ne pousse donc que les champs d'attribution.
  picked
    .filter((r) => r.target === "home")
    .map((r) => ({
      slot: r.slot,
      photoId: r.photoId,
      photographer: r.photographer,
      photographerUrl: r.photographerUrl,
      photoUrl: r.photoUrl,
      alt: r.alt,
    })),
);
patchSsot(
  "src/content/pages/editorial-photos.ts",
  "EDITORIAL_PHOTOS",
  picked.filter((r) => r.target === "edito"),
);

console.log(`\n✅ ${picked.length} slots recadres`);
