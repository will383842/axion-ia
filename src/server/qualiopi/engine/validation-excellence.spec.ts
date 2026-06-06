/**
 * Tests — validation-excellence.ts
 *
 * Vérifie les règles d'excellence pédagogique (module PUR) :
 * - Séquence > 45 min sans synthèse → FAIL
 * - Séquence > 45 min avec synthèse intercalée → PASS
 * - fil_rouge/livrables manquants → WARN
 * - Programme valide complet → PASS
 */

import { describe, it, expect } from "vitest";
import { validateExcellence } from "./validation-excellence";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeModule(dureeMinutes: number, type?: string) {
  return type !== undefined ? { dureeMinutes, type } : { dureeMinutes };
}

// ── Tests séquence > 45 min sans synthèse ──────────────────────────────────────

describe("validateExcellence — synthèses", () => {
  it("séquence de 50 min sans synthèse → FAIL + synthesesErrors", () => {
    const programme = {
      modules: [
        makeModule(20),
        makeModule(20),
        makeModule(10), // total = 50 > 45
      ],
      fil_rouge: "Le cas pratique d'Alice",
      livrables_j0: "Support PDF",
    };
    const result = validateExcellence(programme);
    expect(result.verdict).toBe("FAIL");
    expect(result.synthesesOk).toBe(false);
    expect(result.synthesesErrors.length).toBeGreaterThan(0);
    expect(result.synthesesErrors[0]?.dureeMin).toBeGreaterThan(45);
  });

  it("séquence de 45 min exactement (= limite) → PASS pour les synthèses", () => {
    const programme = {
      modules: [
        makeModule(20),
        makeModule(25), // total = 45, pas > 45
      ],
      fil_rouge: "Fil rouge présent",
      livrables_j1: "Exercices",
    };
    const result = validateExcellence(programme);
    expect(result.synthesesOk).toBe(true);
    expect(result.verdict).toBe("PASS");
  });

  it("séquence > 45 min mais synthèse intercalée → synthesesOk true", () => {
    const programme = {
      modules: [
        makeModule(20),
        makeModule(20),
        makeModule("synthese" as unknown as number, "synthese"), // reset
        makeModule(20),
        makeModule(20), // 40 après reset → OK
      ],
      fil_rouge: "Un bon fil rouge narratif ici",
      livrables_j0: "Support PDF",
    };
    // Note : le 3e module a type=synthese mais dureeMinutes est une string
    // → duree sera 0 (défensif), mais le reset se fait bien sur type=synthese
    const result = validateExcellence(programme);
    expect(result.synthesesOk).toBe(true);
  });

  it("2 séquences > 45 min → 2 erreurs synthèses", () => {
    const programme = {
      modules: [
        makeModule(50), // séquence 1 : 50 > 45 → erreur + reset
        makeModule(20),
        makeModule(30), // séquence 2 : 50 > 45 → erreur + reset
      ],
      fil_rouge: "Fil",
      livrables_j0: "ok",
    };
    const result = validateExcellence(programme);
    expect(result.synthesesOk).toBe(false);
    expect(result.synthesesErrors.length).toBeGreaterThanOrEqual(2);
  });

  it("modules vides → synthesesOk true (défensif)", () => {
    const programme = {
      modules: [],
      fil_rouge: "Fil rouge ici",
      livrables_j0: "ok",
    };
    const result = validateExcellence(programme);
    expect(result.synthesesOk).toBe(true);
  });

  it("programme sans modules → synthesesOk true (défensif)", () => {
    const result = validateExcellence({ fil_rouge: "Fil rouge ici", livrables_j0: "ok" });
    expect(result.synthesesOk).toBe(true);
  });

  it("programme undefined → défensif, pas de throw", () => {
    // @ts-expect-error test défensif intentionnel
    expect(() => validateExcellence(undefined)).not.toThrow();
  });

  it("type=evaluation reset aussi le compteur", () => {
    const programme = {
      modules: [
        makeModule(20),
        makeModule(20),
        { dureeMinutes: 5, type: "evaluation" }, // reset
        makeModule(20),
        makeModule(20), // 40 après reset → OK
      ],
      fil_rouge: "Fil rouge narratif présent ici",
      livrables_j0: "Support",
    };
    const result = validateExcellence(programme);
    expect(result.synthesesOk).toBe(true);
    expect(result.verdict).toBe("PASS");
  });
});

