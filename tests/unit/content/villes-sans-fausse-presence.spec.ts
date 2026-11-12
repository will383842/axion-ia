/**
 * Les pages villes ne mentent pas sur une présence locale.
 *
 * Axion-IA n'a aucun bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. Les fichiers
 * `src/content/villes/copy/*.ts` sont servis AVANT la base
 * (`resolve-with-copy.ts`), donc une phrase fausse écrite là s'affiche telle
 * quelle. « Grenoble » est en outre interdit en communication : Axion-IA ne se
 * présente jamais comme venant de, ou basée à, Grenoble.
 *
 * Ce test lit tous les fichiers du dossier et refuse :
 *   · « Nos consultants sont basés… » ;
 *   · « depuis nos bureaux » / « bureaux proches de » ;
 *   · « nos bureaux <ville> », sauf les deux questions de client listées ;
 *   · « notre bureau », « nos locaux » (hors questions de client listées),
 *     « our office(s) » et « we are / our team … based in » ;
 *   · le mot « Grenoble » dans tout fichier autre que `grenoble.ts` ;
 *   · dans `grenoble.ts` (page DE la ville, le nom y est le sujet), toute
 *     phrase qui place Axion-IA à Grenoble.
 *
 * Hors périmètre, volontairement non verrouillé ici : « Nos consultants
 * viennent de X » et « Nos consultants interviennent depuis X ».
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");

const FICHIERS = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith(".ts"))
  .sort();

const CONTENUS = new Map<string, string>(
  FICHIERS.map((nom) => [nom, readFileSync(join(DOSSIER, nom), "utf8")]),
);

/** Fichiers qui contiennent `motif`, avec le numéro de ligne de la 1re occurrence. */
function violations(motif: RegExp, exclure: (nom: string) => boolean = () => false): string[] {
  const trouves: string[] = [];
  for (const [nom, texte] of CONTENUS) {
    if (exclure(nom)) continue;
    texte.split("\n").forEach((ligne, i) => {
      if (motif.test(ligne)) trouves.push(`${nom}:${i + 1}`);
    });
  }
  return trouves;
}

/**
 * Seules « nos bureaux » légitimes : la QUESTION d'un client (« Pouvez-vous
 * intervenir sur site dans nos bureaux … ? »), où « nos » désigne le client.
 * Phrase exacte exigée : une exception ne couvre pas le reste du fichier.
 */
const QUESTIONS_CLIENT: ReadonlyArray<readonly [string, string]> = [
  ["dijon.ts", 'q: "Pouvez-vous intervenir sur site dans nos bureaux dijonnais ?",'],
  ["lille.ts", 'q: "Pouvez-vous intervenir sur site dans nos bureaux lillois ou nos entrepôts ?",'],
  ["montpellier.ts", 'q: "Pouvez-vous intervenir sur site dans nos bureaux montpelliérains ?",'],
  [
    "nice.ts",
    'q: "Pouvez-vous intervenir sur site dans nos bureaux niçois ou à Sophia Antipolis ?",',
  ],
  ["paris.ts", 'q: "Pouvez-vous intervenir sur site dans nos bureaux parisiens ?",'],
  ["reims.ts", 'q: "Pouvez-vous intervenir sur site à Reims dans nos bureaux ou caves ?",'],
];

/**
 * « nos locaux » : mêmes questions de client que ci-dessus, phrase exacte exigée.
 */
const QUESTIONS_CLIENT_LOCAUX: ReadonlyArray<readonly [string, string]> = [
  [
    "angers.ts",
    'q: "Pouvez-vous intervenir sur site dans nos locaux angevins ou dans les communes alentour ?",',
  ],
  ["marseille.ts", 'q: "Pouvez-vous intervenir sur site dans nos locaux marseillais ?",'],
  ["nantes.ts", 'q: "Pouvez-vous intervenir sur site dans nos locaux nantais ?",'],
  ["nimes.ts", 'q: "Pouvez-vous intervenir sur site dans nos locaux à Nîmes ?",'],
];

