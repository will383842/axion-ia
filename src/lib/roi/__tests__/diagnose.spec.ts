// Comportement du moteur de diagnostic.
//
// L'enjeu de ces tests n'est pas l'arithmétique — elle est triviale — mais les
// PROMESSES faites au dirigeant dans le rapport : ne jamais deviner une valeur
// manquante, ne jamais annoncer un gain invraisemblable, ne jamais recommander
// le chantier lourd avant le gain immédiat.

import { describe, it, expect } from "vitest";
import { diagnose, isTaskApplicable, selectNonAutomatable } from "@/lib/roi/diagnose";
import { AUTOMATABLE_TASKS, getAutomatableTask } from "@/content/roi/model/tasks";
import { ROI_MODEL_CONSTANTS, CAPACITY_GUARD_SHARE, type RoiAnswers } from "@/content/roi/model/types";

function answers(over: Partial<RoiAnswers> = {}): RoiAnswers {
  return {
    sector: "generique",
    headcount: "11-20",
    maturity: "outille",
    functions: ["administratif", "commercial"],
    volumes: { factures_emises_mois: 55, devis_emis_semaine: 6 },
    ...over,
  };
}

describe("exclusion des grandeurs non mesurées", () => {
  it("ignore une tâche dont la grandeur n'a pas été renseignée", () => {
    const withOnlyInvoices = diagnose(answers({ volumes: { factures_emises_mois: 55 } }));
    const ids = withOnlyInvoices.tasks.map((t) => t.task.id);
    expect(ids).toContain("facture_emission");
    expect(ids).not.toContain("devis_redaction");
  });

  it("ignore une grandeur déclarée à zéro plutôt que d'afficher une ligne vide", () => {
    const r = diagnose(
      answers({ functions: ["marketing"], volumes: { publications_mois: 0 } }),
    );
    expect(r.tasks.map((t) => t.task.id)).not.toContain("publication_contenu");
  });

  it("signale les fonctions déclarées mais non mesurées", () => {
    const r = diagnose(
      answers({
        functions: ["administratif", "commercial", "rh"],
        volumes: { factures_emises_mois: 20 },
      }),
    );
    expect(r.unmeasuredFunctions).toContain("commercial");
    expect(r.unmeasuredFunctions).toContain("rh");
    expect(r.unmeasuredFunctions).not.toContain("administratif");
  });

  it("ne signale jamais la direction comme non mesurée", () => {
    // Elle n'a délibérément aucune question de volume : la signaler serait un
    // faux signal, et donnerait l'impression d'un questionnaire incomplet.
    const r = diagnose(answers({ functions: ["administratif", "direction"] }));
    expect(r.unmeasuredFunctions).not.toContain("direction");
  });

  it("produit un rapport vide et honnête quand rien n'a été mesuré", () => {
    const r = diagnose(answers({ volumes: {} }));
    expect(r.isEmpty).toBe(true);
    expect(r.totalSavedHoursPerYear).toBe(0);
    expect(r.topTasks).toHaveLength(0);
    expect(r.roadmap).toHaveLength(0);
  });
});

describe("applicabilité sectorielle", () => {
  const sectorial = AUTOMATABLE_TASKS.find((t) => t.sectors);

  it("retient une tâche sectorielle dans son secteur", () => {
    expect(sectorial).toBeDefined();
    expect(isTaskApplicable(sectorial!, sectorial!.sectors![0]!)).toBe(true);
  });

  it("écarte une tâche sectorielle en profil générique", () => {
    // On ne prétend pas connaître un métier que l'utilisateur n'a pas nommé.
    expect(isTaskApplicable(sectorial!, "generique")).toBe(false);
  });

  it("applique le facteur sectoriel au temps unitaire", () => {
    const base = diagnose(
      answers({
        sector: "commerce_retail",
        functions: ["production"],
        volumes: { comptes_rendus_semaine: 6 },
      }),
    );
    const heavier = diagnose(
      answers({
        sector: "juridique",
        functions: ["production"],
        volumes: { comptes_rendus_semaine: 6 },
      }),
    );
    const baseTask = base.tasks.find((t) => t.task.id === "compte_rendu_reunion")!;
    const heavyTask = heavier.tasks.find((t) => t.task.id === "compte_rendu_reunion")!;
    // Le compte-rendu juridique porte un facteur 1,4.
    expect(heavyTask.minutesPerUnit).toBeCloseTo(baseTask.minutesPerUnit * 1.4, 5);
  });
});

