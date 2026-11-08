import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { payloadVide, type PayloadAssistantV1 } from "../payload";
import {
  saisieFormulesPourOffre,
  validerEtape,
  type ContexteValidation,
} from "../validation-etapes";

const MAINTENANT = new Date("2026-11-08T10:00:00Z");
const CTX: ContexteValidation = {
  formulesActives: true,
  typeClient: "entreprise",
  maintenant: MAINTENANT,
};

/** Lignes L de l'architecte (§4) : 2 400 + 1 800 + 2,3 × 123,45 = 4 483,93 €. */
function base(): PayloadAssistantV1 {
  const p = payloadVide(20);
  p.clientId = "client-1";
  p.activite = "implementation";
  p.lignesClassiques = [
    { designation: "Assistant de réponse", quantite: "1", prixEur: "2 400" },
    { designation: "Relance des factures", quantite: "1", prixEur: "1800,00" },
    { designation: "Formation", quantite: "2,3", prixEur: "123,45" },
  ];
  return p;
}

function formules(modele: "A" | "B" | "AB"): PayloadAssistantV1 {
  const p = base();
  p.typeDevis = "formules";
  p.formules.formules = { achat: modele !== "B", abonnement: modele !== "A" };
  p.formules.achat.maintenance.mensuelEur = "190,00";
  p.formules.abonnement.mensuelCatalogueEur = "199,99";
  p.formules.abonnement.periodes = [
    { mois: 1, remisePct: "0" },
    { mois: 12, remisePct: "5" },
  ];
  p.formules.abonnement.engagementMois = 12;
  p.formules.abonnement.indemniteTauxPct = "50";
  p.formules.abonnement.lignes = [
    { libelle: "Mise en service et adaptation", quantite: "1", prixEur: "1 900", tauxTvaPct: "20" },
  ];
  return p;
}

const champs = (p: PayloadAssistantV1, e: 1 | 2 | 3 | 4, ctx = CTX) =>
  validerEtape(p, e, ctx).erreurs.map((x) => x.champ);

describe("validerEtape — cas valides", () => {
  it("classique, A seule, B seule, A + B passent l'étape 3", () => {
    const c = base();
    c.typeDevis = "classique";
    expect(validerEtape(c, 3, CTX)).toEqual({ ok: true, erreurs: [] });
    for (const m of ["A", "B", "AB"] as const)
      expect(validerEtape(formules(m), 4, CTX), m).toEqual({ ok: true, erreurs: [] });
  });
});

describe("étape 1", () => {
  it("client manquant", () => {
    const p = base();
    p.clientId = null;
    expect(champs(p, 1)).toContain("clientId");
  });
  it("activité manquante", () => {
    const p = base();
    p.activite = null;
    expect(champs(p, 1)).toContain("activite");
  });
  it("total à 0 € refusé (classique)", () => {
    const p = base();
    p.typeDevis = "classique";
    p.lignesClassiques = [{ designation: "x", quantite: "1", prixEur: "0" }];
    expect(champs(p, 1)).toContain("lignesClassiques");
  });
  it("désignation vide et quantité nulle refusées", () => {
    const p = base();
    p.lignesClassiques = [{ designation: " ", quantite: "0", prixEur: "10" }];
    const c = champs(p, 1);
    expect(c).toContain("lignesClassiques.0.designation");
    expect(c).toContain("lignesClassiques.0.quantite");
  });
  it("prix illisible refusé, jamais ramené à 0 (T6)", () => {
    for (const prix of ["2.400", "1 190,505", "-5", "12 €", ""]) {
      const p = base();
      p.lignesClassiques = [{ designation: "x", quantite: "1", prixEur: prix }];
      expect(champs(p, 1), prix).toContain("lignesClassiques.0.prixEur");
    }
  });
  it("espaces, U+00A0 et U+202F acceptés dans le prix (T6)", () => {
    for (const prix of ["2 400", "2 400", "2 400", "1 190,50"]) {
      const p = base();
      p.lignesClassiques = [{ designation: "x", quantite: "1", prixEur: prix }];
      expect(champs(p, 1), prix).toEqual([]);
    }
  });
  it("aucune ligne", () => {
    const p = base();
    p.lignesClassiques = [];
    expect(champs(p, 1)).toContain("lignesClassiques");
  });
});