// ── Tests fil rouge ────────────────────────────────────────────────────────────

describe("validateExcellence — fil rouge", () => {
  it("fil_rouge absent → filRougeOk false", () => {
    const programme = {
      modules: [],
      livrables_j0: "ok",
    };
    const result = validateExcellence(programme);
    expect(result.filRougeOk).toBe(false);
  });

  it("fil_rouge vide → filRougeOk false", () => {
    const programme = {
      modules: [],
      fil_rouge: "   ",
      livrables_j0: "ok",
    };
    const result = validateExcellence(programme);
    expect(result.filRougeOk).toBe(false);
  });

  it("fil_rouge présent → filRougeOk true", () => {
    const programme = {
      modules: [],
      fil_rouge: "Le cas pratique de l'entreprise XYZ",
      livrables_j0: "ok",
    };
    const result = validateExcellence(programme);
    expect(result.filRougeOk).toBe(true);
  });
});

// ── Tests livrables ────────────────────────────────────────────────────────────

describe("validateExcellence — livrables", () => {
  it("aucun livrable → livrablesOk false", () => {
    const result = validateExcellence({ fil_rouge: "Présent", modules: [] });
    expect(result.livrablesOk).toBe(false);
  });

  it("livrables_j0 présent → livrablesOk true", () => {
    const result = validateExcellence({
      fil_rouge: "Présent",
      modules: [],
      livrables_j0: "Support PDF",
    });
    expect(result.livrablesOk).toBe(true);
  });

  it("livrables_j1 seul → livrablesOk true", () => {
    const result = validateExcellence({
      fil_rouge: "Présent",
      modules: [],
      livrables_j1: "Exercices",
    });
    expect(result.livrablesOk).toBe(true);
  });

  it("livrables_j30 seul → livrablesOk true", () => {
    const result = validateExcellence({
      fil_rouge: "Présent",
      modules: [],
      livrables_j30: "Auto-évaluation",
    });
    expect(result.livrablesOk).toBe(true);
  });
});

// ── Tests verdict global ───────────────────────────────────────────────────────

describe("validateExcellence — verdict", () => {
  it("synthèse KO → verdict FAIL (priorité)", () => {
    const programme = {
      modules: [makeModule(50)],
      fil_rouge: "Présent",
      livrables_j0: "ok",
    };
    const result = validateExcellence(programme);
    expect(result.verdict).toBe("FAIL");
  });

  it("synthèse OK mais fil_rouge absent → verdict WARN", () => {
    const programme = {
      modules: [makeModule(10)],
      livrables_j0: "ok",
    };
    const result = validateExcellence(programme);
    expect(result.verdict).toBe("WARN");
    expect(result.axesCorrection.length).toBeGreaterThan(0);
  });

  it("synthèse OK mais livrables absents → verdict WARN", () => {
    const programme = {
      modules: [makeModule(10)],
      fil_rouge: "Présent ici",
    };
    const result = validateExcellence(programme);
    expect(result.verdict).toBe("WARN");
  });

  it("tout valide → verdict PASS, axesCorrection vide", () => {
    const programme = {
      modules: [makeModule(10), makeModule(10)],
      fil_rouge: "Un cas pratique réel fil conducteur",
      livrables_j0: "Support de cours PDF",
    };
    const result = validateExcellence(programme);
    expect(result.verdict).toBe("PASS");
    expect(result.axesCorrection).toHaveLength(0);
  });
});
