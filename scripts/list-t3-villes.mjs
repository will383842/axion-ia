// One-shot: list T3 cities (population 20k-100k) that do NOT yet have a rich
// `services` block (i.e. not one of the ~40 hand-written hubs). Reads the static
// villes data + the copy .ts files directly (NO DB needed). Outputs JSON to stdout.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "src/content/villes/data");
const COPY_DIR = join(ROOT, "src/content/villes/copy");

// Parse each region data file for { slug, nameFr, population, region } tuples.
// Data entries look like: slug: "lyon", nameFr: "Lyon", population: 522969, ...
const villes = [];
for (const f of readdirSync(DATA_DIR)) {
  if (!f.endsWith(".ts")) continue;
  const txt = readFileSync(join(DATA_DIR, f), "utf8");
  // Split on object boundaries; cheap regex extraction per ville object.
  const re = /slug:\s*"([^"]+)"[\s\S]{0,600}?population:\s*([0-9_]+)/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const slug = m[1];
    const population = parseInt(m[2].replace(/_/g, ""), 10);
    villes.push({ slug, population, region: f.replace(".ts", "") });
  }
}

function hasRichServices(slug) {
  const p = join(COPY_DIR, `${slug}.ts`);
  if (!existsSync(p)) return false;
  const txt = readFileSync(p, "utf8");
  return /^  services:\s*\{/m.test(txt); // rich block (2-space indent object)
}
function hasSitesWeb(slug) {
  const p = join(COPY_DIR, `${slug}.ts`);
  if (!existsSync(p)) return false;
  return /sitesWeb:\s*\{\s*\n?\s*(fr:|SITESWEB)/m.test(readFileSync(p, "utf8"));
}

const t3All = villes.filter((v) => v.population >= 20_000 && v.population < 100_000);
// « À faire » = T3 sans bloc RICHE `services:` (le pitch court servicesContext ne compte pas).
const t3NeedSitesWeb = t3All.filter((v) => !hasRichServices(v.slug));
void hasSitesWeb;
const t3WithCopyFile = t3All.filter((v) => existsSync(join(COPY_DIR, `${v.slug}.ts`)));

// Dedup by slug + sort by population desc (biggest T3 first = best grounding)
const seen = new Set();
const list = t3NeedSitesWeb
  .filter((v) => (seen.has(v.slug) ? false : (seen.add(v.slug), true)))
  .sort((a, b) => b.population - a.population)
  .map((v) => ({ slug: v.slug, population: v.population, region: v.region }));

console.error(`[t3] total villes parsed: ${villes.length}`);
console.error(
  `[t3] T3 (20k-100k): ${t3All.length} | avec fichier copy: ${t3WithCopyFile.length} | sans sitesWeb: ${list.length}`,
);
console.error(
  `[t3] échantillon (10 plus grandes): ${list
    .slice(0, 10)
    .map((v) => `${v.slug}(${v.population})`)
    .join(", ")}`,
);
console.log(JSON.stringify(list));
