#!/usr/bin/env node
/**
 * Audit certification Qualiopi — Phase 0.5 : auto-inventaire exhaustif.
 *
 * Génère mécaniquement les 8 inventaires qui pilotent tout l'audit, puis en
 * dérive PROGRESS.csv (le registre maître). Aucune saisie manuelle : ce script
 * est la source de vérité de « ce qu'il y a à auditer ».
 *
 * Usage : node scripts/qualiopi/audit-inventory.mjs <dossier-de-sortie>
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();

/**
 * 🔑 CE SCRIPT NE DOIT PLUS JAMAIS RENDRE LE VIDE EN ANNONÇANT LE SUCCÈS.
 *
 * Ces deux registres collectent ce qui a échoué pendant le balayage. Ils sont
 * relus à la toute fin, et le script SORT EN ERREUR s'ils ne sont pas vides ou
 * si un inventaire est invraisemblable. Un audit lancé sur un périmètre faux ne
 * mesure rien — et il ressemble exactement à un audit qui n'a rien trouvé.
 */
const illisibles = [];
const absents = [];
const invraisemblances = [];

/**
 * 🔴 2026-08-24 — LE DOSSIER DE SORTIE ÉTAIT UN ARGUMENT OBLIGATOIRE, ET C'EST
 * UNE DES RAISONS POUR LESQUELLES CE SCRIPT NE TOURNAIT JAMAIS.
 *
 * Sans valeur par défaut, il ne pouvait pas être appelé par un script npm ni par
 * un workflow — et de fait, au 2026-08-24, AUCUN des deux ne l'appelait. La
 * « source de vérité de ce qu'il y a à auditer » ne tournait que si quelqu'un se
 * souvenait de la lancer à la main, avec le bon chemin.
 *
 * Le défaut est désormais gitignoré (`_AUDIT/VERIF-QUALIOPI-CHAINE-COMPLETE/`
 * couvre déjà les artefacts de run ; celui-ci a sa propre ligne) : relancer ne
 * salit pas le dépôt, et `pnpm qualiopi:audit-inventory` suffit.
 */
const OUT = process.argv[2] ?? join(ROOT, "_AUDIT-INVENTAIRE");
mkdirSync(join(OUT, "05-INVENTAIRE"), { recursive: true });

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  ".turbo",
  "generated",
  ".claude",
  "test-results",
  "playwright-report",
]);

/** Marche récursive, renvoie les chemins relatifs POSIX. */
function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // 🔴 2026-08-24 — CE `catch` ÉTAIT NU, ET IL RENDAIT L'ACCUMULATEUR EN L'ÉTAT.
    // Un dossier illisible disparaissait donc de l'inventaire sans un mot, et le
    // script se terminait sur un code 0. Ce fichier se déclare « la source de
    // vérité de ce qu'il y a à auditer » : une source de vérité qui perd une
    // branche en silence produit un périmètre faux, et tout l'audit raisonne
    // dessus. On COMPTE l'incident, et `main` refuse de conclure s'il y en a.
    illisibles.push(`${relative(ROOT, dir)} — ${err instanceof Error ? err.message : String(err)}`);
    return acc;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".claude") {
      if (e.isDirectory()) continue;
    }
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, acc);
    } else {
      acc.push(relative(ROOT, full).split(sep).join("/"));
    }
  }
  return acc;
}

