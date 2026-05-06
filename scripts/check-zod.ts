// Sprint 0 stub — full enforcement lands at Sprint 13 (forms) when we have
// schemas to test. For now, simply checks that any file matching
// src/lib/schemas/*.ts has a sibling test under tests/schemas/*.test.ts.
import fs from "node:fs";
import path from "node:path";

const SCHEMAS_DIR = path.resolve("src/lib/schemas");
const TESTS_DIR = path.resolve("tests/schemas");

if (!fs.existsSync(SCHEMAS_DIR)) {
  console.warn("[zod:check] no schemas yet — skipping (Sprint 13 will populate)");
  process.exit(0);
}

const offenders: string[] = [];
for (const f of fs.readdirSync(SCHEMAS_DIR)) {
  if (!f.endsWith(".ts")) continue;
  const base = f.replace(/\.ts$/, "");
  const expected = path.join(TESTS_DIR, `${base}.test.ts`);
  if (!fs.existsSync(expected))
    offenders.push(`${f} (missing ${path.relative(process.cwd(), expected)})`);
}

if (offenders.length) {
  console.error("[zod:check] schemas without test:");
  offenders.forEach((o) => console.error("  " + o));
  process.exit(1);
}

console.warn("[zod:check] OK");
