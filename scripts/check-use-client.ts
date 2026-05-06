// Every "use client" directive must have a justification comment of the
// shape `// use-client: <reason>` either immediately before or immediately
// after the directive. Next.js 16 requires the directive to be the first
// non-comment line, so the "after" position is the canonical one.
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
      const before = lines[i - 1]?.trim() ?? "";
      const after = lines[i + 1]?.trim() ?? "";
      const ok = before.includes("use-client:") || after.includes("use-client:");
      if (!ok) offenders.push(`${file}:${i + 1}`);
      break;
    }
    if (line && !line.startsWith("//") && !line.startsWith("/*") && !line.startsWith("*")) {
      break;
    }
  }
}

if (offenders.length) {
  console.error("[use-client:check] missing justification comment on these files:");
  offenders.forEach((o) => console.error("  " + o));
  console.error(
    '\nAdd a `// use-client: <reason>` comment immediately before or after each "use client" directive.',
  );
  process.exit(1);
}

console.warn("[use-client:check] OK — every directive justified");
