import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Lot « grille » (contrat 2.8), relecture : devis MIXTE (Journée IA + autre prestation), prix de
// référence figé, activité inconnue jamais NaN, lignes récurrentes dans un devis de mise en place.
//
// Art. 4.1 bis : « Lorsque plusieurs prestations sont vendues à un prix global, ce prix est réparti
// entre elles au prorata [...] et, à défaut de prix public pour l'une d'elles, selon la ventilation
// du devis. » La Journée IA garde son forfait (A1.1) calculé sur SES lignes ; les autres lignes gardent
// la commission de leur activité (A1.4 audit 30 %, A1.5 automatisation 15 %, A1.2 formation).

import { commissionPourPrixConserve } from "../ajustement";
import { cibleApresAvoir, cibleEtatFinal } from "../avoir-client";
import { lignesRecurrentesSuspectes, ventilerJourneeIa } from "../commandes";
import {
  calculerCommission,
  commissionMixte,
  lirePalierMixte,
  palierMixte,
  PRIX_REFERENCE_JOURNEE_IA_CENTS,
  type ActiviteCommission,
} from "../regles";

const l = (designation: string, prix: number, quantite = 1) => ({
  designation,
  quantite,
  prixUnitaireHtCents: prix,
});

describe("A1.1 — prix de référence de la Journée IA : figé dans le code (annexe 1)", () => {
  it("vaut 149 000 centimes, littéralement, sans dépendre des prix du site (art. 13.1)", () => {
    expect(PRIX_REFERENCE_JOURNEE_IA_CENTS).toBe(149_000);
    const src = readFileSync(join(__dirname, "..", "regles.ts"), "utf8");
    expect(src).toMatch(/export const PRIX_REFERENCE_JOURNEE_IA_CENTS = 149_000;/);
    // Plus de repli `?? 0` (division par zéro) ni de lecture de pricing.ts pour ce prix.
    expect(src).not.toMatch(/JOURNEE_IA_TIER/);
  });
});

describe("activité inconnue (ancien worker, valeur hors type) : jamais NaN", () => {
  it("à qualifier, jamais un montant non fini", () => {
    for (const a of ["mixte", "inconnue", "", "journee-ia"]) {
      const c = calculerCommission({
        activite: a as ActiviteCommission,
        factureHtCents: 100_000,
      });
      expect(c.statut).toBe("a_qualifier");
    }
    const q = calculerCommission({
      activite: "journee_ia",
      factureHtCents: 149_000,
      quantite: Number.NaN,
    });
    expect(q).toMatchObject({ statut: "calculee", montantCents: 50_000 });
  });
});

describe("ventilation d'une commande portant une Journée IA (lignes des factures)", () => {
  it("Journée IA 1 490 + audit 2 900 : 1 490 € de Journée IA, 2 900 € d'autre", () => {
    expect(
      ventilerJourneeIa({
        lignes: [[l("Journée IA", 149_000), l("Audit IA approfondi", 290_000)]],
        baseSignatureCents: 439_000,
      }),
    ).toEqual({ journeeIaHtCents: 149_000, autreHtCents: 290_000, journees: 1 });
  });

  it("acompte + solde : la ligne d'acompte et sa déduction ne comptent pas", () => {
    expect(
      ventilerJourneeIa({
        lignes: [
          [l("Acompte de 30 % — devis D-1", 131_700)],
          [
            l("Journée IA", 149_000),
            l("Automatisation des devis", 600_000),
            l("Acompte déjà facturé — facture F-1", -131_700),
          ],
        ],
        baseSignatureCents: 749_000,
      }),
    ).toEqual({ journeeIaHtCents: 149_000, autreHtCents: 600_000, journees: 1 });
  });

  it("deux journées : quantité 2", () => {
    expect(
      ventilerJourneeIa({ lignes: [[l("Journée IA", 149_000, 2)]], baseSignatureCents: 298_000 }),
    ).toEqual({ journeeIaHtCents: 298_000, autreHtCents: 0, journees: 2 });
  });

  it("remise globale négative sur une commande mixte : incertaine (rien n'est deviné)", () => {
    const v = ventilerJourneeIa({
      lignes: [[l("Journée IA", 149_000), l("Audit", 290_000), l("Remise commerciale", -40_000)]],
      baseSignatureCents: 399_000,
    });
    expect(v).toHaveProperty("incertaine");
  });

  it("lignes qui ne retombent pas sur le total du devis : incertaine", () => {
    const v = ventilerJourneeIa({
      lignes: [[l("Journée IA", 149_000), l("Audit", 290_000)]],
      baseSignatureCents: 500_000,
    });
    expect(v).toHaveProperty("incertaine");
  });

  it("ligne illisible sur une commande mixte : incertaine", () => {
    const v = ventilerJourneeIa({
      lignes: [[l("Journée IA", 149_000), { designation: "Audit", quantite: 1 }]],
      baseSignatureCents: 149_000,
    });
    expect(v).toHaveProperty("incertaine");
  });
});

