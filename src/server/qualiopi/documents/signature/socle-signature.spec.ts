/**
 * Lot S6a — le socle de signature commun, vérifié sur le SOURCE.
 *
 * 🔴 Ce que ce verrou ferme : six actions de signature, six façons de « finir »
 * une signature. Le canal jeton remettait l'exemplaire, la contresignature de
 * la lettre de mission ne remettait rien (le rattrapage horaire passait
 * derrière), et chaque fichier recopiait la paire `super_admin | admin` et sa
 * propre lecture des en-têtes.
 *
 * Désormais :
 *   - chaque action appelle `apresSignature`, et aucune n'appelle
 *     `transmettreExemplaireSigne` directement ;
 *   - aucune ne code un rôle en dur : la garde est `peutEngager("contresigner")` ;
 *   - aucune ne redéfinit `contexteRequete`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HABILITATIONS } from "@/server/auth/habilitations";

const RACINE = join(__dirname, "..", "..", "..", "..", "..");

/** Les fichiers des six actions de signature (et de l'action par lot). */
const ACTIONS: ReadonlyArray<{ fichier: string; actions: readonly string[] }> = [
  {
    fichier: "src/server/actions/qualiopi/piece-signature.ts",
    actions: ["signerPieceParJetonAction", "contresignerPieceAction", "contresignerParLotAction"],
  },
  {
    fichier: "src/server/actions/qualiopi/lettre-mission-signature.ts",
    actions: ["signerLettreMissionFormateurAction", "contresignerLettreMissionAction"],
  },
  {
    fichier: "src/server/actions/qualiopi/contrat-travail-signature.ts",
    actions: ["signerContratTravailFormateurAction", "signerContratTravailEmployeurAction"],
  },
];

/** Le relevé n'est pas une pièce contractuelle, mais il partage garde et contexte. */
const AUTRES_SIGNATURES = ["src/server/actions/qualiopi/releve-signature.ts"];

function lire(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8");
}

/** Code sans commentaires : documenter la règle ne doit pas la satisfaire. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Corps d'une fonction exportée, jusqu'à la prochaine déclaration de premier niveau. */
function corps(source: string, nom: string): string {
  const debut = source.indexOf(`export async function ${nom}(`);
  if (debut < 0) return "";
  const suite = source.slice(debut + 1);
  const fin = suite.search(/\n(export |async function |function |const |type |interface )/);
  return fin < 0 ? suite : suite.slice(0, fin);
}

describe("S6a — six actions, un seul après-signature", () => {
  for (const { fichier, actions } of ACTIONS) {
    const source = code(lire(fichier));

    for (const action of actions) {
      it(`${action} appelle apresSignature`, () => {
        const c = corps(source, action);
        expect(c, `${action} introuvable dans ${fichier}`).not.toBe("");
        // L'action par lot passe par la contresignature unitaire : elle hérite
        // de son après-signature, et c'est ce qu'on vérifie.
        expect(c).toMatch(/apresSignature\(|contresignerUne\(/);
      });
    }

    it(`${fichier} n'appelle jamais transmettreExemplaireSigne directement`, () => {
      expect(source).not.toMatch(/transmettreExemplaireSigne/);
      expect(source).not.toMatch(/consequenceSignatureComplete/);
    });
  }

  for (const fichier of [...ACTIONS.map((a) => a.fichier), ...AUTRES_SIGNATURES]) {
    const source = code(lire(fichier));

    it(`${fichier} ne code aucun rôle en dur`, () => {
      expect(source).not.toMatch(/role\s*[!=]==\s*"(super_admin|admin)"/);
    });

    it(`${fichier} ne redéfinit pas contexteRequete`, () => {
      expect(source).not.toMatch(/function contexteRequete\(/);
    });
  }

  it("la garde de rôle unique garde les mêmes rôles qu'avant", () => {
    expect([...HABILITATIONS.contresigner].sort()).toEqual(["admin", "super_admin"]);
  });

  it("apresSignature vit HORS d'un fichier « use server »", () => {
    const source = lire("src/server/qualiopi/documents/signature/apres-signature.ts");
    expect(source).not.toMatch(/^\s*["']use server["']/m);
  });

  it("l'émission du lien est une enveloppe du service emettreLienSignature", () => {
    const source = code(lire("src/server/actions/qualiopi/piece-lien-signature.ts"));
    const c = corps(source, "emettreLienSignatureAction");
    expect(c).toMatch(/emettreLienSignature\(/);
    expect(c).not.toMatch(/creerTokenDocument/);
  });
});
