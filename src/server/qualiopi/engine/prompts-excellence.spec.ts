/**
 * Tests — Formation Engine T5 : Builders de prompts excellence.
 *
 * Couvre :
 *   1. buildBackwardDesignSystemPrompt / buildBackwardDesignUserPrompt
 *   2. buildPersonaSystemPrompt / buildPersonaUserPrompt
 *   3. buildStructureUserPrompt — injection persona + champs additifs (fil_rouge, livrables_j*)
 */

import { describe, it, expect } from "vitest";
import {
  buildBackwardDesignSystemPrompt,
  buildBackwardDesignUserPrompt,
  buildPersonaSystemPrompt,
  buildPersonaUserPrompt,
  buildStructureUserPrompt,
} from "./prompts";
import type { FormationLike } from "./prompts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const formationBase: FormationLike = {
  id: "test-id-001",
  titre: "Formation IA pour managers",
  dureeHeures: 14,
  modalite: "presentiel",
  publicVise: "Managers et responsables d'équipe non techniques",
  objectifGeneral: "Maîtriser les fondamentaux de l'IA pour piloter des projets IA",
  objectifsPedagogiques: [
    "Distinguer les types d'IA et leurs cas d'usage",
    "Évaluer la pertinence d'un projet IA",
    "Communiquer avec une équipe technique IA",
  ],
};

const formationAvecPersona: FormationLike = {
  ...formationBase,
  programmeDetaille: {
    persona: {
      profil: {
        description: "Manager de 40 ans, ingénieur de formation, peu exposé à l'IA au quotidien",
        rapport_au_numerique: "Aisance bureautique mais peu d'expérience IA",
      },
      motivations: {
        intrinseques: ["Comprendre pour mieux décider"],
        extrinseques: ["Obligation stratégique entreprise"],
        declencheur_inscription: "Projet de transformation digitale en cours",
      },
      freins: {
        apprentissage: ["Peur du jargon technique"],
        organisationnels: ["Peu de temps disponible"],
        psychologiques: ["Syndrome de l'imposteur face aux équipes techniques"],
      },
      style_apprentissage: {
        dominant: "visuel",
        preferences: ["Cas concrets", "Démos"],
        rythme: "moderé",
        autonomie: "moyen",
      },
      recommandations_pedago: [
        { aspect: "Exemples", action: "Utiliser des cas issus du secteur du manager" },
      ],
    },
  },
};

// ── 1. buildBackwardDesignSystemPrompt ────────────────────────────────────────

describe("buildBackwardDesignSystemPrompt", () => {
  it("retourne une string non vide", () => {
    const result = buildBackwardDesignSystemPrompt();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contient les mots-clés Backward Design et Qualiopi", () => {
    const result = buildBackwardDesignSystemPrompt();
    expect(result).toContain("Backward Design");
    expect(result).toContain("Qualiopi");
  });

  it("contient la mention AI Act (obligatoire)", () => {
    const result = buildBackwardDesignSystemPrompt();
    expect(result).toContain("AI Act");
    expect(result).toContain("intelligence artificielle");
  });

  it("mentionne les 3 phases (résultats, preuves, activités)", () => {
    const result = buildBackwardDesignSystemPrompt();
    expect(result).toContain("PHASE RÉSULTATS");
    expect(result).toContain("PHASE PREUVES");
    expect(result).toContain("PHASE ACTIVITÉS");
  });

  it("demande une réponse JSON valide", () => {
    const result = buildBackwardDesignSystemPrompt();
    expect(result).toContain("JSON");
  });
});

// ── 2. buildBackwardDesignUserPrompt ─────────────────────────────────────────

describe("buildBackwardDesignUserPrompt", () => {
  it("retourne une string non vide", () => {
    const result = buildBackwardDesignUserPrompt(formationBase);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contient le titre de la formation", () => {
    const result = buildBackwardDesignUserPrompt(formationBase);
    expect(result).toContain(formationBase.titre!);
  });

  it("contient le public visé", () => {
    const result = buildBackwardDesignUserPrompt(formationBase);
    expect(result).toContain("Managers et responsables");
  });

  it("contient les champs phase_resultats, phase_preuves, phase_activites dans le format JSON attendu", () => {
    const result = buildBackwardDesignUserPrompt(formationBase);
    expect(result).toContain("phase_resultats");
    expect(result).toContain("phase_preuves");
    expect(result).toContain("phase_activites");
  });

  it("fonctionne sans publicVise ni objectifGeneral (valeurs par défaut)", () => {
    const minimal: FormationLike = { titre: "Formation test", dureeHeures: 7 };
    const result = buildBackwardDesignUserPrompt(minimal);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("Formation test");
  });

  it("contient la durée en heures", () => {
    const result = buildBackwardDesignUserPrompt(formationBase);
    expect(result).toContain("14");
  });
});