describe("étape 2", () => {
  it("type de devis manquant", () => {
    expect(champs(base(), 2)).toContain("typeDevis");
  });
  it("formules refusées pour un particulier", () => {
    const e = validerEtape(formules("A"), 2, { ...CTX, typeClient: "particulier" });
    expect(e.ok).toBe(false);
    expect(e.erreurs[0]!.message).toMatch(/particulier/);
  });
  it("formules refusées pour l'activité formation", () => {
    const p = formules("A");
    p.activite = "formation";
    expect(validerEtape(p, 2, CTX).ok).toBe(false);
  });
  it("formules refusées si l'interrupteur est éteint", () => {
    expect(validerEtape(formules("A"), 2, { ...CTX, formulesActives: false }).ok).toBe(false);
  });
  it("aucune formule cochée", () => {
    const p = formules("A");
    p.formules.formules = { achat: false, abonnement: false };
    expect(champs(p, 2)).toContain("formules.formules");
  });
  it("un devis classique n'est pas soumis à l'interrupteur ni à l'activité", () => {
    const p = base();
    p.typeDevis = "classique";
    p.activite = "formation";
    expect(
      validerEtape(p, 2, { ...CTX, formulesActives: false, typeClient: "particulier" }).ok,
    ).toBe(true);
  });
});

describe("étape 3 — formules", () => {
  it("phases ≠ 100 %", () => {
    const p = formules("A");
    p.formules.achat.phases = [
      { libelle: "Acompte", pourcentage: "30", declencheur: "signature" },
      { libelle: "Solde", pourcentage: "60", declencheur: "livraison" },
    ];
    const e = validerEtape(p, 3, CTX);
    expect(e.ok).toBe(false);
    expect(e.erreurs.some((x) => /100/.test(x.message))).toBe(true);
  });
  it("répartition 30/30/40 acceptée", () => {
    const p = formules("A");
    p.formules.achat.phases = [
      { libelle: "Signature", pourcentage: "30", declencheur: "signature" },
      { libelle: "Avancement", pourcentage: "30", declencheur: "avancement" },
      { libelle: "Livraison", pourcentage: "40", declencheur: "livraison" },
    ];
    expect(validerEtape(p, 3, CTX).ok).toBe(true);
  });
  it("maintenance A à 0 € refusée", () => {
    const p = formules("A");
    p.formules.achat.maintenance.mensuelEur = "0";
    expect(champs(p, 3)).toContain("formules.achat.maintenance.mensuelEur");
  });
  it("mensuel B à 0 € refusé", () => {
    const p = formules("B");
    p.formules.abonnement.mensuelCatalogueEur = "0";
    expect(champs(p, 3)).toContain("formules.abonnement.mensuelCatalogueEur");
  });
  it("période de maintenance de 3 mois refusée", () => {
    const p = formules("A");
    p.formules.achat.maintenance.periodes = [3 as never, 12];
    expect(champs(p, 3)).toContain("formules.achat.maintenance.periodes");
  });
  it("période d'abonnement de 3 mois refusée", () => {
    const p = formules("B");
    p.formules.abonnement.periodes = [{ mois: 3 as never, remisePct: "0" }];
    p.formules.abonnement.engagementMois = 12;
    expect(champs(p, 3)).toContain("formules.abonnement.periodes");
  });
  it("indemnité de sortie non saisie refusée", () => {
    const p = formules("B");
    p.formules.abonnement.indemniteTauxPct = "";
    expect(champs(p, 3)).toContain("formules.abonnement.indemniteTauxPct");
  });
  it("engagement non multiple des périodes : message du moteur repris", () => {
    const p = formules("B");
    p.formules.abonnement.engagementMois = 3;
    const e = validerEtape(p, 3, CTX);
    expect(e.erreurs.some((x) => /multiple/.test(x.message))).toBe(true);
  });
  it("A seule et B seule : la mise en service saisie pour « A + B » ne compte pas en B seule", () => {
    const p = formules("B");
    p.formules.abonnement.lignes = [
      { libelle: "x", quantite: "1", prixEur: "illisible", tauxTvaPct: "20" },
    ];
    expect(validerEtape(p, 3, CTX).ok).toBe(true);
  });
  it("B seule : un total de lignes à 0 € n'est pas refusé par l'étape 1 (le garde est le mensuel)", () => {
    const p = formules("B");
    p.lignesClassiques = [{ designation: "x", quantite: "1", prixEur: "0" }];
    expect(champs(p, 1)).toEqual([]);
  });
});

