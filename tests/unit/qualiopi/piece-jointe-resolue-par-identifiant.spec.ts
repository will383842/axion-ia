// @vitest-environment node

/**
 * Verrou — une pièce ATTACHÉE à un e-mail se résout par IDENTIFIANT, jamais par
 * récence.
 *
 * ## Le motif, et il est arrivé TROIS fois
 *
 * Ce n'est pas une série de hasards, c'est une famille :
 *
 *  1. **2026-08-20, `D2-5-07`** — `filtreMemePiece` ignorait `sousTraitantId` :
 *     régénérer le contrat d'un sous-traitant produisait un SECOND ORIGINAL, non
 *     filigrané, et le registre portait deux contrats concurrents dont aucun ne
 *     disait lequel faisait foi.
 *  2. **2026-09-12, #1052** — la transmission d'une autofacture retrouvait son
 *     PDF par `findFirst` trié sur la date. Le cas que le cron de rattrapage
 *     PRODUIT : un formateur avec deux factures, août et septembre, dont l'envoi
 *     d'août a échoué. Cliquer « Transmettre » sur août lui envoyait le PDF de
 *     SEPTEMBRE — avec le numéro et le montant d'août dans le corps du message.
 *     Une pièce comptable fausse, partie chez un tiers.
 *  3. **2026-09-12, #1055** — le même trou sur `trainerId` : un contrat de
 *     travail régénéré serait sorti en second original.
 *
 * 🔑 **Le dénominateur commun : une pièce est identifiée par ce à quoi elle se
 * RATTACHE, jamais par sa position dans une liste.** « La dernière », « la plus
 * récente », « celle du haut » sont des sélections qui marchent tant qu'il n'y en
 * a qu'une — et le jour où il y en a deux, elles se trompent en silence, avec
 * l'aplomb d'un résultat parfaitement normal.
 *
 * ## Ce que ce test garde, et ce qu'il ne garde PAS
 *
 * ⚠️ Il ne condamne pas `findFirst`. Choisir la pièce la plus récente pour
 * l'AFFICHER est légitime, et le dépôt le fait exprès à plusieurs endroits (la
 * lettre de mission d'une session, le dernier tirage d'un contrat sur la fiche
 * formateur) : le tirage le plus récent fait foi à l'écran, et les précédents
 * gardent leurs signatures en base.
 *
 * Ce qu'il condamne est la conjonction : **un fichier qui construit une pièce
 * jointe d'e-mail ET qui résout un `documentGenere` par récence**. Là, la
 * sélection ne décide plus de ce qu'on affiche, elle décide de ce qui PART — et
 * un envoi ne se rattrape pas.
 *
 * ## 🔑 Ce test est un CLIQUET, pas un correctif
 *
 * Les cinq envoyeurs du dépôt sont déjà corrects au moment où il est écrit : ils
 * lisent tous par `findUnique`. Ce test ne répare rien — il empêche la
 * quatrième occurrence, qui autrement arriverait par la même porte que les
 * trois premières, dans six mois, sur une pièce qu'on n'a pas encore inventée.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

/**
 * Fichiers de PRODUCTION susceptibles d'envoyer une pièce jointe.
 *
 * 🔴 Découverts, jamais listés à la main. Une liste écrite ici vieillirait : le
 * prochain envoyeur ne s'y ajouterait pas tout seul, et la garde le laisserait
 * passer sans un mot — ce qui est exactement la manière dont une garde devient
 * décorative.
 *
 * ⚠️ Les `.spec` sont exclus : un test qui SIMULE un mauvais appel pour prouver
 * qu'il est refusé n'est pas une violation, c'est le contraire.
 */
