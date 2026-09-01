/**
 * Les deux veilles du content-gen, et les deux façons dont elles se sont tues.
 *
 * Du 2026-08-28 au 2026-09-01, la chaîne a produit 54 jobs, 100 % d'échecs,
 * zéro article — pendant quatre jours, sans une seule alerte. Les deux veilles
 * censées le dire étaient aveugles, chacune pour une raison différente. Ces
 * tests rejouent les compteurs RÉELS de ces quatre jours.
 */

import { describe, it, expect } from "vitest";
import {
  evaluatePipelineStall,
  evaluateRejectRate,
  REJECT_RULES,
  STALL_RULES,
} from "../anomaly-rules";

describe("taux de rejet — le seuil horaire était inatteignable", () => {
  it("alerte sur la cadence réelle de 15/jour, là où l'ancienne règle ne pouvait rien voir", () => {
    // 29/08 : 15 jobs lancés, 15 échecs. Sur une heure : ~0,6 job terminé.
    // L'ancien seuil (> 5 jobs terminés en 1 h) était hors d'atteinte.
    const verdict = evaluateRejectRate({
      totalRecent: 1,
      failedRecent: 1,
      totalDay: 15,
      failedDay: 15,
    });

    expect(verdict).not.toBeNull();
    expect(verdict?.fenetre).toBe("24 h");
    expect(verdict?.pct).toBe(100);
  });

  it("l'ancienne règle du pic court est CONSERVÉE et reste prioritaire", () => {
    // Anti-régression : sur une cadence haute, le pic sur 1 h reste le signal —
    // il est plus précis que la moyenne du jour.
    const verdict = evaluateRejectRate({
      totalRecent: 10,
      failedRecent: 9,
      totalDay: 100,
      failedDay: 10,
    });

    expect(verdict?.fenetre).toBe("1 h");
    expect(verdict?.failed).toBe(9);
    expect(verdict?.total).toBe(10);
  });

  it("ne dit rien quand la chaîne va bien", () => {
    expect(
      evaluateRejectRate({ totalRecent: 2, failedRecent: 0, totalDay: 15, failedDay: 1 }),
    ).toBeNull();
  });

  it("n'alerte pas sur un échantillon trop maigre", () => {
    // 2 jobs sur 24 h dont 2 échecs : statistiquement muet, on se tait.
    expect(
      evaluateRejectRate({ totalRecent: 0, failedRecent: 0, totalDay: 2, failedDay: 2 }),
    ).toBeNull();
  });

  it("exactement 50 % d'échecs ne déclenche pas (le seuil est STRICT)", () => {
    expect(
      evaluateRejectRate({ totalRecent: 0, failedRecent: 0, totalDay: 10, failedDay: 5 }),
    ).toBeNull();
  });

  it("aucune division par zéro sur une chaîne totalement inactive", () => {
    expect(
      evaluateRejectRate({ totalRecent: 0, failedRecent: 0, totalDay: 0, failedDay: 0 }),
    ).toBeNull();
  });

  it("le plancher de la règle 24 h vaut bien celui annoncé", () => {
    expect(REJECT_RULES.dayWindowMinCompleted).toBe(5);
    expect(REJECT_RULES.failureRatio).toBe(0.5);
  });
});

describe("chaîne à l'arrêt — la veille comptait le producteur, pas le produit", () => {
  it("voit la chaîne tourner À VIDE : 15 lancés, 0 produit", () => {
    // Les compteurs exacts du 29, 30 et 31/08. L'ancienne veille voyait
    // `recentJobs > 0` et concluait « rien à signaler ».
    const stall = evaluatePipelineStall({
      runningCampaigns: 2,
      recentJobs: 3,
      createdDay: 15,
      productiveDay: 0,
    });

    expect(stall).toBe("tourne_a_vide");
  });

  it("l'ancienne règle est CONSERVÉE : plus rien de lancé depuis 4 h", () => {
    const stall = evaluatePipelineStall({
      runningCampaigns: 1,
      recentJobs: 0,
      createdDay: 0,
      productiveDay: 0,
    });

    expect(stall).toBe("rien_lance");
  });

  it("se tait quand la chaîne produit", () => {
    expect(
      evaluatePipelineStall({
        runningCampaigns: 2,
        recentJobs: 3,
        createdDay: 15,
        productiveDay: 9,
      }),
    ).toBeNull();
  });

  it("ne réveille personne sans campagne en cours", () => {
    expect(
      evaluatePipelineStall({
        runningCampaigns: 0,
        recentJobs: 0,
        createdDay: 0,
        productiveDay: 0,
      }),
    ).toBeNull();
  });

  it("n'alarme pas un système fraîchement démarré", () => {
    // 3 jobs lancés, aucun encore terminé : c'est normal, pas une panne. Le
    // plancher existe exactement pour ce cas.
    expect(
      evaluatePipelineStall({
        runningCampaigns: 1,
        recentJobs: 3,
        createdDay: 3,
        productiveDay: 0,
      }),
    ).toBeNull();
    expect(STALL_RULES.dayWindowMinCreated).toBe(5);
  });

  it("un contenu retenu pour relecture COMPTE comme produit", () => {
    // `needs_review` veut dire que la génération a abouti et que le contenu
    // existe. Ne pas le compter ferait hurler la veille sur une chaîne saine
    // dont les contenus attendent simplement un arbitrage humain.
    expect(
      evaluatePipelineStall({
        runningCampaigns: 1,
        recentJobs: 2,
        createdDay: 15,
        productiveDay: 15,
      }),
    ).toBeNull();
  });
});
