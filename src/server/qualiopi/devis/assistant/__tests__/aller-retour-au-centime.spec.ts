/**
 * ⛔ TEST D'ARGENT — réouvrir un devis dans l'assistant ne change PAS UN CENTIME.
 *
 * Chaîne prouvée, pour un devis classique et pour des devis à formules :
 *
 *   état d'écran → `etatVersPayload` → `payloadVersCreation`            = ENTRÉE 1
 *   payload → JSON.parse(JSON.stringify()) → `lirePayload` → `payloadVersEtat`
 *     (attendu `source: "ecran"`) → `etatVersPayload` (sans changement)
 *     → `payloadVersCreation`                                           = ENTRÉE 2
 *
 * Attendus : ENTRÉE 2 strictement égale à ENTRÉE 1 ; même `sha256Offre` ; pour chaque formule
 * et chaque choix, `montantsDevis` / `totauxFormule` / `vueFormules` rendent les mêmes HT, TVA,
 * TTC, lignes, remises, phases et maintenance.
 *
 * Mutation qui fait rougir (essayée à la main, puis annulée) : altérer UN centime de l'état
 * relu (« 1999,99 » → « 1999,98 ») avant la seconde conversion → les comparaisons rougissent.
 * Les cas « témoin » ci-dessous le prouvent en continu : ils ALTÈRENT un centime et exigent
 * que la comparaison le voie.
 */
import { describe, expect, it } from "vitest";

import {
  etatVersPayload,
  payloadVersEtat,
} from "@/components/admin/qualiopi/assistant-devis/vers-payload";
import { ligneVide, reducteur } from "@/components/admin/qualiopi/assistant-devis/etat";
import {
  etatT1,
  etatT2,
  etatT3,
  etatT4,
  etatT5,
  LIGNES_L,
} from "@/components/admin/qualiopi/assistant-devis/fixtures";
import type {
  Etape,
  EtatAssistant,
  PhaseAssistant,
} from "@/components/admin/qualiopi/assistant-devis/types";
import { computeTotauxFacture } from "@/server/qualiopi/legal/tva";
import { offreDevisV1, type OffreDevisV1 } from "@/server/qualiopi/devis/offre-devis";
import { montantsDevis } from "@/server/qualiopi/devis/montants-devis";
import { sha256Offre, totauxFormule } from "@/server/qualiopi/devis/offre-calculs";
import { vueFormules } from "@/server/qualiopi/devis/vue-formules";
import { payloadVersCreation, type ResultatConversion } from "../conversion";
import { lirePayload } from "../payload";

const TVA = 20;
const CTX = { tvaStandardPct: TVA, textes: [], refClient: "BC-2026-17" };
const SERVEUR = {
  formulesActives: true,
  typeClient: "entreprise" as const,
  maintenant: new Date("2026-11-08T10:00:00Z"),
  tauxStandard: TVA,
};

const phase = (id: string, pourcentage: string, libelle: string): PhaseAssistant => ({
  id,
  libelle,
  pourcentage,
  declencheur: "signature",
  livrable: "",
  delaiSemaines: "",
});

/** (a) Devis classique : quantité décimale, centimes impairs, une ligne d'offre catalogue. */
function classique3Lignes(): EtatAssistant {
  return reducteur(etatT4(), {
    type: "champs",
    patch: {
      intitule: "Accompagnement IA",
      lignes: [
        {
          ...ligneVide("c1", "formation"),
          libelle: "Atelier de cadrage",
          quantite: "2,5",
          prixEur: "1999,99",
        },
        {
          ...ligneVide("c2", "formation"),
          libelle: "Formation Prise en main",
          quantite: "1",
          prixEur: "1 190,05",
          offreCode: "AXI-OFF-001",
          designationDepuisOffre: true,
        },
        {
          ...ligneVide("c3", "formation"),
          libelle: "Support de cours",
          quantite: "0.75",
          prixEur: "333,33",
        },
      ],
    },
  });
}

