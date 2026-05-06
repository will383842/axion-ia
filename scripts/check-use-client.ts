// Every "use client" directive must be preceded by a justification comment:
//   // use-client: <reason>
// Enforces axionia-anti-spa: client boundary is an exception, not a default.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");
const exts = new Set([".ts", ".tsx"]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, acc);
    } else if (exts.has(path.extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

const offenders: string[] = [];

for (const file of walk(ROOT)) {
  const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (line === '"use client";' || line === "'use client';") {
      const prev = lines[i - 1]?.trim() ?? "";
      if (!prev.includes("use-client:")) {
        offenders.push(`${file}:${i + 1}`);
      }
      break;
    }
    if (line && !line.startsWith("//") && !line.startsWith("/*") && !line.startsWith("*")) {
      break; // first non-comment, non-empty line passed; no directive present
    }
  }
}

if (offenders.length) {
  console.error("[use-client:check] missing justification comment on these files:");
  offenders.forEach((o) => console.error("  " + o));
  console.error(
    '\nAdd a `// use-client: <reason>` comment immediately above each "use client" directive.',
  );
  process.exit(1);
}

console.warn("[use-client:check] OK — every directive justified");