function fichiersQuiJoignentUnePiece(): string[] {
  // ⚠️ `git grep` SORT EN 1 quand il ne trouve rien, et `execSync` lève alors.
  // Sans ce filet, un motif devenu faux ferait échouer le fichier AU CHARGEMENT :
  // « no tests », aucune assertion nommée, et personne ne saurait que c'est la
  // découverte qui est cassée et non le code gardé. On rend la liste VIDE, et
  // c'est le témoin positif ci-dessous qui le DIT, avec son message.
  let sortie: string;
  try {
    sortie = execSync(
      'git grep -l "attachments" -- "src/server/**/*.ts" "src/app/**/*.ts" ":!*.spec.ts" ":!*.spec.tsx"',
      { cwd: process.cwd(), encoding: "utf8" },
    );
  } catch {
    sortie = "";
  }
  return sortie
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Résolution d'une pièce par RÉCENCE, c'est-à-dire par position dans une liste. */
const PAR_RECENCE = /prisma\s*\.\s*documentGenere\s*\.\s*(findFirst|findMany)\s*\(/;

/** Résolution d'une pièce par IDENTIFIANT. */
const PAR_IDENTIFIANT = /prisma\s*\.\s*documentGenere\s*\.\s*findUnique\s*\(/;

describe("une pièce jointe se résout par identifiant, jamais par récence", () => {
  const fichiers = fichiersQuiJoignentUnePiece();

  it("🔑 TÉMOIN POSITIF : la découverte trouve réellement des envoyeurs", () => {
    // Sans cette assertion, un motif `git grep` devenu faux — un renommage de
    // `attachments`, un déplacement de répertoire — rendrait une liste VIDE, et
    // la boucle ci-dessous passerait zéro fois. Verte, muette, et aveugle.
    //
    // ⚠️ Le seuil est volontairement BAS et le contenu volontairement NOMMÉ :
    // c'est le contenu qui discrimine, jamais le nombre. Un compte qui monte
    // n'est pas une régression — c'est un envoyeur de plus, et il sera contrôlé.
    expect(
      fichiers.length,
      "La DÉCOUVERTE ne rend aucun fichier : c'est le motif `git grep` qui est " +
        "cassé, pas le code gardé. Vérifiez le nom du champ (`attachments`) et " +
        "les chemins avant de conclure quoi que ce soit sur les envoyeurs.",
    ).toBeGreaterThanOrEqual(4);
    expect(fichiers).toContain("src/server/actions/qualiopi/autofacture.ts");
    expect(fichiers).toContain(
      "src/server/qualiopi/documents/signature/transmission-exemplaire.ts",
    );
  });

  it("🔴 aucun envoyeur ne choisit sa pièce jointe par récence", () => {
    const fautifs = fichiers.filter((f) => {
      const source = readFileSync(join(process.cwd(), f), "utf8");
      return PAR_RECENCE.test(source);
    });

    expect(
      fautifs,
      "Ce fichier construit une pièce jointe d'e-mail ET résout un `documentGenere` " +
        "par `findFirst`/`findMany` — c'est-à-dire par sa POSITION dans une liste.\n" +
        "  · Si la pièce est déjà rattachée à l'entité (un `…DocumentId` en base), " +
        "lisez-la par `findUnique` sur cet identifiant.\n" +
        "  · Si ce rattachement n'existe pas encore, POSEZ-LE au moment où la pièce " +
        "est produite. C'est ce qu'a fait #1052 avec `autofactureDocumentId`, après " +
        "qu'une facture d'août soit partie avec le PDF de septembre.\n" +
        "  · Choisir « la plus récente » marche tant qu'il n'y en a qu'une. Le jour " +
        "où il y en a deux, l'envoi se trompe en silence — et un envoi ne se " +
        "rattrape pas.",
    ).toStrictEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : le motif de récence reconnaît bien ce qu'il doit condamner", () => {
    // Sans lui, une expression régulière devenue fausse (un espace, un point,
    // une refonte du client Prisma) rendrait le test ci-dessus vert pour
    // toujours — et il ne regarderait plus rien.
    expect(PAR_RECENCE.test("const d = await prisma.documentGenere.findFirst({")).toBe(true);
    expect(PAR_RECENCE.test("await prisma . documentGenere . findMany ({")).toBe(true);
    // Et il ne doit PAS condamner la lecture par identifiant, sans quoi la garde
    // interdirait le remède qu'elle prescrit.
    expect(PAR_RECENCE.test("await prisma.documentGenere.findUnique({ where: { id } })")).toBe(
      false,
    );
    expect(PAR_IDENTIFIANT.test("await prisma.documentGenere.findUnique({ where: { id } })")).toBe(
      true,
    );
    // ⚠️ Et il ne doit pas déborder sur un AUTRE modèle : `trainingSession.findFirst`
    // est parfaitement licite dans un envoyeur, et le condamner rendrait la
    // garde intenable — donc désarmée à la première PR pressée.
    expect(PAR_RECENCE.test("await prisma.trainingSession.findFirst({")).toBe(false);
  });

  it("🔑 au moins un envoyeur lit RÉELLEMENT par identifiant", () => {
    // Témoin positif du remède : si plus personne ne lisait par `findUnique`,
    // le test principal serait vert parce que plus aucun envoyeur ne toucherait
    // `documentGenere` — verdict juste, mesure vide.
    const vertueux = fichiers.filter((f) =>
      PAR_IDENTIFIANT.test(readFileSync(join(process.cwd(), f), "utf8")),
    );
    expect(vertueux.length).toBeGreaterThan(0);
  });
});
