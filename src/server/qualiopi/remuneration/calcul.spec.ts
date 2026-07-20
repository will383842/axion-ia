/**
 * Tests — calcul.ts (moteur de rémunération des formateurs).
 *
 * Enjeux réels : intangibilité comptable (une ligne émise ne doit jamais être
 * recalculée par une modification de barème postérieure), distinction
 * salarié/indépendant (nature de la ligne + TVA), et zéro centime perdu dans la
 * répartition du CA d'une co-animation. On teste surtout les INVARIANTS.
 */

import { describe, it, expect } from "vitest";
import {
  calculerLigne,
  calculerMontantCents,
  calculerTva,
  natureLigne,
  repartirCa,
  resolveRegle,
  HEURES_PAR_JOUR_DEFAUT,
  type RegleRemuneration,
  type CompensationModel,
} from "./calcul";

/** Fabrique une règle avec des valeurs par défaut raisonnables. */
function regle(over: Partial<RegleRemuneration> = {}): RegleRemuneration {
  return {
    trainerId: "t1",
    prestationType: null,
    interventionSlug: null,
    model: "taux_journalier",
    tauxJourneeHtCents: 90_000, // 900 €/j
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null,
    ...over,
  };
}

const JUIN = new Date("2026-06-15T00:00:00Z");
const SEPT = new Date("2026-09-15T00:00:00Z");

/* ──────────────────────────────────────────────────────────────────────────────
 * natureLigne
 * ────────────────────────────────────────────────────────────────────────────── */

