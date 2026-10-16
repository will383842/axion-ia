#!/usr/bin/env node
// Banc @formateurs — le DÉCOUPAGE par équipe, source unique du job matriciel.
//
// Pourquoi : les scénarios des équipes A, B et D, verts chacun sur sa PR, sont
// devenus rouges une fois réunis sur `main` (run 38663145178). Ils partagent une
// base, un Redis et un worker, et chaque équipe a son PROPRE verrou (Redis pour A,
// fichier pour B, Redis sous une autre clé pour D) : aucun ne voit les autres.
// E39 (D) coupe `invitation_auto` pendant qu'un scénario de A attend F1 ; A
// allume `activation_auto` pendant qu'ED6 (D) la croit coupée ; le journal de
// cascade d'E39 compte les bascules de A et B. Chaque équipe tourne donc dans
// SON job, avec SA base, SON Redis, SON puits SMTP et SON worker.
//
//   node scripts/banc-formateurs/groupes.mjs verifier    # partition exacte, ou sortie 1
//   node scripts/banc-formateurs/groupes.mjs liste <id>  # les specs du groupe, une par ligne
//
// 🔑 La partition est vérifiée À CHAQUE run : un spec `@formateurs` qui ne
// tombe dans aucun groupe (ou dans deux) fait échouer le job au lieu d'être
// silencieusement ignoré. Un nouveau scénario se range ICI, pas dans le workflow.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DOSSIER_E2E = "tests/e2e";

/**
 * Chaque groupe : un identifiant de matrice, et les noms de fichiers qu'il porte
 * (`motif`, plus une ligne de `motifs` par équipe de vérification rangée dans le groupe).
 */
export const GROUPES = [
  {
    id: "A",
    titre: "équipe A · de la candidature au contrat",
    motif: /^tests\/e2e\/formateurs\/e(0[1-9]|1[0-2]|33|37|38)-[^/]+\.spec\.ts$/,
    // Vérification n° 2, rouge « parcours et e-mails ».
    motifs: [/^tests\/e2e\/formateurs\/v2p\d+-[^/]+\.spec\.ts$/],
  },
  {
    id: "B",
    titre: "équipe B · missions",
    motif: /^tests\/e2e\/formateurs\/(e(1[3-9]|31|32|34)|eb\d+|v2n\d+)-[^/]+\.spec\.ts$/,
  },
  {
    id: "C",
    titre: "équipe C · argent",
    motif: /^tests\/e2e\/formateurs\/(e(2[0-6]|36)|ec\d+)-[^/]+\.spec\.ts$/,
  },
  {
    id: "D",
    titre: "équipe D · sécurité",
    motif: /^tests\/e2e\/formateurs\/(e(2[7-9]|30|35|39|40)|ed\d+|v2s\d+)-[^/]+\.spec\.ts$/,
  },
  {
    // Le socle d'avant le chantier V1 : le banc lui-même, la file, les rendez-vous.
    id: "socle",
    titre: "socle · file, rendez-vous, relevé salarié",
    motif:
      /^tests\/e2e\/(formateurs\/(banc-se-verifie|envois-par-la-file|rdv-[a-z-]+)|qualiopi\/formateurs\/releve-salarie-au-centime)\.spec\.ts$/,
  },
];

function specs(dossier) {
  const sortie = [];
  for (const nom of readdirSync(path.join(RACINE, dossier))) {
    const rel = `${dossier}/${nom}`;
    if (statSync(path.join(RACINE, rel)).isDirectory()) sortie.push(...specs(rel));
    else if (nom.endsWith(".spec.ts")) sortie.push(rel);
  }
  return sortie;
}

/** Les specs du banc : celles qui portent le tag `@formateurs`. */
export function specsDuBanc() {
  return specs(DOSSIER_E2E)
    .filter((f) => readFileSync(path.join(RACINE, f), "utf8").includes("@formateurs"))
    .sort();
}

/** Rend `{ parGroupe, orphelins, doublons }` sur les specs du dépôt. */
export function partition(fichiers = specsDuBanc()) {
  const parGroupe = Object.fromEntries(GROUPES.map((g) => [g.id, []]));
  const orphelins = [];
  const doublons = [];
  for (const f of fichiers) {
    const groupes = GROUPES.filter((g) => [g.motif, ...(g.motifs ?? [])].some((m) => m.test(f)));
    if (groupes.length === 0) orphelins.push(f);
    else if (groupes.length > 1) doublons.push(`${f} (${groupes.map((g) => g.id).join(", ")})`);
    else parGroupe[groupes[0].id].push(f);
  }
  return { parGroupe, orphelins, doublons };
}

function principal(argv) {
  const [commande, id] = argv;
  const { parGroupe, orphelins, doublons } = partition();
  if (orphelins.length > 0 || doublons.length > 0) {
    for (const f of orphelins) {
      console.error(`::error::banc @formateurs : ${f} n'appartient à aucun groupe (groupes.mjs)`);
    }
    for (const f of doublons) {
      console.error(`::error::banc @formateurs : ${f} appartient à plusieurs groupes`);
    }
    return 1;
  }
  if (commande === "verifier") {
    for (const g of GROUPES)
      console.log(`${g.id.padEnd(6)} ${parGroupe[g.id].length} spec(s) — ${g.titre}`);
    return 0;
  }
  if (commande === "liste") {
    if (!(id in parGroupe)) {
      console.error(`banc @formateurs : groupe inconnu « ${id ?? ""} »`);
      return 1;
    }
    for (const f of parGroupe[id]) console.log(f);
    return 0;
  }
  console.error("usage : groupes.mjs verifier | liste <A|B|C|D|socle>");
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
