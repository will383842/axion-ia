/**
 * Tests — content-schema.ts : schéma du contenu pédagogique détaillé.
 * Tests purs (Zod), aucune I/O.
 */

import { describe, it, expect } from "vitest";
import {
  ContenuDetailleSchema,
  ModuleContenuSchema,
  QuizItemSchema,
  CONTENU_DETAILLE_VERSION,
  readContenuDetaille,
  hasContenuDetaille,
  stripNullsDeep,
} from "./content-schema";

const MODULE_VALIDE = {
  moduleId: "M1",
  titre: "Introduction à l'IA générative",
  introduction: "Ce module pose les bases indispensables pour utiliser l'IA au quotidien.",
  sequences: [
    {
      titre: "Comprendre un LLM",
      dureeMin: 30,
      concepts: [
        {
          titre: "Modèle de langage",
          explication:
            "Un LLM prédit le mot suivant à partir d'un contexte, ce qui lui permet de rédiger.",
        },
      ],
      exempleConcret: "Un assistant qui reformule un e-mail client trop sec en message courtois.",
      pointsVigilance: ["Ne jamais coller de données personnelles sensibles"],
      exercice: {
        consigne: "Reformuler un e-mail fourni en 3 tons différents.",
        dureeMin: 15,
        corrige: "Attendu : un ton neutre, un ton chaleureux, un ton ferme, chacun cohérent.",
        criteresReussite: ["3 tons distincts produits"],
      },
      noteFormateur: "Faire verbaliser les différences de ton par les stagiaires.",
      adaptationDistanciel: "Exercice en breakout room, restitution dans le doc partagé.",
    },
  ],
  synthese: "Un LLM est un outil de rédaction assistée puissant mais à cadrer.",
  quiz: [
    {
      question: "Que prédit un LLM ?",
      options: ["Le mot suivant", "La météo"],
      bonneReponseIndex: 0,
      explication: "Un LLM est entraîné à prédire le token suivant.",
    },
  ],
};

const CONTENU_VALIDE = {
  version: CONTENU_DETAILLE_VERSION,
  modalite: "presentiel" as const,
  modules: [MODULE_VALIDE],
};

describe("content-schema", () => {
  it("valide un module bien formé", () => {
    expect(ModuleContenuSchema.safeParse(MODULE_VALIDE).success).toBe(true);
  });

  it("valide un contenu détaillé complet", () => {
    expect(ContenuDetailleSchema.safeParse(CONTENU_VALIDE).success).toBe(true);
  });

  it("rejette un module sans concept", () => {
    const bad = { ...MODULE_VALIDE, sequences: [{ ...MODULE_VALIDE.sequences[0], concepts: [] }] };
    expect(ModuleContenuSchema.safeParse(bad).success).toBe(false);
  });

  it("applique le default [] sur pointsVigilance/quiz/criteresReussite", () => {
    const parsed = ModuleContenuSchema.parse({
      moduleId: "M2",
      titre: "Module test",
      introduction: "Introduction suffisamment longue pour passer la validation.",
      sequences: [
        {
          titre: "Séquence",
          dureeMin: 20,
          concepts: [
            { titre: "Concept", explication: "Explication assez longue pour valider le schéma." },
          ],
          exempleConcret: "Un exemple concret suffisamment détaillé pour valider.",
          noteFormateur: "Note d'animation.",
        },
      ],
      synthese: "Synthèse suffisamment longue pour valider le schéma Zod.",
    });
    expect(parsed.sequences[0]?.pointsVigilance).toEqual([]);
    expect(parsed.quiz).toEqual([]);
  });

  it("readContenuDetaille extrait un contenu valide depuis programmeDetaille", () => {
    const programme = { modules: [], contenuDetaille: CONTENU_VALIDE };
    const read = readContenuDetaille(programme);
    expect(read).not.toBeNull();
    expect(read?.modules).toHaveLength(1);
    expect(hasContenuDetaille(programme)).toBe(true);
  });

  it("readContenuDetaille retourne null si absent ou invalide", () => {
    expect(readContenuDetaille({ modules: [] })).toBeNull();
    expect(readContenuDetaille(null)).toBeNull();
    expect(readContenuDetaille({ contenuDetaille: { version: 999 } })).toBeNull();
    expect(hasContenuDetaille({})).toBe(false);
  });

  it("stripNullsDeep : un module devient valide après nettoyage des null LLM", () => {
    // L'IA renvoie des champs optionnels à null au lieu de les omettre.
    const brut = {
      ...MODULE_VALIDE,
      quiz: null,
      sequences: [
        {
          ...MODULE_VALIDE.sequences[0],
          adaptationPresentiel: null,
          adaptationDistanciel: null,
          pointsVigilance: null,
        },
      ],
    };
    // Sans nettoyage → échec (Zod rejette null).
    expect(ModuleContenuSchema.safeParse(brut).success).toBe(false);
    // Avec nettoyage → succès + defaults appliqués.
    const nettoye = ModuleContenuSchema.safeParse(stripNullsDeep(brut));
    expect(nettoye.success).toBe(true);
    if (nettoye.success) {
      expect(nettoye.data.quiz).toEqual([]);
      expect(nettoye.data.sequences[0]?.pointsVigilance).toEqual([]);
    }
  });

  it("QuizItemSchema rejette un bonneReponseIndex hors des options", () => {
    const bad = {
      question: "Question ?",
      options: ["A", "B"],
      bonneReponseIndex: 5,
      explication: "Explication de la réponse.",
    };
    expect(QuizItemSchema.safeParse(bad).success).toBe(false);
  });
});
