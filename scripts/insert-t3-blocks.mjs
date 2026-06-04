// Inserts gold-standard sites-web blocks (from a workflow output file) into the
// corresponding ville copy .ts files. Thin cities have no `services:` object → we
// create one with `sitesWeb`. Rich cities (already have `services:`) get sitesWeb
// inserted into the existing object. Idempotent-ish: skips if sitesWeb already there.
//
// Usage: node scripts/insert-t3-blocks.mjs <workflow-output.json>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("usage: node insert-t3-blocks.mjs <output.json>");
  process.exit(1);
}
const parsed = JSON.parse(readFileSync(file, "utf8"));
const cities = Array.isArray(parsed) ? parsed : parsed.result;
const COPY = "src/content/villes/copy";

let inserted = 0,
  skipped = 0,
  failed = 0;
for (const c of cities) {
  if (!c || !c.slug || !c.fr || !c.en) {
    console.error(`! invalid entry, skipped`);
    failed++;
    continue;
  }
  const path = join(COPY, `${c.slug}.ts`);
  if (!existsSync(path)) {
    console.error(`! ${c.slug}: file missing`);
    failed++;
    continue;
  }
  let txt = readFileSync(path, "utf8");
  if (/sitesWeb:\s*\{\s*\n?\s*(fr:|hero)/.test(txt) || /sitesWeb: SITESWEB/.test(txt)) {
    console.log(`= ${c.slug}: already has sitesWeb, skipped`);
    skipped++;
    continue;
  }

  // Compact but valid TS object literal (JSON keys are valid TS). Prettier reformats on commit.
  const sitesWebJson = JSON.stringify({ fr: c.fr, en: c.en });

  if (/^  services:\s*\{/m.test(txt)) {
    // Rich city: insert sitesWeb into the existing services object, before its close.
    // Anchor on the unAUn line close pattern is risky; instead inject right after `  services: {`.
    txt = txt.replace(/^(  services:\s*\{\n)/m, `$1    sitesWeb: ${sitesWebJson},\n`);
  } else {
    // Thin city: create a services object before faqGeolocalisee (2-space top-level field).
    const block = `  services: {\n    sitesWeb: ${sitesWebJson},\n  },\n\n`;
    const m = txt.match(/\n  faqGeolocalisee:/);
    if (!m) {
      console.error(`! ${c.slug}: no faqGeolocalisee anchor`);
      failed++;
      continue;
    }
    txt = txt.replace(/\n  faqGeolocalisee:/, `\n${block}  faqGeolocalisee:`);
  }
  writeFileSync(path, txt, "utf8");
  console.log(`+ ${c.slug}: inserted sitesWeb (${sitesWebJson.length} chars)`);
  inserted++;
}
console.log(`\n=== ${inserted} insérés, ${skipped} déjà présents, ${failed} échecs ===`);
