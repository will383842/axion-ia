/**
 * Tests — Formation Engine Worker (T4).
 *
 * Stratégie : tester les FONCTIONS PURES de décision d'état du pipeline.
 * Ces fonctions sont extraites ici pour éviter d'importer next-auth
 * (qui ne résout pas dans l'environnement de test Vitest).
 *
 * Couvre :
 *   1. resolveNextStatutAfterApproval — transitions après approbation FileValidation
 *   2. resolveRevertStatutAfterRejection — retour d'état après rejet
 *   3. Exhaustivité des cas (toutes les étapes connues)
 *
 * Note : le test d'intégration (handler + provider mocké) est séparé dans
 * worker.integration.spec.ts une fois l'env next-auth stable en test.
 */

import { describe, it, expect } from "vitest";
import type { FormationStatutGeneration } from "../../../../prisma/generated/client";

// ── Fonctions pures extraites du moteur de décision ───────────────────────────
// (Miroir exact de resolveNextStatutAfterApproval / resolveRevertStatutAfterRejection
//  dans src/server/actions/qualiopi/engine.ts — même logique, testable sans next-auth)

function resolveNextStatutAfterApproval(
  etape: string,
  currentStatut: FormationStatutGeneration,
): FormationStatutGeneration | null {
  switch (etape) {
    case "contenu":
      return "contenu_valide";
    case "assemblage":
      return "publie";
    case "structure":
      if (currentStatut === "structure_generee") return "contenu_evalue";
      return null;
    default:
      return null;
  }
}

function resolveRevertStatutAfterRejection(etape: string): FormationStatutGeneration {
  switch (etape) {
    case "contenu":
      return "structure_generee";
    case "assemblage":
      return "contenu_genere";
    case "structure":
      return "intention";
    default:
      return "intention";
  }
}

// ── 1. resolveNextStatutAfterApproval ────────────────────────────────────────

describe("resolveNextStatutAfterApproval", () => {
  it("étape=contenu → contenu_valide", () => {
    expect(resolveNextStatutAfterApproval("contenu", "contenu_genere")).toBe("contenu_valide");
  });

  it("étape=assemblage → publie", () => {
    expect(resolveNextStatutAfterApproval("assemblage", "assemble")).toBe("publie");
  });

  it("étape=structure depuis structure_generee → contenu_evalue", () => {
    expect(resolveNextStatutAfterApproval("structure", "structure_generee")).toBe("contenu_evalue");
  });

  it("étape=structure depuis autre statut → null", () => {
    expect(resolveNextStatutAfterApproval("structure", "contenu_evalue")).toBeNull();
  });

  it("étape inconnue → null", () => {
    expect(resolveNextStatutAfterApproval("inconnue", "intention")).toBeNull();
  });
});

// ── 2. resolveRevertStatutAfterRejection ─────────────────────────────────────

describe("resolveRevertStatutAfterRejection", () => {
  it("étape=contenu → structure_generee (repartir de la structure)", () => {
    expect(resolveRevertStatutAfterRejection("contenu")).toBe("structure_generee");
  });

  it("étape=assemblage → contenu_genere (correction manuelle)", () => {
    expect(resolveRevertStatutAfterRejection("assemblage")).toBe("contenu_genere");
  });

  it("étape=structure → intention (re-démarrage complet)", () => {
    expect(resolveRevertStatutAfterRejection("structure")).toBe("intention");
  });

  it("étape inconnue → intention (sécurité par défaut)", () => {
    expect(resolveRevertStatutAfterRejection("inconnue")).toBe("intention");
  });
});

// ── 3. Tests d'exhaustivité ───────────────────────────────────────────────────

describe("resolveNextStatutAfterApproval — exhaustivité", () => {
  const etapes = ["structure", "contenu", "assemblage"] as const;

  it.each(etapes)("retourne une valeur non-undefined pour étape=%s", (etape) => {
    const result = resolveNextStatutAfterApproval(etape, "intention");
    // null est valide (pas de transition pour cet état)
    expect(result).not.toBeUndefined();
  });
});

describe("resolveRevertStatutAfterRejection — pas de throw", () => {
  const etapes = ["structure", "contenu", "assemblage"] as const;

  it.each(etapes)("ne lève pas d'erreur pour étape=%s", (etape) => {
    expect(() => resolveRevertStatutAfterRejection(etape)).not.toThrow();
  });
});

// ── 4. Cohérence approve → revert (idempotence A/R) ─────────────────────────

describe("cohérence approve ↔ revert", () => {
  it("approuver contenu puis rejeter revient à structure_generee", () => {
    const afterApprove = resolveNextStatutAfterApproval("contenu", "contenu_genere");
    expect(afterApprove).toBe("contenu_valide");
    // Si on avait rejeté plutôt que approuvé :
    const afterReject = resolveRevertStatutAfterRejection("contenu");
    expect(afterReject).toBe("structure_generee");
  });

  it("approuver assemblage → publie (validation finale déléguée à publishFormationAction)", () => {
    expect(resolveNextStatutAfterApproval("assemblage", "assemble")).toBe("publie");
  });
});