describe("maturité numérique", () => {
  it("réduit le gain et allonge le délai pour une entreprise encore sur papier", () => {
    const outille = diagnose(answers({ maturity: "outille" }));
    const papier = diagnose(answers({ maturity: "papier" }));

    expect(papier.totalSavedHoursPerYear).toBeLessThan(outille.totalSavedHoursPerYear);

    const before = outille.tasks.find((t) => t.task.id === "facture_emission")!;
    const after = papier.tasks.find((t) => t.task.id === "facture_emission")!;
    expect(after.weeksToValue).toBeGreaterThan(before.weeksToValue);
  });
});

describe("garde-fou de capacité", () => {
  it("plafonne un cumul invraisemblable au regard de l'effectif", () => {
    // Un dirigeant seul cochant partout la tranche haute : arithmétiquement
    // cohérent, manifestement faux. Sans plafond, le rapport annoncerait
    // plusieurs ETP récupérés dans une entreprise d'une personne — et perdrait
    // toute crédibilité en une ligne.
    const r = diagnose(
      answers({
        headcount: "1",
        functions: ["administratif", "commercial", "production", "relation_client"],
        volumes: {
          factures_emises_mois: 320,
          emails_traites_jour: 450,
          devis_emis_semaine: 40,
          prospects_qualifies_mois: 160,
          comptes_rendus_semaine: 45,
          recherches_documentaires_semaine: 90,
          appels_entrants_jour: 120,
          demandes_ecrites_jour: 90,
        },
      }),
    );

    expect(r.capacityCapped).toBe(true);
    const capacity = r.headcount * ROI_MODEL_CONSTANTS.annualHoursPerFte;
    expect(r.totalCurrentHoursPerYear).toBeLessThanOrEqual(
      Math.ceil(capacity * CAPACITY_GUARD_SHARE),
    );
    expect(r.fteRecovered).toBeLessThan(r.headcount);
  });

  it("laisse un profil raisonnable intact", () => {
    const r = diagnose(answers());
    expect(r.capacityCapped).toBe(false);
  });

  it("garde la part de capacité rendue sous un seuil crédible", () => {
    const r = diagnose(
      answers({
        headcount: "2-5",
        functions: ["administratif", "commercial", "production"],
        volumes: {
          factures_emises_mois: 320,
          emails_traites_jour: 450,
          devis_emis_semaine: 40,
          comptes_rendus_semaine: 45,
        },
      }),
    );
    expect(r.pctOfTeamCapacity).toBeLessThanOrEqual(CAPACITY_GUARD_SHARE * 100);
  });
});