describe("commission d'une commande mixte (art. 4.1 bis + A1.1, A1.4, A1.5, A1.2)", () => {
  it("Journée IA 1 490 + audit 2 900 → 500 + 870 = 1 370 €", () => {
    const p = {
      journees: 1,
      journeeIaHtCents: 149_000,
      autre: "audit",
      sessions: 1,
      autreHtCents: 290_000,
    };
    expect(commissionMixte(p, 439_000)).toMatchObject({
      statut: "calculee",
      montantCents: 137_000,
      prixPublicCents: 149_000,
    });
  });

  it("Journée IA 1 490 + automatisation 6 000 → 500 + 900 = 1 400 €", () => {
    const p = {
      journees: 1,
      journeeIaHtCents: 149_000,
      autre: "implementation",
      sessions: 1,
      autreHtCents: 600_000,
    };
    expect(commissionMixte(p, 749_000)).toMatchObject({ montantCents: 140_000 });
  });

  it("Journée IA 1 000 + formation 1 900 : 335,57 € + forfait de la formation (palier choisi)", () => {
    const aQualifier = {
      journees: 1,
      journeeIaHtCents: 100_000,
      autre: "formation",
      sessions: 1,
      autreHtCents: 190_000,
    };
    // Palier de formation pas encore choisi : rien n'est deviné.
    expect(commissionMixte(aQualifier, 290_000).statut).toBe("a_qualifier");
    const qualifiee = { ...aQualifier, autre: "formation-generale-1j" };
    expect(commissionMixte(qualifiee, 290_000)).toMatchObject({
      montantCents: 33_557 + 50_000,
      prixPublicCents: 149_000 + 190_000,
    });
  });

  it("Journée IA + coaching (A1.3) : seule la Journée IA rapporte", () => {
    const p = {
      journees: 1,
      journeeIaHtCents: 149_000,
      autre: "un_a_un",
      sessions: 1,
      autreHtCents: 100_000,
    };
    expect(commissionMixte(p, 249_000)).toMatchObject({ montantCents: 50_000 });
  });

  it("avoir de moitié : chaque part est réduite dans la même proportion (art. 4.5)", () => {
    const p = {
      journees: 1,
      journeeIaHtCents: 149_000,
      autre: "audit",
      sessions: 1,
      autreHtCents: 290_000,
    };
    expect(commissionMixte(p, 219_500)).toMatchObject({ montantCents: 25_000 + 43_500 });
    expect(commissionMixte(p, 0)).toMatchObject({ montantCents: 0 });
  });

  it("le palier encode les parts et se relit à l'identique (≤ 60 caractères)", () => {
    const p = {
      journees: 12,
      journeeIaHtCents: 1_788_000,
      autre: "formation-secteur-2j",
      sessions: 3,
      autreHtCents: 1_170_000,
    };
    const s = palierMixte(p);
    expect(s.length).toBeLessThanOrEqual(60);
    expect(lirePalierMixte(s)).toEqual(p);
    expect(lirePalierMixte("journee-ia")).toBeNull();
    expect(lirePalierMixte("mixte:abc")).toBeNull();
    expect(lirePalierMixte(null)).toBeNull();
  });
});

describe("une ligne mixte suit les avoirs par la même règle (réduction, état final, reprise)", () => {
  const ligne = {
    activite: "journee_ia",
    palier: palierMixte({
      journees: 1,
      journeeIaHtCents: 149_000,
      autre: "audit",
      sessions: 1,
      autreHtCents: 290_000,
    }),
    prixPublicHtCents: 149_000,
    factureHtCents: 439_000,
    montantCents: 137_000,
  };
  it("prix conservé réduit : recalcul sur les deux parts", () => {
    expect(commissionPourPrixConserve(ligne, 219_500, 137_000)).toBe(68_500);
  });
  it("cible après avoir et état final : même montant, jamais au-delà de la ligne", () => {
    expect(cibleApresAvoir(ligne, 219_500)).toBe(68_500);
    expect(cibleEtatFinal(ligne, 219_500, 439_000)).toBe(68_500);
    expect(cibleEtatFinal(ligne, 439_000, 439_000)).toBe(137_000);
  });
});

describe("A1.6 — hébergement, maintenance, licence, abonnement dans un devis de mise en place", () => {
  it("repère les lignes positives qui y ressemblent, jamais une déduction", () => {
    expect(
      lignesRecurrentesSuspectes([
        [
          l("Site vitrine 5 pages", 300_000),
          l("Hébergement 12 mois", 24_000),
          l("Maintenance annuelle", 60_000),
          l("Licence Make", 12_000),
          l("Abonnement outil", 9_000),
          l("Acompte déjà facturé — facture F-1", -90_000),
        ],
      ]),
    ).toEqual(["Hébergement 12 mois", "Maintenance annuelle", "Licence Make", "Abonnement outil"]);
    expect(lignesRecurrentesSuspectes([[l("Développement sur mesure", 500_000)]])).toEqual([]);
  });
});

describe("autofacture d'une commande mixte (art. 4.1 bis : prix public, prix facturé, commission)", () => {
  it("la désignation détaille la Journée IA et l'autre partie, jamais le palier brut", async () => {
    const { designationCommission } = await import("../autofacture-donnees");
    const d = designationCommission({
      id: "C1",
      activite: "journee_ia",
      palier: "mixte:1x149000+audit:290000",
      parrainage: false,
      montantCents: 137_000,
      prixPublicHtCents: 149_000,
      factureHtCents: 439_000,
    });
    expect(d).not.toContain("mixte:");
    expect(d).toMatch(/Journée IA/);
    expect(d).toMatch(/prix public 1\s?490,00 € HT/);
    expect(d).toMatch(/audit/);
    expect(d).toMatch(/prix facturé 2\s?900,00 € HT/);
  });
});
