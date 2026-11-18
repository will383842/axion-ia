import { describe, expect, it } from "vitest";

import { choixCanonique, prixMensuelNet, sha256Offre } from "./offre-calculs";
import { offreFictive } from "./offre-fixtures.spec-util";
import { presenterOffre, recapitulerChoix } from "./choix-affichage";

const eurRe = (n: number) => new RegExp(`^${(n / 100).toFixed(2).replace(".", ",")}`);

describe("presenterOffre", () => {
  it("nomme les formules comme le client les lit : « Formule A · Achat », « Formule B · Mise en place + abonnement »", () => {
    const p = presenterOffre(offreFictive());
    expect(p.formules.map((f) => f.libelle)).toEqual([
      "Formule A · Achat",
      "Formule B · Mise en place + abonnement",
    ]);
  });

  it("ne présente que les formules proposées", () => {
    const o = offreFictive();
    o.formulesProposees = ["abonnement"];
    delete o.achat;
    expect(presenterOffre(o).formules.map((f) => f.formule)).toEqual(["abonnement"]);
  });

  it("montants formatés côté serveur, TVA toujours incluse dans le TTC", () => {
    const p = presenterOffre(offreFictive());
    const b = p.formules.find((f) => f.formule === "abonnement")!;
    // 30 000 centimes HT de mise en service (aucune automatisation obligatoire).
    expect(b.baseHtLisible.replace(/\s| | /g, "")).toMatch(/^300,00€/);
    expect(b.baseTtcLisible).not.toBe(b.baseHtLisible);
    expect(b.abonnement?.mensuelLisible.replace(/\s| | /g, "")).toMatch(/^90,00€/);
  });

  it("maintenance : règle, mensuel et durées proposées (formule A)", () => {
    const a = presenterOffre(offreFictive()).formules.find((f) => f.formule === "achat")!;
    expect(a.maintenance?.regle).toBe("facultative");
    expect(a.maintenance?.periodes.map((x) => x.mois)).toEqual([1, 12]);
    expect(a.abonnement).toBeNull();
  });

  it("les automatisations portent leurs dépendances en libellés lisibles", () => {
    const o = offreFictive();
    o.automatisations.push({
      code: "auto2",
      libelle: "Deux",
      facultative: true,
      dependDe: ["auto1"],
      prixHtCents: 100,
      tauxTvaBps: 2000,
      modeIA: "client_direct",
    });
    const auto2 = presenterOffre(o).automatisations.find((a) => a.code === "auto2")!;
    expect(auto2.dependDeLibelles).toEqual(["Automatisation un"]);
    expect(auto2.dependDe).toEqual(["auto1"]);
  });

  it("🔴 aucun mot « token »/« jeton », aucune unité d'IA, aucun prix fournisseur", () => {
    expect(JSON.stringify(presenterOffre(offreFictive()))).not.toMatch(
      /token|jeton|crédit ia|fournisseur/i,
    );
  });
});

describe("recapitulerChoix", () => {
  const offre = offreFictive();
  offre.abonnement!.periodes = [
    { mois: 1, remiseBps: 0 },
    { mois: 6, remiseBps: 500 },
  ];
  const sha = sha256Offre(offre);

  it("formule B : total ponctuel + abonnement remisé arrondi avant multiplication", () => {
    const choix = choixCanonique({
      devisNumero: "AXI-DEV-2026-001",
      offreSha256: sha,
      formule: "abonnement",
      automatisationsRetenues: ["auto1"],
      maintenanceRetenue: false,
      periodiciteMois: 6,
    });
    const r = recapitulerChoix(offre, choix);
    expect(r.formuleLibelle).toBe("Formule B · Mise en place + abonnement");
    const net = prixMensuelNet(9000, 500);
    expect(r.recurrent[0]).toContain(`${net / 100}`.replace(".", ","));
    expect(r.recurrent[0]).toContain("6 mois");
    expect(r.totalPonctuelHtLisible.replace(/\s| | /g, "")).toMatch(/^350,00€/);
    expect(r.totalPonctuelTtcLisible).not.toBe(r.totalPonctuelHtLisible);
    expect(r.automatisations).toEqual(["Automatisation un"]);
  });

  it("formule A sans maintenance : aucune ligne récurrente", () => {
    const choix = choixCanonique({
      devisNumero: "AXI-DEV-2026-001",
      offreSha256: sha,
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: null,
    });
    const r = recapitulerChoix(offre, choix);
    expect(r.recurrent).toEqual([]);
    expect(r.totalPonctuelHtLisible).toMatch(/^\d/);
    expect(eurRe(0)).toBeTruthy();
  });

  it("formule A avec maintenance : une ligne récurrente", () => {
    const choix = choixCanonique({
      devisNumero: "AXI-DEV-2026-001",
      offreSha256: sha,
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: true,
      periodiciteMois: 12,
    });
    const r = recapitulerChoix(offre, choix);
    expect(r.recurrent).toHaveLength(1);
    expect(r.recurrent[0]).toContain("Maintenance");
    expect(r.recurrent[0]).toContain("12 mois");
  });
});