describe("classement et feuille de route", () => {
  it("classe les tâches par score de priorité décroissant", () => {
    const r = diagnose(
      answers({
        functions: ["administratif", "commercial", "production"],
        volumes: {
          factures_emises_mois: 55,
          devis_emis_semaine: 6,
          comptes_rendus_semaine: 6,
          recherches_documentaires_semaine: 12,
        },
      }),
    );
    const scores = r.tasks.map((t) => t.priorityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("ne met jamais un chantier long dans la première vague", () => {
    // C'est la promesse centrale du plan d'action : ce qui est proposé à
    // 30 jours doit être réellement livrable en 30 jours.
    const r = diagnose(
      answers({
        functions: ["administratif", "production"],
        volumes: { factures_emises_mois: 55, recherches_documentaires_semaine: 12 },
      }),
    );
    const wave1 = r.roadmap.find((w) => w.id === "wave1");
    for (const id of wave1?.taskIds ?? []) {
      const detail = r.tasks.find((t) => t.task.id === id)!;
      expect(detail.weeksToValue, `tâche ${id}`).toBeLessThanOrEqual(4);
    }
  });

  it("range chaque tâche chiffrée dans exactement une vague", () => {
    const r = diagnose(
      answers({
        functions: ["administratif", "commercial", "production", "finance"],
        volumes: {
          factures_emises_mois: 55,
          devis_emis_semaine: 6,
          comptes_rendus_semaine: 6,
          recherches_documentaires_semaine: 12,
          reportings_produits_mois: 7,
        },
      }),
    );
    const placed = r.roadmap.flatMap((w) => w.taskIds);
    expect(new Set(placed).size).toBe(placed.length);
    expect(placed.sort()).toEqual(r.tasks.map((t) => t.task.id).sort());
  });

  it("limite le plan d'action au nombre de tâches annoncé", () => {
    const r = diagnose(
      answers({
        functions: ["administratif", "commercial", "production", "finance", "marketing"],
        volumes: {
          factures_emises_mois: 55,
          emails_traites_jour: 85,
          devis_emis_semaine: 6,
          prospects_qualifies_mois: 20,
          comptes_rendus_semaine: 6,
          recherches_documentaires_semaine: 12,
          reportings_produits_mois: 7,
          publications_mois: 10,
        },
      }),
    );
    expect(r.tasks.length).toBeGreaterThan(ROI_MODEL_CONSTANTS.topTasksInReport);
    expect(r.topTasks).toHaveLength(ROI_MODEL_CONSTANTS.topTasksInReport);
    expect(r.topTasks[0]).toEqual(r.tasks[0]);
  });
});

describe("fourchettes et totaux", () => {
  it("encadre la valeur centrale par une fourchette non dégénérée", () => {
    const r = diagnose(answers());
    expect(r.totalSavedHoursLow).toBeLessThan(r.totalSavedHoursPerYear);
    expect(r.totalSavedHoursHigh).toBeGreaterThan(r.totalSavedHoursPerYear);
    expect(r.totalSavedEurLow).toBeLessThan(r.totalSavedEurHigh);
  });

  it("élargit la fourchette d'une tâche peu certaine", () => {
    const r = diagnose(
      answers({
        sector: "juridique",
        functions: ["production", "relation_client"],
        volumes: { comptes_rendus_semaine: 6, reclamations_mois: 6 },
      }),
    );
    const sure = r.tasks.find((t) => t.task.id === "compte_rendu_reunion")!; // haute
    const unsure = r.tasks.find((t) => t.task.id === "reclamation_traitement")!; // prudente

    const relSpread = (t: typeof sure) =>
      (t.savedHoursHigh - t.savedHoursLow) / t.savedHoursPerYear;
    expect(relSpread(unsure)).toBeGreaterThan(relSpread(sure));
  });

  it("ne gagne jamais plus de temps qu'il n'en est passé", () => {
    const r = diagnose(
      answers({
        functions: ["administratif", "commercial", "production"],
        volumes: {
          factures_emises_mois: 140,
          devis_emis_semaine: 17,
          comptes_rendus_semaine: 20,
        },
      }),
    );
    for (const t of r.tasks) {
      expect(t.savedHoursPerYear, `tâche ${t.task.id}`).toBeLessThan(t.currentHoursPerYear);
    }
    expect(r.totalSavedHoursPerYear).toBeLessThan(r.totalCurrentHoursPerYear);
  });

  it("ventile la totalité du gain entre les fonctions", () => {
    const r = diagnose(
      answers({
        functions: ["administratif", "commercial"],
        volumes: { factures_emises_mois: 55, devis_emis_semaine: 6 },
      }),
    );
    const sum = r.byFunction.reduce((s, f) => s + f.savedHoursPerYear, 0);
    expect(Math.abs(sum - r.totalSavedHoursPerYear)).toBeLessThanOrEqual(r.byFunction.length);
    const shares = r.byFunction.reduce((s, f) => s + f.sharePct, 0);
    expect(shares).toBeGreaterThanOrEqual(98);
    expect(shares).toBeLessThanOrEqual(102);
  });

  it("borne le coût horaire aux valeurs plausibles", () => {
    const low = diagnose(answers({ hourlyCostEur: 1 }));
    const high = diagnose(answers({ hourlyCostEur: 10_000 }));
    expect(low.hourlyCostEur).toBe(ROI_MODEL_CONSTANTS.hourlyCostMinEur);
    expect(high.hourlyCostEur).toBe(ROI_MODEL_CONSTANTS.hourlyCostMaxEur);
  });
});

describe("ce qui ne s'automatise pas", () => {
  it("montre d'abord la mise en garde propre au secteur", () => {
    const picked = selectNonAutomatable("btp_immobilier", ["production", "commercial"]);
    expect(picked[0]?.id).toBe("na_visite_chantier");
  });

  it("remplit toujours le bloc, même sans fonction correspondante", () => {
    // Un bloc vide donnerait l'impression que tout s'automatise — l'inverse
    // exact du message.
    const picked = selectNonAutomatable("generique", []);
    expect(picked).toHaveLength(3);
  });

  it("ne répète jamais la même mise en garde", () => {
    const picked = selectNonAutomatable("juridique", ["production", "direction", "commercial"]);
    expect(new Set(picked.map((p) => p.id)).size).toBe(picked.length);
  });
});

describe("traçabilité", () => {
  it("permet de remonter de chaque ligne du rapport à sa fiche du référentiel", () => {
    // C'est la propriété qui rend le rapport opposable : un dirigeant peut
    // demander « d'où sort ce chiffre ? » pour n'importe quelle ligne.
    const r = diagnose(answers());
    for (const t of r.tasks) {
      expect(getAutomatableTask(t.task.id), `tâche ${t.task.id}`).toBeDefined();
      expect(t.task.proofFr.length).toBeGreaterThan(0);
    }
  });
});
