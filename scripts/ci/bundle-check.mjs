#!/usr/bin/env node
/**
 * `pnpm bundle:check` — size-limit, PRÉCÉDÉ d'une vérification que chaque motif
 * de chaque bucket correspond réellement à au moins un fichier.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE SCRIPT EXISTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `tests/unit/ci/size-limit-buckets.spec.ts` déclare depuis juin, dans son
 * en-tête, le trou qu'il ne sait pas voir :
 *
 *     « ⚠️ Ce test ne peut pas vérifier que le glob matche des fichiers réels :
 *       les chunks n'existent qu'après un build. »
 *
 * Il vérifie donc l'invariant qu'on peut établir sans build — « le segment de
 * route nommé existe encore » — et c'est le seul qu'il pouvait établir. Ce
 * script comble l'autre moitié : il s'exécute AU MOMENT DE LA MESURE, quand
 * `.next` est là, et répond à la question que la garde statique ne peut pas
 * poser — ce motif a-t-il trouvé quelque chose ?
 *
 * Deux fautes réelles sont passées par ce trou :
 *
 *   1. `/reserver`, 2026-06-26 → 2026-08-14. La page est supprimée, ses trois
 *      globs restent. Six semaines de mesure du VIDE, en vert.
 *   2. `(admin)` en parenthèses NUES, 2026-09-06. Le groupe de routes de Next
 *      s'écrit `(admin)` ; écrites nues dans un motif, les parenthèses ne sont
 *      pas des caractères littéraux pour le moteur de globs. Mesuré sur le même
 *      build, à quelques secondes d'écart :
 *
 *          chunks/app/**\/(admin)/**\/page-*.js      →   0 fichier
 *          chunks/app/**\/[(]admin[)]/**\/page-*.js  → 311 fichiers
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 LE CAS MUET EST LA NÉGATION, ET C'EST LUI QUI COMPTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Les deux sortes de motifs ne se trompent pas avec le même bruit. Vérifié en
 * mutant le fichier et en relançant la mesure, pas déduit :
 *
 *   - sur une INCLUSION seule, size-limit s'arrête et sort en 1 : « Size Limit
 *     can't find files at … ». Ce cas-là n'était donc pas le trou — SAUF quand
 *     le bucket porte plusieurs inclusions et qu'une seule est morte : l'union
 *     restant non vide, size-limit ne dit rien. C'est exactement l'état dans
 *     lequel ce script a trouvé les buckets `/galerie` et `/implantations`, qui
 *     citaient chacun un alias de `pathnames` next-intl (`gallery`,
 *     `locations`). Un alias est réécrit au runtime : il n'a jamais de
 *     répertoire propre dans l'App Router, donc jamais de répertoire de chunks.
 *     Ces deux motifs étaient incapables PAR CONSTRUCTION de correspondre, et
 *     ils étaient verts depuis le jour de leur écriture ;
 *
 *   - sur une NÉGATION, un motif qui ne correspond à rien n'exclut rien ET NE
 *     DIT RIEN. Le bucket « pages publiques » ré-avalerait les 452 kB de la
 *     console d'administration en silence, et le budget public redeviendrait la
 *     fiction qu'on vient de retirer. Aucune erreur, aucun avertissement, un
 *     simple nombre plus gros que personne ne sait lire.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ LE MOTEUR DE GLOBS DOIT ÊTRE CELUI DE SIZE-LIMIT, PAS UN AUTRE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Première tentative écrite pour ce contrôle : `fs.globSync` de Node. Elle rend
 * 311 fichiers pour `(admin)` en parenthèses nues — le glob de Node traite `(`
 * comme un caractère littéral. Un contrôle bâti dessus aurait été VERT sur la
 * faute exacte qu'il est censé attraper.
 *
 * On importe donc `tinyglobby` PAR LA RÉSOLUTION DE SIZE-LIMIT LUI-MÊME
 * (`size-limit/get-config.js` : `glob(patterns, { cwd: config.cwd })`). Le
 * contrôle et la mesure ne peuvent alors pas diverger : même moteur, même
 * version, même `cwd`.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 « AU MOINS UN FICHIER » NE SUFFIT PAS — CE QUE LA MUTATION A APPRIS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le contrôle « chaque motif correspond à ≥ 1 fichier » a été écrit d'abord,
 * puis ÉPROUVÉ en remettant `(admin)` en parenthèses nues dans la seule
 * NÉGATION. Il est resté VERT. La mesure aussi.
 *
 * Parce que `(admin)` ne correspond pas à rien : picomatch lit les parenthèses
 * comme un groupe, donc le motif correspond au répertoire littéralement nommé
 * `admin` — et il en existe un, `chunks/app/api/admin/`, qui porte 8 chunks de
 * route handlers. Le motif trouve donc 8 fichiers au lieu de 341 : assez pour
 * satisfaire « ≥ 1 », et aucun d'eux n'est un `page-*.js`, donc l'exclusion
 * n'exclut RIEN de ce qu'elle devait exclure. Le bucket public ré-avalait les
 * 452 kB de la console, en vert, avec un contrôle « anti-glob mort » satisfait.
 *
 * ⚠️ Un compte non nul n'est pas la preuve qu'un motif désigne la bonne
 * population. Le seul témoin qui discrimine est une identité EXACTE, d'où le
 * second contrôle : la PARTITION. Les trois buckets qui se partagent les
 * `page-*.js` (`/appel`, public, console admin) doivent en couvrir la totalité
 * et n'en partager aucun. Sous la mutation, public en garde 497, admin 311 :
 * 311 fichiers comptés DEUX fois, et le contrôle rougit.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TÉMOIN POSITIF
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le tableau imprime le NOMBRE de fichiers trouvés par motif, la partition
 * imprime ses trois parts et leur somme, et le script refuse un total nul en le
 * nommant pour ce qu'il est — « aucun build à mesurer » — plutôt que de le
 * confondre avec un motif mort. Sans ces comptes affichés, un contrôle devenu
 * incapable de trouver quoi que ce soit serait indiscernable d'un dépôt sain.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const RACINE = process.cwd();

/** Le moteur de globs de size-limit, résolu depuis size-limit. Cf. en-tête. */
async function chargerLeMoteurDeSizeLimit() {
  const ancre = realpathSync(join(RACINE, "node_modules", "size-limit", "get-config.js"));
  const requireDeSizeLimit = createRequire(ancre);
  const { glob } = await import(pathToFileURL(requireDeSizeLimit.resolve("tinyglobby")).href);
  return glob;
}

