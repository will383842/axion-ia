/**
 * Tests — conditions de paiement par client (F61).
 *
 * Le point sensible est la distinction entre « null = suivre le global » et
 * « 0 = valeur explicite ». Les confondre ferait basculer silencieusement un
 * client en paiement comptant, ou lui ferait perdre son acompte.
 */

import { describe, it, expect } from "vitest";
import {
  resoudreConditions,
  DELAI_PAIEMENT_MAX_JOURS,
  type DefautsGlobaux,
} from "./conditions-client";

const defauts: DefautsGlobaux = {
  delaiPaiementJours: 30,
  tauxAcomptePct: 30,
  modeFacturation: "acompte_solde",
};

describe("Repli sur le global", () => {
  it("client absent → tout vient du global", () => {
    const r = resoudreConditions(null, defauts);
    expect(r.delaiPaiementJours).toBe(30);
    expect(r.tauxAcomptePct).toBe(30);
    expect(r.origine).toEqual({ delai: "global", acompte: "global", mode: "global" });
  });

  it("champs à null → repli, sans écraser l'intention", () => {
    const r = resoudreConditions(
      { delaiPaiementJours: null, tauxAcomptePct: null, modeFacturation: null },
      defauts,
    );
    expect(r.delaiPaiementJours).toBe(30);
    expect(r.origine.delai).toBe("global");
  });

  // 🔴 La distinction qui compte : 0 est une VALEUR, pas une absence. Un client
  // réglé à 0 % d'acompte doit rester à 0, pas retomber sur les 30 % globaux.
  it("un 0 explicite n'est PAS un repli", () => {
    const r = resoudreConditions(
      { delaiPaiementJours: 0, tauxAcomptePct: 0, modeFacturation: null },
      defauts,
    );
    expect(r.delaiPaiementJours).toBe(0);
    expect(r.tauxAcomptePct).toBe(0);
    expect(r.origine.delai).toBe("client");
    expect(r.origine.acompte).toBe("client");
  });
});

describe("Priorité du client", () => {
  it("un grand compte à 60 jours prime sur les 30 jours globaux", () => {
    const r = resoudreConditions(
      { delaiPaiementJours: 60, tauxAcomptePct: null, modeFacturation: null },
      defauts,
    );
    expect(r.delaiPaiementJours).toBe(60);
    expect(r.origine.delai).toBe("client");
    expect(r.origine.acompte).toBe("global");
  });

  it("un nouveau client peut être réglé à 50 % d'acompte", () => {
    const r = resoudreConditions(
      { delaiPaiementJours: null, tauxAcomptePct: 50, modeFacturation: null },
      defauts,
    );
    expect(r.tauxAcomptePct).toBe(50);
  });
});

describe("Bornes légales", () => {
  // Au-delà de 60 jours, la clause est illicite entre professionnels.
  it("ramène un délai de 90 jours à 60, et le dit", () => {
    const r = resoudreConditions(
      { delaiPaiementJours: 90, tauxAcomptePct: null, modeFacturation: null },
      defauts,
    );
    expect(r.delaiPaiementJours).toBe(DELAI_PAIEMENT_MAX_JOURS);
    expect(r.avertissements[0]).toContain("L441-10");
  });

  it("ramène un taux aberrant dans 0–100", () => {
    const r = resoudreConditions(
      { delaiPaiementJours: null, tauxAcomptePct: 250, modeFacturation: null },
      defauts,
    );
    expect(r.tauxAcomptePct).toBe(100);
    expect(r.avertissements.length).toBeGreaterThan(0);
  });

  it("corrige plutôt que d'échouer — aucune exception", () => {
    expect(() =>
      resoudreConditions(
        { delaiPaiementJours: -5, tauxAcomptePct: -10, modeFacturation: null },
        defauts,
      ),
    ).not.toThrow();
  });
});

describe("Cohérence mode / acompte", () => {
  // Le MODE est l'intention explicite ; le taux n'est qu'un paramètre.
  it("« solde unique » annule le taux d'acompte, et l'explique", () => {
    const r = resoudreConditions(
      { delaiPaiementJours: null, tauxAcomptePct: 40, modeFacturation: "solde_unique" },
      defauts,
    );
    expect(r.tauxAcomptePct).toBe(0);
    expect(r.avertissements.some((a) => a.includes("solde unique"))).toBe(true);
  });

  it("« acompte + solde » conserve le taux", () => {
    const r = resoudreConditions(
      { delaiPaiementJours: null, tauxAcomptePct: 40, modeFacturation: "acompte_solde" },
      defauts,
    );
    expect(r.tauxAcomptePct).toBe(40);
    expect(r.avertissements).toHaveLength(0);
  });
});
