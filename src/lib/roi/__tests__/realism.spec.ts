// Réalisme du modèle sur des profils d'entreprise réels.
//
// ── Ce que ces tests protègent ────────────────────────────────────────────
// Le simulateur alimente un tunnel de vente : ses chiffres finissent dans un
// PDF, dans un e-mail, et dans la bouche d'un commercial. Un ajustement anodin
// du référentiel (un temps unitaire relevé, un taux d'automatisation arrondi
// vers le haut) peut faire passer une promesse de crédible à ridicule sans
// qu'aucun autre test ne bronche — et c'est le prospect qui s'en aperçoit.
//
// Les bornes ci-dessous sont donc volontairement LARGES : elles n'imposent pas
// une valeur, elles interdisent l'absurde. Si l'une casse, la bonne question
// n'est pas « comment faire repasser le test » mais « ce chiffre est-il
// défendable devant un dirigeant ? ».

import { describe, it, expect } from "vitest";
import { diagnose } from "@/lib/roi/diagnose";
import { ROI_MODEL_CONSTANTS, type RoiAnswers } from "@/content/roi/model/types";

interface Archetype {
  readonly name: string;
  readonly answers: RoiAnswers;
  /** Fourchette plausible du gain annuel en euros. */
  readonly eurRange: readonly [number, number];
  /** Fourchette plausible des heures rendues par an, sur l'équipe. */
  readonly hoursRange: readonly [number, number];
}

const ARCHETYPES: readonly Archetype[] = [
  {
    name: "Artisan seul, bureautique",
    answers: {
      sector: "artisanat_services",
      headcount: "1",
      maturity: "bureautique",
      functions: ["administratif", "commercial"],
      volumes: {
        factures_emises_mois: 20,
        emails_traites_jour: 12,
        devis_emis_semaine: 6,
        prospects_qualifies_mois: 20,
      },
    },
    eurRange: [3_000, 20_000],
    hoursRange: [80, 400],
  },
  {
    name: "Cabinet comptable, 15 personnes, outillé",
    answers: {
      sector: "comptabilite_finance",
      headcount: "11-20",
      maturity: "outille",
      functions: ["administratif", "production", "finance", "relation_client"],
      volumes: {
        factures_emises_mois: 140,
        emails_traites_jour: 200,
        comptes_rendus_semaine: 6,
        recherches_documentaires_semaine: 40,
        reportings_produits_mois: 7,
        rapprochements_mois: 160,
        appels_entrants_jour: 20,
        demandes_ecrites_jour: 12,
      },
      hourlyCostEur: 55,
    },
    eurRange: [60_000, 260_000],
    hoursRange: [1_200, 4_500],
  },
  {
    name: "PME BTP, 33 personnes, bureautique",
    answers: {
      sector: "btp_immobilier",
      headcount: "21-50",
      maturity: "bureautique",
      functions: ["administratif", "commercial", "production", "rh"],
      volumes: {
        factures_emises_mois: 140,
        emails_traites_jour: 200,
        devis_emis_semaine: 17,
        prospects_qualifies_mois: 60,
        comptes_rendus_semaine: 20,
        recherches_documentaires_semaine: 12,
        candidatures_recues_mois: 12,
        entretiens_menes_mois: 6,
      },
    },
    eurRange: [40_000, 190_000],
    hoursRange: [900, 4_000],
  },
  {
    name: "Cabinet d'avocats, 8 personnes, outillé",
    answers: {
      sector: "juridique",
      headcount: "6-10",
      maturity: "outille",
      functions: ["administratif", "production"],
      volumes: {
        factures_emises_mois: 55,
        emails_traites_jour: 85,
        comptes_rendus_semaine: 6,
        recherches_documentaires_semaine: 40,
      },
      hourlyCostEur: 90,
    },
    eurRange: [40_000, 200_000],
    hoursRange: [500, 2_000],
  },
];