describe("étape 3 — décisions de l'architecte", () => {
  const auto = {
    code: "relance",
    libelle: "Relance",
    facultative: true,
    dependDe: [],
    prixHtCents: 180000,
    tauxTvaBps: 2000,
    modeIA: "client_direct" as const,
  };
  it("automatisation NEUVE refusée", () => {
    const p = formules("A");
    p.formules.automatisations = [auto];
    expect(champs(p, 3)).toContain("formules.automatisations.0");
  });
  it("automatisation héritée à l'identique acceptée (ordre des clés indifférent)", () => {
    const p = formules("A");
    p.formules.automatisations = [auto];
    const heritee = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(auto).reverse())));
    expect(validerEtape(p, 3, { ...CTX, automatisationsHeritees: [heritee] }).ok).toBe(true);
  });
  it("automatisation héritée MODIFIÉE refusée", () => {
    const p = formules("A");
    p.formules.automatisations = [{ ...auto, prixHtCents: 1 }];
    expect(champs(p, 3, { ...CTX, automatisationsHeritees: [auto] })).toContain(
      "formules.automatisations.0",
    );
  });
  it("aucun montant d'IA dans nonImprime ; un choix d'IA sans montant passe", () => {
    const p = formules("A");
    p.nonImprime = { ia: { achat: "compte_client", abonnement: { inclus: true, niveau: "pro" } } };
    expect(validerEtape(p, 3, CTX).ok).toBe(true);
    for (const n of [
      { ia: { forfaitMensuelEur: "50" } },
      { forfaitIa: 50 },
      { ia: { achat: { montant: 3 } } },
    ]) {
      const q = formules("A");
      q.nonImprime = n;
      expect(
        champs(q, 3).some((c) => c.startsWith("nonImprime")),
        JSON.stringify(n),
      ).toBe(true);
    }
  });
});

describe("étape 3 — liste blanche des clés d'IA", () => {
  it("budgetIA et ia.achat.valeur refusés (champ hors liste blanche)", () => {
    for (const n of [
      { budgetIA: 1200 },
      { ia: { achat: { valeur: 3 } } },
      { ia: { achat: { mode: "incluse", mois: "6 000" } } },
      { ia: { achat: { mode: 5 } } },
      { ia: { abonnement: { inclus: "oui" } } },
      { ia: { tarif: 1 } },
      { client: { ia: { achat: "compte_client" } } },
    ]) {
      const p = formules("A");
      p.nonImprime = n;
      expect(
        champs(p, 3).some((c) => c.startsWith("nonImprime")),
        JSON.stringify(n),
      ).toBe(true);
    }
  });
  it("mode, niveau, inclus et nombre de mois passent", () => {
    const p = formules("AB");
    p.nonImprime = {
      ia: { achat: { mode: "incluse", mois: 6 }, abonnement: { inclus: true, niveau: "pro" } },
    };
    expect(validerEtape(p, 3, CTX).ok).toBe(true);
  });
});