function lireLesBuckets() {
  const pkg = JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8"));
  return pkg["size-limit"] ?? [];
}

function motifsDe(bucket) {
  if (Array.isArray(bucket.path)) return bucket.path;
  return bucket.path ? [bucket.path] : [];
}

const glob = await chargerLeMoteurDeSizeLimit();
const buckets = lireLesBuckets();

if (buckets.length === 0) {
  console.error("✖ La section `size-limit` de package.json est vide : aucun budget à mesurer.");
  process.exit(1);
}

const morts = [];
let totalDeFichiers = 0;

console.log("");
console.log("  Correspondance des motifs size-limit (moteur : tinyglobby, celui de size-limit)");
console.log("");

for (const bucket of buckets) {
  const nom = bucket.name ?? "(bucket sans nom)";
  const motifs = motifsDe(bucket);
  console.log(`  ${nom}`);

  if (motifs.length === 0) {
    console.log("      ✖ aucun `path` déclaré");
    morts.push({ bucket: nom, motif: "(aucun `path` déclaré)", sens: "—" });
    continue;
  }

  for (const motif of motifs) {
    const estUneNegation = motif.startsWith("!");
    const nu = estUneNegation ? motif.slice(1) : motif;
    const trouves = await glob([nu], { cwd: RACINE });
    totalDeFichiers += trouves.length;

    const sens = estUneNegation ? "EXCLUSION" : "inclusion";
    const marque = trouves.length === 0 ? "✖" : "·";
    console.log(`      ${marque} ${String(trouves.length).padStart(5)}  ${sens}  ${nu}`);

    if (trouves.length === 0) morts.push({ bucket: nom, motif: nu, sens });
  }
}

console.log("");

if (totalDeFichiers === 0) {
  console.error(
    "✖ AUCUN motif n'a trouvé le moindre fichier — ce n'est pas un glob mort,\n" +
      "  c'est un build absent. `.next/static` doit exister AVANT la mesure :\n" +
      "  lancer `pnpm build` (ou, en CI, vérifier que l'étape de build a tourné).",
  );
  process.exit(1);
}

if (morts.length > 0) {
  console.error("✖ Motif(s) size-limit sans aucune correspondance :\n");
  for (const { bucket, motif, sens } of morts) {
    console.error(`    « ${bucket} »\n      ${sens} → ${motif}`);
  }
  console.error(
    "\n  Un motif qui ne correspond à rien ne mesure rien, et il ne le dit pas :\n" +
      "  sur une INCLUSION noyée parmi d'autres, l'union reste non vide et size-limit\n" +
      "  se tait ; sur une EXCLUSION, rien n'est exclu et le bucket enfle en silence.\n" +
      "  Corriger le motif, ou le retirer s'il désigne une route qui n'existe plus.\n" +
      "  ⚠️ Un alias `pathnames` de next-intl (`gallery`, `locations`…) n'a jamais de\n" +
      "  répertoire de chunks : il est réécrit au runtime. Ne pas le citer ici.",
  );
  process.exit(1);
}