describe.each(ARCHETYPES)("$name", (arch) => {
  const report = diagnose(arch.answers);

  it("annonce un gain annuel dans une fourchette défendable", () => {
    expect(report.totalSavedEurPerYear).toBeGreaterThanOrEqual(arch.eurRange[0]);
    expect(report.totalSavedEurPerYear).toBeLessThanOrEqual(arch.eurRange[1]);
  });

  it("annonce un volume d'heures cohérent avec la taille de l'équipe", () => {
    expect(report.totalSavedHoursPerYear).toBeGreaterThanOrEqual(arch.hoursRange[0]);
    expect(report.totalSavedHoursPerYear).toBeLessThanOrEqual(arch.hoursRange[1]);
  });

  it("reste sous le tiers de la capacité de l'équipe", () => {
    // Au-delà, le rapport affirmerait qu'un tiers de l'entreprise ne sert à
    // rien — un dirigeant referme l'onglet.
    expect(report.pctOfTeamCapacity).toBeLessThanOrEqual(33);
  });

  it("ne récupère jamais plus d'ETP que l'effectif déclaré", () => {
    expect(report.fteRecovered).toBeLessThan(report.headcount);
  });

  it("propose au moins une action réellement lançable sous 30 jours", () => {
    // Un rapport dont tout le plan est à six mois ne déclenche aucune décision.
    const wave1 = report.roadmap.find((w) => w.id === "wave1");
    expect(wave1?.taskIds.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("détaille un plan d'action complet", () => {
    expect(report.topTasks.length).toBe(
      Math.min(ROI_MODEL_CONSTANTS.topTasksInReport, report.tasks.length),
    );
    expect(report.isEmpty).toBe(false);
  });

  it("assume ce qui ne s'automatise pas", () => {
    expect(report.nonAutomatable.length).toBe(3);
  });

  it("garde un gain moyen par personne sous un plafond crédible", () => {
    // Plus de 2 000 heures rendues par personne et par an dépasserait la durée
    // légale du travail : le signe qu'un temps unitaire a dérapé.
    const perPerson = report.totalSavedHoursPerYear / report.headcount;
    expect(perPerson).toBeLessThan(ROI_MODEL_CONSTANTS.annualHoursPerFte / 2);
  });
});

describe("cohérence entre profils", () => {
  it("donne plus à une équipe outillée qu'à la même équipe sur papier", () => {
    const base = ARCHETYPES[1]!.answers;
    const outille = diagnose({ ...base, maturity: "outille" });
    const papier = diagnose({ ...base, maturity: "papier" });
    expect(outille.totalSavedEurPerYear).toBeGreaterThan(papier.totalSavedEurPerYear);
  });

  it("donne plus à une grande équipe qu'à une petite, à volumes égaux", () => {
    // Le garde-fou de capacité ne doit pas s'inverser : plafonner une petite
    // équipe ne doit jamais la faire passer devant une grande.
    const base = ARCHETYPES[2]!.answers;
    const small = diagnose({ ...base, headcount: "2-5" });
    const large = diagnose({ ...base, headcount: "51-100" });
    expect(large.totalSavedEurPerYear).toBeGreaterThan(small.totalSavedEurPerYear);
  });

  it("croît avec le coût horaire, sans changer le classement des priorités", () => {
    // Le plan d'action se raisonne en TEMPS : changer le coût horaire ne doit
    // pas réordonner les recommandations, seulement leur valorisation.
    const base = ARCHETYPES[3]!.answers;
    const cheap = diagnose({ ...base, hourlyCostEur: 30 });
    const pricey = diagnose({ ...base, hourlyCostEur: 120 });
    expect(pricey.totalSavedEurPerYear).toBeGreaterThan(cheap.totalSavedEurPerYear);
    expect(pricey.topTasks.map((t) => t.task.id)).toEqual(cheap.topTasks.map((t) => t.task.id));
  });
});