describe("villes · aucune fausse présence physique", () => {
  it("le dossier est bien lu (garde contre un test vide)", () => {
    expect(FICHIERS.length).toBeGreaterThan(2000);
  });

  it("aucun « Nos consultants sont basés »", () => {
    expect(violations(/Nos consultants sont basés/i)).toEqual([]);
  });

  it("aucun « depuis nos bureaux »", () => {
    expect(violations(/depuis nos bureaux/i)).toEqual([]);
  });

  it("aucun « bureaux proches de »", () => {
    expect(violations(/bureaux proches de/i)).toEqual([]);
  });

  it("« nos bureaux » n'apparaît que dans les questions de client listées", () => {
    const autorisees = new Set(QUESTIONS_CLIENT.map(([nom, phrase]) => `${nom}|${phrase}`));
    const fautives: string[] = [];
    for (const [nom, texte] of CONTENUS) {
      texte.split("\n").forEach((ligne, i) => {
        if (!/nos bureaux/i.test(ligne)) return;
        if (!autorisees.has(`${nom}|${ligne.trim()}`)) fautives.push(`${nom}:${i + 1}`);
      });
    }
    expect(fautives).toEqual([]);
  });

  it("« nos locaux » n'apparaît que dans les questions de client listées", () => {
    const autorisees = new Set(QUESTIONS_CLIENT_LOCAUX.map(([nom, phrase]) => `${nom}|${phrase}`));
    const fautives: string[] = [];
    for (const [nom, texte] of CONTENUS) {
      texte.split("\n").forEach((ligne, i) => {
        if (!/\bnos locaux\b/i.test(ligne)) return;
        if (!autorisees.has(`${nom}|${ligne.trim()}`)) fautives.push(`${nom}:${i + 1}`);
      });
    }
    expect(fautives).toEqual([]);
  });

  it("chaque exception « nos locaux » existe encore telle quelle", () => {
    for (const [nom, phrase] of QUESTIONS_CLIENT_LOCAUX) {
      const lignes = (CONTENUS.get(nom) ?? "").split("\n").map((l) => l.trim());
      expect(lignes, `${nom} : exception introuvable`).toContain(phrase);
    }
  });

  it("aucun « notre bureau », « our office(s) » ni « we are / our team … based in »", () => {
    expect(violations(/\bnotre bureau/i)).toEqual([]);
    expect(violations(/\bour offices?\b/i)).toEqual([]);
    expect(
      violations(
        /\b(we are|we're|our (team|consultants|experts|firm)( is| are)?|Axion-IA (is|are)) based (in|at)\b/i,
      ),
    ).toEqual([]);
    expect(
      violations(
        /\b(nos (consultants|équipes)|notre (équipe|cabinet))\s+(est |sont )?(basée?s?|installée?s?|implantée?s?)\s+(à|au|aux|sur|dans)\b/i,
      ),
    ).toEqual([]);
  });

  it("chaque exception « nos bureaux » existe encore telle quelle (pas de liste morte)", () => {
    for (const [nom, phrase] of QUESTIONS_CLIENT) {
      const lignes = (CONTENUS.get(nom) ?? "").split("\n").map((l) => l.trim());
      expect(lignes, `${nom} : exception introuvable`).toContain(phrase);
    }
  });

  it("« Grenoble » n'apparaît dans aucun fichier autre que grenoble.ts", () => {
    expect(violations(/Grenoble/i, (nom) => nom === "grenoble.ts")).toEqual([]);
  });

  it("grenoble.ts ne place pas Axion-IA à Grenoble", () => {
    const texte = CONTENUS.get("grenoble.ts") ?? "";
    expect(texte.length).toBeGreaterThan(0);
    const motifs: ReadonlyArray<RegExp> = [
      /depuis Grenoble/i,
      /from Grenoble/i,
      /(consultants|équipe|bureaux?|siège|agence|cabinet)\s+(grenobl|de Grenoble|à Grenoble|basés?)/i,
      /(consultants|team|office|headquarters)\s+(based\s+)?(in|at)\s+Grenoble/i,
      /basée?s?\s+(à|sur)\s+Grenoble/i,
      /based\s+(in|at)\s+Grenoble/i,
      /(notre|nos)\s+(bureaux?|siège|agence|équipes?)[^.]{0,40}Grenoble/i,
    ];
    const fautives: string[] = [];
    texte.split("\n").forEach((ligne, i) => {
      for (const m of motifs) if (m.test(ligne)) fautives.push(`grenoble.ts:${i + 1} ${m}`);
    });
    expect(fautives).toEqual([]);
  });
});
