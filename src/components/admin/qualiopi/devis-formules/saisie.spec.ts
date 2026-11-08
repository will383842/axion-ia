import { describe, expect, it } from "vitest";

import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import {
  construireOffre,
  eurosVersCents,
  indemniteSortieAffichee,
  offreVersSaisie,
  saisieVide,
  type SaisieFormules,
} from "./saisie";

/** Saisie FICTIVE (montants inventés pour le test). */
function saisieValide(): SaisieFormules {
  const s = saisieVide(20);
  return {
    ...s,
    formules: { achat: true, abonnement: true },
    achat: {
      ...s.achat,
      lignes: [{ libelle: "Mise en place", quantite: "1", prixEur: "1000", tauxTvaPct: "20" }],
      maintenance: { ...s.achat.maintenance, mensuelEur: "40", periodes: [1, 12] },
    },
    abonnement: {
      ...s.abonnement,
      lignes: [{ libelle: "Mise en service", quantite: "1", prixEur: "300", tauxTvaPct: "20" }],
      mensuelCatalogueEur: "90",
      periodes: [{ mois: 1, remisePct: "0" }],
      engagementMois: 12,
      indemniteTauxPct: "50",
    },
  };
}

describe("eurosVersCents", () => {
  it("virgule ou point, 2 décimales au plus", () => {
    expect(eurosVersCents("12,5")).toBe(1250);
    expect(eurosVersCents("12.50")).toBe(1250);
    expect(eurosVersCents("0")).toBe(0);
    expect(eurosVersCents("1000")).toBe(100000);
  });
  it("refuse vide, négatif, trois décimales, texte", () => {
    for (const v of ["", "-1", "1,234", "abc", "1e3", " "]) expect(eurosVersCents(v)).toBeNull();
  });
});

describe("construireOffre", () => {
  it("construit une offre valide à deux formules", () => {
    const r = construireOffre(saisieValide(), []);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.offre.formulesProposees).toEqual(["achat", "abonnement"]);
      expect(r.offre.achat?.lignes[0]?.prixHtCents).toBe(100000);
      expect(r.offre.abonnement?.indemniteSortieTauxBps).toBe(5000);
      expect(r.offre.garantie.jours).toBe(30);
    }
  });
  it("aucune formule cochée : refus", () => {
    const s = { ...saisieValide(), formules: { achat: false, abonnement: false } };
    expect(construireOffre(s, []).ok).toBe(false);
  });
  it("ne garde que les blocs des formules cochées", () => {
    const s = { ...saisieValide(), formules: { achat: true, abonnement: false } };
    const r = construireOffre(s, []);
    expect(r.ok && r.offre.abonnement).toBeFalsy();
  });
  it("prix illisible : refus avec message, jamais 0 silencieux", () => {
    const s = saisieValide();
    s.achat.lignes[0]!.prixEur = "dix";
    const r = construireOffre(s, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join(" ")).toMatch(/prix/i);
  });
  it("engagement incompatible avec une période : refus (règle du modèle)", () => {
    const s = saisieValide();
    s.abonnement.engagementMois = 6;
    s.abonnement.periodes = [{ mois: 12, remisePct: "0" }];
    expect(construireOffre(s, []).ok).toBe(false);
  });
  it("copie les textes actifs de la bibliothèque", () => {
    const r = construireOffre(saisieValide(), [
      { bibliothequeId: "b1", version: "2", texte: "Texte", actif: true },
    ]);
    expect(r.ok && r.offre.textes).toHaveLength(1);
  });
});

describe("indemniteSortieAffichee", () => {
  it("taux × mensualités restantes au maximum (engagement entier, mensuel le plus haut)", () => {
    // 90 € × 12 mois × 50 % = 540 €
    expect(indemniteSortieAffichee(saisieValide())).toBe(54000);
  });
  it("la remise la plus faible donne le mensuel net le plus haut", () => {
    const s = saisieValide();
    s.abonnement.periodes = [
      { mois: 1, remisePct: "10" },
      { mois: 12, remisePct: "20" },
    ];
    // 90 € −10 % = 81 € ; × 12 × 50 % = 486 €
    expect(indemniteSortieAffichee(s)).toBe(48600);
  });
  it("sans engagement ou sans abonnement : rien à afficher", () => {
    const s = saisieValide();
    s.abonnement.engagementMois = 0;
    expect(indemniteSortieAffichee(s)).toBeNull();
    const t = { ...saisieValide(), formules: { achat: true, abonnement: false } };
    expect(indemniteSortieAffichee(t)).toBeNull();
  });
  it("saisie illisible : null, pas d'exception", () => {
    const s = saisieValide();
    s.abonnement.mensuelCatalogueEur = "x";
    expect(indemniteSortieAffichee(s)).toBeNull();
  });
});

