/**
 * 🔴 « Inscrit actif » ne s'écrit plus à la main.
 *
 * ## Le défaut
 *
 * Le prédicat « hors abandon et exclusion » était recopié **quinze fois** dans
 * douze fichiers — indicateurs, pilotage, présence, financement, alertes, crons,
 * documents, satisfaction, liens d'émargement, clôture. L'une des copies
 * l'écrivait dans l'ordre inverse (`["exclu", "abandon"]`) : la preuve qu'il
 * s'agissait de recopies indépendantes, et non d'une constante partagée.
 *
 * ⚠️ Ces lectures alimentent des chiffres qui doivent COÏNCIDER : le nombre
 * d'inscrits au BPF, le dénominateur du taux de présence, le décompte du dossier
 * de financement, la base des indicateurs. Le jour où un statut de sortie
 * s'ajoute, la copie qu'on oublie compte une personne de trop — et deux écrans
 * de la console affichent deux vérités sur la même session.
 *
 * ## Ce que ce fichier garde
 *
 * L'INTERDICTION d'écrire à nouveau la liste à la main. Vérifier que les copies
 * sont « à jour » supposerait de repasser ; interdire la recopie, non.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { STATUTS_SORTIS, inscriptionsActives, estInscriptionActive } from "../inscriptions-actives";

const SRC = join(process.cwd(), "src");
const SOURCE_DU_PREDICAT = join("server", "qualiopi", "inscriptions", "inscriptions-actives.ts");

/** Tous les `.ts`/`.tsx` de `src/`, hors tests. */
function fichiers(): string[] {
  const sortie: string[] = [];
  const pile = [SRC];
  while (pile.length > 0) {
    const dossier = pile.pop();
    if (dossier === undefined) break;
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name);
      if (e.isDirectory()) pile.push(chemin);
      else if (
        (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) &&
        !/\.(spec|test)\.tsx?$/.test(e.name)
      ) {
        sortie.push(chemin);
      }
    }
  }
  return sortie;
}

describe("« inscrit actif » — une seule définition", () => {
  it("le prédicat rend le fragment attendu", () => {
    expect(inscriptionsActives()).toEqual({ statut: { notIn: ["abandon", "exclu"] } });
    expect(STATUTS_SORTIS).toHaveLength(2);
  });

  it("le témoin : la fonction SAIT distinguer les deux cas", () => {
    // 🔑 Sans lui, un prédicat qui rendrait toujours `true` passerait le test
    // ci-dessus — il ne vérifie que la forme du fragment Prisma.
    expect(estInscriptionActive("planifiee")).toBe(true);
    expect(estInscriptionActive("presente")).toBe(true);
    expect(estInscriptionActive("abandon")).toBe(false);
    expect(estInscriptionActive("exclu")).toBe(false);
  });

  it("🔴 personne ne réécrit la liste à la main", () => {
    // ⚠️ Les deux ORDRES sont interdits : c'est en écrivant `["exclu",
    // "abandon"]` qu'une des copies s'était trahie comme indépendante.
    const motif = /notIn:\s*\[\s*"(abandon|exclu)",\s*"(exclu|abandon)"\s*\]/;
    const coupables = fichiers().filter((f) => {
      if (f.endsWith(SOURCE_DU_PREDICAT)) return false;
      const code = readFileSync(f, "utf-8")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      return motif.test(code);
    });
    expect(
      coupables.map((f) => f.slice(SRC.length + 1)),
      "utilisez `inscriptionsActives()` : deux définitions finissent par diverger",
    ).toEqual([]);
  });

  it("🔴 personne ne réécrit non plus la comparaison en JavaScript", () => {
    // ⚠️ La recopie ne prend pas qu'une forme. Trois GARDES — refuser un
    // certificat, refuser une signature de plus, refuser une attestation —
    // écrivaient `statut === "abandon" || statut === "exclu"` à la main, dont
    // une dans l'ordre inverse. Et l'un des commentaires demandait de « rester
    // cohérent avec » son jumeau : une prière en commentaire est l'aveu qu'on
    // sait que ça va diverger.
    //
    // 🔑 Ce sont les gardes les plus coûteuses à laisser diverger : celle qu'on
    // oublie de durcir DÉLIVRE une attestation à quelqu'un qui a abandonné.
    const motif = /statut\s*===\s*"(abandon|exclu)"\s*\|\|[\s\S]{0,60}?===\s*"(exclu|abandon)"/;
    const coupables = fichiers().filter((f) => {
      if (f.endsWith(SOURCE_DU_PREDICAT)) return false;
      const code = readFileSync(f, "utf-8")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      return motif.test(code);
    });
    expect(
      coupables.map((f) => f.slice(SRC.length + 1)),
      "utilisez `estInscriptionActive()` : la copie qu'on oublie de durcir délivre la pièce",
    ).toEqual([]);
  });

  it("le témoin de non-vacuité : la lecture voit bien les fichiers", () => {
    // 🔑 Un balayage cassé rendrait la liste vide et le test précédent vert pour
    // de mauvaises raisons.
    const tous = fichiers();
    expect(tous.length).toBeGreaterThan(500);
    expect(tous.some((f) => f.endsWith(SOURCE_DU_PREDICAT))).toBe(true);
  });
});