/** (b) Devis à formules A + B : remise, maintenance, mois offerts, phases, lignes multiples. */
function formulesAB(): EtatAssistant {
  const e = reducteur(etatT3(), {
    type: "achat",
    patch: {
      phases: [
        phase("a1", "33", "Cadrage"),
        phase("a2", "33", "Réalisation"),
        phase("a3", "34", "Livraison"),
      ],
      maintenance: {
        regle: "obligatoire",
        mensuelEur: "189,99",
        periodes: [1, 12],
        dureeMinimale: "",
        moisOfferts: "3",
      },
    },
  });
  return reducteur(e, {
    type: "abonnement",
    patch: {
      miseEnServiceSaisie: "1 999,99",
      miseEnServiceLibelle: "Mise en service et adaptation",
      mensuelCatalogueEur: "199,99",
      periodes: [
        { mois: 1, remisePct: "0" },
        { mois: 12, remisePct: "12.5" },
      ],
      phases: [phase("b1", "40", "Installation"), phase("b2", "60", "Recette")],
    },
  });
}

/** (b′) B seule : PLUSIEURS lignes de mise en service. */
function abonnementPlusieursLignes(): EtatAssistant {
  return reducteur(etatT5(), {
    type: "champs",
    patch: {
      lignes: [
        { ...ligneVide("m1", "automatisation"), libelle: "Installation", prixEur: "999,99" },
        { ...ligneVide("m2", "automatisation"), libelle: "Paramétrage", prixEur: "450,01" },
        {
          ...ligneVide("m3", "formation"),
          libelle: "Formation",
          quantite: "1,5",
          prixEur: "123,45",
        },
      ],
    },
  });
}

const CAS: Array<{ nom: string; etat: () => EtatAssistant; etape: Etape }> = [
  { nom: "(a) classique, 3 lignes", etat: classique3Lignes, etape: 4 },
  { nom: "(b) formules A + B", etat: formulesAB, etape: 4 },
  {
    nom: "(b′) B seule, plusieurs lignes de mise en service",
    etat: abonnementPlusieursLignes,
    etape: 4,
  },
  { nom: "T1 : A seule", etat: etatT1, etape: 4 },
  { nom: "T2 : B seule", etat: etatT2, etape: 4 },
  { nom: "T3 : A + B", etat: etatT3, etape: 4 },
  { nom: "T4 : prix unique", etat: etatT4, etape: 4 },
];

function creation(
  p: ReturnType<typeof etatVersPayload>,
): Exclude<ResultatConversion, { erreurs: unknown }> {
  const r = payloadVersCreation(p, SERVEUR);
  if ("erreurs" in r) throw new Error("conversion refusée : " + JSON.stringify(r.erreurs));
  return r;
}

/** Les deux entrées de la chaîne ; `alterer` n'est utilisé que par les cas « témoin ». */
function allerRetour(etat: EtatAssistant, etape: Etape, alterer?: (relu: EtatAssistant) => void) {
  const payload1 = etatVersPayload(etat, etape, CTX);
  const entree1 = creation(payload1);

  const lu = lirePayload(JSON.parse(JSON.stringify(payload1)));
  if (!lu.ok) throw new Error(lu.error);
  const retour = payloadVersEtat(lu.payload);
  expect(retour.source).toBe("ecran");
  expect(retour.etape).toBe(etape);
  alterer?.(retour.etat);
  const payload2 = etatVersPayload(retour.etat, retour.etape, CTX);
  const entree2 = creation(payload2);
  return { etatRelu: retour.etat, entree1, entree2 };
}

/** Tout l'argent d'une offre à formules, par formule et par choix. */
function argentDeLOffre(brute: OffreDevisV1) {
  const offre = offreDevisV1.parse(brute);
  return {
    sha: sha256Offre(brute),
    vue: vueFormules(offre),
    parFormule: offre.formulesProposees.map((formule) => ({
      formule,
      totaux: totauxFormule(offre, formule, []),
      montants: montantsDevis({
        offre,
        lignes: [],
        montantTotalHtCents: 0,
        choix: { formule, automatisationsRetenues: [] },
      }),
    })),
    sansChoix: montantsDevis({ offre, lignes: [], montantTotalHtCents: 0 }),
  };
}

function argentDuClassique(lignes: Array<{ quantite: number; prixUnitaireHtCents: number }>) {
  return computeTotauxFacture(
    lignes.map((l) => ({
      quantite: l.quantite,
      prixUnitaireHtCents: l.prixUnitaireHtCents,
      tauxTvaPercent: TVA,
    })),
    "assujetti",
  );
}

