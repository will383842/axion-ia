/**
 * T0 — la règle de décision du gate volumétrique, sous test.
 *
 * Avant le 2026-08-16, cette règle vivait dans `scripts/volumetrie/mesurer.ts`,
 * hors de l'`include` Vitest : **la garde qui décide si une surface admin part
 * en production n'était elle-même vérifiée par rien.**
 *
 * Les cas ci-dessous couvrent les deux façons dont cette garde peut échouer :
 * se taire quand il faut crier (§ « elle rougit »), et crier quand il ne faut
 * pas (§ « elle ne rougit pas sur le bruit »). La seconde est celle qui a
 * motivé le correctif : une garde qui crie à tort cesse d'être lue.
 */

import { describe, expect, it } from "vitest";
import { PLANCHER_BRUIT_MS, TOLERANCE_REGRESSION, verdictSonde } from "../verdict-volumetrique";
import { SONDES } from "../sondes-volumetriques";

describe("🔴 la garde volumétrique rougit quand elle doit", () => {
  it("une sonde sans mesure committée est refusée", () => {
    // Une surface livrée sans baseline part à l'aveugle : c'est exactement le
    // scénario T2 (la liste chargeait toutes les inscriptions pour les compter,
    // pendant des mois, parce que personne ne mesurait).
    const v = verdictSonde({ ms: 12, budgetMs: 450, baselineMs: null });
    expect(v.rouge).toBe(true);
    expect(v.etat).toBe("sans_baseline");
  });

  it("un dépassement de budget est rouge, même TRÈS en dessous du plancher de bruit", () => {
    // 🔴 Le cas qui interdit d'implémenter le plancher comme un court-circuit
    // global : si une sonde avait un budget de 20 ms, un plancher appliqué
    // avant le budget la rendrait inatteignable et la garde muette.
    const v = verdictSonde({ ms: 30, budgetMs: 20, baselineMs: 10 });
    expect(v.rouge).toBe(true);
    expect(v.etat).toBe("hors_budget");
  });

  it("un dépassement de budget est rouge même si la baseline n'a pas bougé", () => {
    // Baseline identique à la mesure : aucune « régression » relative, et
    // pourtant la page ne tient pas son budget. Le budget est absolu.
    const v = verdictSonde({ ms: 800, budgetMs: 450, baselineMs: 800 });
    expect(v.rouge).toBe(true);
    expect(v.etat).toBe("hors_budget");
  });

  it("une vraie régression au-dessus du plancher est rouge", () => {
    // 120 ms contre une baseline de 60 ms : ×2, au-dessus du plancher, et
    // encore dans le budget. C'est précisément ce que la garde existe pour
    // attraper — une dégradation réelle qu'aucun budget ne verrait passer.
    const v = verdictSonde({ ms: 120, budgetMs: 450, baselineMs: 60 });
    expect(v.rouge).toBe(true);
    expect(v.etat).toBe("regression");
  });

  it("juste au-dessus de la tolérance, au-dessus du plancher : rouge", () => {
    const baselineMs = 100;
    const ms = Math.ceil(baselineMs * TOLERANCE_REGRESSION) + 1; // 141 ms
    expect(verdictSonde({ ms, budgetMs: 450, baselineMs }).rouge).toBe(true);
  });
});

describe("🔴 la garde ne rougit PAS sur le bruit d'un runner", () => {
  // Les quatre mesures réelles au volume cible (1 200 sessions), CI du
  // 2026-08-16. À ces ordres de grandeur, 1,4 × baseline est à l'intérieur de
  // la dispersion d'un runner partagé.
  const MESURES_REELLES = [
    { cle: "sessions_liste", baselineMs: 10, budgetMs: 450 },
    { cle: "sessions_liste_archives", baselineMs: 7, budgetMs: 700 },
    { cle: "dossiers_pipeline", baselineMs: 17, budgetMs: 600 },
    { cle: "dossiers_pipeline_archives", baselineMs: 12, budgetMs: 900 },
  ] as const;

  it.each(MESURES_REELLES)(
    "$cle : un doublement du temps sous le plancher ne déclare pas de régression",
    ({ baselineMs, budgetMs }) => {
      const v = verdictSonde({ ms: baselineMs * 2, budgetMs, baselineMs });
      expect(
        v.rouge,
        `${baselineMs * 2} ms contre une baseline de ${baselineMs} ms : c'est du bruit ` +
          `d'ordonnancement, pas une régression. Faire rougir ici, c'est apprendre à ` +
          `l'équipe à ignorer ce gate.`,
      ).toBe(false);
    },
  );

  it("le plus mauvais cas sous le plancher reste vert", () => {
    // Baseline 1 ms, mesure au plancher : ×50, et pourtant rien d'observable.
    const v = verdictSonde({ ms: PLANCHER_BRUIT_MS, budgetMs: 450, baselineMs: 1 });
    expect(v.rouge).toBe(false);
  });

  it("un pas au-dessus du plancher, la comparaison relative reprend la main", () => {
    // La frontière est nette et testée des deux côtés : sans ça, un plancher
    // mal borné (>= au lieu de >) désarmerait silencieusement un cran de plus.
    const baselineMs = 10;
    expect(verdictSonde({ ms: PLANCHER_BRUIT_MS, budgetMs: 450, baselineMs }).rouge).toBe(false);
    expect(verdictSonde({ ms: PLANCHER_BRUIT_MS + 1, budgetMs: 450, baselineMs }).rouge).toBe(true);
  });

  it("une mesure plus RAPIDE que la baseline est verte", () => {
    expect(verdictSonde({ ms: 3, budgetMs: 450, baselineMs: 17 }).rouge).toBe(false);
  });
});

describe("🔴 le plancher ne peut pas avaler un budget déclaré", () => {
  it.each(SONDES.map((s) => [s.cle, s.budgetMs] as const))(
    "%s : son budget (%i ms) reste au-dessus du plancher de bruit",
    (_cle, budgetMs) => {
      // Si un jour quelqu'un déclare une sonde à 40 ms de budget, ou relève le
      // plancher, ce test rougit AVANT que la garde ne devienne décorative.
      expect(
        budgetMs,
        `Un budget inférieur au plancher de bruit (${PLANCHER_BRUIT_MS} ms) laisserait ` +
          `passer toute dégradation relative sans jamais rien dire.`,
      ).toBeGreaterThan(PLANCHER_BRUIT_MS);
    },
  );
});
