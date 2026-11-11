/**
 * Cliquet · lot 2 sur 3 des textes de ville (`gerardmer.ts` → `parmain.ts`) :
 * plus de fausse présence locale.
 *
 * Axion-IA n'a ni bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Les fichiers
 * `src/content/villes/copy/*.ts` passent AVANT la base : la phrase s'affiche
 * telle quelle. Lot nettoyé par `scripts/villes/retirer-fausse-presence-tranche.mjs`.
 *
 * Le périmètre est borné PAR NOM de fichier (indépendant du nombre de
 * fichiers) : le lot 1 s'arrête à `gentilly.ts`, le lot 3 commence à
 * `parthenay.ts` ; ni chevauchement ni trou. Plafond : 0 occurrence, pour
 * chaque motif, dans tout le lot.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");

/** Premier fichier du lot 2 (le lot 1 finit à gentilly.ts). */
const PREMIER = "gerardmer.ts";
/** Premier fichier du lot 3 (exclu du lot 2). */
const SUIVANT = "parthenay.ts";

const TRANCHE = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts") && nom !== "types.ts" && !nom.startsWith("_"))
  .sort()
  .filter((nom) => nom >= PREMIER && nom < SUIVANT);

interface Motif {
  nom: string;
  motif: RegExp;
  /** Une ligne qui DOIT être reconnue (garde contre un motif mort). */
  fautive: string;
  /** Une ligne voisine qui ne doit PAS l'être. */
  saine: string;
}

