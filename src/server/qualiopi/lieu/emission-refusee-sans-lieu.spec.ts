/**
 * Garde — tout point qui IMPRIME un lieu de déroulement refuse d'abord la pièce
 * qui mentirait.
 *
 * 🔴 I17-01 (audit initial Qualiopi, 2026-09-14) et relecture de la PR #1086.
 * `resolveLieuDocument` retombe sur l'adresse de l'organisme quand la session
 * n'a pas de lieu. L'alerte `session_sans_lieu` le DISAIT, mais la pièce fausse
 * naissait quand même et restait au dossier. Le correctif refuse l'émission
 * (`refusEmissionLieu`) dans chaque point qui imprime ce lieu.
 *
 * ⚠️ Pourquoi une garde statique en plus des tests d'action : les points
 * d'émission sont huit, répartis sur trois fichiers, et le neuvième s'ajoutera
 * sans que personne pense à ce refus. Un test par action ne voit que les
 * actions qu'il connaît ; cette garde voit toute fonction qui appelle le repli.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RACINE = join(__dirname, "..", "..", "..", "..");
const SRC = join(RACINE, "src");
const MODULE_DU_REPLI = join("src", "server", "qualiopi", "lieu", "resolve-lieu-document.ts");

function fichiersSource(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "node_modules" || nom === "generated") continue;
      sortie.push(...fichiersSource(chemin));
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.(ts|tsx)$/.test(nom)) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

/** Découpe un fichier en blocs, un par déclaration `function` de premier niveau ou non. */
function blocsDeFonction(source: string): Array<{ nom: string; corps: string }> {
  const re = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  const debuts: Array<{ nom: string; index: number }> = [];
  for (const m of source.matchAll(re)) debuts.push({ nom: m[1]!, index: m.index! });
  return debuts.map((d, i) => ({
    nom: d.nom,
    corps: source.slice(d.index, debuts[i + 1]?.index ?? source.length),
  }));
}

const APPEL_DU_REPLI = /\bresolveLieu(?:Document|Convocation)\(/;

function pointsDEmission(): Array<{ fichier: string; nom: string; refuse: boolean }> {
  const points: Array<{ fichier: string; nom: string; refuse: boolean }> = [];
  for (const chemin of fichiersSource(SRC)) {
    const rel = relative(RACINE, chemin);
    if (rel === MODULE_DU_REPLI) continue;
    const source = readFileSync(chemin, "utf8");
    if (!APPEL_DU_REPLI.test(source)) continue;
    for (const bloc of blocsDeFonction(source)) {
      if (!APPEL_DU_REPLI.test(bloc.corps)) continue;
      points.push({
        fichier: rel.split(sep).join("/"),
        nom: bloc.nom,
        refuse: /\brefusEmissionLieu\(/.test(bloc.corps),
      });
    }
  }
  return points;
}

describe("🔴 I17-01 — aucun point d'émission n'imprime le repli sans l'avoir d'abord refusé", () => {
  const points = pointsDEmission();

  it("la garde voit bien les points d'émission connus — sinon elle ne surveille rien", () => {
    // Liste tapée À DESSEIN : si un de ces noms disparaît, c'est que la garde a
    // cessé de les trouver (renommage, découpage), et c'est ce qu'on veut voir.
    const noms = points.map((p) => p.nom);
    for (const attendu of [
      "produireConvention",
      "produireConventionTripartite",
      "produireContratFormation",
      "produireConvocation",
      "produireProgramme",
      "produireOrganisationAction",
      "construireTirageEmargement",
      "genererAutorisationCaptationAction",
    ]) {
      expect(noms, `point d'émission introuvable : ${attendu}`).toContain(attendu);
    }
  });

  it("🔴 chaque fonction qui appelle resolveLieuDocument/resolveLieuConvocation appelle refusEmissionLieu", () => {
    const fautifs = points.filter((p) => !p.refuse).map((p) => `${p.fichier} › ${p.nom}`);
    expect(
      fautifs,
      "ces fonctions impriment l'adresse de l'organisme faute de lieu, sans refuser la pièce",
    ).toEqual([]);
  });
});
