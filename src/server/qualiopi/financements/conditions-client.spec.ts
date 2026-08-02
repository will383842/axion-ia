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
  calculerEcheanceFacture,
  DELAI_PAIEMENT_DEFAUT_JOURS,
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

// ─────────────────────────────────────────────────────────────────────────────
// Vérification E2E 2026-07-26 — le bornage ne couvrait que la saisie client.
// ─────────────────────────────────────────────────────────────────────────────

describe("Bornage des défauts globaux", () => {
  // 🔴 Le clamp L441-10 ne s'appliquait qu'à la valeur du client. Un défaut
  // global aberrant sortait tel quel, sans un mot — alors qu'il s'applique à
  // TOUS les clients, pas à un seul.
  it("un délai global de 365 jours est ramené à 60 et signalé", () => {
    const r = resoudreConditions(null, {
      delaiPaiementJours: 365,
      tauxAcomptePct: 30,
      modeFacturation: "acompte_solde",
    });
    expect(r.delaiPaiementJours).toBe(60);
    expect(r.avertissements.join(" ")).toContain("L441-10");
  });

  it("un taux global de 900 % est ramené à 100 et signalé", () => {
    const r = resoudreConditions(null, {
      delaiPaiementJours: 30,
      tauxAcomptePct: 900,
      modeFacturation: "acompte_solde",
    });
    expect(r.tauxAcomptePct).toBe(100);
    expect(r.avertissements.join(" ")).toContain("0–100 %");
  });
});

describe("Entrées non numériques", () => {
  // 🔴 `NaN > 60` et `NaN < 0` sont faux : un délai NaN sortait NaN SANS
  // avertissement ; un taux NaN sortait NaN AVEC un avertissement qui affirmait
  // l'avoir ramené — il n'avait rien ramené.
  const defauts = {
    delaiPaiementJours: 30,
    tauxAcomptePct: 30,
    modeFacturation: "acompte_solde" as const,
  };

  const clientVide = { delaiPaiementJours: null, tauxAcomptePct: null, modeFacturation: null };

  it("un délai NaN vaut 0 et le dit", () => {
    const r = resoudreConditions({ ...clientVide, delaiPaiementJours: NaN }, defauts);
    expect(r.delaiPaiementJours).toBe(0);
    expect(r.avertissements.join(" ")).toContain("non numérique");
  });

  it("un taux NaN vaut 0 et le dit, sans prétendre l'avoir borné", () => {
    const r = resoudreConditions({ ...clientVide, tauxAcomptePct: NaN }, defauts);
    expect(r.tauxAcomptePct).toBe(0);
    expect(r.avertissements.join(" ")).toContain("non numérique");
  });

  it("aucune sortie NaN, quelle que soit l'entrée", () => {
    for (const c of [
      { ...clientVide, delaiPaiementJours: NaN },
      { ...clientVide, tauxAcomptePct: NaN },
      { ...clientVide, delaiPaiementJours: Infinity },
      { ...clientVide, tauxAcomptePct: -Infinity },
    ]) {
      const r = resoudreConditions(c, defauts);
      expect(Number.isFinite(r.delaiPaiementJours)).toBe(true);
      expect(Number.isFinite(r.tauxAcomptePct)).toBe(true);
    }
  });

  it("0 reste une valeur explicite du client, pas une absence", () => {
    const r = resoudreConditions(
      { ...clientVide, delaiPaiementJours: 0, tauxAcomptePct: 0 },
      defauts,
    );
    expect(r.delaiPaiementJours).toBe(0);
    expect(r.tauxAcomptePct).toBe(0);
    expect(r.origine.delai).toBe("client");
    expect(r.origine.acompte).toBe("client");
    expect(r.avertissements).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculerEcheanceFacture — l'échéance sans laquelle rien n'est jamais relancé
// ─────────────────────────────────────────────────────────────────────────────

describe("calculerEcheanceFacture", () => {
  const emise = new Date("2026-08-02T10:30:00Z");

  it("ajoute le délai du client à la date d'émission", () => {
    expect(calculerEcheanceFacture(emise, 45).toISOString()).toBe("2026-09-16T10:30:00.000Z");
  });

  it("retombe sur 30 jours quand le client n'a pas de délai propre (null)", () => {
    expect(calculerEcheanceFacture(emise, null).toISOString()).toBe(
      calculerEcheanceFacture(emise, DELAI_PAIEMENT_DEFAUT_JOURS).toISOString(),
    );
  });

  it("retombe sur 30 jours sur undefined (champ absent, pas « zéro »)", () => {
    expect(calculerEcheanceFacture(emise, undefined).toISOString()).toBe(
      calculerEcheanceFacture(emise, 30).toISOString(),
    );
  });

  it("plafonne à 60 jours (art. L441-10 — au-delà la clause est illicite)", () => {
    expect(calculerEcheanceFacture(emise, 365).toISOString()).toBe(
      calculerEcheanceFacture(emise, DELAI_PAIEMENT_MAX_JOURS).toISOString(),
    );
  });

  it("plancher à 1 jour : une échéance le jour même serait échue dès son écriture", () => {
    const j1 = calculerEcheanceFacture(emise, 1).getTime();
    expect(calculerEcheanceFacture(emise, 0).getTime()).toBe(j1);
    expect(calculerEcheanceFacture(emise, -10).getTime()).toBe(j1);
  });

  it("ne rend JAMAIS une date invalide sur une entrée non numérique", () => {
    for (const v of [NaN, Infinity, -Infinity]) {
      const d = calculerEcheanceFacture(emise, v);
      expect(Number.isNaN(d.getTime())).toBe(false);
      expect(d.toISOString()).toBe(calculerEcheanceFacture(emise, 30).toISOString());
    }
  });

  it("tronque un délai fractionnaire au lieu de produire une heure décalée", () => {
    expect(calculerEcheanceFacture(emise, 30.9).toISOString()).toBe(
      calculerEcheanceFacture(emise, 30).toISOString(),
    );
  });

  it("ne MUTE pas la date d'émission reçue (souvent réutilisée comme emiseAt)", () => {
    const source = new Date("2026-08-02T10:30:00Z");
    calculerEcheanceFacture(source, 30);
    expect(source.toISOString()).toBe("2026-08-02T10:30:00.000Z");
  });

  it("l'échéance est TOUJOURS strictement postérieure à l'émission", () => {
    for (const v of [null, undefined, 0, -5, 1, 30, 60, 999, NaN]) {
      expect(calculerEcheanceFacture(emise, v).getTime()).toBeGreaterThan(emise.getTime());
    }
  });
});
