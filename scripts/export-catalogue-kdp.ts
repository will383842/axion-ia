#!/usr/bin/env tsx
// Exporte les données du catalogue imprimé (KDP) depuis le SSOT du site.
//
// POURQUOI CE SCRIPT EXISTE (2026-08-16, décision Will)
//
// Le générateur du catalogue papier vit hors dépôt
// (`Catalogue_formations_Axion_IA/catalogue-kdp`). Jusqu'ici il obtenait ses
// données en **scrapant le site en production** : `scrape-modules.cjs` ouvrait
// `https://axion-ia.com/fr/formations/<slug>`, lisait `document.body.innerText`
// et découpait ce texte au parser.
//
// Deux conséquences, l'une fragile et l'autre grave :
//   - toute reformulation d'une page casse ou VIDE silencieusement les données
//     du livre — un « 0 modules » dans un log que personne ne relit ;
//   - le livre distribué en main propre pouvait afficher un prix différent du
//     site, sans que rien ne le signale.
//
// CE QUE CE SCRIPT PILOTE, ET CE QU'IL NE PILOTE PAS
//
// Il pilote les FAITS : prix, durée, titre, rubrique, format, effectif,
// accroche. C'est là qu'une divergence coûte cher — un prix faux sur du papier
// distribué en main propre ne se corrige pas.
//
// Il NE pilote PAS l'écriture du livre. Les objectifs (`objectifs-livre.cjs`)
// et les lignes avant/après (`prose-livre.cjs`) sont figés côté générateur,
// parce qu'ils sont ÉCRITS POUR LE PAPIER :
//   - les objectifs du site font 225 caractères en moyenne contre 58 pour ceux
//     du livre ; les verser dans une double-page calibrée au millimètre ferait
//     déborder le cadre, et `fitPages()` réduirait les pages tout seul ;
//   - la ligne « avant » de la journée complète distingue celle-ci de la
//     demi-journée, qui se suivent aux pages 10 et 12 ; le site sert la même
//     phrase aux deux, ce qui ferait dire la même chose à deux pages voisines.
//
// Décision Will 2026-08-16 : ON NE TOUCHE PAS À LA MISE EN PAGE.
//
// SORTIE, compatible avec l'existant, dans `catalogue-kdp/` :
//   formations-data.json   (remplace le scrape de la page listing)
//   modules-data.json      (remplace scrape-modules.cjs)
//
// Usage :
//   pnpm tsx scripts/export-catalogue-kdp.ts [dossier-de-sortie]

import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { FORMATIONS_V2, type FormationV2 } from "@/content/formations/catalog-v2";
// Pas de `getFormationEffectif` ici : l'effectif est figé côté livre
// (`prose-livre.cjs`). Le livre écrit « 2 à 15 participants · intra-entreprise »
// quand le SSOT rend « Jusqu'à 15 participants » — la plupart des formations ne
// renseignent pas `effectifFr` et retombent sur la valeur par défaut, plus pauvre.
import {
  formatDureeFr,
  getFormationModalites,
  formatModalitesFr,
} from "@/content/formations/catalog-v2-facts";
import { formatFormationPrice } from "@/content/pricing";

const SORTIE =
  process.argv[2] ?? "C:/Users/willi/Documents/Projets/Catalogue_formations_Axion_IA/catalogue-kdp";

function prix(f: FormationV2): string {
  if (f.surDevis) return "Sur devis";
  // ⚠️ La matrice est indexée par `categorie`, PAS par `gamme` — les deux
  // existent sur FormationV2 et se confondent facilement. Passer `gamme` rend
  // `undefined`, donc « Sur devis » pour TOUTES les formations : un catalogue
  // imprimé sans un seul prix. Erreur commise et corrigée le 2026-08-16.
  if (!f.categorie) return "Sur devis"; // séminaire : hors matrice, prix négocié
  return formatFormationPrice(f.categorie, f.duree, "fr");
}

if (!existsSync(SORTIE)) {
  console.error(`[export-catalogue-kdp] dossier de sortie introuvable : ${SORTIE}`);
  process.exit(1);
}

/** Relit un fichier `module.exports = {...}` du générateur, sans l'exécuter. */
function lireFige<T>(nom: string, role: string): T {
  const chemin = join(SORTIE, nom);
  if (!existsSync(chemin)) {
    console.error(
      [
        `[export-catalogue-kdp] ${chemin} introuvable.`,
        `  Ce fichier porte ${role}.`,
        `  Sans lui l'export produirait un catalogue amputé — on s'arrête.`,
      ].join("\n"),
    );
    process.exit(1);
  }
  const texte = readFileSync(chemin, "utf8");
  const debut = texte.indexOf("module.exports =");
  return JSON.parse(texte.slice(texte.indexOf("{", debut), texte.lastIndexOf("}") + 1)) as T;
}

const objectifsLivre = lireFige<Record<string, string[]>>(
  "objectifs-livre.cjs",
  "les objectifs TELS QU'IMPRIMÉS",
);
type TextesLivre = {
  avant_line: string;
  apres_line: string;
  category_tag: string;
  participants: string;
};
const proseLivre = lireFige<Record<string, TextesLivre>>(
  "prose-livre.cjs",
  "les textes ÉCRITS POUR LE LIVRE (avant/après, rubrique, effectif)",
);

