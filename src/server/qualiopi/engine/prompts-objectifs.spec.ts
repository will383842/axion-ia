/**
 * Prompts — injection des objectifs pédagogiques (correctif 2026-08-05).
 *
 * 🔴 Défaut couvert : l'ancien test `formation.objectifsPedagogiques ? ... : fallback`
 * ne tombait JAMAIS dans le fallback — la colonne Prisma a `@default("[]")` et
 * `[]` est truthy. Le prompt de structure recevait littéralement
 * `Objectifs pédagogiques : []` pour toute formation créée via l'UI, et le
 * Backward Design partait sur `[]` au lieu de l'objectif général.
 *
 * Ces tests ROUGISSENT sur l'ancien code (ils vérifient l'absence de `[]` et la
 * présence du fallback) — règle projet : une garde ne vaut que si elle rougit.
 */

import { describe, it, expect } from "vitest";
import {
  buildStructureUserPrompt,
  buildBackwardDesignUserPrompt,
} from "@/server/qualiopi/engine/prompts";

describe("buildStructureUserPrompt — objectifs pédagogiques", () => {
  const base = {
    titre: "IA pour bien commencer",
    dureeHeures: 4,
    modalite: "presentiel",
  };

  it("colonne vide ([] par défaut Prisma) → fallback lisible, jamais « [] »", () => {
    const prompt = buildStructureUserPrompt({ ...base, objectifsPedagogiques: [] });
    expect(prompt).toContain("Objectifs pédagogiques : À définir selon le niveau des apprenants");
    expect(prompt).not.toContain("Objectifs pédagogiques : []");
  });

  it("forme catalogue [{ id, verbe, description }] → descriptions jointes, pas de JSON brut", () => {
    const prompt = buildStructureUserPrompt({
      ...base,
      objectifsPedagogiques: [
        { id: "obj-1", verbe: "Rédiger", description: "Rédiger un prompt efficace" },
        { id: "obj-2", verbe: "Identifier", description: "Identifier 3 tâches automatisables" },
      ],
    });
    expect(prompt).toContain("Rédiger un prompt efficace ; Identifier 3 tâches automatisables");
    expect(prompt).not.toContain('"id"');
  });

  it("entrées inexploitables (objets sans libellé) → fallback, pas de [object Object]", () => {
    const prompt = buildStructureUserPrompt({
      ...base,
      objectifsPedagogiques: [{ foo: "bar" }],
    });
    expect(prompt).toContain("À définir selon le niveau des apprenants");
    expect(prompt).not.toContain("[object Object]");
  });
});

describe("buildBackwardDesignUserPrompt — objectifs pédagogiques", () => {
  it("colonne vide → retombe sur l'objectif général, jamais « [] »", () => {
    const prompt = buildBackwardDesignUserPrompt({
      titre: "IA pour bien commencer",
      dureeHeures: 4,
      modalite: "presentiel",
      objectifsPedagogiques: [],
      objectifGeneral: "Prendre en main l'IA générative au quotidien",
    });
    expect(prompt).toContain("Prendre en main l'IA générative au quotidien");
    expect(prompt).not.toContain("Objectifs pédagogiques : []");
  });
});
