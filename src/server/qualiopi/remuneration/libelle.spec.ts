/**
 * Tests — libellé humain d'une règle de rémunération.
 *
 * L'enjeu n'est pas le formatage : c'est qu'une pièce SIGNÉE n'imprime jamais
 * un montant inventé. Un zéro qui ressemble à un tarif convenu, ou un taux
 * absent silencieusement remplacé, sont les deux défauts que ces tests fixent.
 */

import { describe, it, expect } from "vitest";
import type { RegleRemuneration } from "./calcul";
import { libelleRemuneration } from "./libelle";

const BASE: Omit<RegleRemuneration, "model"> = {
  trainerId: "t-1",
  prestationType: "formation_collective",
  interventionSlug: null,
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  effectiveTo: null,
};

describe("libelleRemuneration", () => {
  it("taux journalier", () => {
    const l = libelleRemuneration(
      { ...BASE, model: "taux_journalier", tauxJourneeHtCents: 60000 },
      null,
    );
    expect(l).toContain("600,00");
    expect(l).toContain("jour");
  });

  it("taux horaire", () => {
    const l = libelleRemuneration(
      { ...BASE, model: "taux_horaire", tauxHoraireHtCents: 9000 },
      null,
    );
    expect(l).toContain("90,00");
    expect(l).toContain("heure");
  });

  it("commission sur CA — pourcentage sans zéros parasites", () => {
    const l = libelleRemuneration({ ...BASE, model: "commission_ca_pct", commissionPct: 40 }, null);
    expect(l).toContain("40 %");
    expect(l).toContain("chiffre d'affaires");
  });

  it("forfait", () => {
    const l = libelleRemuneration(
      { ...BASE, model: "forfait_prestation", forfaitHtCents: 150000 },
      null,
    );
    // ⚠️ Pas d'assertion sur le nombre entier : le séparateur de milliers
    // d'Intl fr-FR est une espace fine insécable (U+202F), pas une espace.
    expect(l).toContain("500,00");
    expect(l).toContain("forfaitaire");
  });

  it("sans règle, retombe sur le tarif de la fiche en le disant", () => {
    const l = libelleRemuneration(null, 80000);
    expect(l).toContain("800,00");
    expect(l).toContain("tarif général");
  });

  // 🔴 Le cas qui compte. « 0,00 € / jour » sur une lettre signée se lit comme
  // un tarif convenu — gratuit. Écrire l'absence est rattrapable ; un faux zéro
  // scellé ne l'est pas.
  it("sans règle NI tarif, ÉCRIT l'absence au lieu d'imprimer zéro", () => {
    const l = libelleRemuneration(null, null);
    expect(l).toContain("aucun barème");
    expect(l).not.toContain("0,00");
  });

  it("tarif fiche à zéro = absence, pas un montant", () => {
    const l = libelleRemuneration(null, 0);
    expect(l).toContain("aucun barème");
  });

  // ⚠️ Une règle mal saisie (modèle sans son taux) relève du même traitement :
  // on l'écrit, on n'invente pas.
  it("règle sans le taux de son modèle → repli, jamais un montant inventé", () => {
    const l = libelleRemuneration({ ...BASE, model: "taux_journalier" }, 80000);
    expect(l).toContain("800,00");
    expect(l).toContain("tarif général");
  });
});