const csvCell = (v) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const writeCsv = (name, header, rows) => {
  const body = [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
  writeFileSync(join(OUT, "05-INVENTAIRE", name), body + "\n", "utf8");
  console.log(`  ${name.padEnd(28)} ${rows.length} lignes`);
  return rows.length;
};

/**
 * 🔴 2026-08-24 — CE `catch` RENDAIT `""`, ET UN FICHIER MANQUANT DEVENAIT DONC
 * INDISCERNABLE D'UN FICHIER VIDE.
 *
 * Conséquence : un chemin périmé — après un renommage, un déplacement — faisait
 * rendre un inventaire VIDE sur la section concernée, sans erreur, avec un code
 * de sortie 0. Le dépôt a déjà payé ce motif trois fois : 0 test sur 237 lus
 * comme un vert, quatre specs de console qui n'exécutaient aucune assertion, et
 * un cliquet de budgets qui cherchait deux de ses trois aides au mauvais chemin.
 *
 * On distingue désormais les deux cas, et on RETIENT l'absence.
 */
const read = (p) => {
  try {
    return readFileSync(join(ROOT, p), "utf8");
  } catch (err) {
    absents.push(`${p} — ${err instanceof Error ? err.message : String(err)}`);
    return "";
  }
};

console.log("Inventaire depuis :", ROOT, "\n");
const all = walk(join(ROOT, "src"));
const counts = {};

/* ------------------------------------------------------------------ */
/* 1 + 2 — Routes (page.tsx) : publiques et admin                      */
/* ------------------------------------------------------------------ */
const pages = all.filter((p) => /^src\/app\/.*\/page\.tsx$/.test(p) || p === "src/app/page.tsx");

/** Chemin fichier -> URL : retire src/app, les groupes (xxx), et /page.tsx */
function toUrl(file) {
  return (
    "/" +
    file
      .replace(/^src\/app\//, "")
      .replace(/\/page\.tsx$/, "")
      .split("/")
      .filter((seg) => !/^\(.*\)$/.test(seg))
      .join("/")
  );
}

const publicRows = [];
const adminRows = [];
for (const f of pages) {
  const src = read(f);
  const url = toUrl(f);
  const isAdmin = f.includes("(admin)");
  const dynamic = /\[/.test(url) ? "dynamique" : "statique";
  const usesDb = /\bprisma\b/.test(src) ? "oui" : "non";
  const isClient = /^["']use client["']/m.test(src) ? "oui" : "non";
  const revalidate = (src.match(/export const revalidate\s*=\s*([^\s;]+)/) || [])[1] ?? "";
  if (isAdmin) {
    const seg = url.split("/").filter(Boolean);
    adminRows.push([
      f,
      url,
      seg[2] ?? "",
      seg.slice(3).join("/"),
      dynamic,
      usesDb,
      isClient,
      revalidate,
    ]);
  } else {
    publicRows.push([f, url, dynamic, usesDb, isClient, revalidate]);
  }
}
counts.pub = writeCsv(
  "INV-ROUTES-PUBLIQUES.csv",
  ["fichier", "url", "type", "depend_db", "use_client", "revalidate"],
  publicRows.sort((a, b) => a[1].localeCompare(b[1])),
);
counts.adm = writeCsv(
  "INV-ROUTES-ADMIN.csv",
  ["fichier", "url", "section", "sous_section", "type", "depend_db", "use_client", "revalidate"],
  adminRows.sort((a, b) => a[1].localeCompare(b[1])),
);

/* ------------------------------------------------------------------ */
/* 3 — API routes                                                      */
/* ------------------------------------------------------------------ */
const apiRows = all
  .filter((p) => /^src\/app\/api\/.*\/route\.ts$/.test(p))
  .map((f) => {
    const src = read(f);
    const methods = [
      ...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)/g),
    ]
      .map((m) => m[1])
      .join(" ");
    return [
      f,
      "/" + f.replace(/^src\/app\//, "").replace(/\/route\.ts$/, ""),
      methods,
      /auth\(|getServerSession|requireAdmin|assertAdmin/.test(src) ? "oui" : "non",
      /z\.object|zod/.test(src) ? "oui" : "non",
      /rateLimit|ratelimit|limiter/.test(src) ? "oui" : "non",
      /signature|verifyWebhook|constructEvent|hmac/i.test(src) ? "oui" : "non",
    ];
  });
counts.api = writeCsv(
  "INV-API.csv",
  [
    "fichier",
    "url",
    "methodes",
    "auth_detectee",
    "validation_zod",
    "rate_limit",
    "signature_webhook",
  ],
  apiRows.sort((a, b) => a[1].localeCompare(b[1])),
);

/* ------------------------------------------------------------------ */
/* 4 — Server actions                                                  */
/* ------------------------------------------------------------------ */
const actionRows = [];
for (const f of all.filter((p) => /\.tsx?$/.test(p))) {
  const src = read(f);
  if (!/^\s*["']use server["']/m.test(src)) continue;
  const fns = [...src.matchAll(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  for (const fn of fns.length ? fns : ["(aucune export async function)"]) {
    actionRows.push([
      f,
      fn,
      // Élargi après faux positif sur coaching.actions.ts (garde `requireFormateurAction`
      // + `assertOwnership`) : on couvre les gardes admin, formateur, portail et
      // l'import d'un module `guard`. Reste file-level → à confirmer par fonction.
      /auth\(|getServerSession|require[A-Z]\w*|assert[A-Z]\w*|from ["'][^"']*guard["']|forbidden|Unauthorized/.test(
        src,
      )
        ? "oui"
        : "NON",
      /z\.object|parse\(|safeParse/.test(src) ? "oui" : "NON",
      /prisma\.\w+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)/.test(src)
        ? "oui"
        : "non",
      /activityLog|auditLog|logActivity|journal/i.test(src) ? "oui" : "non",
    ]);
  }
}
counts.act = writeCsv(
  "INV-SERVER-ACTIONS.csv",
  ["fichier", "action", "controle_autorisation", "validation_entree", "mute_la_base", "journalise"],
  actionRows.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1])),
);

/* ------------------------------------------------------------------ */
/* 5 — Modèles Prisma                                                  */
/* ------------------------------------------------------------------ */
const schema = read("prisma/schema.prisma");
const qualiopiSrc = walk(join(ROOT, "src", "server", "qualiopi"))
  .map((p) => read(p))
  .join("\n");
const modelRows = [];
for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  const [, name, body] = m;
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"));
  const fields = lines.filter((l) => /^\w+\s+\w/.test(l) && !l.startsWith("@@"));
  const relations = fields.filter((l) => /@relation/.test(l)).length;
  const uniques = (body.match(/@@unique|@unique/g) || []).length;
  const indexes = (body.match(/@@index/g) || []).length;
  const cascade = /onDelete:\s*Cascade/.test(body) ? "oui" : "non";
  const usedByQualiopi = new RegExp(`prisma\\.${name[0].toLowerCase()}${name.slice(1)}\\b`).test(
    qualiopiSrc,
  )
    ? "oui"
    : "non";
  modelRows.push([name, fields.length, relations, uniques, indexes, cascade, usedByQualiopi]);
}
counts.mod = writeCsv(
  "INV-MODELES.csv",
  [
    "modele",
    "champs",
    "relations",
    "contraintes_unicite",
    "index",
    "on_delete_cascade",
    "utilise_par_qualiopi",
  ],
  modelRows,
);

/* ------------------------------------------------------------------ */
/* 6 — Documents générés                                               */
/* ------------------------------------------------------------------ */
const docFiles = all.filter(
  (p) => /^src\/server\/qualiopi\/(documents|supports)\//.test(p) && /\.tsx?$/.test(p),
);
const docRows = docFiles.map((f) => {
  const src = read(f);
  return [
    f,
    f.split("/").pop(),
    /templates\//.test(f) ? "template" : "service",
    /numero|numbering|sequence/i.test(src) ? "oui" : "non",
    /pdf|renderToBuffer|puppeteer|@react-pdf/i.test(src) ? "oui" : "non",
    src.split("\n").length,
  ];
});
counts.doc = writeCsv(
  "INV-DOCUMENTS.csv",
  ["fichier", "nom", "role", "numerotation_referencee", "genere_pdf", "lignes"],
  docRows,
);

/* ------------------------------------------------------------------ */
/* 7 — Les 32 indicateurs                                              */
/* ------------------------------------------------------------------ */
const registre = read("src/server/qualiopi/conformite/indicateurs-registre.ts");
const GRADUABLES = new Set([1, 2, 3, 8, 9, 12, 13, 17, 18, 19, 23, 24, 25, 28, 30]);
const indRows = [];
const seen = new Set();
// Chaque indicateur est un objet littéral sans accolade imbriquée.
for (const m of registre.matchAll(/\{([^{}]*?)\}/g)) {
  const block = m[1];
  const numero = (block.match(/numero:\s*(\d+)/) || [])[1];
  const critere = (block.match(/critere:\s*(\d+)/) || [])[1];
  if (!numero || !critere || seen.has(numero)) continue;
  seen.add(numero);
  const libelle =
    (block.match(/libelleOfficiel:\s*"((?:[^"\\]|\\.)*)"/) ||
      block.match(/libelleOfficiel:\s*`([^`]*)`/) ||
      [])[1] ?? "";
  indRows.push([
    numero,
    critere,
    libelle.replace(/\\"/g, '"').replace(/\s+/g, " ").trim(),
    GRADUABLES.has(Number(numero)) ? "graduable" : "NC MAJEURE obligatoire",
    (block.match(/super:\s*(true|false)/) || [])[1] ?? "",
    (block.match(/conditionnel:\s*"?([\w.]+)"?/) || [])[1] ?? "tronc commun",
  ]);
}
counts.ind = writeCsv(
  "INV-INDICATEURS.csv",
  [
    "numero",
    "critere",
    "libelle_officiel",
    "gradation_referentiel",
    "flag_super_code",
    "conditionnel",
  ],
  indRows.sort((a, b) => Number(a[0]) - Number(b[0])),
);
// 🔴 C'ÉTAIT UN `console.log`, DONC RIEN. Le référentiel national de qualité
// compte 32 indicateurs : ce n'est pas une estimation, c'est un invariant. Un
// parseur qui en rend 7 ou 0 a cessé de fonctionner, et l'audit qui suit compte
// une couverture sur un denominateur faux. On le porte en faute vraisemblance.
if (indRows.length !== 32) {
  invraisemblances.push(
    `${indRows.length} indicateurs RNQ extraits au lieu de 32 — le parseur a cessé de fonctionner`,
  );
}

/* ------------------------------------------------------------------ */
/* 8 — Tests                                                           */
/* ------------------------------------------------------------------ */
const testFiles = [
  ...walk(join(ROOT, "src")),
  ...walk(join(ROOT, "tests")),
  ...walk(join(ROOT, "prisma")),
].filter((p) => /\.(spec|test)\.tsx?$/.test(p));
const testRows = [...new Set(testFiles)].map((f) => {
  const src = read(f);
  return [
    f,
    f.startsWith("tests/e2e") ? "e2e" : /integration/.test(f) ? "integration" : "unit",
    (src.match(/\b(it|test)\s*\(/g) || []).length,
    /vi\.mock|jest\.mock/.test(src) ? "oui" : "non",
    /qualiopi|emargement|attestation|convention|formateur|stagiaire|session|indicateur/i.test(
      f + src,
    )
      ? "oui"
      : "non",
  ];
});
counts.tst = writeCsv(
  "INV-TESTS.csv",
  ["fichier", "type", "nb_cas", "utilise_des_mocks", "touche_au_domaine_qualiopi"],
  testRows.sort((a, b) => a[0].localeCompare(b[0])),
);

/* ------------------------------------------------------------------ */
/* PROGRESS.csv — le registre maître                                   */
/* ------------------------------------------------------------------ */
const progress = [];
let n = 0;
const add = (phase, type, cible) =>
  progress.push([
    `${type.slice(0, 3).toUpperCase()}-${String(++n).padStart(4, "0")}`,
    phase,
    type,
    cible,
    "TODO",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

publicRows.forEach((r) => add(5, "route_publique", r[1]));
adminRows.forEach((r) => add(4, "route_admin", r[1]));
apiRows.forEach((r) => add(3, "api", `${r[2]} ${r[1]}`));
docRows.filter((r) => r[2] === "template").forEach((r) => add(8, "document", r[1]));
indRows.forEach((r) => add(10, "indicateur", `Indicateur ${r[0]} (critère ${r[1]})`));
[
  "P01 entreprise OPCO",
  "P02 B2C contrat",
  "P03 AFEST 1-to-1",
  "P04 inter-entreprises",
  "P05 CPF / France Travail",
  "P06 sous-traitance ind.27",
  "P07 réclamation → revue de direction",
  "P08 handicap ind.26",
  "P09 abandon / annulation",
  "P10 RGPD export & effacement",
].forEach((p) => add(7, "parcours", p));
[
  "Workers BullMQ",
  "Tâches planifiées",
  "Alertes",
  "Emails transactionnels",
  "Sauvegarde & restauration",
  "Journalisation & supervision",
  "Journée type chronométrée",
].forEach((p) => add(15, "exploitation", p));
[
  "Chaîne devis→facture",
  "Mentions & numérotation facture",
  "Avoirs & annulations",
  "Facturation électronique 2026",
  "BPF",
].forEach((p) => add(16, "financier", p));
Array.from({ length: 20 }, (_, i) => `Demande auditeur ${i + 1}`).forEach((p) =>
  add(11, "demande_auditeur", p),
);

writeFileSync(
  join(OUT, "PROGRESS.csv"),
  [
    "id,phase,type,cible,statut,verdict,artefact,findings,session,horodatage,note",
    ...progress.map((r) => r.map(csvCell).join(",")),
  ].join("\n") + "\n",
  "utf8",
);

console.log(`\n  PROGRESS.csv                 ${progress.length} unités de travail`);
console.log("\nRépartition :");
const byType = {};
for (const r of progress) byType[r[2]] = (byType[r[2]] ?? 0) + 1;
for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t.padEnd(18)} ${c}`);
}

/* ------------------------------------------------------------------ */
/* 9 — LE VERDICT DU SCRIPT SUR LUI-MÊME                               */
/* ------------------------------------------------------------------ */
/**
 * 🔴 2026-08-24 — SANS CE BLOC, TOUT CE QUI PRÉCÈDE N'EST QUE DE LA PROSE.
 *
 * Ce script se déclare en tête « la source de vérité de ce qu'il y a à
 * auditer ». Il avalait pourtant ses propres pannes : un dossier illisible
 * rendait l'accumulateur, un fichier manquant rendait une chaîne vide, et
 * l'écart sur les 32 indicateurs du RNQ n'était qu'un `console.log`. Il
 * terminait donc sur un code 0 en ayant produit des inventaires vides — et un
 * audit lancé là-dessus croit avoir traversé un périmètre qu'il n'a pas vu.
 *
 * 🔑 Un inventaire vide n'est pas « rien à auditer », c'est « rien n'a été
 * mesuré ». Les deux se ressemblent exactement, et c'est pour cela qu'il faut
 * une garde qui ROUGIT : le dépôt a déjà payé ce motif trois fois (0 test sur
 * 237 lus comme un vert, quatre specs de console sans assertion, un cliquet de
 * budgets aveugle à deux de ses trois aides).
 *
 * ⚠️ Le seuil de vraisemblance est délibérément bas : il ne cherche pas à juger
 * la qualité de l'inventaire, seulement à refuser un effondrement. Un dépôt
 * Qualiopi qui rendrait moins de 50 unités de travail n'a pas été lu.
 */
const SEUIL_UNITES = 50;
if (progress.length < SEUIL_UNITES) {
  invraisemblances.push(
    `PROGRESS.csv ne porte que ${progress.length} unités de travail (seuil : ${SEUIL_UNITES}) — ` +
      "le balayage n'a pas atteint le dépôt",
  );
}

const incidents = [
  ...illisibles.map((x) => `dossier illisible : ${x}`),
  ...absents.map((x) => `fichier attendu ABSENT : ${x}`),
  ...invraisemblances.map((x) => `invraisemblance : ${x}`),
];

if (incidents.length > 0) {
  console.error("\n🔴 INVENTAIRE NON CONCLUANT — ne PAS auditer sur cette base :\n");
  for (const i of incidents) console.error(`  · ${i}`);
  console.error(
    "\n  Chacun de ces incidents produisait auparavant un inventaire silencieusement" +
      "\n  amputé, avec un code de sortie 0. Corriger la cause, puis relancer." +
      "\n  Un périmètre faux rend tout verdict d'audit sans valeur.\n",
  );
  process.exit(1);
}

console.log("\n✅ Inventaire conclusif : aucun dossier illisible, aucun fichier attendu absent.");
