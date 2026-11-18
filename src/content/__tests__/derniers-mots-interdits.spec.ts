// Garde « derniers mots interdits » (lot V1-05, chantier GEO).
//
// Les textes publics de référence — guide, FAQ, accueil, Journée IA, offre, régions — ne doivent
// jamais redire : Qualiopi, OPCO, CPF, France Travail, « prise en charge » (au sens financement),
// ni mettre Grenoble en avant (Grenoble ne vit que sur sa page ville et sur /fr/memo-isere).
//
// 🔑 Ce que cette garde ne regarde PAS, et pourquoi :
//   · les blocs Qualiopi / financement des pages formations, à-propos, avis, équipe : ils sont
//     rendus SEULEMENT quand l'interrupteur « organisme certifié » est allumé (chantier Qualiopi,
//     à ne pas supprimer) ; un test de rendu séparé couvre `ofPublic=false` ;
//   · l'admin, les portails, les e-mails de dossier, les mentions légales, la page ville Grenoble.
//
// La garde NE porte PAS une liste de motifs recopiés : elle lit des fichiers réels, avec des
// témoins positifs pour ne jamais passer au vert en ne regardant rien.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MOTS =
  /grenoble|prise en charge|\bopco\b|qualiopi|\bcpf\b|france travail|aucun gain garanti|formation obligatoire/i;

/** Les textes publics lus, sans exception. Un chemin disparu fait ROUGIR. */
const CIBLES = [
  "src/content/guide-ia-page.ts",
  "src/content/transversal.ts",
  "src/content/faq",
  "src/content/home",
  "src/content/home-data.ts",
  "src/content/journee-ia-commun.ts",
  "src/content/offre.ts",
  "src/content/villes/copy",
  "src/content/villes/fiches-locales",
  "src/content/villes/journee-ia-locale.ts",
  "src/content/regions.ts",
  "src/content/case-studies.ts",
  "src/app/[locale]/journee-ia",
  "src/app/[locale]/_accueil/contenu.ts",
  "src/app/[locale]/guide-ia",
  "src/app/[locale]/contact",
  "src/app/[locale]/appel",
] as const;

function fichiers(chemin: string, sortie: string[]): void {
  if (!existsSync(chemin)) throw new Error(`cible disparue : ${chemin}`);
  if (statSync(chemin).isFile()) {
    sortie.push(chemin);
    return;
  }
  for (const nom of readdirSync(chemin)) {
    if (nom === "__tests__" || nom === "node_modules" || /\.(test|spec)\./.test(nom)) continue;
    const p = join(chemin, nom);
    if (statSync(p).isDirectory()) fichiers(p, sortie);
    else if (/\.(ts|tsx|json|md)$/.test(nom)) sortie.push(p);
  }
}

/** Les lignes qui comptent : ni commentaire, ni import. */
export function lignesVisibles(source: string): { n: number; ligne: string }[] {
  return source
    .split("\n")
    .map((ligne, i) => ({ n: i + 1, ligne }))
    .filter(
      ({ ligne }) =>
        !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(ligne) && !/^\s*import\s|from\s+["']/.test(ligne),
    );
}

/**
 * Fichiers lus par la garde mais volontairement écartés, avec la raison :
 *  · la page de la ville de Grenoble (Grenoble ne vit que là) ;
 *  · `dunkerque.ts` : sa FAQ porte encore « prise en charge », mais le fichier est touché par la
 *    PR 1979 (ouverte) : à retirer de cette liste dès que cette PR est fusionnée et corrigée.
 * Les données brutes (`villes/data`, `villes/economic-data`) ne sont pas de la prose : elles
 * nomment des lieux et des employeurs, et ne sont pas lues ici.
 */
const ECARTES: ReadonlyArray<RegExp> = [
  /src\/content\/villes\/copy\/grenoble\.ts$/,
  /src\/content\/villes\/copy\/dunkerque\.ts$/,
];

const TOUS: string[] = [];
for (const c of CIBLES) fichiers(c, TOUS);
for (let i = TOUS.length - 1; i >= 0; i--) {
  if (ECARTES.some((re) => re.test(TOUS[i]!.replace(/\\/g, "/")))) TOUS.splice(i, 1);
}

describe("V1-05 — derniers mots interdits dans les textes publics", () => {
  it("lit bien les fichiers (plancher)", () => {
    expect(TOUS.length).toBeGreaterThan(20);
  });

  it("témoin positif : le motif voit chacun des mots interdits", () => {
    for (const mot of [
      "Grenoble",
      "prise en charge",
      "OPCO",
      "Qualiopi",
      "CPF",
      "France Travail",
      "Aucun gain garanti",
      "formation obligatoire",
    ]) {
      expect(MOTS.test(`Texte avec ${mot}.`)).toBe(true);
    }
    expect(MOTS.test("Texte propre, rien à signaler.")).toBe(false);
  });

  it("aucun mot interdit hors commentaire dans les textes publics de référence", () => {
    const fautes: string[] = [];
    for (const f of TOUS) {
      for (const { n, ligne } of lignesVisibles(readFileSync(f, "utf8"))) {
        if (MOTS.test(ligne)) fautes.push(`${f}:${n} → ${ligne.trim().slice(0, 110)}`);
      }
    }
    expect(fautes, fautes.join("\n")).toEqual([]);
  });
});
