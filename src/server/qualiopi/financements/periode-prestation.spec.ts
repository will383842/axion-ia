/**
 * Date de réalisation de la prestation (art. 242 nonies A CGI).
 *
 * 🔴 Aucun émetteur ne la transmettait : le gabarit retombait sur son défaut, la
 * date d'émission. `AXI-FACT-2026-001` déclarait ainsi une prestation exécutée
 * le 01/08/2026 pour une formation tenue le 31/07/2026.
 */
import { describe, it, expect } from "vitest";
import { periodePrestationSession } from "./periode-prestation";

describe("periodePrestationSession", () => {
  it("rend une date simple pour une session d'un seul jour", () => {
    expect(
      periodePrestationSession(new Date("2026-07-31T09:00:00Z"), new Date("2026-07-31T17:00:00Z")),
    ).toBe("31/07/2026");
  });

  it("rend une période pour une session étalée", () => {
    expect(
      periodePrestationSession(new Date("2026-07-31T09:00:00Z"), new Date("2026-08-02T17:00:00Z")),
    ).toBe("du 31/07/2026 au 02/08/2026");
  });

  it("ne rend pas la date du jour quand la session est inconnue", () => {
    // Le repli silencieux sur « aujourd'hui » est exactement le défaut d'origine :
    // il produit une mention légale FAUSSE au lieu d'une mention absente.
    expect(periodePrestationSession(null, null)).toBeNull();
    expect(periodePrestationSession(undefined, undefined)).toBeNull();
  });

  it("tolère une date de fin absente ou invalide sans mentir sur le début", () => {
    expect(periodePrestationSession(new Date("2026-07-31T09:00:00Z"), null)).toBe("31/07/2026");
    expect(periodePrestationSession(new Date("2026-07-31T09:00:00Z"), "pas-une-date")).toBe(
      "31/07/2026",
    );
  });

  it("rend null sur une date de début illisible plutôt qu'« Invalid Date »", () => {
    expect(periodePrestationSession("pas-une-date", null)).toBeNull();
  });
});
