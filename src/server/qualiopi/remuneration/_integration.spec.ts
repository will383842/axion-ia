// Test d'INTÉGRATION de la chaîne monétaire : calcul → run → totaux.
//
// Les specs unitaires vérifient chaque module isolément. Celui-ci traverse la
// chaîne réelle avec des modules NON mockés, pour attraper une incohérence de
// contrat entre eux (arrondis, ensembles de statuts, snapshot) qu'un test isolé
// ne verrait pas. Aucun mock : ce sont les vraies fonctions.

import { describe, it, expect } from "vitest";
import { resolveRegle, type RegleRemuneration } from "./calcul";
import {
  construireLignesPrestation,
  construireReleve,
  totauxReleve,
  type FormateurContexte,
  type PrestationACalculer,
  type RegleIdentifiee,
} from "./run";

const JUIN = new Date("2026-06-15T09:00:00Z");

function ctx(fs: FormateurContexte[]): Map<string, FormateurContexte> {
  return new Map(fs.map((f) => [f.trainerId, f]));
}

describe("intégration — co-animation salarié + indépendant, cycle complet", () => {
  it("calcule, répartit, snapshote et totalise de façon cohérente", () => {
    // Deux formateurs animent 14 h chacun une session à 20 000 € HT.
    // - t1 salarié, taux journalier 800 €/j → ligne ANALYTIQUE (jamais facturée)
    // - t2 indépendant assujetti, commission 30 % → ligne HONORAIRE_DU + TVA 20 %
    const regles: RegleIdentifiee[] = [
      {
        id: "r-sal",
        trainerId: "sal",
        prestationType: null,
        interventionSlug: null,
        model: "taux_journalier",
        tauxJourneeHtCents: 80_000,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveTo: null,
      },
      {
        id: "r-ind",
        trainerId: "ind",
        prestationType: null,
        interventionSlug: null,
        model: "commission_ca_pct",
        commissionPct: 30,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveTo: null,
      },
    ];

    const prestation: PrestationACalculer = {
      type: "formation_collective",
      sessionId: "s1",
      coachingSessionId: null,
      bookingId: null,
      auditMissionId: null,
      date: JUIN,
      statut: "realisee",
      interventionSlug: null,
      dureeHeures: 14,
      caTotalCents: 2_000_000, // 20 000 €
      affectations: [
        { trainerId: "sal", heuresAnimees: 14 },
        { trainerId: "ind", heuresAnimees: 14 },
      ],
    };

    const formateurs = ctx([
      { trainerId: "sal", statut: "salarie", tarifJourneeHtCentsFallback: null, regimeTva: null },
      {
        trainerId: "ind",
        statut: "sous_traitant",
        tarifJourneeHtCentsFallback: null,
        regimeTva: "assujetti_20",
      },
    ]);

    const { lignes, anomalies } = construireLignesPrestation(prestation, regles, formateurs);
    expect(anomalies).toEqual([]);
    expect(lignes).toHaveLength(2);

    const lSal = lignes.find((l) => l.trainerId === "sal")!;
    const lInd = lignes.find((l) => l.trainerId === "ind")!;

    // Salarié : 14 h / 7 = 2 jours × 800 € = 1 600 €, nature analytique.
    expect(lSal.nature).toBe("analytique");
    expect(lSal.montantHtCents).toBe(160_000);
    expect(lSal.nbJours).toBe(2);
    expect(lSal.tauxSnapshotCents).toBe(80_000);

    // CA réparti 50/50 (14 h chacun) → 10 000 € chacun. Commission 30 % = 3 000 €.
    expect(lInd.nature).toBe("honoraire_du");
    expect(lInd.caBaseCents).toBe(1_000_000);
    expect(lInd.montantHtCents).toBe(300_000);
    expect(lInd.commissionPctSnapshot).toBe(30);

    // ── Relevé du salarié : AUCUN (nature analytique) ──
    const relSal = construireReleve(formateurs.get("sal")!, { year: 2026, month: 6 }, [lSal]);
    expect(relSal.releve).toBeNull();

    // ── Relevé de l'indépendant : 3 000 € HT + 20 % TVA = 3 600 € TTC ──
    const relInd = construireReleve(formateurs.get("ind")!, { year: 2026, month: 6 }, [lInd]);
    expect(relInd.anomalies).toEqual([]);
    expect(relInd.releve?.totalHtCents).toBe(300_000);
    expect(relInd.releve?.tvaCents).toBe(60_000);
    expect(relInd.releve?.totalTtcCents).toBe(360_000);

    // ── Invariant transverse : le total du relevé ignore l'analytique ──
    // Passer les DEUX lignes ne doit PAS ajouter le coût salarié au dû.
    const totalMixte = totauxReleve([lSal, lInd], "assujetti_20");
    expect(totalMixte.totalHtCents).toBe(300_000); // seul l'indépendant compte
  });

  it("TVA au niveau du relevé ≠ somme des TVA ligne à ligne", () => {
    // 3 lignes à 333,33 € : arrondir chaque ligne dériverait du total réel.
    const ligne = {
      nature: "honoraire_du" as const,
      statut: "calcule" as const,
      montantHtCents: 33_333,
    };
    const t = totauxReleve([ligne, ligne, ligne], "assujetti_20");
    expect(t.totalHtCents).toBe(99_999);
    expect(t.tvaCents).toBe(20_000); // round(20 % × 99 999), PAS 3 × round(20 % × 33 333)=20 001
  });

  it("le barème résolu par resolveRegle est bien celui snapshoté sur la ligne", () => {
    // Deux versions : jusqu'à sept. 900 €, à partir de sept. 1100 €.
    const regles: RegleIdentifiee[] = [
      {
        id: "v1",
        trainerId: "t",
        prestationType: null,
        interventionSlug: null,
        model: "taux_journalier",
        tauxJourneeHtCents: 90_000,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveTo: new Date("2026-09-01T00:00:00Z"),
      },
      {
        id: "v2",
        trainerId: "t",
        prestationType: null,
        interventionSlug: null,
        model: "taux_journalier",
        tauxJourneeHtCents: 110_000,
        effectiveFrom: new Date("2026-09-01T00:00:00Z"),
        effectiveTo: null,
      },
    ];

    // resolveRegle en juin doit rendre v1 ; la ligne doit snapshoter 90 000.
    const resolue = resolveRegle(regles, {
      trainerId: "t",
      prestationType: "formation_collective",
      interventionSlug: null,
      date: JUIN,
    });
    expect(resolue?.id).toBe("v1");

    const { lignes } = construireLignesPrestation(
      {
        type: "formation_collective",
        sessionId: "s",
        coachingSessionId: null,
        bookingId: null,
        auditMissionId: null,
        date: JUIN,
        statut: "realisee",
        interventionSlug: null,
        dureeHeures: 7,
        caTotalCents: 0,
        affectations: [{ trainerId: "t", heuresAnimees: 7 }],
      },
      regles,
      ctx([
        {
          trainerId: "t",
          statut: "sous_traitant",
          tarifJourneeHtCentsFallback: null,
          regimeTva: "franchise_293b",
        },
      ]),
    );
    expect(lignes[0]?.ruleId).toBe("v1");
    expect(lignes[0]?.tauxSnapshotCents).toBe(90_000);
    expect(lignes[0]?.montantHtCents).toBe(90_000); // 1 j × 900 €
  });

  it("un type miroir TS reste aligné sur RegleRemuneration (compile-time)", () => {
    // Si un champ de RegleRemuneration disparaissait, cette affectation casserait.
    const r: RegleRemuneration = {
      trainerId: "x",
      prestationType: null,
      interventionSlug: null,
      model: "forfait_prestation",
      forfaitHtCents: 50_000,
      effectiveFrom: JUIN,
      effectiveTo: null,
    };
    expect(r.model).toBe("forfait_prestation");
  });
});