describe("étape 3 — mise en service de B en « A + B »", () => {
  const ab = (prix: string) => {
    const p = formules("AB");
    p.formules.abonnement.lignes[0]!.prixEur = prix;
    return p;
  };
  it.each(["", "0", "0,00", "0.00", " 0 "])("« %s » = vide : aucune ligne, valide", (prix) => {
    const p = ab(prix);
    expect(saisieFormulesPourOffre(p, 20).abonnement.lignes).toEqual([]);
    expect(validerEtape(p, 3, CTX).ok).toBe(true);
  });
  it("deux lignes refusées", () => {
    const p = ab("1 900");
    p.formules.abonnement.lignes.push({ ...p.formules.abonnement.lignes[0]!, prixEur: "100" });
    expect(champs(p, 3)).toContain("formules.abonnement.lignes");
  });
  it("quantité différente de 1 refusée", () => {
    const p = ab("1 900");
    p.formules.abonnement.lignes[0]!.quantite = "2";
    expect(champs(p, 3)).toContain("formules.abonnement.lignes");
  });
  it("une ligne à 0 € ajoutée à une ligne valide est écartée (une seule ligne reste)", () => {
    const p = ab("1 900");
    p.formules.abonnement.lignes.push({ ...p.formules.abonnement.lignes[0]!, prixEur: "0,00" });
    expect(validerEtape(p, 3, CTX).ok).toBe(true);
    expect(saisieFormulesPourOffre(p, 20).abonnement.lignes).toHaveLength(1);
  });
});

describe("étape 4 — validité (D8 : J+7 à J+90)", () => {
  const avec = (d: string | null) => {
    const p = formules("A");
    p.dateValidite = d;
    return champs(p, 4);
  };
  it("null = défaut du moteur", () => expect(avec(null)).toEqual([]));
  it("bornes incluses : 15/11 (J+7) et 06/02/2027 (J+90)", () => {
    expect(avec("2026-11-15")).toEqual([]);
    expect(avec("2027-02-06")).toEqual([]);
  });
  it("hors bornes : J+6 et J+91", () => {
    expect(avec("2026-11-14")).toContain("dateValidite");
    expect(avec("2027-02-07")).toContain("dateValidite");
  });
  it("date illisible ou impossible", () => {
    expect(avec("demain")).toContain("dateValidite");
    expect(avec("2026-02-31")).toContain("dateValidite");
  });
  it("l'étape 4 rejoue les étapes précédentes", () => {
    const p = formules("A");
    p.clientId = null;
    expect(champs(p, 4)).toContain("clientId");
  });
});

describe("saisieFormulesPourOffre (D1 : lignes de l'étape 1)", () => {
  it("A : lignes de l'étape 1 → achat.lignes, taux standard reçu", () => {
    const s = saisieFormulesPourOffre(formules("A"), 20);
    expect(s.achat.lignes.map((l) => l.libelle)).toEqual([
      "Assistant de réponse",
      "Relance des factures",
      "Formation",
    ]);
    expect(s.achat.lignes.every((l) => l.tauxTvaPct === "20")).toBe(true);
  });
  it("B seule : lignes de l'étape 1 → mise en service ; saisie A + B gardée dans le brouillon", () => {
    const p = formules("B");
    const s = saisieFormulesPourOffre(p, 20);
    expect(s.abonnement.lignes).toHaveLength(3);
    expect(p.formules.abonnement.lignes[0]!.prixEur).toBe("1 900");
  });
  it("A + B : une seule ligne saisie ; champ vide = aucune ligne", () => {
    const s = saisieFormulesPourOffre(formules("AB"), 20);
    expect(s.abonnement.lignes).toHaveLength(1);
    const p = formules("AB");
    p.formules.abonnement.lignes[0]!.prixEur = "";
    expect(saisieFormulesPourOffre(p, 20).abonnement.lignes).toEqual([]);
  });
});

describe("pureté", () => {
  it("client-safe : aucun import prisma ni module Node", () => {
    const src = readFileSync(resolve(__dirname, "../validation-etapes.ts"), "utf8");
    expect(src).not.toMatch(/@\/lib\/prisma|node:|from "(fs|crypto)"/);
  });
});