describe("⛔ aller-retour au centime : écran → serveur → écran → serveur", () => {
  for (const cas of CAS) {
    it(`${cas.nom} : entrée 2 strictement égale à l'entrée 1, mêmes montants`, () => {
      const etat = cas.etat();
      const { etatRelu, entree1, entree2 } = allerRetour(etat, cas.etape);

      // L'état d'écran revient tel quel, et la création est strictement identique.
      expect(etatRelu).toStrictEqual(etat);
      expect(entree2).toStrictEqual(entree1);

      if (entree1.type === "classique" && entree2.type === "classique") {
        expect(entree2.input.lignes).toStrictEqual(entree1.input.lignes);
        expect(argentDuClassique(entree2.input.lignes)).toStrictEqual(
          argentDuClassique(entree1.input.lignes),
        );
      } else if (entree1.type === "formules" && entree2.type === "formules") {
        expect(sha256Offre(entree2.input.offre)).toBe(sha256Offre(entree1.input.offre));
        const a = argentDeLOffre(entree1.input.offre);
        const b = argentDeLOffre(entree2.input.offre);
        expect(b.sha).toBe(a.sha);
        expect(b.parFormule).toStrictEqual(a.parFormule);
        expect(b.sansChoix).toStrictEqual(a.sansChoix);
        // HT, TVA, TTC, lignes, remises, maintenance, phases : toute la vue.
        expect(b.vue).toStrictEqual(a.vue);
      } else {
        throw new Error("le type de devis a changé pendant l'aller-retour");
      }
    });
  }

  it("valeurs d'appui : le classique (a) garde 1999,99 € × 2,5 et 333,33 € × 0,75 au centime près", () => {
    const { entree1, entree2 } = allerRetour(classique3Lignes(), 4);
    if (entree1.type !== "classique" || entree2.type !== "classique") throw new Error("classique");
    for (const e of [entree1, entree2]) {
      expect(e.input.lignes.map((l) => [l.quantite, l.prixUnitaireHtCents])).toEqual([
        [2.5, 199999],
        [1, 119005],
        [0.75, 33333],
      ]);
      expect(e.input.lignes[1]).toMatchObject({ offreCode: "AXI-OFF-001" });
    }
  });

  it("valeurs d'appui : (b) garde 1 999,99 € de mise en service et 189,99 € de maintenance, 3 mois offerts", () => {
    const { entree1, entree2 } = allerRetour(formulesAB(), 4);
    for (const e of [entree1, entree2]) {
      if (e.type !== "formules") throw new Error("formules");
      expect(e.input.offre.abonnement?.miseEnServiceLignes.map((l) => l.prixHtCents)).toEqual([
        199999,
      ]);
      expect(e.input.offre.achat?.lignes.length).toBe(LIGNES_L.length);
      expect(JSON.stringify(e.input.offre)).toContain("18999");
    }
  });
});

describe("⛔ témoins : la comparaison VOIT un centime altéré", () => {
  it("classique : « 1999,99 » → « 1999,98 » dans l'état relu change l'entrée 2 (et le TTC)", () => {
    const { entree1, entree2 } = allerRetour(classique3Lignes(), 4, (relu) => {
      relu.lignes[0]!.prixEur = "1999,98";
    });
    expect(entree2).not.toStrictEqual(entree1);
    if (entree1.type !== "classique" || entree2.type !== "classique") throw new Error("classique");
    expect(argentDuClassique(entree2.input.lignes)).not.toStrictEqual(
      argentDuClassique(entree1.input.lignes),
    );
  });

  it("formules : un centime de mise en service ou de mensuel altéré change l'empreinte et les montants", () => {
    for (const alterer of [
      (relu: EtatAssistant) => {
        relu.abonnement.miseEnServiceSaisie = "1 999,98";
      },
      (relu: EtatAssistant) => {
        relu.abonnement.mensuelCatalogueEur = "199,98";
      },
      (relu: EtatAssistant) => {
        relu.achat.maintenance.moisOfferts = "2";
      },
    ]) {
      const { entree1, entree2 } = allerRetour(formulesAB(), 4, alterer);
      if (entree1.type !== "formules" || entree2.type !== "formules") throw new Error("formules");
      expect(entree2).not.toStrictEqual(entree1);
      expect(sha256Offre(entree2.input.offre)).not.toBe(sha256Offre(entree1.input.offre));
      expect(argentDeLOffre(entree2.input.offre).vue).not.toStrictEqual(
        argentDeLOffre(entree1.input.offre).vue,
      );
    }
  });
});