// ---- Faits, depuis le SSOT ---------------------------------------------------

const faits = new Map(
  FORMATIONS_V2.map((f) => [
    f.slugFr,
    {
      slug: f.slugFr,
      flagship: Boolean(f.featured),
      title: f.titreFr,
      duration: formatDureeFr(f),
      format: formatModalitesFr(getFormationModalites(f)),
      price: prix(f),
      hero_tagline: f.accrocheFr,
    },
  ]),
);

const programmes = new Map(
  FORMATIONS_V2.map((f) => [
    f.slugFr,
    {
      modules: f.programme.map((s) => s.titreFr).filter(Boolean),
      acquis: f.programme.flatMap((s) => s.steps.map((e) => e.titre).filter(Boolean)),
      benefice_temps: f.equationTempsFr ?? "",
      benefice_entreprise: f.beneficeDirigeantFr ?? "",
    },
  ]),
);

// ---- Composition du livre ----------------------------------------------------
//
// ⚠️ L'ORDRE ET LA COMPOSITION SONT PORTÉS PAR `objectifs-livre.cjs`, PAS PAR
// LE SSOT.
//
// `catalog-generate.cjs` fait `formations.forEach(...)` : UNE double-page par
// entrée, numéros de page calculés au compteur. Ajouter ou retirer une offre
// décale toute la pagination — et derrière elle le nombre de pages, donc
// l'épaisseur du dos de la couverture, donc les numéros du sommaire, écrits EN
// DUR dans `combine-book.cjs`.
//
// Or le SSOT porte 22 formations quand le livre en imprime 21 : la version 4 h
// d'« IA pour bien commencer » existe sur le site mais pas comme double-page
// distincte. Itérer sur le SSOT aurait ajouté une offre et cassé la pagination
// en silence.

const slugsDuLivre = Object.keys(objectifsLivre);
const absents = slugsDuLivre.filter((s) => !faits.has(s));
if (absents.length) {
  console.error(
    [
      `[export-catalogue-kdp] ces offres du livre n'existent plus dans le SSOT :`,
      ...absents.map((s) => `  - ${s}`),
      `  Écrire maintenant produirait un catalogue amputé et décalerait la`,
      `  pagination. Corriger le SSOT, ou retirer l'offre de objectifs-livre.cjs`,
      `  ET de prose-livre.cjs (et refaire la pagination en conséquence).`,
    ].join("\n"),
  );
  process.exit(1);
}

const sorties = slugsDuLivre.map((slug) => ({
  ...faits.get(slug)!,
  category_tag: proseLivre[slug]?.category_tag ?? "",
  participants: proseLivre[slug]?.participants ?? "",
  avant_line: proseLivre[slug]?.avant_line ?? "",
  apres_line: proseLivre[slug]?.apres_line ?? "",
  objectives: objectifsLivre[slug] ?? [],
}));

const modules = Object.fromEntries(
  slugsDuLivre.filter((s) => programmes.has(s)).map((s) => [s, programmes.get(s)!]),
);

writeFileSync(join(SORTIE, "formations-data.json"), JSON.stringify(sorties, null, 1), "utf8");
writeFileSync(join(SORTIE, "modules-data.json"), JSON.stringify(modules, null, 1), "utf8");

// ---- Garde-fous --------------------------------------------------------------
//
// Un champ vide ne doit JAMAIS partir à l'impression sans qu'on le sache. C'est
// le mode de panne exact du scrape : il rendait du vide en silence, et le défaut
// ne se voyait que sur le papier livré.

const sansAccroche = sorties.filter((f) => !f.hero_tagline).map((f) => f.slug);
const sansProse = sorties.filter((f) => !f.avant_line || !f.apres_line).map((f) => f.slug);
const sansObjectifs = sorties.filter((f) => f.objectives.length === 0).map((f) => f.slug);
const sansProgramme = Object.entries(modules)
  .filter(([, m]) => m.modules.length === 0)
  .map(([s]) => s);
const surDevis = sorties.filter((f) => f.price === "Sur devis").map((f) => f.slug);

console.log(`[export-catalogue-kdp] ${sorties.length} offres imprimées → ${SORTIE}`);
console.log(`  faits (prix, durée, titre, format, accroche) : SSOT du site`);
console.log(`  rubrique, effectif, avant/après, objectifs : figés côté livre`);
if (sansAccroche.length) console.log(`  ⚠️  sans accroche : ${sansAccroche.join(", ")}`);
if (sansProse.length) console.log(`  ⚠️  sans avant/après : ${sansProse.join(", ")}`);
if (sansObjectifs.length) console.log(`  ⚠️  sans objectifs : ${sansObjectifs.join(", ")}`);
if (sansProgramme.length) console.log(`  ⚠️  sans programme : ${sansProgramme.join(", ")}`);
if (surDevis.length) console.log(`  ·   sur devis : ${surDevis.join(", ")}`);
if (!sansAccroche.length && !sansProse.length && !sansObjectifs.length && !sansProgramme.length) {
  console.log("  ✅ aucun champ vide");
}
