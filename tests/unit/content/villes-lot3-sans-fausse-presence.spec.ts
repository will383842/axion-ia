/**
 * Cliquet · lot 3 sur 3 des textes de ville (dernier tiers par ordre de nom,
 * `parthenay.ts` et suivants, hors `types.ts`) : plus de fausse présence locale.
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient partout
 * en France, sur place ou à distance. Aucun texte ne doit laisser croire que
 * l'équipe, un consultant, Williams ou Axion-IA part d'une ville, y est basé, y a
 * des locaux ou en est proche.
 *
 * Méthode (passe exhaustive du 2026-11-11). Cinq relectures ont montré qu'une
 * liste de motifs ponctuels laisse toujours passer une forme nouvelle de la même
 * faute. Le test applique donc UNE règle large, insensible à la casse, sur toutes
 * ses occurrences ; chaque occurrence restante doit figurer, à l'identique, dans la
 * liste blanche : les lignes jugées LEGITIME à la main dans l'inventaire
 * `docs/_AUDIT/villes-lot-3-inventaire-presence-2026-11-11.csv`.
 *
 * Une entrée de liste blanche est un couple (fichier, extrait exact) : l'extrait
 * est le texte qui commence À LA POSITION de l'occurrence (120 caractères). Ce
 * n'est pas une expression régulière. Modifier une phrase repérée par la règle la
 * fait donc sortir de la liste blanche : il faut la rejuger et mettre le CSV à
 * jour. Plafond : 0 occurrence non jugée.
 *
 * Le tiers est borné par NOM de fichier (de `parthenay.ts` à la fin), jamais par
 * un tiers du nombre de fichiers : l'ajout d'une ville ailleurs ne le déplace pas.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");
const INVENTAIRE = join(
  process.cwd(),
  "docs",
  "_AUDIT",
  "villes-lot-3-inventaire-presence-2026-11-11.csv",
);
const PREMIER = "parthenay.ts";
const LONGUEUR_EXTRAIT = 120;

const FICHIERS = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts") && nom !== "types.ts")
  .sort();
const TIERS = FICHIERS.filter((nom) => nom >= PREMIER);

/** Règle large : équipe/mission/accès + « depuis <Ville> », proximité, « vos locaux », anglais. */
const REGLE =
  /(?:d[ée]plac|consultants?|[ée]quipe|experts?|williams|axion|nous|on|acc[èe]s|couverture|couvr|visio|build|missions?|interventions?)[^."?]{0,160}depuis [A-ZÉ]|depuis [A-ZÉ][^,.]{0,60},\s*(?:on|nous)|sont? [àa] \d+ ?min(?:utes)? d|visio depuis [A-ZÉ]|vos locaux|based in|\bfrom (?:Paris|[A-Z][a-z]+)\b[^."]{0,40}(?:consultants?|we |our )/giu;

type Ligne = { fichier: string; extrait: string; verdict: string; motif: string };

/** Lecture du CSV `fichier;ligne;"extrait";verdict;motif` (guillemets doublés dans l'extrait). */
function lireInventaire(): Ligne[] {
  const lignes = readFileSync(INVENTAIRE, "utf8").trimEnd().split("\n").slice(1);
  return lignes.map((brut) => {
    const m = /^([^;]+);(\d+);"((?:[^"]|"")*)";(FAUTIF|LEGITIME);(.*)$/u.exec(brut);
    if (!m) throw new Error(`ligne d'inventaire illisible : ${brut.slice(0, 80)}`);
    return { fichier: m[1]!, extrait: m[3]!.replace(/""/g, '"'), verdict: m[4]!, motif: m[5]! };
  });
}

const INVENTAIRE_LU = lireInventaire();
const LISTE_BLANCHE = new Map<string, Set<string>>();
for (const l of INVENTAIRE_LU) {
  if (l.verdict !== "LEGITIME") continue;
  const set = LISTE_BLANCHE.get(l.fichier) ?? new Set<string>();
  set.add(l.extrait);
  LISTE_BLANCHE.set(l.fichier, set);
}

/** Occurrences de la règle large qui ne sont pas jugées LEGITIME à l'identique. */
function nonJugees(fichier: string, texte: string): string[] {
  const blanche = LISTE_BLANCHE.get(fichier) ?? new Set<string>();
  return texte
    .split("\n")
    .flatMap((ligne, i) =>
      [...ligne.matchAll(REGLE)]
        .filter((m) => !blanche.has(ligne.slice(m.index, m.index + LONGUEUR_EXTRAIT)))
        .map((m) => `${fichier}:${i + 1} « ${m[0].slice(0, 90)} »`),
    );
}

