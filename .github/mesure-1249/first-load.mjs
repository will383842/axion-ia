// Mesure du First Load JS (gz) des routes de la fiche session, sur un .next
// produit par `next build --webpack --experimental-build-mode compile`.
// First Load = rootMainFiles (+ polyfills) ∪ entryJSFiles de TOUS les segments
// (layouts + page) de la route, lus dans son client-reference-manifest.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";

const nextDir = path.resolve(process.argv[2]);
const etiquette = process.argv[3] ?? "";
const ROUTES = [
  "qualiopi/sessions/[id]",
  "qualiopi/sessions/[id]/emargement",
  "qualiopi/sessions/[id]/evaluations",
  "qualiopi/sessions/[id]/financement",
  "qualiopi/sessions/[id]/kit",
];

const bm = JSON.parse(fs.readFileSync(path.join(nextDir, "build-manifest.json"), "utf8"));
const racine = [...(bm.rootMainFiles ?? [])];
const polyfills = [...(bm.polyfillFiles ?? [])];

function tous(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tous(p, out);
    else if (e.name === "page_client-reference-manifest.js") out.push(p);
  }
  return out;
}
const manifestes = tous(path.join(nextDir, "server", "app"));
const norm = (p) => p.split(path.sep).join("/");

const gz = new Map();
function poids(f) {
  if (!gz.has(f)) {
    const abs = path.join(nextDir, f.replace(/^\/?_next\//, ""));
    const buf = fs.readFileSync(abs);
    gz.set(f, { brut: buf.length, gz: zlib.gzipSync(buf).length });
  }
  return gz.get(f);
}

const lignes = [];
const details = {};
for (const route of ROUTES) {
  const suffixe = `/${route}/page_client-reference-manifest.js`;
  const m = manifestes.find((p) => norm(p).endsWith(suffixe) && norm(p).includes("[adminPrefix]"));
  if (!m) {
    lignes.push(`| ${route} | manifeste introuvable | | |`);
    continue;
  }
  const ctx = { globalThis: {} };
  ctx.globalThis = ctx;
  vm.runInNewContext(fs.readFileSync(m, "utf8"), ctx);
  const cles = Object.keys(ctx.__RSC_MANIFEST ?? {});
  const man = ctx.__RSC_MANIFEST[cles[0]];
  const entrees = man.entryJSFiles ?? {};
  // Les polyfills sont servis en `nomodule` : Next les exclut du First Load.
  const fichiers = new Set([...racine]);
  for (const liste of Object.values(entrees)) for (const f of liste) if (f.endsWith(".js")) fichiers.add(f);
  // Webpack : pas d'entryJSFiles ; les chunks de chaque composant client du
  // manifeste de la route (layouts + page) sont chargés à l'hydratation.
  let nbModules = 0;
  for (const mod of Object.values(man.clientModules ?? {})) {
    nbModules++;
    for (const c of mod.chunks ?? []) if (typeof c === "string" && c.endsWith(".js")) fichiers.add(c);
  }
  // Chunks d'ENTRÉE webpack des segments (layout-*.js / page-*.js) de la route.
  const rel = norm(path.relative(path.join(nextDir, "server", "app"), path.dirname(m)));
  const parts = rel.split("/");
  for (let i = 0; i <= parts.length; i++) {
    const d = path.join(nextDir, "static", "chunks", "app", ...parts.slice(0, i));
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      const estPage = i === parts.length && /^page-.*\.js$/.test(f);
      if (/^layout-.*\.js$/.test(f) || estPage)
        fichiers.add(norm(path.join("static", "chunks", "app", ...parts.slice(0, i), f)));
    }
  }
  if (route === ROUTES[0]) {
    console.log("DIAG cles manifeste:", Object.keys(man).join(","), "| modules clients:", nbModules, "| entryJSFiles:", Object.keys(entrees).length);
    console.log("DIAG app-build-manifest:", fs.existsSync(path.join(nextDir, "app-build-manifest.json")));
    console.log("DIAG dossier:", fs.readdirSync(path.dirname(m)).join(","));
    const ex = Object.entries(man.clientModules ?? {}).slice(0, 2);
    console.log("DIAG exemple:", JSON.stringify(ex).slice(0, 600));
  }
  let totalGz = 0;
  let totalBrut = 0;
  for (const f of fichiers) {
    const w = poids(f);
    totalGz += w.gz;
    totalBrut += w.brut;
  }
  // Part propre à la route : hors racine/polyfills partagés.
  let propreGz = 0;
  for (const f of fichiers) if (!racine.includes(f)) propreGz += poids(f).gz;
  details[route] = { modulesClients: nbModules, segments: Object.keys(entrees).map((k) => k.replace(/.*\/src\/app/, "src/app")), fichiers: [...fichiers].map((f) => ({ f, ...poids(f) })) };
  lignes.push(
    `| ${route} | ${(totalGz / 1024).toFixed(1)} KB | ${(propreGz / 1024).toFixed(1)} KB | ${(totalBrut / 1024).toFixed(1)} KB |`,
  );
}

const md = [
  `### First Load JS — ${etiquette}`,
  "",
  "| Route (console) | First Load JS gz | dont propre à la route gz | First Load brut |",
  "|---|---|---|---|",
  ...lignes,
  "",
  `Racine partagée (rootMainFiles, polyfills nomodule exclus) : ${((racine.reduce((s, f) => s + poids(f).gz, 0)) / 1024).toFixed(1)} KB gz`,
].join("\n");
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n\n");
fs.writeFileSync(`first-load-${etiquette}.json`, JSON.stringify(details, null, 2));
