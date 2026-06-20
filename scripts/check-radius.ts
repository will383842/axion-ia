// Reject any `rounded-[NNpx]` or `border-radius: NNpx` where NN > 8 — except
// 9999px / 50% / `rounded-full` (avatars only). Aligned with Design.md §5
// (radius 2-8px conservative).
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src/app", "src/components"];
const exts = new Set([".ts", ".tsx", ".css", ".js", ".jsx", ".mjs"]);

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
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

const offenders: { file: string; line: number; match: string }[] = [];

// Tailwind arbitrary radius syntax: rounded-[NNpx] or rounded-[NNrem] etc.
const ARB_RX = /rounded-\[(\d+(?:\.\d+)?)(px|rem|em)\]/g;
// Inline CSS: border-radius: NNpx
const CSS_RX = /border-radius\s*:\s*(\d+(?:\.\d+)?)(px|rem|em)/g;

const PX_LIMIT = 8;
const REM_LIMIT = 0.5; // 8px ≈ 0.5rem

for (const root of ROOTS) {
  for (const file of walk(root)) {
    // globals.css holds canonical radius tokens — skip it.
    // admin.css : feuille de style cloisonnée de la console admin. L'admin a sa
    // PROPRE doctrine de rayons (cf. en-tête admin.css : « radius 4-12 max vs
    // public 12-16 ») ; le cap 8px de Design.md §5 vise le SITE PUBLIC (admin =
    // noindex, hors budget Web Vitals). Ces rayons admin (pills 999px, cmdk
    // 12px, cartes 12px…) vivaient dans globals.css (déjà sauté) avant l'Étape 1
    // d'unification (juin 2026) ; on préserve l'exemption après relocalisation.
    if (file.endsWith("globals.css") || file.endsWith("admin.css")) continue;

    const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
    lines.forEach((line, idx) => {
      const checkOne = (rx: RegExp) => {
        let m: RegExpExecArray | null;
        while ((m = rx.exec(line)) !== null) {
          const value = parseFloat(m[1] ?? "0");
          const unit = m[2] ?? "px";
          const limit = unit === "px" ? PX_LIMIT : REM_LIMIT;
          if (value > limit) offenders.push({ file, line: idx + 1, match: m[0] });
        }
      };
      checkOne(new RegExp(ARB_RX.source, ARB_RX.flags));
      checkOne(new RegExp(CSS_RX.source, CSS_RX.flags));
    });
  }
}

if (offenders.length > 0) {
  console.error("[radius:check] radius > 8px (or 0.5rem) found — Design.md §5 caps at 8px");
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  ${o.match}`);
  }
  console.error("Use rounded-full for avatars only.");
  process.exit(1);
}

console.warn("[radius:check] OK — no functional radius > 8px");
