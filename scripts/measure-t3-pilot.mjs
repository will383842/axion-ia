// Measures inter-city content uniqueness (anti-doorway gate) for the T3 pilot.
// Reads the workflow output file, extracts each city's FR copy (hero + whyHere +
// faq answers + guarantees), computes pairwise Jaccard similarity on word shingles.
// Doorway risk if any pair > 0.40 (Google HCU near-duplicate heuristic).
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node measure-t3-pilot.mjs <output-file>");
  process.exit(1);
}
const raw = readFileSync(file, "utf8");
let cities;
try {
  const obj = JSON.parse(raw);
  cities = Array.isArray(obj) ? obj : obj.result;
} catch (e) {
  console.error("JSON parse failed:", e.message);
  process.exit(1);
}
if (!Array.isArray(cities)) {
  console.error("No result array.");
  process.exit(1);
}

function frText(c) {
  const f = c.fr || {};
  const parts = [
    f.hero || "",
    ...(f.whyHere || []),
    ...(f.faq || []).map((x) => `${x.q} ${x.a}`),
    ...(f.pricing || []).map((x) => x.detail || ""),
    f.guarantees || "",
  ];
  return parts.join(" ");
}
function shingles(text, n = 3) {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const set = new Set();
  for (let i = 0; i + n <= words.length; i++) set.add(words.slice(i, i + n).join(" "));
  return set;
}
function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const sh = cities.map((c) => ({ slug: c.slug, set: shingles(frText(c)), len: frText(c).length }));
console.log(`\n=== ${cities.length} villes — longueur FR (hero+whyHere+faq+pricing+guarantees) ===`);
for (const s of sh) console.log(`  ${s.slug.padEnd(12)} ${s.len} chars · ${s.set.size} shingles(3-grammes)`);

console.log(`\n=== Similarité Jaccard inter-villes (3-grammes de mots) — DOORWAY si > 0.40 ===`);
let maxPair = { v: 0, a: "", b: "" };
for (let i = 0; i < sh.length; i++) {
  for (let j = i + 1; j < sh.length; j++) {
    const v = jaccard(sh[i].set, sh[j].set);
    const flag = v > 0.4 ? " ⚠️ DOORWAY" : v > 0.25 ? " ~ surveiller" : " ✅";
    console.log(`  ${sh[i].slug.padEnd(12)} vs ${sh[j].slug.padEnd(12)} : ${v.toFixed(3)}${flag}`);
    if (v > maxPair.v) maxPair = { v, a: sh[i].slug, b: sh[j].slug };
  }
}
console.log(`\n→ Pire paire : ${maxPair.a} vs ${maxPair.b} = ${maxPair.v.toFixed(3)} ${maxPair.v > 0.4 ? "⚠️ DOORWAY — NE PAS publier tel quel" : maxPair.v > 0.25 ? "~ acceptable mais à surveiller" : "✅ UNIQUE — sûr"}`);

// Spot: show each city's 1st whyHere bullet (proves grounding)
console.log(`\n=== 1re puce whyHere de chaque ville (preuve d'ancrage local) ===`);
for (const c of cities) console.log(`  [${c.slug}] ${(c.fr?.whyHere?.[0] || "").slice(0, 150)}…`);