describe("offreVersSaisie", () => {
  it("aller-retour : saisie → offre → saisie → offre identique", () => {
    const r1 = construireOffre(saisieValide(), []);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = construireOffre(offreVersSaisie(r1.offre), []);
    expect(r2.ok && r2.offre).toEqual(r1.offre);
  });
  it("une seule formule : l'autre bloc reste vide mais la saisie se relit", () => {
    const s = { ...saisieValide(), formules: { achat: true, abonnement: false } };
    const r1 = construireOffre(s, []);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const relue = offreVersSaisie(r1.offre);
    expect(relue.formules).toEqual({ achat: true, abonnement: false });
  });
});

describe("relecture d'une offre enregistrée : rien de ce que l'écran ne saisit n'est effacé", () => {
  it("automatisations, services tiers, plafond, mode d'avance, délais et dates survivent", () => {
    const o = offreFictive();
    o.servicesTiers = [
      { nom: "Hébergeur tiers", obligatoire: true, estimationHtCents: 1200, rythme: "mensuel" },
    ];
    o.plafondAConfirmer = { montantHtCents: 50000, texte: "À confirmer" };
    o.abonnement!.modeAvance = "toutes_periodes";
    o.achat!.phases = [
      {
        rang: 1,
        libelle: "Solde",
        pourcentage: 100,
        declencheur: "livraison",
        delaiJours: 15,
        dateEstimee: "2026-12-01",
      },
    ];
    const r = construireOffre(offreVersSaisie(o), []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.offre.automatisations).toEqual(o.automatisations);
    expect(r.offre.servicesTiers).toEqual(o.servicesTiers);
    expect(r.offre.plafondAConfirmer).toEqual(o.plafondAConfirmer);
    expect(r.offre.abonnement?.modeAvance).toBe("toutes_periodes");
    expect(r.offre.achat?.phases[0]).toMatchObject({ delaiJours: 15, dateEstimee: "2026-12-01" });
  });
  it("saisie neuve : valeurs vides, mode d'avance au défaut du schéma", () => {
    const r = construireOffre(saisieValide(), []);
    expect(r.ok && r.offre.automatisations).toEqual([]);
    expect(r.ok && r.offre.servicesTiers).toEqual([]);
    expect(r.ok && r.offre.plafondAConfirmer).toBeNull();
    expect(r.ok && r.offre.abonnement?.modeAvance).toBe("premiere_periode_seulement");
  });
});

describe("échéancier par défaut : acompte 30 % à la signature, solde 70 % à la livraison", () => {
  const attendu = [
    { libelle: "Acompte", pourcentage: "30", declencheur: "signature" },
    { libelle: "Solde", pourcentage: "70", declencheur: "livraison" },
  ];

  it("le défaut de l'achat et celui de l'abonnement sont identiques", () => {
    const s = saisieVide(20);
    expect(s.achat.phases).toEqual(attendu);
    expect(s.abonnement.phases).toEqual(attendu);
  });

  it("deux appels ne partagent pas les mêmes objets (pas de mutation croisée)", () => {
    const s = saisieVide(20);
    expect(s.achat.phases[0]).not.toBe(s.abonnement.phases[0]);
  });

  it("construireOffre accepte ce défaut : rang 1 = 30 % signature, rang 2 = 70 % livraison", () => {
    const r = construireOffre(saisieValide(), []);
    if (!r.ok) throw new Error(JSON.stringify(r));
    for (const f of [r.offre.achat, r.offre.abonnement]) {
      expect(f?.phases).toHaveLength(2);
      expect(f?.phases[0]).toMatchObject({ rang: 1, pourcentage: 30, declencheur: "signature" });
      expect(f?.phases[1]).toMatchObject({ rang: 2, pourcentage: 70, declencheur: "livraison" });
    }
  });
});
