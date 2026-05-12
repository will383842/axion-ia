// One-shot fix mojibake (UTF-8 mal lu comme Latin1 puis ré-encodé).
// Sprint 14.10.7 fix Will (2026-05-12).
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/fix-mojibake.mjs <file...>");
  process.exit(1);
}

// IMPORTANT : 'Ã ' affiché vient en réalité de 'Ã' + NBSP (U+00A0), pas
// un espace normal. Construire le codepoint explicite pour éviter les
// mismatches sur Edit tool (qui sérialise NBSP comme espace standard).
const NBSP = String.fromCharCode(0x00a0);
const fixes = [
  [`Ã${NBSP}`, "à"], // 'Ã' + NBSP → 'à'
  ["Ã©", "é"],
  ["Ã¨", "è"],
  ["Ãª", "ê"],
  ["Ã¢", "â"],
  ["Ã´", "ô"],
  ["Ã®", "î"],
  ["Ã»", "û"],
  ["Ã§", "ç"],
  ["Ã—", "×"],
];

let totalAcrossFiles = 0;
for (const f of args) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) {
    console.warn("skip (missing):", p);
    continue;
  }
  let s = fs.readFileSync(p, "utf8");
  let count = 0;
  for (const [bad, good] of fixes) {
    const occurrences = s.split(bad).length - 1;
    if (occurrences > 0) {
      s = s.split(bad).join(good);
      count += occurrences;
    }
  }
  if (count > 0) {
    fs.writeFileSync(p, s, "utf8");
    console.log(`✓ ${path.relative(process.cwd(), p)} — ${count} fixes`);
    totalAcrossFiles += count;
  }
}
console.log(`Total: ${totalAcrossFiles} replacements`);
