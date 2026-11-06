import { describe, expect, it } from "vitest";

import { offreFictive } from "./offre-fixtures.spec-util";
import { vueFormules } from "./vue-formules";
import type { OffreDevisV1 } from "./offre-devis";

const sansToken = (v: unknown): void => {
  expect(JSON.stringify(v)).not.toMatch(/token|jeton/i);
};

function offreDeuxFormules(): OffreDevisV1 {
  const o = offreFictive();
  // Mono-taux : deux phases autorisées.
  o.achat!.lignes = [{ libelle: "Ligne A", quantite: 1, prixHtCents: 100001, tauxTvaBps: 2000 }];
  o.achat!.phases = [
    { rang: 1, libelle: "Acompte", pourcentage: 30, declencheur: "signature" },
    { rang: 2, libelle: "Solde", pourcentage: 70, declencheur: "livraison" },
  ];
  o.abonnement!.periodes = [
    { mois: 1, remiseBps: 0 },
    { mois: 6, remiseBps: 1000 },
  ];
  return o;
}

describe("vueFormules", () => {
  it("rend A puis B, dans cet ordre, avec leur titre client", () => {
    const v = vueFormules(offreDeuxFormules());
    expect(v.formules.map((f) => f.titre)).toEqual([
      "Formule A · Achat",
      "Formule B · Mise en place + abonnement",
    ]);
  });

  it("une seule formule proposée : une seule colonne", () => {
    const o = offreDeuxFormules();
    o.formulesProposees = ["abonnement"];
    expect(vueFormules(o).formules).toHaveLength(1);
  });

  it("échéancier : somme des paliers = total, le dernier absorbe le reste", () => {
    const f = vueFormules(offreDeuxFormules()).formules[0]!;
    expect(f.totalHtCents).toBe(100001);
    expect(f.phases.map((p) => p.montantHtCents)).toEqual([30000, 70001]);
    expect(f.phases.reduce((s, p) => s + p.montantHtCents, 0)).toBe(f.totalHtCents);
  });

  it("l'automatisation facultative est une option HORS total", () => {
    const f = vueFormules(offreDeuxFormules()).formules[0]!;
    expect(f.options).toHaveLength(1);
    expect(f.lignes.map((l) => l.designation)).not.toContain("Automatisation un");
    expect(f.totalHtCents).toBe(100001);
  });

  it("l'automatisation obligatoire entre dans les lignes et le total", () => {
    const o = offreDeuxFormules();
    o.automatisations[0]!.facultative = false;
    const f = vueFormules(o).formules[0]!;
    expect(f.totalHtCents).toBe(105001);
    expect(f.options).toHaveLength(0);
  });

  it("indemnité de sortie maximale en centimes : taux × engagement × plus haut mensuel net", () => {
    const b = vueFormules(offreDeuxFormules()).formules[1]!;
    // 12 mois × 9000 (1 mois, sans remise : le plus haut) × 50 % = 54 000
    expect(b.abonnement?.indemniteSortieMaxHtCents).toBe(54000);
    expect(b.abonnement?.periodes.map((p) => p.mensuelNetHtCents)).toEqual([9000, 8100]);
    expect(b.abonnement?.periodes.map((p) => p.prixPeriodeHtCents)).toEqual([9000, 48600]);
  });

  it("sans engagement ou à taux 0 : aucune indemnité", () => {
    const o = offreDeuxFormules();
    o.abonnement!.engagementMois = 0;
    expect(vueFormules(o).formules[1]!.abonnement?.indemniteSortieMaxHtCents).toBeNull();
    const o2 = offreDeuxFormules();
    o2.abonnement!.indemniteSortieTauxBps = 0;
    expect(vueFormules(o2).formules[1]!.abonnement?.indemniteSortieMaxHtCents).toBeNull();
  });

  it("porte maintenance, garantie, préavis ; textes inactifs écartés", () => {
    const o = offreDeuxFormules();
    o.textes = [
      { texte: "Avantage retenu", actif: true },
      { texte: "Texte écarté", actif: false },
    ];
    const v = vueFormules(o);
    expect(v.formules[0]!.maintenance).toMatchObject({ obligatoire: false, mensuelHtCents: 4000 });
    expect(v.formules[1]!.abonnement?.preavisMois).toBe(1);
    expect(v.garantieJours).toBe(30);
    expect(v.textes).toEqual(["Avantage retenu"]);
  });

  it("est déterministe et ne contient jamais « token » ni « jeton »", () => {
    const o = offreDeuxFormules();
    expect(vueFormules(o)).toEqual(vueFormules(o));
    sansToken(vueFormules(o));
  });
});