describe("natureLigne", () => {
  it("salarié → ligne analytique (coût indicatif, jamais payée)", () => {
    expect(natureLigne("salarie")).toBe("analytique");
  });
  it("dirigeant-formateur → ligne analytique (interne, comme un salarié)", () => {
    expect(natureLigne("dirigeant")).toBe("analytique");
  });
  it("indépendant → ligne honoraire_du (dû réel, facturable)", () => {
    expect(natureLigne("sous_traitant")).toBe("honoraire_du");
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * resolveRegle — barème versionné
 * ────────────────────────────────────────────────────────────────────────────── */

describe("resolveRegle — spécificité", () => {
  const globale = regle({ prestationType: null, interventionSlug: null, tauxJourneeHtCents: 1 });
  const parType = regle({
    prestationType: "formation_collective",
    interventionSlug: null,
    tauxJourneeHtCents: 2,
  });
  const parIntervention = regle({
    prestationType: "formation_collective",
    interventionSlug: "ia-generative",
    tauxJourneeHtCents: 3,
  });

  it("préfère (type + intervention) au plus général", () => {
    const r = resolveRegle([globale, parType, parIntervention], {
      trainerId: "t1",
      prestationType: "formation_collective",
      interventionSlug: "ia-generative",
      date: JUIN,
    });
    expect(r?.tauxJourneeHtCents).toBe(3);
  });

  it("retombe sur (type, intervention null) si l'intervention ne matche pas", () => {
    const r = resolveRegle([globale, parType, parIntervention], {
      trainerId: "t1",
      prestationType: "formation_collective",
      interventionSlug: "autre-slug",
      date: JUIN,
    });
    expect(r?.tauxJourneeHtCents).toBe(2);
  });

  it("retombe sur le barème global si le type ne matche pas", () => {
    const r = resolveRegle([globale, parType, parIntervention], {
      trainerId: "t1",
      prestationType: "audit",
      interventionSlug: null,
      date: JUIN,
    });
    expect(r?.tauxJourneeHtCents).toBe(1);
  });

  it("ne matche pas un autre formateur", () => {
    const r = resolveRegle([globale], {
      trainerId: "t2",
      prestationType: "audit",
      interventionSlug: null,
      date: JUIN,
    });
    expect(r).toBeNull();
  });

  it("aucune règle → null (l'appelant appliquera le fallback legacy)", () => {
    const r = resolveRegle([], {
      trainerId: "t1",
      prestationType: "audit",
      interventionSlug: null,
      date: JUIN,
    });
    expect(r).toBeNull();
  });
});

describe("resolveRegle — effet de date", () => {
  it("ignore une règle future (effectiveFrom > date)", () => {
    const future = regle({ effectiveFrom: SEPT, tauxJourneeHtCents: 999 });
    const r = resolveRegle([future], {
      trainerId: "t1",
      prestationType: "audit",
      interventionSlug: null,
      date: JUIN,
    });
    expect(r).toBeNull();
  });

  it("ignore une règle close (effectiveTo passé)", () => {
    const close = regle({
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      effectiveTo: new Date("2026-03-01T00:00:00Z"),
    });
    const r = resolveRegle([close], {
      trainerId: "t1",
      prestationType: "audit",
      interventionSlug: null,
      date: JUIN,
    });
    expect(r).toBeNull();
  });

  it("effectiveTo est EXCLU : la veille de la clôture, la règle s'applique encore", () => {
    const close = regle({
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      effectiveTo: new Date("2026-06-15T00:00:00Z"),
      tauxJourneeHtCents: 42,
    });
    // date strictement < effectiveTo → couverte
    const avant = resolveRegle([close], {
      trainerId: "t1",
      prestationType: "audit",
      interventionSlug: null,
      date: new Date("2026-06-14T23:59:59Z"),
    });
    expect(avant?.tauxJourneeHtCents).toBe(42);
    // date == effectiveTo → NON couverte (la nouvelle version prend le relais)
    const pile = resolveRegle([close], {
      trainerId: "t1",
      prestationType: "audit",
      interventionSlug: null,
      date: new Date("2026-06-15T00:00:00Z"),
    });
    expect(pile).toBeNull();
  });

  it("à spécificité égale, effectiveFrom le plus récent ≤ date l'emporte", () => {
    const ancienne = regle({
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      effectiveTo: new Date("2026-05-01T00:00:00Z"),
      tauxJourneeHtCents: 80_000,
    });
    const recente = regle({
      effectiveFrom: new Date("2026-05-01T00:00:00Z"),
      effectiveTo: null,
      tauxJourneeHtCents: 100_000,
    });
    const r = resolveRegle([ancienne, recente], {
      trainerId: "t1",
      prestationType: "audit",
      interventionSlug: null,
      date: JUIN,
    });
    expect(r?.tauxJourneeHtCents).toBe(100_000);
  });
});

describe("resolveRegle — INVARIANT : changer un taux en septembre ne recalcule pas juin", () => {
  // Barème juin (900 €/j) clos au 1er sept ; nouveau barème sept (1 200 €/j).
  const barumeJuin = regle({
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: new Date("2026-09-01T00:00:00Z"),
    tauxJourneeHtCents: 90_000,
  });
  const barumeSept = regle({
    effectiveFrom: new Date("2026-09-01T00:00:00Z"),
    effectiveTo: null,
    tauxJourneeHtCents: 120_000,
  });
  const regles = [barumeJuin, barumeSept];

  it("une session de juin résout le taux de juin (900 €/j), pas celui de septembre", () => {
    const r = resolveRegle(regles, {
      trainerId: "t1",
      prestationType: "formation_collective",
      interventionSlug: null,
      date: JUIN,
    });
    expect(r?.tauxJourneeHtCents).toBe(90_000);
  });

  it("une session de septembre résout le nouveau taux (1 200 €/j)", () => {
    const r = resolveRegle(regles, {
      trainerId: "t1",
      prestationType: "formation_collective",
      interventionSlug: null,
      date: SEPT,
    });
    expect(r?.tauxJourneeHtCents).toBe(120_000);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * calculerMontantCents — les 4 modèles
 * ────────────────────────────────────────────────────────────────────────────── */

describe("calculerMontantCents — les 4 modèles", () => {
  it("taux_journalier : 900 €/j sur 14 h (2 j de 7 h) = 1 800 €", () => {
    const m = calculerMontantCents({
      regle: regle({ model: "taux_journalier", tauxJourneeHtCents: 90_000 }),
      heuresAnimees: 14,
      heuresParJour: 7,
      caBaseCents: 0,
    });
    expect(m).toBe(180_000);
  });

  it("taux_journalier : demi-journée (3,5 h) = 450 €, arrondi au centime", () => {
    const m = calculerMontantCents({
      regle: regle({ model: "taux_journalier", tauxJourneeHtCents: 90_000 }),
      heuresAnimees: 3.5,
      heuresParJour: 7,
      caBaseCents: 0,
    });
    expect(m).toBe(45_000);
  });

  it("taux_journalier : heuresParJour ≤ 0 → 0 (garde-fou division par zéro)", () => {
    const m = calculerMontantCents({
      regle: regle({ model: "taux_journalier", tauxJourneeHtCents: 90_000 }),
      heuresAnimees: 7,
      heuresParJour: 0,
      caBaseCents: 0,
    });
    expect(m).toBe(0);
  });

  it("taux_horaire : 120 €/h × 10,5 h = 1 260 €", () => {
    const m = calculerMontantCents({
      regle: regle({ model: "taux_horaire", tauxHoraireHtCents: 12_000 }),
      heuresAnimees: 10.5,
      heuresParJour: 7,
      caBaseCents: 0,
    });
    expect(m).toBe(126_000);
  });

  it("commission_ca_pct : 30 % de 10 000 € = 3 000 €", () => {
    const m = calculerMontantCents({
      regle: regle({ model: "commission_ca_pct", commissionPct: 30 }),
      heuresAnimees: 0,
      heuresParJour: 7,
      caBaseCents: 1_000_000,
    });
    expect(m).toBe(300_000);
  });

  it("commission_ca_pct : arrondi au centime (33,33 % de 1 000,01 €)", () => {
    const m = calculerMontantCents({
      regle: regle({ model: "commission_ca_pct", commissionPct: 33.33 }),
      heuresAnimees: 0,
      heuresParJour: 7,
      caBaseCents: 100_001,
    });
    // 100001 * 33.33 / 100 = 33330.3333 → 33330
    expect(m).toBe(33_330);
  });

  it("forfait_prestation : montant fixe de la règle", () => {
    const m = calculerMontantCents({
      regle: regle({ model: "forfait_prestation", forfaitHtCents: 250_000 }),
      heuresAnimees: 99,
      heuresParJour: 7,
      caBaseCents: 0,
    });
    expect(m).toBe(250_000);
  });

  it("forfait_prestation : le forfait négocié prime sur celui de la règle", () => {
    const m = calculerMontantCents({
      regle: regle({ model: "forfait_prestation", forfaitHtCents: 250_000 }),
      heuresAnimees: 0,
      heuresParJour: 7,
      caBaseCents: 0,
      forfait: 300_000,
    });
    expect(m).toBe(300_000);
  });

  it("taux manquant → 0 (montant jamais inventé)", () => {
    // Modèle horaire mais aucun tauxHoraireHtCents renseigné sur la règle.
    const m = calculerMontantCents({
      regle: regle({ model: "taux_horaire" }),
      heuresAnimees: 10,
      heuresParJour: 7,
      caBaseCents: 0,
    });
    expect(m).toBe(0);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * repartirCa — co-animation
 * ────────────────────────────────────────────────────────────────────────────── */

describe("repartirCa", () => {
  it("un seul formateur reçoit tout le CA", () => {
    const parts = repartirCa(1_000_000, [{ trainerId: "t1", heuresAnimees: 7 }]);
    expect(parts).toEqual([{ trainerId: "t1", montantCents: 1_000_000 }]);
  });

  it("prorata des heures animées (7 h / 7 h)", () => {
    const parts = repartirCa(1_000_000, [
      { trainerId: "t1", heuresAnimees: 7 },
      { trainerId: "t2", heuresAnimees: 7 },
    ]);
    expect(parts).toEqual([
      { trainerId: "t1", montantCents: 500_000 },
      { trainerId: "t2", montantCents: 500_000 },
    ]);
  });

  it("prorata inégal (10 h / 5 h) sur 15 h", () => {
    const parts = repartirCa(900_000, [
      { trainerId: "t1", heuresAnimees: 10 },
      { trainerId: "t2", heuresAnimees: 5 },
    ]);
    expect(parts).toEqual([
      { trainerId: "t1", montantCents: 600_000 },
      { trainerId: "t2", montantCents: 300_000 },
    ]);
  });

  it("quotePartPct explicite prioritaire (60 / 40)", () => {
    const parts = repartirCa(1_000_000, [
      { trainerId: "t1", heuresAnimees: 1, quotePartPct: 60 },
      { trainerId: "t2", heuresAnimees: 99, quotePartPct: 40 },
    ]);
    expect(parts).toEqual([
      { trainerId: "t1", montantCents: 600_000 },
      { trainerId: "t2", montantCents: 400_000 },
    ]);
  });

  it("quotePartPct dont la somme ≠ 100 est normalisée sur la somme réelle", () => {
    // 30 + 30 = 60 → chacun 50 % du total
    const parts = repartirCa(1_000_000, [
      { trainerId: "t1", quotePartPct: 30 },
      { trainerId: "t2", quotePartPct: 30 },
    ]);
    expect(parts).toEqual([
      { trainerId: "t1", montantCents: 500_000 },
      { trainerId: "t2", montantCents: 500_000 },
    ]);
  });

  it("INVARIANT : aucun centime perdu, le reliquat va au premier", () => {
    // 100 centimes sur 3 → 34 / 33 / 33 (reliquat +1 au premier)
    const parts = repartirCa(100, [
      { trainerId: "t1", heuresAnimees: 1 },
      { trainerId: "t2", heuresAnimees: 1 },
      { trainerId: "t3", heuresAnimees: 1 },
    ]);
    expect(parts.map((p) => p.montantCents)).toEqual([34, 33, 33]);
    expect(parts.reduce((s, p) => s + p.montantCents, 0)).toBe(100);
  });

  it("INVARIANT : somme des parts == total, pour un cas non trivial", () => {
    const total = 1_234_567;
    const parts = repartirCa(total, [
      { trainerId: "t1", heuresAnimees: 3 },
      { trainerId: "t2", heuresAnimees: 5 },
      { trainerId: "t3", heuresAnimees: 7 },
    ]);
    expect(parts.reduce((s, p) => s + p.montantCents, 0)).toBe(total);
  });

  it("0 heure partout → répartition ÉGALE (faute de mieux)", () => {
    const parts = repartirCa(900_000, [
      { trainerId: "t1", heuresAnimees: 0 },
      { trainerId: "t2", heuresAnimees: 0 },
      { trainerId: "t3", heuresAnimees: 0 },
    ]);
    expect(parts.map((p) => p.montantCents)).toEqual([300_000, 300_000, 300_000]);
  });

  it("aucune heure renseignée (undefined partout) → répartition égale", () => {
    const parts = repartirCa(100, [{ trainerId: "t1" }, { trainerId: "t2" }]);
    expect(parts).toEqual([
      { trainerId: "t1", montantCents: 50 },
      { trainerId: "t2", montantCents: 50 },
    ]);
  });

  it("liste vide → aucune part", () => {
    expect(repartirCa(1000, [])).toEqual([]);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * calculerTva — les 3 régimes
 * ────────────────────────────────────────────────────────────────────────────── */

describe("calculerTva", () => {
  it("franchise_293b → 0 %, mention art. 293 B", () => {
    const r = calculerTva(180_000, "franchise_293b");
    expect(r.tvaCents).toBe(0);
    expect(r.totalTtcCents).toBe(180_000);
    expect(r.mention).toBe("TVA non applicable, article 293 B du Code Général des Impôts.");
  });

  it("exonere_formation → 0 %, mention art. 261-4-4°a (base légale DIFFÉRENTE)", () => {
    const r = calculerTva(180_000, "exonere_formation");
    expect(r.tvaCents).toBe(0);
    expect(r.totalTtcCents).toBe(180_000);
    expect(r.mention).toContain("261-4-4°a");
    // Ne doit PAS être confondu avec la franchise.
    expect(r.mention).not.toContain("293 B");
  });

  it("assujetti_20 → 20 %, sans mention d'exonération", () => {
    const r = calculerTva(180_000, "assujetti_20");
    expect(r.tvaCents).toBe(36_000);
    expect(r.totalTtcCents).toBe(216_000);
    expect(r.mention).toBe("");
  });

  it("assujetti_20 : arrondi de la TVA au centime", () => {
    // 20 % de 100,01 € = 20,002 € → 2000 centimes
    const r = calculerTva(10_001, "assujetti_20");
    expect(r.tvaCents).toBe(2_000);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * calculerLigne — ligne complète + snapshot
 * ────────────────────────────────────────────────────────────────────────────── */

describe("calculerLigne — nature & TVA", () => {
  it("salarié → nature analytique, aucune TVA (pas de facture)", () => {
    const ligne = calculerLigne({
      trainerId: "t1",
      statutFormateur: "salarie",
      regle: regle({ model: "taux_journalier", tauxJourneeHtCents: 90_000 }),
      tarifJourneeHtCentsFallback: null,
      statutPrestation: "realisee",
      heuresAnimees: 14,
      heuresParJour: 7,
      caBaseCents: 0,
      regimeTva: "assujetti_20", // ignoré : ligne analytique
    });
    expect(ligne.nature).toBe("analytique");
    expect(ligne.montantHtCents).toBe(180_000);
    expect(ligne.tvaCents).toBe(0);
    expect(ligne.totalTtcCents).toBe(180_000);
    expect(ligne.mentionTva).toBe("");
  });

  it("indépendant → nature honoraire_du, TVA selon régime formateur", () => {
    const ligne = calculerLigne({
      trainerId: "t1",
      statutFormateur: "sous_traitant",
      regle: regle({ model: "taux_journalier", tauxJourneeHtCents: 90_000 }),
      tarifJourneeHtCentsFallback: null,
      statutPrestation: "realisee",
      heuresAnimees: 14,
      heuresParJour: 7,
      caBaseCents: 0,
      regimeTva: "assujetti_20",
    });
    expect(ligne.nature).toBe("honoraire_du");
    expect(ligne.montantHtCents).toBe(180_000);
    expect(ligne.tvaCents).toBe(36_000);
    expect(ligne.totalTtcCents).toBe(216_000);
  });

  it("indépendant en franchise → honoraire_du à 0 % avec mention 293 B", () => {
    const ligne = calculerLigne({
      trainerId: "t1",
      statutFormateur: "sous_traitant",
      regle: regle({ model: "forfait_prestation", forfaitHtCents: 250_000 }),
      tarifJourneeHtCentsFallback: null,
      statutPrestation: "realisee",
      heuresAnimees: 0,
      caBaseCents: 0,
      regimeTva: "franchise_293b",
    });
    expect(ligne.tvaCents).toBe(0);
    expect(ligne.mentionTva).toContain("293 B");
  });
});

describe("calculerLigne — annulation / report", () => {
  it("prestation annulée → montant 0 (rien animé), snapshot conservé", () => {
    const ligne = calculerLigne({
      trainerId: "t1",
      statutFormateur: "sous_traitant",
      regle: regle({ model: "taux_journalier", tauxJourneeHtCents: 90_000 }),
      tarifJourneeHtCentsFallback: null,
      statutPrestation: "annulee",
      heuresAnimees: 14,
      heuresParJour: 7,
      caBaseCents: 0,
      regimeTva: "assujetti_20",
    });
    expect(ligne.montantHtCents).toBe(0);
    expect(ligne.tvaCents).toBe(0);
    expect(ligne.totalTtcCents).toBe(0);
    // Le barème qui se serait appliqué reste tracé.
    expect(ligne.regleSnapshot?.model).toBe("taux_journalier");
    expect(ligne.regleSnapshot?.tauxJourneeHtCents).toBe(90_000);
  });

  it("prestation reportée → montant 0", () => {
    const ligne = calculerLigne({
      trainerId: "t1",
      statutFormateur: "sous_traitant",
      regle: regle(),
      tarifJourneeHtCentsFallback: null,
      statutPrestation: "reportee",
      heuresAnimees: 14,
      heuresParJour: 7,
      caBaseCents: 0,
      regimeTva: "assujetti_20",
    });
    expect(ligne.montantHtCents).toBe(0);
  });
});

describe("calculerLigne — fallback legacy tarifJournee", () => {
  it("aucune règle mais tarif journée legacy → taux_journalier synthétique", () => {
    const ligne = calculerLigne({
      trainerId: "t1",
      statutFormateur: "sous_traitant",
      regle: null,
      tarifJourneeHtCentsFallback: 80_000, // 800 €/j
      statutPrestation: "realisee",
      heuresAnimees: 7,
      heuresParJour: 7,
      caBaseCents: 0,
      regimeTva: "franchise_293b",
    });
    expect(ligne.montantHtCents).toBe(80_000);
    expect(ligne.regleSnapshot?.model).toBe("taux_journalier");
    expect(ligne.regleSnapshot?.tauxJourneeHtCents).toBe(80_000);
  });

  it("aucune règle et aucun fallback → montant 0, snapshot null", () => {
    const ligne = calculerLigne({
      trainerId: "t1",
      statutFormateur: "sous_traitant",
      regle: null,
      tarifJourneeHtCentsFallback: null,
      statutPrestation: "realisee",
      heuresAnimees: 7,
      caBaseCents: 0,
      regimeTva: "assujetti_20",
    });
    expect(ligne.montantHtCents).toBe(0);
    expect(ligne.regleSnapshot).toBeNull();
  });

  it("heuresParJour par défaut = HEURES_PAR_JOUR_DEFAUT si non fourni", () => {
    const ligne = calculerLigne({
      trainerId: "t1",
      statutFormateur: "sous_traitant",
      regle: regle({ model: "taux_journalier", tauxJourneeHtCents: 70_000 }),
      tarifJourneeHtCentsFallback: null,
      statutPrestation: "realisee",
      heuresAnimees: HEURES_PAR_JOUR_DEFAUT, // 1 journée pile
      caBaseCents: 0,
      regimeTva: "franchise_293b",
    });
    expect(ligne.montantHtCents).toBe(70_000);
  });
});

describe("calculerLigne — snapshot ne copie que le taux du modèle", () => {
  it("chaque modèle ne fige que son taux pertinent", () => {
    const cas: Array<
      [
        CompensationModel,
        Partial<RegleRemuneration>,
        keyof NonNullable<ReturnType<typeof calculerLigne>["regleSnapshot"]>,
      ]
    > = [
      ["taux_journalier", { tauxJourneeHtCents: 90_000 }, "tauxJourneeHtCents"],
      ["taux_horaire", { tauxHoraireHtCents: 12_000 }, "tauxHoraireHtCents"],
      ["commission_ca_pct", { commissionPct: 25 }, "commissionPct"],
      ["forfait_prestation", { forfaitHtCents: 250_000 }, "forfaitHtCents"],
    ];
    for (const [model, taux, champ] of cas) {
      const ligne = calculerLigne({
        trainerId: "t1",
        statutFormateur: "sous_traitant",
        regle: regle({ model, ...taux }),
        tarifJourneeHtCentsFallback: null,
        statutPrestation: "realisee",
        heuresAnimees: 7,
        heuresParJour: 7,
        caBaseCents: 1_000_000,
        regimeTva: "franchise_293b",
      });
      expect(ligne.regleSnapshot?.model).toBe(model);
      expect(ligne.regleSnapshot?.[champ]).toBeDefined();
    }
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Scénario intégré : co-animation, chaque formateur son propre modèle
 * ────────────────────────────────────────────────────────────────────────────── */

describe("scénario intégré — co-animation à modèles distincts", () => {
  it("principal au journalier, co-animateur à l'horaire, sur un CA réparti", () => {
    const caTotal = 3_000_000; // 30 000 € HT
    const parts = repartirCa(caTotal, [
      { trainerId: "principal", heuresAnimees: 14 },
      { trainerId: "co", heuresAnimees: 7 },
    ]);
    // 14/21 et 7/21 → 2 000 000 / 1 000 000
    expect(parts).toEqual([
      { trainerId: "principal", montantCents: 2_000_000 },
      { trainerId: "co", montantCents: 1_000_000 },
    ]);

    const lignePrincipal = calculerLigne({
      trainerId: "principal",
      statutFormateur: "sous_traitant",
      regle: regle({ model: "taux_journalier", tauxJourneeHtCents: 90_000 }),
      tarifJourneeHtCentsFallback: null,
      statutPrestation: "realisee",
      heuresAnimees: 14,
      heuresParJour: 7,
      caBaseCents: parts[0]!.montantCents,
      regimeTva: "assujetti_20",
    });
    expect(lignePrincipal.montantHtCents).toBe(180_000); // 2 j × 900 €

    const ligneCo = calculerLigne({
      trainerId: "co",
      statutFormateur: "salarie", // co-animateur salarié → analytique
      regle: regle({ model: "taux_horaire", tauxHoraireHtCents: 10_000 }),
      tarifJourneeHtCentsFallback: null,
      statutPrestation: "realisee",
      heuresAnimees: 7,
      heuresParJour: 7,
      caBaseCents: parts[1]!.montantCents,
      regimeTva: "assujetti_20",
    });
    expect(ligneCo.montantHtCents).toBe(70_000); // 7 h × 100 €
    expect(ligneCo.nature).toBe("analytique");
    expect(ligneCo.tvaCents).toBe(0); // analytique : pas de TVA
  });
});
