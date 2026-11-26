import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Commande MIXTE (Journée IA + autre prestation), tour de correction 2/2 : la prudence prime. La part
// « autre » ne se calcule automatiquement que si elle est HOMOGÈNE et cohérente avec l'activité de la
// facture ; sinon « à qualifier » + alerte interne unique. Jamais de sur-versement.

import { commissionPourPrixConserve } from "../ajustement";
import { cibleApresAvoir, cibleEtatFinal } from "../avoir-client";
import { designationCommission } from "../autofacture-donnees";
import { commissionJourneeIa } from "../commission-commande-mixte";
import { ventilerJourneeIa } from "../commandes";
import { ciblesMixtesApresAvoir, commissionMixte, lirePalierMixte, palierMixte } from "../regles";

const l = (designation: string, prix: number, quantite = 1) => ({
  designation,
  quantite,
  prixUnitaireHtCents: prix,
});

const mixte = (lignes: ReturnType<typeof l>[], activiteAutre: string | null) => {
  const base = lignes.reduce((s, x) => s + x.prixUnitaireHtCents * x.quantite, 0);
  return commissionJourneeIa({
    lignes: [lignes],
    quantite: 1,
    baseSignatureCents: base,
    baseApresAvoirsCents: base,
    activiteAutre,
  });
};

describe("1 — la part « autre » n'est calculée que si elle est homogène et sûre", () => {
  it("cas sûr : Journée IA + audit 2 900 sur facture audit = 1 370 €", () => {
    const r = mixte([l("Journée IA", 149_000), l("Audit IA approfondi", 290_000)], "audit");
    expect(r.calc).toMatchObject({ statut: "calculee", montantCents: 137_000 });
    expect(r.alerteMixte).toBeNull();
  });

  it("cas sûr : Journée IA + automatisation 6 000 sur facture intégration = 1 400 €", () => {
    const r = mixte(
      [l("Journée IA", 149_000), l("Automatisation des devis", 600_000)],
      "implementation",
    );
    expect(r.calc).toMatchObject({ statut: "calculee", montantCents: 140_000 });
  });

  it("D07 : Journée IA + audit 2 900 + automatisation 6 000 sur facture audit → à qualifier (jamais 3 170 €)", () => {
    const r = mixte(
      [l("Journée IA", 149_000), l("Audit IA", 290_000), l("Automatisation des devis", 600_000)],
      "audit",
    );
    expect(r.calc.statut).toBe("a_qualifier");
    expect(r.alerteMixte).toMatch(/Automatisation des devis/);
  });

  it("M19 : + « Coaching individuel » 1 000 sur facture audit → à qualifier (jamais 1 670 €)", () => {
    const r = mixte(
      [l("Journée IA", 149_000), l("Audit IA", 290_000), l("Coaching individuel", 100_000)],
      "audit",
    );
    expect(r.calc.statut).toBe("a_qualifier");
    expect(r.alerteMixte).toMatch(/Coaching individuel/);
  });

  it("D09 : + « Maintenance annuelle » 1 000 → à qualifier, alerte A1.6 (jamais 800 €)", () => {
    for (const activite of ["audit", "implementation", "site_web", "un_a_un", null]) {
      const r = mixte(
        [l("Journée IA", 149_000), l("Audit IA", 290_000), l("Maintenance annuelle", 100_000)],
        activite,
      );
      expect(r.calc.statut).toBe("a_qualifier");
      expect(r.alerteMixte).toMatch(/A1\.6/);
      expect(r.alerteMixte).toMatch(/Maintenance annuelle/);
    }
  });

  it("une seule ligne d'hébergement ou de licence suffit à rendre la commande « à qualifier »", () => {
    for (const d of ["Hébergement 12 mois", "Licence Make", "Abonnement outil"]) {
      const r = mixte([l("Journée IA", 149_000), l(d, 100_000)], "implementation");
      expect(r.calc.statut).toBe("a_qualifier");
    }
  });

  it("le passage n'envoie plus l'alerte A1.6 « calculée sur tout le HT » sur le chemin Journée IA", () => {
    const src = readFileSync(join(__dirname, "..", "passage-quotidien.ts"), "utf8");
    expect(src).toMatch(/!\(journee && "reconnue" in journee\)/);
  });
});

