/**
 * Tests — normalisation des objectifs pédagogiques (constat du parcours à blanc
 * 2026-07-27).
 *
 * 🔴 Ce qui s'est passé en production. Le catalogue écrit les objectifs sous la
 * forme `{ id, verbe, description }` (`catalog-import.ts`). Quatre lieux les
 * relisaient chacun à sa façon et un seul connaissait `description` : l'écran
 * d'évaluation des acquis proposait cinq compétences nommées « [object Object] »,
 * l'attestation de fin de formation imprimait la même chose sous « Objectifs »,
 * et le portail stagiaire n'en affichait aucun.
 *
 * Le cas nominal ci-dessous — la forme du catalogue — est donc le test qui
 * compte le plus, et c'est précisément celui qui manquait.
 */

import { describe, it, expect } from "vitest";

import { normaliserObjectifsPedagogiques, objectifsPedagogiquesEnTexte } from "./objectifs";

/** La forme réellement écrite par l'import du catalogue. */
const CATALOGUE = [
  {
    id: "obj-1",
    verbe: "Décrire",
    description: "Décrire ce qu'est une IA générative, ce qu'elle fait bien et ses limites",
  },
  {
    id: "obj-2",
    verbe: "Identifier",
    description: "Identifier l'outil adapté (ChatGPT, Claude, Gemini) selon la tâche",
  },
];

describe("normaliserObjectifsPedagogiques", () => {
  // 🔴 Le cas qui cassait les trois écrans.
  it("lit la forme du catalogue { id, verbe, description }", () => {
    expect(normaliserObjectifsPedagogiques(CATALOGUE)).toEqual([
      "Décrire ce qu'est une IA générative, ce qu'elle fait bien et ses limites",
      "Identifier l'outil adapté (ChatGPT, Claude, Gemini) selon la tâche",
    ]);
  });

  // Le verbe ne porte que le premier mot : le retenir tronquerait l'objectif.
  it("préfère `description` à `verbe`", () => {
    const r = normaliserObjectifsPedagogiques([
      { verbe: "Décrire", description: "Phrase complète" },
    ]);
    expect(r).toEqual(["Phrase complète"]);
  });

  it("lit les autres formes rencontrées : objectif, libelle, label, titre", () => {
    expect(
      normaliserObjectifsPedagogiques([
        { objectif: "A" },
        { libelle: "B" },
        { label: "C" },
        { titre: "D" },
      ]),
    ).toEqual(["A", "B", "C", "D"]);
  });

  it("lit un tableau de chaînes", () => {
    expect(normaliserObjectifsPedagogiques(["A", "B"])).toEqual(["A", "B"]);
  });

  it("accepte une chaîne unique", () => {
    expect(normaliserObjectifsPedagogiques("Un seul objectif")).toEqual(["Un seul objectif"]);
  });

  // 🔴 Le cœur du correctif : plus jamais « [object Object] » sur une pièce
  // probante. Une entrée illisible disparaît, elle ne s'imprime pas.
  it("ignore une entrée objet sans clé de libellé, au lieu d'imprimer [object Object]", () => {
    const r = normaliserObjectifsPedagogiques([
      { id: "obj-1", niveau: 3 },
      { description: "Vrai" },
    ]);
    expect(r).toEqual(["Vrai"]);
    expect(r.join(" ")).not.toContain("object Object");
  });

  it("écarte les libellés vides ou blancs", () => {
    expect(normaliserObjectifsPedagogiques(["  ", "", { description: "   " }, "Gardé"])).toEqual([
      "Gardé",
    ]);
  });

  it("rogne les espaces de bord", () => {
    expect(normaliserObjectifsPedagogiques([{ description: "  Avec espaces  " }])).toEqual([
      "Avec espaces",
    ]);
  });

  it("rend une liste vide sur null, undefined, nombre ou objet nu", () => {
    for (const v of [null, undefined, 42, {}, true]) {
      expect(normaliserObjectifsPedagogiques(v)).toEqual([]);
    }
  });

  it("ne casse pas sur des entrées nulles dans le tableau", () => {
    expect(normaliserObjectifsPedagogiques([null, undefined, { description: "OK" }])).toEqual([
      "OK",
    ]);
  });
});

describe("objectifsPedagogiquesEnTexte", () => {
  it("joint les libellés du catalogue", () => {
    expect(objectifsPedagogiquesEnTexte(CATALOGUE)).toBe(
      "Décrire ce qu'est une IA générative, ce qu'elle fait bien et ses limites, " +
        "Identifier l'outil adapté (ChatGPT, Claude, Gemini) selon la tâche",
    );
  });

  it("rend une chaîne vide plutôt qu'un texte inventé quand rien n'est lisible", () => {
    expect(objectifsPedagogiquesEnTexte([{ id: "x" }])).toBe("");
    expect(objectifsPedagogiquesEnTexte(null)).toBe("");
  });

  it("accepte un séparateur explicite", () => {
    expect(objectifsPedagogiquesEnTexte(["A", "B"], " · ")).toBe("A · B");
  });
});