// ── 3. buildPersonaSystemPrompt ───────────────────────────────────────────────

describe("buildPersonaSystemPrompt", () => {
  it("retourne une string non vide", () => {
    const result = buildPersonaSystemPrompt();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contient la mention AI Act", () => {
    const result = buildPersonaSystemPrompt();
    expect(result).toContain("AI Act");
  });

  it("mentionne les concepts clés du persona pédagogique", () => {
    const result = buildPersonaSystemPrompt();
    expect(result).toContain("persona");
    expect(result).toContain("apprentissage");
  });

  it("demande une réponse JSON valide", () => {
    const result = buildPersonaSystemPrompt();
    expect(result).toContain("JSON");
  });
});

// ── 4. buildPersonaUserPrompt ─────────────────────────────────────────────────

describe("buildPersonaUserPrompt", () => {
  it("retourne une string non vide", () => {
    const result = buildPersonaUserPrompt("Managers et responsables d'équipe");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contient le public visé dans le prompt", () => {
    const result = buildPersonaUserPrompt("Managers et responsables d'équipe");
    expect(result).toContain("Managers et responsables");
  });

  it("contient les champs du format JSON attendu", () => {
    const result = buildPersonaUserPrompt("Développeurs frontend");
    expect(result).toContain("profil");
    expect(result).toContain("motivations");
    expect(result).toContain("freins");
    expect(result).toContain("style_apprentissage");
    expect(result).toContain("recommandations_pedago");
  });

  it("injecte le contexteIa quand fourni", () => {
    const result = buildPersonaUserPrompt("Ingénieurs", "Formation sur mesure pour PME");
    expect(result).toContain("Formation sur mesure");
  });

  it("fonctionne sans publicVise (chaîne vide)", () => {
    const result = buildPersonaUserPrompt("");
    expect(result.length).toBeGreaterThan(0);
    // Doit contenir la valeur par défaut
    expect(result).toContain("professionnels");
  });

  it("fonctionne sans contexteIa (undefined)", () => {
    const result = buildPersonaUserPrompt("Comptables");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain("undefined");
  });
});

// ── 5. buildStructureUserPrompt — injection persona + champs additifs ─────────

describe("buildStructureUserPrompt — persona injection", () => {
  it("contient fil_rouge dans le format JSON attendu (toujours)", () => {
    const result = buildStructureUserPrompt(formationBase);
    expect(result).toContain("fil_rouge");
  });

  it("contient livrables_j0 dans le format JSON attendu (toujours)", () => {
    const result = buildStructureUserPrompt(formationBase);
    expect(result).toContain("livrables_j0");
  });

  it("contient livrables_j1 dans le format JSON attendu (toujours)", () => {
    const result = buildStructureUserPrompt(formationBase);
    expect(result).toContain("livrables_j1");
  });

  it("contient livrables_j30 dans le format JSON attendu (toujours)", () => {
    const result = buildStructureUserPrompt(formationBase);
    expect(result).toContain("livrables_j30");
  });

  it("N'injecte PAS de section persona si programmeDetaille absent", () => {
    const result = buildStructureUserPrompt(formationBase);
    // Sans persona dans programmeDetaille, pas de section "PERSONA STAGIAIRE"
    expect(result).not.toContain("PERSONA STAGIAIRE");
  });

  it("injecte le persona en tête quand programmeDetaille.persona est présent", () => {
    const result = buildStructureUserPrompt(formationAvecPersona);
    expect(result).toContain("PERSONA STAGIAIRE");
  });

  it("persona injecté précède la description de la formation", () => {
    const result = buildStructureUserPrompt(formationAvecPersona);
    const personaIdx = result.indexOf("PERSONA STAGIAIRE");
    const titrIdx = result.indexOf(formationBase.titre!);
    expect(personaIdx).toBeLessThan(titrIdx);
  });

  it("conserve les champs existants (modules, objectifs, ratioPratiqueEstime)", () => {
    const result = buildStructureUserPrompt(formationAvecPersona);
    expect(result).toContain("modules");
    expect(result).toContain("objectifs");
    expect(result).toContain("ratioPratiqueEstime");
  });

  it("fonctionne avec programmeDetaille sans champ persona (ne plante pas)", () => {
    const formationSansPersonaDansProgramme: FormationLike = {
      ...formationBase,
      programmeDetaille: { modules: [], titre: "test" },
    };
    expect(() => buildStructureUserPrompt(formationSansPersonaDansProgramme)).not.toThrow();
    const result = buildStructureUserPrompt(formationSansPersonaDansProgramme);
    expect(result).not.toContain("PERSONA STAGIAIRE");
  });
});
