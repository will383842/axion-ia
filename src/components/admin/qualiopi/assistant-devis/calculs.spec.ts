import { describe, expect, it } from "vitest";

import { vueFormules } from "@/server/qualiopi/devis/vue-formules";

import { construireOffre, type SaisieFormules } from "../devis-formules/saisie";
import {
  eurosEnCents,
  fourchetteSemaines,
  indemniteSortieMax,
  miseEnServiceIgnoree,
  periodesAbonnement,
  quantiteLue,
  semainesTotales,
  totauxFormuleA,
  totauxLignes,
  totauxMiseEnServiceB,
} from "./calculs";
import { propositionEffective, reducteur } from "./etat";
import { etatT1, etatT2, etatT3, etatT4, etatT5, SAISIES_EUROS } from "./fixtures";
import type { EtatAssistant } from "./types";

const TVA = 20;

/** Saisie du moteur construite à la main (l'adaptateur E04 est une autre fiche). */
function saisieDepuis(e: EtatAssistant, tva: number): SaisieFormules {
  const p = propositionEffective(e);
  const a = p === "A" || p === "AB";
  const b = p === "B" || p === "AB";
  const ligne = (l: { libelle: string; quantite: string; prixEur: string }) => ({
    libelle: l.libelle,
    quantite: l.quantite,
    prixEur: l.prixEur.replace(/\s/g, ""),
    tauxTvaPct: String(tva),
  });
  const phases = (ph: EtatAssistant["achat"]["phases"]) =>
    ph.map((x) => ({
      libelle: x.libelle,
      pourcentage: x.pourcentage,
      declencheur: x.declencheur,
    }));
  const ms = e.abonnement.miseEnServiceSaisie.replace(/\s/g, "");
  return {
    formules: { achat: a, abonnement: b },
    garantieJours: "30",
    automatisations: [],
    servicesTiers: [],
    plafondAConfirmer: null,
    achat: {
      lignes: e.lignes.map(ligne),
      phases: phases(e.achat.phases),
      hebergement: "client",
      hebergementMensuelEur: "",
      maintenance: {
        regle: e.achat.maintenance.regle,
        moisOfferts: "0",
        mensuelEur: e.achat.maintenance.mensuelEur,
        periodes: e.achat.maintenance.periodes,
      },
    },
    abonnement: {
      lignes:
        p === "B"
          ? e.lignes.map(ligne)
          : ms === ""
            ? []
            : [ligne({ libelle: e.abonnement.miseEnServiceLibelle, quantite: "1", prixEur: ms })],
      phases: phases(e.abonnement.phases),
      mensuelCatalogueEur: e.abonnement.mensuelCatalogueEur,
      tauxTvaPct: String(tva),
      terme: e.abonnement.terme,
      periodes: e.abonnement.periodes,
      engagementMois: e.abonnement.engagementMois,
      reconduction: e.abonnement.reconduction,
      preavisMois: e.abonnement.preavisMois,
      indemniteTauxPct: e.abonnement.indemniteTauxPct,
    },
  };
}

function vue(e: EtatAssistant, tva = TVA) {
  const r = construireOffre(saisieDepuis(e, tva), []);
  if (!r.ok) throw new Error(r.erreurs.join(" | "));
  return vueFormules(r.offre);
}

describe("saisie des euros (T6)", () => {
  it.each(SAISIES_EUROS)("« $saisie » → $cents", ({ saisie, cents }) => {
    expect(eurosEnCents(saisie)).toBe(cents);
  });
  it("quantité : 2,3 et 2.3 lus, 0 / négatif / 3 décimales refusés", () => {
    expect(quantiteLue("2,3")).toBe(2.3);
    expect(quantiteLue("2.3")).toBe(2.3);
    for (const s of ["", "0", "-1", "1,234", "abc"]) expect(quantiteLue(s)).toBeNull();
  });
});

describe("totaux d'aperçu", () => {
  it("T1 : ligne 3 = 28 393 (pas 28 394), HT 448 393, TVA 89 679, TTC 538 072", () => {
    const t = totauxFormuleA(etatT1(), TVA);
    expect(t).toMatchObject({ htCents: 448393, tvaCents: 89679, ttcCents: 538072 });
  });

  it("T4 : TVA par groupe de taux (6 280, pas 6 282)", () => {
    expect(totauxLignes(etatT4().lignes, TVA)).toMatchObject({
      htCents: 31402,
      tvaCents: 6280,
      ttcCents: 37682,
    });
  });

  it("la TVA suit le taux PASSÉ en paramètre (aucun 20 en dur)", () => {
    const t = totauxLignes(etatT4().lignes, 10);
    expect(t.tvaCents).toBe(Math.round(31402 * 0.1));
    expect(t.tvaCents).not.toBe(6280);
  });

  it("une saisie illisible compte pour 0 et marque l'aperçu incomplet, jamais un montant inventé", () => {
    const e = etatT4();
    const l = [{ ...e.lignes[0]!, prixEur: "2.400" }];
    expect(totauxLignes(l, TVA)).toMatchObject({ htCents: 0, incomplet: true });
  });

  it("T3 : mise en service B saisie « 1 900 » = 190 000 / 38 000 / 228 000, sans les lignes de A", () => {
    expect(totauxMiseEnServiceB(etatT3(), TVA)).toMatchObject({
      htCents: 190000,
      tvaCents: 38000,
      ttcCents: 228000,
    });
  });

  it("T5 : B seule = total des lignes ; la saisie reste et est signalée ; retour A+B la réactive", () => {
    const e = etatT5();
    expect(totauxMiseEnServiceB(e, TVA).htCents).toBe(448393);
    expect(miseEnServiceIgnoree(e, TVA)).toEqual({ saisieCents: 190000, totalLignesCents: 448393 });
    const retour = reducteur(e, { type: "proposer", proposition: "AB" });
    expect(miseEnServiceIgnoree(retour, TVA)).toBeNull();
    expect(totauxMiseEnServiceB(retour, TVA).htCents).toBe(190000);
  });

  it("T6 : mise en service B vide en A + B = 0 / 0 / 0", () => {
    const e = reducteur(etatT3(), { type: "abonnement", patch: { miseEnServiceSaisie: "" } });
    expect(totauxMiseEnServiceB(e, TVA)).toMatchObject({ htCents: 0, tvaCents: 0, ttcCents: 0 });
  });
});