console.log(`  ✔ ${buckets.length} buckets, tous leurs motifs trouvent au moins un fichier.`);
console.log("");

// ══════════════════════════════════════════════════════════════════════════
// PARTITION — le contrôle qui DISCRIMINE. Cf. en-tête, « ≥ 1 fichier ne suffit
// pas ». Ces trois buckets se partagent la population des `page-*.js` : chaque
// chunk de page appartient à un et un seul d'entre eux.
// ══════════════════════════════════════════════════════════════════════════
const PARTITION = {
  univers: ".next/static/chunks/app/**/page-*.js",
  parts: [
    "Routes /appel",
    "SOMME des page chunks PUBLICS",
    "SOMME des page chunks de la CONSOLE ADMIN",
  ],
};

const univers = new Set(await glob([PARTITION.univers], { cwd: RACINE }));

/** Le set de fichiers que size-limit mesurera pour ce bucket, restreint à l'univers. */
async function fichiersDuBucket(prefixeDuNom) {
  const bucket = buckets.find((b) => (b.name ?? "").startsWith(prefixeDuNom));
  if (!bucket) {
    console.error(
      `✖ Le bucket « ${prefixeDuNom}… » a disparu de package.json.\n` +
        "  L'invariant de PARTITION des `page-*.js` perd une de ses parts : il ne\n" +
        "  peut plus rien prouver. Rétablir le bucket, ou remettre à jour la liste\n" +
        "  `PARTITION.parts` de ce script si le découpage a délibérément changé.",
    );
    process.exit(1);
  }
  const trouves = await glob(motifsDe(bucket), { cwd: RACINE });
  return new Set(trouves.filter((f) => univers.has(f)));
}

const parts = [];
for (const prefixe of PARTITION.parts) parts.push([prefixe, await fichiersDuBucket(prefixe)]);

const proprietaires = new Map();
for (const [nom, fichiers] of parts) {
  for (const f of fichiers) proprietaires.set(f, [...(proprietaires.get(f) ?? []), nom]);
}

const partages = [...proprietaires].filter(([, noms]) => noms.length > 1);
const orphelins = [...univers].filter((f) => !proprietaires.has(f));

console.log("  Partition des `page-*.js` — chaque chunk dans un bucket et un seul");
console.log("");
for (const [nom, fichiers] of parts) {
  console.log(`      · ${String(fichiers.size).padStart(5)}  ${nom}`);
}
console.log(
  `      = ${String(parts.reduce((n, [, f]) => n + f.size, 0)).padStart(5)}  ` +
    `pour ${univers.size} chunks de page au total`,
);
console.log("");

if (partages.length > 0 || orphelins.length > 0) {
  console.error("✖ La partition des `page-*.js` est rompue.\n");
  if (partages.length > 0) {
    console.error(
      `  ${partages.length} chunk(s) comptés dans PLUSIEURS buckets — une exclusion\n` +
        "  ne retire pas ce qu'elle prétend retirer. Trois exemples :",
    );
    for (const [f, noms] of partages.slice(0, 3)) {
      console.error(`      ${f}\n        → ${noms.join(" + ")}`);
    }
    console.error("");
  }
  if (orphelins.length > 0) {
    console.error(
      `  ${orphelins.length} chunk(s) dans AUCUN bucket — ils ne sont mesurés par\n` +
        "  rien, et un budget ne peut pas les voir grossir. Trois exemples :",
    );
    for (const f of orphelins.slice(0, 3)) console.error(`      ${f}`);
    console.error("");
  }
  console.error(
    "  ⚠️ Ce contrôle est le seul qui DISCRIMINE : « chaque motif trouve au moins\n" +
      "  un fichier » reste vert sur `(admin)` en parenthèses nues, qui trouve les\n" +
      "  8 chunks de `chunks/app/api/admin/` et n'exclut aucun `page-*.js`.\n" +
      "  Les parenthèses d'un groupe de routes Next s'écrivent `[(]admin[)]`.",
  );
  process.exit(1);
}

console.log("  ✔ Partition exacte et exhaustive.");
console.log("");

const bin = realpathSync(join(RACINE, "node_modules", "size-limit", "bin.js"));
const mesure = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  cwd: RACINE,
  stdio: "inherit",
});
process.exit(mesure.status ?? 1);