describe("2 — devis marqué Journée IA sans ligne « Journée IA »", () => {
  it("une seule ligne positive : c'est la Journée IA (jamais 0 €)", () => {
    const v = ventilerJourneeIa({
      lignes: [[l("Atelier IA sur site (1 jour)", 149_000)]],
      baseSignatureCents: 149_000,
    });
    expect(v).toEqual({ journeeIaHtCents: 149_000, autreHtCents: 0, journees: 1 });
    const r = mixte([l("Atelier IA sur site (1 jour)", 149_000)], "audit");
    expect(r.calc).toMatchObject({ statut: "calculee", montantCents: 50_000 });
  });

  it("plusieurs lignes positives, aucune « Journée IA » : à qualifier + alerte", () => {
    const r = mixte([l("Atelier IA sur site (1 jour)", 149_000), l("Audit IA", 290_000)], "audit");
    expect(r.calc.statut).toBe("a_qualifier");
    expect(r.alerteMixte).toMatch(/Journée IA/);
  });

  it("montant nul alors que la commande a été payée : à qualifier + alerte, jamais un abandon muet", () => {
    const r = mixte([l("Journée IA", 149_000), l("Coaching individuel", 100_000)], "un_a_un");
    expect(r.calc.statut).toBe("calculee");
    const z = commissionJourneeIa({
      lignes: [[l("Journée IA", 149_000)]],
      quantite: 1,
      baseSignatureCents: 149_000,
      baseApresAvoirsCents: 1,
      activiteAutre: null,
    });
    expect(z.calc.statut).toBe("a_qualifier");
    expect(z.alerteMixte).not.toBeNull();
  });
});

describe("3 — avoir partiel sur une ligne mixte : jamais de sur-versement", () => {
  const p = {
    journees: 1,
    journeeIaHtCents: 149_000,
    autre: "implementation",
    sessions: 1,
    autreHtCents: 600_000,
  };
  const ligne = {
    activite: "journee_ia",
    palier: palierMixte(p),
    prixPublicHtCents: 149_000,
    factureHtCents: 749_000,
    montantCents: 140_000,
  };

  it("Journée IA 1 490 + automatisation 6 000, avoir 1 490 : cible la plus basse 900 € (pas 1 121,49 €)", () => {
    expect(commissionMixte(p, 600_000)).toMatchObject({ statut: "calculee", montantCents: 90_000 });
    expect(commissionPourPrixConserve(ligne, 600_000)).toBe(90_000);
    expect(cibleApresAvoir(ligne, 600_000)).toBe(90_000);
    expect(cibleEtatFinal(ligne, 600_000, 749_000)).toBe(90_000);
    expect(ciblesMixtesApresAvoir(p, 600_000)).toEqual({ basse: 90_000, haute: 117_650 });
  });

  it("avoir total : 0 ; aucun avoir : commission pleine", () => {
    expect(commissionMixte(p, 0)).toMatchObject({ montantCents: 0 });
    expect(commissionMixte(p, 749_000)).toMatchObject({ montantCents: 140_000 });
  });

  it("le passage des avoirs alerte Williams (une fois) sur un avoir partiel de ligne mixte", () => {
    const src = readFileSync(join(__dirname, "..", "avoir-client.ts"), "utf8");
    expect(src).toMatch(/apporteur_avoir_mixte/);
  });

  it("l'autofacture détaille la ventilation retenue (Journée IA 0 €, automatisation 6 000 €)", () => {
    const d = designationCommission({
      id: "C1",
      activite: "journee_ia",
      palier: palierMixte(p),
      parrainage: false,
      montantCents: 90_000,
      prixPublicHtCents: 149_000,
      factureHtCents: 600_000,
    });
    expect(d).toMatch(/prix facturé 0,00 € HT/);
    expect(d).toMatch(/prix facturé 6\s?000,00 € HT/);
  });
});

describe("4 et 5 — palier à 3 chiffres de journées, un seul arrondi", () => {
  it("100 journées : le palier se relit", () => {
    const q = {
      journees: 100,
      journeeIaHtCents: 14_900_000,
      autre: "audit",
      sessions: 1,
      autreHtCents: 1,
    };
    expect(lirePalierMixte(palierMixte(q))).toEqual(q);
  });

  it("un seul arrondi sur le total (deux arrondis séparés perdraient un centime)", () => {
    // Journée IA : 500 × 1 000,01 / 1 490 = 33 557,38 cts ; audit 30 % de 1 ct = 0,3 ct.
    // Deux arrondis : 33 557 + 0 = 33 557 ; un seul : 33 557,68 → 33 558.
    const r = commissionMixte(
      { journees: 1, journeeIaHtCents: 100_001, autre: "audit", sessions: 1, autreHtCents: 1 },
      100_002,
    );
    expect(r).toMatchObject({ montantCents: 33_558 });
  });
});