describe("abonnement B (T2)", () => {
  it("mensuel net, prix de période et engagement minimal PAR période, remise comprise", () => {
    const p = periodesAbonnement(etatT2())!;
    expect(p[0]).toMatchObject({ mois: 1, mensuelNetCents: 19999, prixPeriodeCents: 19999 });
    expect(p[0]!.engagementMinimalCents).toBe(239988);
    expect(p[1]).toMatchObject({ mois: 12, mensuelNetCents: 18999, prixPeriodeCents: 227988 });
    expect(p[1]!.engagementMinimalCents).toBe(227988);
  });

  it("indemnité maximale 119 994 ; aucune sans engagement", () => {
    expect(indemniteSortieMax(etatT2())).toBe(119994);
    const sans = reducteur(etatT2(), { type: "abonnement", patch: { engagementMois: 0 } });
    expect(indemniteSortieMax(sans)).toBeNull();
  });

  it("mensuel illisible → null, pas de 0", () => {
    const e = reducteur(etatT2(), { type: "abonnement", patch: { mensuelCatalogueEur: "x" } });
    expect(periodesAbonnement(e)).toBeNull();
  });
});

describe("durées", () => {
  it("semaines totales des phases", () => {
    const ph = ["2", "2", "", "1"].map((d) => ({ delaiSemaines: d }));
    expect(semainesTotales(ph)).toBe(5);
  });

  it("fourchette : chemin le plus long (min) et tout à la suite (max)", () => {
    const e = etatT1();
    const l = (id: string, d: string, necessite: string[] = []) => ({
      ...e.lignes[0]!,
      id,
      delaiSemaines: d,
      necessite,
    });
    expect(fourchetteSemaines([l("a", "2"), l("b", "3", ["a"]), l("c", "4")])).toEqual({
      min: 5,
      max: 9,
    });
  });

  it("un cycle ne boucle pas", () => {
    const e = etatT1();
    const base = e.lignes[0]!;
    const r = fourchetteSemaines([
      { ...base, id: "a", delaiSemaines: "1", necessite: ["b"] },
      { ...base, id: "b", delaiSemaines: "1", necessite: ["a"] },
    ]);
    expect(r.max).toBe(2);
  });
});

describe("égalité avec le moteur (vueFormules ∘ construireOffre)", () => {
  it("T1 : totaux A identiques", () => {
    const e = etatT1();
    const f = vue(e).formules[0]!;
    const t = totauxFormuleA(e, TVA);
    expect([t.htCents, t.tvaCents, t.ttcCents]).toEqual([
      f.totalHtCents,
      f.totalTvaCents,
      f.totalTtcCents,
    ]);
  });

  it("T2 : totaux B (B seule) et périodes identiques", () => {
    const e = etatT2();
    const f = vue(e).formules[0]!;
    const t = totauxMiseEnServiceB(e, TVA);
    expect([t.htCents, t.tvaCents, t.ttcCents]).toEqual([
      f.totalHtCents,
      f.totalTvaCents,
      f.totalTtcCents,
    ]);
    const ab = f.abonnement!;
    const p = periodesAbonnement(e)!;
    expect(p.map((x) => x.prixPeriodeCents)).toEqual(ab.periodes.map((x) => x.prixPeriodeHtCents));
    expect(indemniteSortieMax(e)).toBe(ab.indemniteSortieMaxHtCents);
  });

  it("T2 à taux d'indemnité 0 : aucune indemnité, comme le moteur (null, pas 0)", () => {
    const e = reducteur(etatT2(), { type: "abonnement", patch: { indemniteTauxPct: "0" } });
    const ab = vue(e).formules[0]!.abonnement!;
    expect(ab.indemniteSortieMaxHtCents).toBeNull();
    expect(indemniteSortieMax(e)).toBe(ab.indemniteSortieMaxHtCents);
  });

  it("T3 : A + B, mise en service saisie", () => {
    const e = etatT3();
    const v = vue(e);
    const b = v.formules.find((f) => f.formule === "abonnement")!;
    const t = totauxMiseEnServiceB(e, TVA);
    expect([t.htCents, t.tvaCents, t.ttcCents]).toEqual([
      b.totalHtCents,
      b.totalTvaCents,
      b.totalTtcCents,
    ]);
  });

  it("T5 : B seule reprend les lignes de A", () => {
    const e = etatT5();
    const f = vue(e).formules[0]!;
    expect(totauxMiseEnServiceB(e, TVA).htCents).toBe(f.totalHtCents);
  });

  it("taux de TVA différent : égalité conservée", () => {
    const e = etatT1();
    const f = vue(e, 25).formules[0]!;
    expect(totauxFormuleA(e, 25).tvaCents).toBe(f.totalTvaCents);
  });
});
