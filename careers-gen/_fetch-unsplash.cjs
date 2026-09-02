/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-expressions, no-empty */
// Fetch 1 photo Unsplash par offre (mot-clé métier), dédupliquée, + crédit +
// trigger download (conformité CGU Unsplash). Sortie : careers-images.json.
const fs = require("fs");
const path = require("path");
const KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!KEY) {
  console.error("UNSPLASH_ACCESS_KEY manquant");
  process.exit(1);
}

const KW = {
  "business-developer-ia": "business meeting handshake office",
  "formateur-ia-itinerant": "workshop training presentation audience",
  "redacteur-web-ia": "writing laptop notebook desk",
  "charge-rd-ia": "artificial intelligence research lab",
  "ingenieur-ia-implementation": "software engineer coding screen",
  "customer-success-ia": "customer support smiling headset",
  "developpeur-web": "web developer code laptop",
  "devops-infra": "server room data center",
  "designer-ux-ui": "ux designer workspace figma",
  "formateur-ia-sedentaire": "teacher classroom laptop training",
  "stagiaire-formation-ia": "student internship learning laptop",
  "referent-pedagogique-ia": "education design learning material",
  "assistant-financements-qualiopi": "office paperwork administration desk",
  "charge-subventions": "finance documents desk calculator",
  "secretaire-direction": "executive assistant modern office",
  "office-manager": "modern bright office workspace",
  "charge-recrutement-sourcing": "job interview recruitment office",
  "charge-communication": "communication social media laptop",
  "responsable-rh": "human resources team meeting",
  "responsable-reseau-commercial": "sales team meeting whiteboard",
  "chef-projet-ia": "project management team planning",
  "referent-handicap": "inclusive diverse workplace team",
  "responsable-qualite-qualiopi": "quality checklist clipboard office",
  "comptable-raf": "accounting finance desk calculator",
  "juriste-dpo": "legal law documents office",
  "support-hotline-saas": "tech support call center headset",
  "coordinateur-interventions": "logistics planning schedule board",
  "responsable-marketing-growth": "marketing analytics dashboard laptop",
  "directeur-operations": "business leader modern office",
  "directeur-commercial": "sales director business meeting",
  "responsable-acquisition-growth": "growth marketing data analytics",
  "traffic-manager-media-buyer": "digital advertising analytics screen",
  "social-media-manager": "social media content creation phone",
  "community-manager": "community engagement laptop social",
  "videaste-content-creator": "videographer filming camera",
  "monteur-video-motion": "video editing studio timeline",
  "monteur-video-freelance-distance": "freelance video editor home desk headphones",
  "createur-ugc-reels": "smartphone content creator filming",
  "producteur-podcast": "podcast studio microphone recording",
  "monteur-son-podcast": "audio mixing console studio",
  "charge-relations-presse": "press conference microphones journalists",
  "responsable-partenariats-evenements": "conference event networking audience",
  "brand-content-strategist": "creative strategy whiteboard brainstorm",
  "photographe-crea": "photographer camera studio shoot",
};
const HERO_KW = "diverse modern tech team office collaboration";

const used = new Set();
async function search(kw) {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", kw);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  url.searchParams.set("per_page", "15");
  const r = await fetch(url, {
    headers: { Authorization: "Client-ID " + KEY },
  });
  if (!r.ok) throw new Error("Unsplash " + r.status + " pour " + kw);
  const j = await r.json();
  return (j.results || []).filter((p) => p && p.urls && p.urls.regular);
}
function pick(results) {
  const fresh = results.find((p) => !used.has(p.id));
  const chosen = fresh || results[0];
  if (chosen) used.add(chosen.id);
  return chosen;
}
const TRIGGER_DOWNLOAD = process.env.NO_DL !== "1"; // NO_DL=1 → économise le quota
async function one(slug, kw) {
  const results = await search(kw);
  const c = pick(results);
  if (!c) return null;
  // trigger download endpoint (conformité CGU)
  if (TRIGGER_DOWNLOAD && c.links && c.links.download_location) {
    fetch(c.links.download_location + "&client_id=" + KEY).catch(() => {});
  }
  return {
    slug,
    id: c.id,
    url: c.urls.regular,
    alt: (c.alt_description || c.description || kw).slice(0, 140),
    byName: c.user && c.user.name ? c.user.name : "Unsplash",
    byUrl: c.user && c.user.links ? c.user.links.html : "https://unsplash.com",
  };
}

async function main() {
  // idempotent : recharge l'existant, ne fetch que les manquants
  const outPath = path.join(__dirname, "careers-images.json");
  const out = fs.existsSync(outPath)
    ? JSON.parse(fs.readFileSync(outPath, "utf8"))
    : {};
  for (const v of Object.values(out)) if (v && v.id) used.add(v.id);
  if (!out._hero) {
    out._hero = await one("_hero", HERO_KW);
    console.log("hero ok");
  }
  for (const [slug, kw] of Object.entries(KW)) {
    if (out[slug]) {
      continue;
    }
    try {
      const img = await one(slug, kw);
      if (img) {
        out[slug] = img;
        console.log("ok " + slug);
      } else console.log("VIDE " + slug);
    } catch (e) {
      console.log("ERR " + slug + ": " + e.message);
    }
    await new Promise((r) => setTimeout(r, 250)); // rate-limit doux
  }
  fs.writeFileSync(
    path.join(__dirname, "careers-images.json"),
    JSON.stringify(out, null, 1),
    "utf8",
  );
  console.log(
    "\n=== " +
      Object.keys(out).length +
      " images ecrites dans careers-images.json ===",
  );
}
main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
