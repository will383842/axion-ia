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

import { execFileSync } from "node:child_process";

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

/**
 * PASSE FINALE · RÈGLE GÉNÉRALE (au lieu d'une liste de motifs ponctuels).
 *
 * Un texte ne doit jamais laisser croire que l'équipe, un consultant ou
 * Williams PART d'une ville : « <mot du champ> … depuis <Ville ou nom propre> »,
 * quel que soit le mot (déplacement, intervention, accès rapide, mission…),
 * en FR comme en EN (« travelling from », « travel costs from »).
 */
const REGLE_GENERALE =
  /(?:se déplac|déplacements?|interventions?|intervenons|[Ii]ntervenir|consultants?|équipe|experts?|Williams|[Nn]ous|\bon\b|[Aa]ccès|[Cc]ouverture|accédez-vous|missions?)[^."?]{0,80}depuis (?!le |la |les |l'|son |sa |votre |vos )[A-ZÉ]/u;
const REGLE_GENERALE_EN =
  /(?:travel|travels|travelling|traveling|consultants?|experts?|Williams|we send|we travel)\b[^."?]{0,60}\b(?:from|travelling from|travels from) (?:Paris|Lille|Lyon|Bordeaux|Nantes|Versailles|Marseille|Toulouse|Strasbourg|Rennes|Nice|Montpellier|Rouen|Caen)\b/u;
const QUESTION_MISSION = /Comment se (?:passe|déroule) une (?:mission|intervention)[^"?]* depuis /u;

/**
 * Liste blanche ÉTROITE : faux positifs de la règle générale.
 *  · « …équipes pilotent l'outil en autonomie depuis <Ville> » : ce sont les
 *    équipes DU CLIENT (autonomie après la mission), pas les nôtres.
 */
const LISTE_BLANCHE: readonly RegExp[] = [
  /[ée]quipes?[^."?]{0,80}autonomie depuis /u,
  // Accès AU lieu pour le client (depuis la commune elle-même ou un axe routier), pas une origine d'équipe.
  /[Aa]ccès[^."?]{0,40}(?:directs? )?depuis (?:Loos|A8)\b/u,
];

function fautes(motifs: readonly RegExp[]): string[] {
  return TRANCHE.flatMap((nom) =>
    readFileSync(join(DOSSIER, nom), "utf8")
      .split("\n")
      .flatMap((ligne, i) =>
        motifs.some((m) => m.test(ligne)) && !LISTE_BLANCHE.some((b) => b.test(ligne))
          ? [`${nom}:${i + 1}`]
          : [],
      ),
  );
}

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

  describe("passe finale · règle générale", () => {
    it("motif vivant : une ligne fautive est reconnue, une saine non", () => {
      for (const fautive of [
        "Nos experts IA se déplacent depuis Paris en 30 min.",
        "Accès rapide par le RER A depuis Paris (20 min).",
        "Williams intervient sur site, déplacement depuis Lille.",
        "Les interventions courtes depuis Versailles.",
      ]) {
        expect(REGLE_GENERALE.test(fautive), fautive).toBe(true);
      }
      for (const saine of [
        "Nous intervenons partout en France, sur place ou à distance.",
        "La gare est accessible depuis le centre-ville.",
      ]) {
        expect(REGLE_GENERALE.test(saine), saine).toBe(false);
      }
      for (const fautive of [
        "Accès tram T2 direct depuis Montpellier centre.",
        "Couverture depuis Tours (45 min voiture).",
        "Comment accédez-vous à Lognes depuis Paris ?",
        "Intervenir au Plessis-Trévise (RER E ou A4 depuis Paris) pour automatiser.",
      ]) {
        expect(REGLE_GENERALE.test(fautive), fautive).toBe(true);
      }
      expect(REGLE_GENERALE.test("Métro ligne 11, Châtelet à 20 min.")).toBe(false);
      expect(REGLE_GENERALE_EN.test("Our consultants travel from Paris to your site.")).toBe(true);
      expect(REGLE_GENERALE_EN.test("Travel costs are billed separately.")).toBe(false);
      expect(QUESTION_MISSION.test("Comment se déroule une intervention depuis Nantes ?")).toBe(
        true,
      );
      expect(QUESTION_MISSION.test("Comment se déroule une intervention à Nantes ?")).toBe(false);
      expect(
        LISTE_BLANCHE.some((b) => b.test("Vos équipes pilotent l'outil en autonomie depuis Lyon")),
      ).toBe(true);
    });

    it("0 occurrence de la règle générale (FR + EN + questions) hors liste blanche", () => {
      expect(fautes([REGLE_GENERALE, REGLE_GENERALE_EN, QUESTION_MISSION])).toEqual([]);
    });
  });
});

describe("villes · lot 2/3 · une réponse « communes proches » garde sa liste", () => {
  const QR = /q:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*a:\s*"((?:[^"\\]|\\.)*)"/g;
  const AVEC_LISTE = /\([^()]*,[^()]*\)|(?:voisines|limitrophes)[^.]*,/u;
  const COMMUNES = /communes (?:proches|voisines)/u;

  it("motif vivant", () => {
    expect(AVEC_LISTE.test("Oui, à Meudon et dans les communes voisines (Sèvres, Clamart).")).toBe(
      true,
    );
    expect(AVEC_LISTE.test("Oui. Nous intervenons partout en France.")).toBe(false);
  });

  it("aucune réponse du lot n'a perdu sa liste de communes par rapport à origin/main", () => {
    const perdues: string[] = [];
    for (const nom of TRANCHE) {
      let ref: string;
      try {
        ref = execFileSync("git", ["show", `origin/main:src/content/villes/copy/${nom}`], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          maxBuffer: 8 * 1024 * 1024,
        });
      } catch {
        continue; // pas de référence (fichier neuf, ou origin/main absent)
      }
      const actuel = [...readFileSync(join(DOSSIER, nom), "utf8").matchAll(QR)];
      const avant = [...ref.matchAll(QR)];
      if (avant.length !== actuel.length) continue;
      avant.forEach((m, i) => {
        const a = m[2] ?? "";
        if (
          COMMUNES.test(`${m[1]} ${a}`) &&
          AVEC_LISTE.test(a) &&
          !AVEC_LISTE.test(actuel[i]?.[2] ?? "")
        ) {
          perdues.push(`${nom} · ${m[1]}`);
        }
      });
    }
    expect(perdues).toEqual([]);
  });
});