/** Une phrase fautive par branche de la règle : une branche qui ne reconnaît plus rien est morte. */
const EXEMPLES_FAUTIFS: readonly string[] = [
  "Nos consultants viennent sur site depuis Lyon (20 min).",
  "Déplacement depuis Annecy (50 min) ou Genève (1h10).",
  "Consultants accessibles en 10 min depuis Orange via A7.",
  "Williams rejoint vos équipes depuis Bordeaux.",
  "Depuis Saint-Ouen-l'Aumône, on couvre toute l'agglomération.",
  "Quelles communes proches couvrez-vous depuis Sartrouville ?",
  "Nos consultants sont à 10 minutes de Lille centre.",
  "Démos hebdomadaires en visio depuis Saumur.",
  "Greffe IA sur l'existant ou build IA-native depuis Saint-Cyr-l'École.",
  "Comment rejoindre vos locaux villeurbannais ?",
  "Our consultants are based in Paris.",
  "Travel from Paris: our consultants come every week.",
];

describe("villes · lot 3 sans fausse présence locale (règle large + inventaire jugé)", () => {
  it("le tiers est borné par nom et bien lu (garde contre un test vide)", () => {
    expect(TIERS[0]).toBe(PREMIER);
    expect(TIERS).not.toContain("types.ts");
    expect(TIERS.length).toBeGreaterThan(600);
  });

  it("l'inventaire est lu et contient des verdicts des deux sortes", () => {
    expect(INVENTAIRE_LU.length).toBeGreaterThan(1000);
    expect(INVENTAIRE_LU.some((l) => l.verdict === "FAUTIF")).toBe(true);
    expect(LISTE_BLANCHE.size).toBeGreaterThan(100);
    for (const l of INVENTAIRE_LU) expect(TIERS, l.fichier).toContain(l.fichier);
  });

  it("chaque branche de la règle reconnaît une phrase fautive (garde « motif mort »)", () => {
    for (const exemple of EXEMPLES_FAUTIFS) {
      expect([...exemple.matchAll(REGLE)].length, exemple).toBeGreaterThan(0);
    }
    expect([
      ..."Nous intervenons partout en France, sur place ou à distance.".matchAll(REGLE),
    ]).toEqual([]);
  });

  it("la liste blanche ne couvre aucune forme fautive connue", () => {
    const FORMES_FAUTIVES =
      /sont? [àa] \d+ ?min|visio depuis [A-ZÉ]|déplacements? depuis [A-ZÉ]|consultants accessibles|build IA-native depuis [A-ZÉ]|couvr\w* depuis [A-ZÉ]|rejoindre vos locaux/iu;
    const fautives = INVENTAIRE_LU.filter(
      (l) => l.verdict === "LEGITIME" && FORMES_FAUTIVES.test(l.extrait),
    ).map((l) => `${l.fichier} « ${l.extrait.slice(0, 80)} »`);
    expect(fautives).toEqual([]);
  });

  it("plafond 0 : toute occurrence de la règle large est jugée LEGITIME dans l'inventaire", () => {
    const restantes = TIERS.flatMap((nom) =>
      nonJugees(nom, readFileSync(join(DOSSIER, nom), "utf8")),
    );
    expect(restantes).toEqual([]);
  });

  it("une phrase fautive ajoutée serait refusée (la liste blanche n'est pas une regex)", () => {
    const fichier = TIERS[0]!;
    const texte = `${readFileSync(join(DOSSIER, fichier), "utf8")}\n  a: "Nos consultants viennent depuis Niort.",`;
    expect(nonJugees(fichier, texte)).toHaveLength(1);
  });

  it("invariants conservés : ni « Grenoble », ni prix « From €NNN excl. VAT »", () => {
    const fautes = TIERS.flatMap((nom) =>
      readFileSync(join(DOSSIER, nom), "utf8")
        .split("\n")
        .flatMap((ligne, i) =>
          /Grenoble|From €\d+ excl\. VAT/u.test(ligne) ? [`${nom}:${i + 1}`] : [],
        ),
    );
    expect(fautes).toEqual([]);
  });
});
