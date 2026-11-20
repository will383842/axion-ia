// @vitest-environment node
/**
 * Décision de Williams (20/11/2026) : « Aucun suivi nulle part ».
 *
 * Axion-IA ne promet AUCUN suivi après une prestation : ni point de suivi à 30 jours,
 * ni support post-livraison, ni questions/réponses après formation, ni suivi 30/60/90 jours,
 * ni accompagnement post-audit / post-déploiement inclus.
 *
 * Ce test rougit si une de ces promesses réapparaît dans le code publié (`src/content`,
 * `src/app`, `src/components`, `src/messages`). Il ne regarde PAS :
 *   - les tests eux-mêmes ;
 *   - les conseils donnés AUX clients dans le contenu de formation (`FICHIERS_CONSEIL_CLIENT`),
 *     où « point de suivi » désigne le rendez-vous que l'équipe du client se fixe elle-même ;
 *   - le garanti de remboursement de la Journée IA sous 30 jours, le « plan d'action sur
 *     90 jours » (un livrable), les durées de conservation : aucun de ces motifs n'en fait partie.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const DOSSIERS = [
  "src/content",
  "src/app",
  "src/components",
  "src/messages",
  "src/lib/email/templates",
];
const EXTENSIONS = /\.(ts|tsx|json)$/;
const EXCLUS = /(\.test\.|\.spec\.|__tests__|\/node_modules\/)/;

/** Conseils adressés au client dans les supports de formation : pas une promesse d'Axion-IA. */
const FICHIERS_CONSEIL_CLIENT = new Set([
  "src/content/formations/modules/ia-pour-les-equipes.ts",
  "src/content/formations/modules/seminaire-ia-toute-l-entreprise-1j.ts",
]);

/**
 * Gabarits d'e-mail INTERNES (formateurs, apporteurs, alertes, relances de dossier) : ils ne
 * s'adressent pas à un client après une prestation, « suivi » y désigne un traitement interne.
 * Seuls les gabarits adressés aux clients/stagiaires restent scannés.
 */
const GABARITS_EMAIL_INTERNES =
  /^src\/lib\/email\/templates\/(?:_formateur|_infos-pratiques-formateur|_kit-apporteur|_bareme-apporteur|formateur-|apporteur-|lead-apporteur-|candidature-|qualiopi-alerte-interne|alerte-demande-client|opco-)/;

const PROMESSES: ReadonlyArray<readonly [string, RegExp]> = [
  ["point de suivi", /point de suivi/i],
  ["support post-livraison", /support post[- ]?livraison/i],
  ["support post-intervention", /support post[- ]?intervention/i],
  ["questions/réponses inclus", /questions\s*\/\s*réponses inclus/i],
  ["suivi N jours", /suivi (?:post-mission (?:de )?)?\d+ jours/i],
  ["suivi post-mission", /suivi post-mission/i],
  [
    "accompagnement post-(audit|formation|déploiement) inclus",
    /accompagnement post[- ]?(?:audit|formation|déploiement|deploiement|livraison) inclus/i,
  ],
  ["30 jours de support", /(?:30|trente) (?:jours|j) de support/i],
  ["30-day support", /30[- ]days? (?:of )?(?:post-delivery )?support/i],
  ["bilan à N jours", /bilan à \d+ jours/i],
  ["« les suit avec vous »", /les suit avec vous/i],
  ["suivi continu", /suivi continu/i],
  ["accompagnement supplémentaire", /accompagnement supplémentaire/i],
  [
    "révisions périodiques / pendant N premiers mois",
    /r[ée]visions? (?:trimestrielle|mensuelle|semestrielle)s?|pendant les \d+ premiers mois/i,
  ],
  [
    "« suivi régulier » (coaching)",
    /ou un suivi r[ée]gulier|suivi r[ée]gulier mensuel|un suivi r[ée]gulier sur plusieurs|or regular follow-up|regular follow-up over several/i,
  ],
  [
    "suivi ponctuel / sessions de suivi / suivi à distance",
    /suivi ponctuel|sessions? de suivi|le suivi à distance|occasional follow-up|follow-up training/i,
  ],
  [
    "un suivi à distance / suivi en visio possible (après l'intervention)",
    /un suivi à distance|suivi en visio est possible|un suivi en visio/i,
  ],
];

/**
 * Base de connaissances de génération (articles, FAQ, chatbot RAG) : elle nourrit du texte
 * PUBLIC, donc elle ne doit pas non plus promettre de suivi après la prestation.
 * Les motifs sont volontairement étroits (promesses retirées le 20/11), pour ne pas rougir
 * sur « mesure à 6 mois » d'une étude citée ou sur « suivi » au sens de pilotage.
 */
const DOSSIER_KB = "src/server/content-gen/kb";
const PROMESSES_KB: ReadonlyArray<readonly [string, RegExp]> = [
  ["suivi post-formation", /suivi post-formation/i],
  ["évaluation à froid à 30 et 90 jours", /évaluation à froid à 30 et 90 jours/i],
  ["30 jours de support", /(?:30|trente) (?:jours|j) de support/i],
];

function* fichiers(dossier: string): Generator<string> {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (EXCLUS.test(chemin)) continue;
    if (statSync(chemin).isDirectory()) yield* fichiers(chemin);
    else if (EXTENSIONS.test(nom)) yield chemin;
  }
}

describe("décision du 20/11 — aucune promesse de suivi après prestation", () => {
  const corpus = DOSSIERS.flatMap((d) => [...fichiers(join(RACINE, d))])
    .map((chemin) => relative(RACINE, chemin).replaceAll("\\", "/"))
    .filter((rel) => !FICHIERS_CONSEIL_CLIENT.has(rel) && !GABARITS_EMAIL_INTERNES.test(rel));

  it("le corpus est bien lu (garde-fou contre un test qui ne regarde rien)", () => {
    expect(corpus.length).toBeGreaterThan(500);
  });

  for (const [nom, motif] of PROMESSES) {
    it(`« ${nom} » n'apparaît nulle part`, () => {
      const trouves: string[] = [];
      for (const rel of corpus) {
        const lignes = readFileSync(join(RACINE, rel), "utf8").split("\n");
        lignes.forEach((ligne, i) => {
          if (motif.test(ligne)) trouves.push(`${rel}:${i + 1}`);
        });
      }
      expect(trouves, `promesse de suivi réintroduite : ${nom}`).toEqual([]);
    });
  }

  for (const [nom, motif] of PROMESSES_KB) {
    it(`base de connaissances : « ${nom} » n'apparaît nulle part`, () => {
      const fichiersKb = [...fichiers(join(RACINE, DOSSIER_KB))];
      expect(fichiersKb.length).toBeGreaterThan(5);
      const trouves: string[] = [];
      for (const chemin of fichiersKb) {
        const rel = relative(RACINE, chemin).replaceAll("\\", "/");
        readFileSync(chemin, "utf8")
          .split("\n")
          .forEach((ligne, i) => {
            if (motif.test(ligne)) trouves.push(`${rel}:${i + 1}`);
          });
      }
      expect(trouves, `promesse de suivi dans la base de connaissances : ${nom}`).toEqual([]);
    });
  }
});
