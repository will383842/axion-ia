/**
 * Registre des gestes humains (lot S0-bis) — test STATIQUE.
 *
 * Toute Server Action de la console qui fait passer une étape à un formateur
 * indépendant (étape de suivi, étape de mission, relevé de rémunération) doit
 * être rattachée à un geste du registre. Sinon le geste n'apparaît dans aucune
 * tuile « À faire maintenant », et personne ne le fait.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { GESTES_HUMAINS, actionsDuRegistre } from "./gestes-humains";

const SRC = join(process.cwd(), "src");

/** Écrit l'étape d'un formateur : suivi, mission, ou relevé. */
const MARQUEURS_ETAPE =
  /etapeMission|etape-suivi-formateur|etapeSuiviFormateur|trainerStatement\.update(Many)?\(|\b(emettre|transmettre)Autofacture\(/;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return nom === "node_modules" ? [] : fichiers(chemin);
    return /\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

/** Les Server Actions exportées : nom → corps (jusqu'au prochain export). */
function actionsExportees(): Array<{ fichier: string; nom: string; corps: string }> {
  const sortie: Array<{ fichier: string; nom: string; corps: string }> = [];
  for (const f of fichiers(SRC)) {
    const texte = readFileSync(f, "utf8");
    if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/m.test(texte)) continue;
    for (const morceau of texte.split(/\nexport (?=async function )/).slice(1)) {
      const nom = /^async function (\w+)/.exec(morceau)?.[1];
      if (nom) sortie.push({ fichier: relative(process.cwd(), f), nom, corps: morceau });
    }
  }
  return sortie;
}

describe("registre des gestes humains", () => {
  const actions = actionsExportees();

  it("chaque geste est complet et son identifiant unique", () => {
    const ids = GESTES_HUMAINS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GESTES_HUMAINS) {
      expect(g.geste.length, g.id).toBeGreaterThan(10);
      expect(g.frequence.length, g.id).toBeGreaterThan(2);
    }
  });

  it("le relevé des actions trouve bien les étapes de relevé (le filtre n'est pas vide)", () => {
    const touchees = actions.filter((a) => MARQUEURS_ETAPE.test(a.corps)).map((a) => a.nom);
    expect(touchees).toContain("transitionStatementAction");
  });

  it("🔴 toute action console qui fait passer une étape figure au registre", () => {
    const registre = actionsDuRegistre();
    const absentes = actions
      .filter((a) => MARQUEURS_ETAPE.test(a.corps) && !registre.has(a.nom))
      .map((a) => `${a.fichier} › ${a.nom}`);
    expect(absentes, "Rattacher ces actions à un geste de gestes-humains.ts").toEqual([]);
  });

  it("chaque action citée au registre existe vraiment", () => {
    const noms = new Set(actions.map((a) => a.nom));
    const fantomes = [...actionsDuRegistre()].filter((n) => !noms.has(n));
    expect(fantomes).toEqual([]);
  });
});