const MOTIFS: readonly Motif[] = [
  {
    nom: "équipe « depuis / viennent de / rejoignent / basés / couvrent »",
    motif:
      /\b[Nn]os (?:consultants|équipes|experts)\b[^."]*?(?:\bdepuis [A-ZÉ]|\bviennent (?:de|depuis)\b|\brejoignent\b|\bsont basés\b|\bcouvrent\b)/u,
    fautive: 'a: "Nos consultants interviennent à Houplines depuis Lille (25 min)."',
    saine: 'a: "Nous intervenons partout en France, sur place ou à distance."',
  },
  {
    nom: "A · « Consultants depuis <Ville> (n min). »",
    motif: /(?:^|["“.!?] ?)Consultants depuis [A-ZÉ]/u,
    fautive: 'a: "Lens à 5 min. Consultants depuis Lyon (1h30) ou Genève (20 min)."',
    saine: 'a: "Consultants seniors, en visio ou sur place."',
  },
  {
    nom: "phrase « Depuis <Ville> (n min). »",
    motif: /(?:^|["“.!?] ?)[Dd]epuis [A-ZÉ][^."(]{1,40} \(\d/u,
    fautive: 'a: "Ok. Depuis Bordeaux (50 min). Tarifs publics."',
    saine: 'a: "Nous intervenons partout en France, sur place ou à distance."',
  },
  {
    nom: "C · « Depuis Paris, nous rejoignons … »",
    motif: /(?:^|["“.!?] ?)[Dd]epuis [A-ZÉ][^,."]{1,40}, (?:nous|nos)\b/u,
    fautive: 'a: "Depuis Paris, nous rejoignons La Madeleine via la gare TGV."',
    saine: 'a: "Gare TGV à 10 min, puis nous intervenons sur site."',
  },
  {
    nom: "C · « nos experts IA se déplacent depuis <Ville> »",
    motif: /\b[Nn]os (?:experts|consultants)(?: IA)? (?:se déplacent|rejoignent)[^."]*depuis/u,
    fautive: 'a: "Pas d\'agence : nos experts IA se déplacent depuis Paris, frais distincts."',
    saine: 'a: "Pas d\'agence : nous intervenons partout en France."',
  },
  {
    nom: "C · « rejoignent le site depuis Paris-Montparnasse »",
    motif: /rejoignent le site depuis/iu,
    fautive: 'a: "Nos consultants rejoignent le site depuis Paris-Montparnasse."',
    saine: 'a: "Gare Paris-Montparnasse à 3 h en TGV."',
  },
  {
    nom: "C · « environ N km depuis Paris »",
    motif: /\d+ ?km depuis Paris/iu,
    fautive: 'a: "Situé à environ 19 km depuis Paris."',
    saine: 'a: "Situé à 19 km du centre de Paris."',
  },
  {
    nom: "C · « depuis Paris en N min »",
    motif: /depuis Paris en \d+/iu,
    fautive: 'a: "Accès facile depuis Paris en 30 minutes."',
    saine: 'a: "Paris-Gare de Lyon en 30 minutes de RER."',
  },
  {
    nom: "C · « depuis le littoral azuréen »",
    motif: /depuis le littoral azuréen/iu,
    fautive: 'a: "Nos experts interviennent depuis le littoral azuréen."',
    saine: 'a: "Le littoral azuréen est desservi par la ligne TER."',
  },
  {
    nom: "C · « frais de déplacement depuis <Ville> »",
    motif: /frais de déplacement depuis [A-ZÉ]/u,
    fautive: 'a: "Devis sous 48 h, frais de déplacement depuis Paris indiqués."',
    saine: 'a: "Devis sous 48 h, frais de déplacement indiqués séparément."',
  },
  {
    nom: "B · « Comment se passe une mission depuis <Ville> ? »",
    motif: /Comment se passe une mission[^"?]* depuis /u,
    fautive: 'q: "Comment se passe une mission depuis Lyon ou Saint-Étienne ?",',
    saine: 'q: "Comment se déroule une mission à Lyon ?",',
  },
  {
    nom: "bureaux",
    motif: /depuis nos bureaux|bureaux proches de/u,
    fautive: 'a: "Nous intervenons depuis nos bureaux de Lyon."',
    saine: 'a: "Nous intervenons dans vos locaux."',
  },
  {
    nom: "B2 · « Comment se déroule une mission depuis <Ville> ? »",
    motif: /Comment se (?:passe|deroule|déroule) une mission[^"?]* depuis /u,
    fautive: 'q: "Comment se déroule une mission depuis Nantes ?",',
    saine: 'q: "Comment se déroule une mission à Nantes ?",',
  },
  {
    nom: "« Consultants … depuis <Ville> » (phrase 2/3)",
    motif: /\bConsultants\b[^."]{0,40}\bdepuis [A-ZÉ]/u,
    fautive: 'a: "Consultants sur place en 10 min depuis Caen centre."',
    saine: 'a: "Consultants seniors, en visio ou sur place."',
  },
  {
    nom: "« consultant(s) … depuis <Ville> » (toute casse, 3)",
    motif: /consultants?[^."]{0,60}depuis [A-ZÉ]/iu,
    fautive: 'a: "Consultants via gare SNCF ou déplacement route depuis Limoges."',
    saine: 'a: "Consultants seniors, en visio ou sur place."',
  },
  {
    nom: "« Nous arrivons … depuis <Ville> »",
    motif: /Nous arrivons[^."]*depuis/u,
    fautive: 'a: "Nous arrivons en 1h10 depuis Paris-Montparnasse."',
    saine: 'a: "Nous intervenons partout en France, sur place ou à distance."',
  },
  {
    nom: "« Williams se déplace … depuis Paris »",
    motif: /Williams se déplac[^."?]*depuis/u,
    fautive: 'a: "Williams se déplace sur site depuis Paris pour auditer."',
    saine: 'a: "Williams se déplace sur site pour auditer."',
  },
  {
    nom: "« Williams intervient / se déplaçant / déplacement Williams depuis Paris »",
    motif: /Williams (?:intervient|se déplaçant) depuis|déplacement Williams depuis/u,
    fautive: 'a: "Williams intervient depuis Paris pour livrer du code."',
    saine: 'a: "Williams intervient pour livrer du code."',
  },
  {
    nom: "« Williams prend le RER E depuis Paris » / « Nous nous déplaçons depuis <Ville> »",
    motif: /Williams prend le RER E depuis|Nous nous déplaçons depuis [A-ZÉ]/u,
    fautive: 'a: "Nous nous déplaçons depuis Martigues vers Port-de-Bouc."',
    saine: 'a: "Nous nous déplaçons à Port-de-Bouc."',
  },
  {
    nom: "« déplacement rapide depuis Paris (16 km) »",
    motif: /déplacement rapide depuis Paris/u,
    fautive: 'a: "RGPD systématique, déplacement rapide depuis Paris (16 km)."',
    saine: 'a: "RGPD systématique."',
  },
  {
    nom: "prix « From €NNN excl. VAT »",
    motif: /From €\d+ excl\. VAT/iu,
    fautive: 'price: "From €990 excl. VAT"',
    saine: 'price: "{{price:audit-flash|flat}}"',
  },
];

function occurrences(motif: RegExp): string[] {
  return TRANCHE.flatMap((nom) =>
    readFileSync(join(DOSSIER, nom), "utf8")
      .split("\n")
      .flatMap((ligne, i) => (motif.test(ligne) ? [`${nom}:${i + 1}`] : [])),
  );
}

describe("villes · lot 2/3 sans fausse présence locale", () => {
  it("le lot est borné par nom, sans chevauchement avec les lots 1 et 3", () => {
    expect(TRANCHE.length).toBeGreaterThan(600);
    expect(TRANCHE[0] && TRANCHE[0] >= PREMIER).toBe(true);
    expect(TRANCHE.at(-1)).toBe("parmain.ts");
    expect(TRANCHE).not.toContain("gentilly.ts");
    expect(TRANCHE).not.toContain(SUIVANT);
    expect(TRANCHE.some((nom) => nom.startsWith("_"))).toBe(false);
  });

  for (const { nom, motif, fautive, saine } of MOTIFS) {
    it(`motif vivant · ${nom}`, () => {
      expect(motif.test(fautive)).toBe(true);
      expect(motif.test(saine)).toBe(false);
    });

    it(`0 occurrence dans le lot · ${nom}`, () => {
      expect(occurrences(motif)).toEqual([]);
    });
  }
});
