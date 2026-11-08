import { describe, expect, it } from "vitest";

import { offreFictive } from "./offre-fixtures.spec-util";
import type { OffreDevisV1 } from "./offre-devis";
import type { ChoixPourPlan } from "./plan-recurrent-devis";
import { calculerProchaineGeneration } from "../financements/facture-libre-pur";
import { planifierPlansRecurrents, PLAFOND_PERIODE_HT_CENTS } from "./plan-recurrent-devis";

const jour = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Abo = NonNullable<OffreDevisV1["abonnement"]>;
type Achat = NonNullable<OffreDevisV1["achat"]>;

function offreB(abo: Partial<Abo> = {}): OffreDevisV1 {
  const o = offreFictive();
  return { ...o, abonnement: { ...o.abonnement!, ...abo } };
}
function offreA(maintenance: Partial<Achat["maintenance"]> = {}, achat: Partial<Achat> = {}) {
  const o = offreFictive();
  return {
    ...o,
    achat: { ...o.achat!, ...achat, maintenance: { ...o.achat!.maintenance, ...maintenance } },
  };
}

const choixB = (periodiciteMois: number | null = 1) => ({
  formule: "abonnement" as const,
  maintenanceRetenue: false,
  periodiciteMois,
});
const choixA = (maintenanceRetenue: boolean, periodiciteMois: number | null = null) => ({
  formule: "achat" as const,
  maintenanceRetenue,
  periodiciteMois,
});
const entree = (offre: OffreDevisV1, choix: ChoixPourPlan, debut = "2030-01-15") => ({
  offre,
  choix,
  debutAt: jour(debut),
  devisNumero: "AXI-DEV-2030-001",
});

function unPlan(r: ReturnType<typeof planifierPlansRecurrents>) {
  if (!r.ok) throw new Error(`refus inattendu : ${r.code}`);
  expect(r.plans).toHaveLength(1);
  return r.plans[0]!;
}

