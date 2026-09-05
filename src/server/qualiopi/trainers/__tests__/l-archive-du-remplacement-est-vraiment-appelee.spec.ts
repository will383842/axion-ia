/**
 * 🔴 L'archive d'une affectation retirée doit être RÉELLEMENT APPELÉE.
 *
 * ## Le défaut que ce témoin existe pour attraper
 *
 * `assignTrainerToSessionAction` supprime la ligne `SessionFormateur` de
 * l'ancien formateur — et avec elle son tarif snapshoté, ses heures animées et
 * les envois déjà faits. `archiverAffectationsRetirees` existe pour en garder la
 * trace (défaut D6).
 *
 * Le 2026-09-05, cet appel a **disparu du code sans que rien ne rougisse**. Un
 * agent l'avait remplacé par un marqueur `// MUTATION` pour éprouver sa garde,
 * puis est mort avant de restaurer — tué net par le plafond de session. Résultat :
 *
 * - le code **compilait** (`tsc --noEmit` exit 0) ;
 * - les tests **passaient** ;
 * - la fonction restait **importée, jamais appelée** ;
 * - et l'archive n'était plus jamais écrite.
 *
 * 🔑 **`tsc` ne voit pas un import orphelin ; `eslint` si.** Je n'avais lancé que
 * le typecheck. La leçon n'est pas « lancer lint » — c'est qu'un défaut peut
 * vivre dans ce qui MANQUE, et que rien de ce qui vérifie du code présent ne le
 * verra. D'où ce témoin, qui ne vérifie pas un comportement mais une PRÉSENCE.
 *
 * ## Pourquoi il lit la source
 *
 * Éprouver l'appel réellement demanderait de simuler toute l'action (auth,
 * transaction Prisma, habilitations). Ce qu'on veut garder est plus simple et
 * plus durable : **un import qui n'est pas appelé est un mensonge**, et il ne
 * doit pas pouvoir se réinstaller en silence.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SOURCE = fs.readFileSync(
  path.join(process.cwd(), "src/server/actions/qualiopi/trainers.ts"),
  "utf-8",
);

/** Retire les commentaires : la prose qui documente le défaut le cite. */
function sansCommentaires(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/.*$/, ""))
    .join("\n");
}

const CODE = sansCommentaires(SOURCE);

/** Ce qui est importé de `affectation-retiree` doit être APPELÉ. */
const FONCTIONS_ARCHIVE = ["lireAffectationsAvantRetrait", "archiverAffectationsRetirees"] as const;

describe("🔴 l'archive du remplacement de formateur est vraiment appelée", () => {
  it("le fichier est bien celui qu'on croit lire", () => {
    // Témoin de prémisse : un chemin faux rendrait une chaîne vide, et toutes
    // les assertions ci-dessous passeraient sur du néant.
    expect(CODE.length).toBeGreaterThan(5000);
    expect(CODE).toContain("export async function assignTrainerToSessionAction");
  });

  it("importe bien les deux fonctions d'archive", () => {
    for (const fn of FONCTIONS_ARCHIVE) {
      expect(CODE).toContain(fn);
    }
  });

  it("🔴 APPELLE chacune d'elles — un import non appelé est un mensonge", () => {
    const jamaisAppelees = FONCTIONS_ARCHIVE.filter((fn) => {
      // `await fn(` ou `fn(` — l'import lui-même s'écrit sans parenthèse, donc
      // la parenthèse suffit à distinguer l'appel de la déclaration d'import.
      return !new RegExp(`${fn}\\s*\\(`).test(CODE);
    });
    expect(jamaisAppelees).toEqual([]);
  });

  it("archive avec un MOTIF dérivé, pas une constante", () => {
    // `remplacement` quand quelqu'un prend la place, `desaffectation` quand
    // l'organisme retire sans désigner personne. Ce ne sont pas les mêmes faits,
    // et un auditeur ne lit pas le second comme le premier. Figer l'un des deux
    // rendrait l'archive présente mais fausse — pire qu'absente.
    expect(CODE).toMatch(
      /motif:\s*trainerId\s*!==\s*null\s*\?\s*"remplacement"\s*:\s*"desaffectation"/,
    );
  });

  it("LIT le snapshot AVANT la transaction, et ARCHIVE APRÈS", () => {
    // L'ordre porte tout le sens : lire après la suppression ne rendrait rien,
    // archiver avant le succès écrirait un retrait qui n'a peut-être pas eu lieu.
    // ⚠️ BORNÉ à la fonction concernée. Chercher dans tout le fichier prenait le
    // PREMIER `prisma.$transaction(` du module — celui d'une autre action, 8 000
    // caractères plus haut — et la garde rougissait sur un ordre parfaitement
    // correct. Un `indexOf` sur un fichier entier ne mesure pas ce qu'on croit
    // dès qu'un même motif apparaît plusieurs fois.
    const debut = CODE.indexOf("export async function assignTrainerToSessionAction");
    expect(debut).toBeGreaterThan(0);
    const suivante = CODE.indexOf("export async function", debut + 10);
    const corps = CODE.slice(debut, suivante > 0 ? suivante : CODE.length);

    const iLecture = corps.indexOf("lireAffectationsAvantRetrait(");
    const iTransaction = corps.indexOf("prisma.$transaction(");
    const iArchive = corps.indexOf("archiverAffectationsRetirees(");
    expect(iLecture).toBeGreaterThan(0);
    expect(iTransaction).toBeGreaterThan(iLecture);
    expect(iArchive).toBeGreaterThan(iTransaction);
  });

  it("le détecteur d'appel RECONNAÎT la forme manquante", () => {
    // Contre-épreuve du détecteur lui-même, sur un échantillon fabriqué :
    // exactement l'état dans lequel la mutation avait laissé le fichier.
    const mute = `
      import { archiverAffectationsRetirees } from "./affectation-retiree";
      async function faire() {
        return 1;
      }
    `;
    expect(/archiverAffectationsRetirees\s*\(/.test(sansCommentaires(mute))).toBe(false);
    const sain = `
      import { archiverAffectationsRetirees } from "./affectation-retiree";
      async function faire() {
        await archiverAffectationsRetirees([], { motif: "remplacement" });
      }
    `;
    expect(/archiverAffectationsRetirees\s*\(/.test(sansCommentaires(sain))).toBe(true);
  });
});
