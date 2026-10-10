/**
 * Interrupteurs du chantier « formateurs freelance » (lot S0-ter, ADR 0066 (f)).
 *
 * Module pur : lecture d'une valeur, position sûre par défaut, préalables.
 */

import { describe, it, expect } from "vitest";

import {
  CLES_INTERRUPTEURS,
  DEPENDANCES_DE_COUPURE,
  INTERRUPTEURS,
  PREALABLES,
  cleSetting,
  estCleProtegee,
  etatsParDefaut,
  lireDrapeauEnvoi,
  lireDrapeauGarde,
  lireValeur,
  prealablesManquants,
  type EtatsInterrupteurs,
} from "./interrupteurs";

function etats(partiel: Partial<EtatsInterrupteurs> = {}): EtatsInterrupteurs {
  return { ...etatsParDefaut(), ...partiel };
}

describe("la liste des interrupteurs", () => {
  it("compte les seize clés `formateurs.*` du chantier, sans doublon", () => {
    expect([...CLES_INTERRUPTEURS].sort()).toEqual(
      [
        "activation_auto",
        "choix_suivants",
        "communes_geo_cron",
        "contrat_auto",
        "controle_registre_periodique",
        "dossier_en_ligne",
        "echange_ouvert",
        "garde_activation",
        "garde_mission",
        "invitation_auto",
        "lettre_auto",
        "passage_paiement",
        "pieces_cron",
        "proches_bloc",
        "relances_auto",
        "textes_valides",
      ].sort(),
    );
    expect(new Set(CLES_INTERRUPTEURS).size).toBe(CLES_INTERRUPTEURS.length);
    for (const cle of CLES_INTERRUPTEURS) {
      expect(cleSetting(cle)).toBe(`formateurs.${cle}`);
      expect(INTERRUPTEURS[cle].libelle.length).toBeGreaterThan(5);
    }
  });

  it("protège toute clé qui commence par « formateurs. », casse comprise", () => {
    expect(estCleProtegee("formateurs.passage_paiement")).toBe(true);
    expect(estCleProtegee("Formateurs.inconnue")).toBe(true);
    expect(estCleProtegee("careers.reponse_poste_pourvu")).toBe(false);
    expect(estCleProtegee("formateursX")).toBe(false);
  });
});

describe("lecture unique — absent ou illisible", () => {
  it("un envoi absent ou illisible est ARRÊTÉ", () => {
    expect(lireValeur("invitation_auto", undefined)).toEqual({ valeur: false, lisible: false });
    expect(lireValeur("invitation_auto", "oui")).toEqual({ valeur: false, lisible: false });
    expect(lireValeur("invitation_auto", { actif: "true" })).toEqual({
      valeur: false,
      lisible: false,
    });
    expect(lireValeur("invitation_auto", { actif: true })).toEqual({ valeur: true, lisible: true });
    expect(lireDrapeauEnvoi(etatsParDefaut(), "relances_auto")).toBe(false);
  });

  it("une garde absente ou illisible est au plus STRICT", () => {
    expect(lireValeur("garde_mission", undefined).valeur).toBe("refuser");
    expect(lireValeur("garde_mission", { valeur: "laisser" }).valeur).toBe("refuser");
    expect(lireValeur("garde_mission", { valeur: "avertir" }).valeur).toBe("avertir");
    expect(lireValeur("garde_activation", null).valeur).toBe(true);
    expect(lireValeur("garde_activation", { actif: false }).valeur).toBe(false);
    expect(lireDrapeauGarde(etatsParDefaut(), "garde_mission")).toBe("refuser");
    expect(lireDrapeauGarde(etatsParDefaut(), "garde_activation")).toBe(true);
  });

  it("une date de passage illisible ou hors du 1er du mois vaut « pas de passage »", () => {
    expect(lireValeur("passage_paiement", { date: "2026-12-01" }).valeur).toBe("2026-12-01");
    expect(lireValeur("passage_paiement", { date: "2026-12-15" }).valeur).toBeNull();
    expect(lireValeur("passage_paiement", { date: "2026-02-30" }).valeur).toBeNull();
    expect(lireValeur("passage_paiement", undefined).valeur).toBeNull();
  });
});

describe("préalables", () => {
  it("invitation_auto exige echange_ouvert ET textes_valides", () => {
    expect(prealablesManquants("invitation_auto", true, etats())).toHaveLength(2);
    expect(
      prealablesManquants("invitation_auto", true, etats({ textes_valides: true })),
    ).toHaveLength(1);
    expect(
      prealablesManquants(
        "invitation_auto",
        true,
        etats({ textes_valides: true, echange_ouvert: true }),
      ),
    ).toEqual([]);
  });

  it("relances_auto exige dossier_en_ligne", () => {
    const manques = prealablesManquants("relances_auto", true, etats({ textes_valides: true }));
    expect(manques.join(" ")).toMatch(/dossier/i);
  });

  it("garde_mission=avertir exige le contrôle registre périodique", () => {
    expect(prealablesManquants("garde_mission", "avertir", etats())).toHaveLength(1);
    expect(
      prealablesManquants(
        "garde_mission",
        "avertir",
        etats({ controle_registre_periodique: true }),
      ),
    ).toEqual([]);
  });

  it("couper (position sûre) n'a jamais de préalable", () => {
    for (const cle of CLES_INTERRUPTEURS) {
      expect(prealablesManquants(cle, INTERRUPTEURS[cle].positionSure, etats()), cle).toEqual([]);
    }
  });

  it("un préalable non lisible en base refuse l'allumage", () => {
    const tout = etats(
      Object.fromEntries(
        CLES_INTERRUPTEURS.filter((c) => typeof INTERRUPTEURS[c].positionSure === "boolean").map(
          (c) => [c, true],
        ),
      ) as Partial<EtatsInterrupteurs>,
    );
    expect(prealablesManquants("contrat_auto", true, tout).length).toBeGreaterThan(0);
  });

  it("la table de coupure est l'inverse exact des préalables entre interrupteurs", () => {
    expect(DEPENDANCES_DE_COUPURE.echange_ouvert).toContain("invitation_auto");
    expect(DEPENDANCES_DE_COUPURE.textes_valides).toContain("invitation_auto");
    expect(DEPENDANCES_DE_COUPURE.dossier_en_ligne).toContain("relances_auto");
    expect(DEPENDANCES_DE_COUPURE.controle_registre_periodique).toContain("garde_mission");
    for (const [mere, filles] of Object.entries(DEPENDANCES_DE_COUPURE)) {
      for (const fille of filles) {
        const p = PREALABLES[fille as keyof typeof PREALABLES];
        expect(p.some((x) => x.sorte === "interrupteur" && x.cle === mere)).toBe(true);
      }
    }
  });
});