describe("formule B — abonnement", () => {
  it("mensuel, à échoir : 1re génération = début, prix = mensuel, TVA du devis", () => {
    const p = unPlan(
      planifierPlansRecurrents(entree(offreB({ reconduction: "aucune" }), choixB(1))),
    );
    expect(p.nature).toBe("abonnement");
    expect(p.periodiciteMois).toBe(1);
    expect(p.lignes).toHaveLength(1);
    expect(p.lignes[0]).toMatchObject({
      quantite: 1,
      prixUnitaireHtCents: 9000,
      tauxTvaPercent: 20,
    });
    expect(iso(p.prochaineGenerationAt)).toBe("2030-01-15");
    expect(p.nbMaxFactures).toBe(12); // engagement 12 mois / période 1
  });

  it("échu : 1re génération = début + une période", () => {
    const o = offreB({
      terme: "echu",
      periodes: [{ mois: 6, remiseBps: 0 }],
      modeAvance: "toutes_periodes",
    });
    const p = unPlan(planifierPlansRecurrents(entree(o, choixB(6))));
    expect(iso(p.prochaineGenerationAt)).toBe("2030-07-15");
  });

  it("échu, fin de mois : bornée au dernier jour (31 janv. + 1 → 28 févr., 29 en bissextile)", () => {
    const o = offreB({ terme: "echu" });
    expect(
      iso(
        unPlan(planifierPlansRecurrents(entree(o, choixB(1), "2030-01-31"))).prochaineGenerationAt,
      ),
    ).toBe("2030-02-28");
    expect(
      iso(
        unPlan(planifierPlansRecurrents(entree(o, choixB(1), "2032-01-31"))).prochaineGenerationAt,
      ),
    ).toBe("2032-02-29");
    const o6 = offreB({
      terme: "echu",
      periodes: [{ mois: 6, remiseBps: 0 }],
      modeAvance: "toutes_periodes",
    });
    expect(
      iso(
        unPlan(planifierPlansRecurrents(entree(o6, choixB(6), "2030-08-31"))).prochaineGenerationAt,
      ),
    ).toBe("2031-02-28");
  });

  it("à échoir : le jour 31 n'est jamais décalé", () => {
    const p = unPlan(planifierPlansRecurrents(entree(offreB(), choixB(1), "2030-01-31")));
    expect(iso(p.prochaineGenerationAt)).toBe("2030-01-31");
  });

  it("arrondi : mensuel remisé arrondi AVANT × mois (1001, −15 %, 6 mois = 851 × 6 = 5106)", () => {
    const o = offreB({
      mensuelCatalogueHtCents: 1001,
      periodes: [{ mois: 6, remiseBps: 1500 }],
      modeAvance: "toutes_periodes",
      engagementMois: 12,
      reconduction: "aucune",
    });
    const p = unPlan(planifierPlansRecurrents(entree(o, choixB(6))));
    expect(p.lignes[0]!.prixUnitaireHtCents).toBe(5106); // et non round(1001 × 6 × 0,85) = 5105
    expect(p.nbMaxFactures).toBe(2);
    // Total engagé = 2 × 5106 = 10212 = 12 × 851
    expect(p.nbMaxFactures! * p.lignes[0]!.prixUnitaireHtCents).toBe(12 * 851);
  });

  it("arrondi : le demi-centime monte (mensuel 5, −10 % = 4,5 → 5)", () => {
    const o = offreB({ mensuelCatalogueHtCents: 5, periodes: [{ mois: 1, remiseBps: 1000 }] });
    expect(
      unPlan(planifierPlansRecurrents(entree(o, choixB(1)))).lignes[0]!.prixUnitaireHtCents,
    ).toBe(5);
  });

  it("arrondi : 33,33 % sur 100 → 66,67 → 67", () => {
    const o = offreB({ mensuelCatalogueHtCents: 100, periodes: [{ mois: 1, remiseBps: 3333 }] });
    expect(
      unPlan(planifierPlansRecurrents(entree(o, choixB(1)))).lignes[0]!.prixUnitaireHtCents,
    ).toBe(67);
  });

  it("taux de TVA du devis repris tel quel (21 %)", () => {
    const o = offreB({ tauxTvaBps: 2100 });
    expect(unPlan(planifierPlansRecurrents(entree(o, choixB(1)))).lignes[0]!.tauxTvaPercent).toBe(
      21,
    );
  });

  describe("engagement ÷ périodicité", () => {
    const avecEngagement = (engagementMois: Abo["engagementMois"], mois: 1 | 2 | 6 | 12) =>
      planifierPlansRecurrents(
        entree(
          offreB({
            engagementMois,
            reconduction: "aucune",
            periodes: [{ mois, remiseBps: 0 }],
            modeAvance: "toutes_periodes",
          }),
          choixB(mois),
        ),
      );

    it.each([
      [12, 1, 12],
      [12, 2, 6],
      [12, 6, 2],
      [12, 12, 1],
      [24, 12, 2],
      [6, 6, 1],
      [6, 2, 3],
      [3, 1, 3],
    ] as const)("engagement %i mois / période %i mois → %i factures", (eng, mois, attendu) => {
      expect(unPlan(avecEngagement(eng, mois)).nbMaxFactures).toBe(attendu);
    });

    it("sans engagement (0) → aucune borne de nombre de factures", () => {
      expect(unPlan(avecEngagement(0, 1)).nbMaxFactures).toBeNull();
      expect(unPlan(avecEngagement(0, 12)).nbMaxFactures).toBeNull();
    });

    describe("reconduction : l'engagement ne borne la facturation que sans reconduction", () => {
      const avecReconduction = (
        reconduction: Abo["reconduction"],
        engagementMois: Abo["engagementMois"],
      ) =>
        planifierPlansRecurrents(
          entree(
            offreB({
              engagementMois,
              reconduction,
              periodes: [{ mois: 1, remiseBps: 0 }],
              modeAvance: "toutes_periodes",
            }),
            choixB(1),
          ),
        );

      it.each([
        ["mensuelle", 12, null],
        ["annuelle", 12, null],
        ["aucune", 12, 12],
        ["mensuelle", 0, null],
        ["annuelle", 0, null],
        ["aucune", 0, null],
      ] as const)("reconduction %s / engagement %i → nbMaxFactures %s", (rec, eng, attendu) => {
        expect(unPlan(avecReconduction(rec, eng)).nbMaxFactures).toBe(attendu);
      });
    });

    it("engagement 3 avec période 2 → REFUS (1,5 facture), pas 1 par division entière", () => {
      const r = avecEngagement(3, 2);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("engagement_non_multiple");
    });

    it.each([
      [3, 6, false],
      [3, 12, false],
      [6, 12, false],
      [24, 12, true],
    ] as const)("engagement %i mois / période %i mois : accepté = %s", (eng, mois, accepte) => {
      expect(avecEngagement(eng, mois).ok).toBe(accepte);
    });
  });

  it("période absente du choix ou non proposée → refus", () => {
    const a = planifierPlansRecurrents(entree(offreB(), choixB(null)));
    const b = planifierPlansRecurrents(entree(offreB(), choixB(12)));
    for (const r of [a, b]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("periode_inconnue");
    }
  });

  it("avance sur la 1re période seulement + période > 1 : point ouvert → refus ; période 1 : accepté", () => {
    const o = (mois: 1 | 6) =>
      offreB({ modeAvance: "premiere_periode_seulement", periodes: [{ mois, remiseBps: 0 }] });
    const r6 = planifierPlansRecurrents(entree(o(6), choixB(6)));
    expect(r6.ok).toBe(false);
    if (!r6.ok) expect(r6.code).toBe("avance_premiere_periode_ambigue");
    expect(planifierPlansRecurrents(entree(o(1), choixB(1))).ok).toBe(true);
  });

  it("remise 100 % → prix nul → refus (aucun plan à zéro)", () => {
    const r = planifierPlansRecurrents(
      entree(offreB({ periodes: [{ mois: 1, remiseBps: 10000 }] }), choixB(1)),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("prix_nul");
  });

  it("prix de période au-dessus de la borne Int32 → refus", () => {
    const o = offreB({
      mensuelCatalogueHtCents: PLAFOND_PERIODE_HT_CENTS,
      periodes: [{ mois: 2, remiseBps: 0 }],
      modeAvance: "toutes_periodes",
      engagementMois: 0,
    });
    const r = planifierPlansRecurrents(entree(o, choixB(2)));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("prix_hors_borne");
  });

  it("formule B non proposée → refus", () => {
    const o = { ...offreA(), formulesProposees: ["achat" as const] };
    const r = planifierPlansRecurrents(entree(o, choixB(1)));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("formule_non_proposee");
  });
});

describe("formule A — maintenance", () => {
  it("facultative et non retenue → aucun plan", () => {
    const r = planifierPlansRecurrents(entree(offreA(), choixA(false)));
    expect(r).toMatchObject({ ok: true, plans: [] });
  });

  it("retenue : prix = mensuel × mois, sans engagement, début = acceptation + mois offerts", () => {
    const o = offreA({ moisOfferts: 3, mensuelHtCents: 4000, periodesMois: [1, 12] });
    const p = unPlan(planifierPlansRecurrents(entree(o, choixA(true, 12), "2030-01-31")));
    expect(p.nature).toBe("maintenance");
    expect(p.periodiciteMois).toBe(12);
    expect(p.lignes[0]!.prixUnitaireHtCents).toBe(48000);
    expect(p.nbMaxFactures).toBeNull();
    expect(iso(p.prochaineGenerationAt)).toBe("2030-04-30"); // 31 janv. + 3 mois, fin de mois bornée
  });

  it("TVA : aucune valeur inventée, le taux standard s'applique à l'émission", () => {
    const o = offreA({ periodesMois: [1] });
    const p = unPlan(planifierPlansRecurrents(entree(o, choixA(true))));
    expect(p.lignes[0]!.tauxTvaPercent).toBeUndefined();
  });

  it("une seule périodicité proposée : retenue d'office ; plusieurs sans choix → refus", () => {
    const seule = planifierPlansRecurrents(entree(offreA({ periodesMois: [6] }), choixA(true)));
    expect(unPlan(seule).periodiciteMois).toBe(6);
    const ambigue = planifierPlansRecurrents(
      entree(offreA({ periodesMois: [1, 12] }), choixA(true)),
    );
    expect(ambigue.ok).toBe(false);
    if (!ambigue.ok) expect(ambigue.code).toBe("periode_inconnue");
  });

  it("périodicité hors offre → refus", () => {
    const r = planifierPlansRecurrents(entree(offreA({ periodesMois: [1, 12] }), choixA(true, 6)));
    expect(r.ok).toBe(false);
  });

  it("maintenance obligatoire non retenue → refus (incohérence), obligatoire retenue → plan", () => {
    const obl = offreA({ regle: "obligatoire", periodesMois: [1] });
    const r = planifierPlansRecurrents(entree(obl, choixA(false)));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("maintenance_obligatoire_non_retenue");
    expect(planifierPlansRecurrents(entree(obl, choixA(true))).ok).toBe(true);
  });

  it("mensuel nul → refus", () => {
    const r = planifierPlansRecurrents(
      entree(offreA({ mensuelHtCents: 0, periodesMois: [1] }), choixA(true)),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("prix_nul");
  });

  it("hébergement chez Axion : signalé, jamais transformé en plan", () => {
    const o = offreA(
      { periodesMois: [1] },
      { hebergement: "axion", hebergementMensuelHtCents: 4900 },
    );
    const r = planifierPlansRecurrents(entree(o, choixA(true)));
    expect(r.ok && r.nonTraites).toEqual(["hebergement"]);
    expect(r.ok && r.plans.map((p) => p.nature)).toEqual(["maintenance"]);
  });
});

describe("première période non doublée", () => {
  const six = (terme: "a_echoir" | "echu") =>
    offreB({ terme, periodes: [{ mois: 6, remiseBps: 0 }], modeAvance: "toutes_periodes" });

  it("🔴 à échoir : 1re génération = début, la suivante début + période (jamais la même période deux fois)", () => {
    const p = unPlan(planifierPlansRecurrents(entree(six("a_echoir"), choixB(6), "2030-08-31")));
    expect(iso(p.prochaineGenerationAt)).toBe("2030-08-31");
    expect(iso(calculerProchaineGeneration(p.prochaineGenerationAt, 6, p.jourAncre))).toBe(
      "2031-02-28",
    );
  });
  it("🔴 à terme échu : 1re génération = début + période (la période 1 n'est facturée qu'une fois)", () => {
    const p = unPlan(planifierPlansRecurrents(entree(six("echu"), choixB(6), "2030-08-31")));
    expect(iso(p.prochaineGenerationAt)).toBe("2031-02-28");
    expect(p.jourAncre).toBe(31);
    expect(iso(calculerProchaineGeneration(p.prochaineGenerationAt, 6, p.jourAncre))).toBe(
      "2031-08-31",
    );
  });
});
