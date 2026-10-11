/**
 * Lot L8 — l'étape d'un formateur indépendant est CALCULÉE (plan 08 §2.2 à §2.4).
 */

import { describe, expect, it } from "vitest";

import {
  compterParOnglet,
  estOnglet,
  etapeFormateurIndependant,
  type FaitsParcours,
} from "../etape-parcours-independant";

const D = new Date("2026-10-14T10:00:00Z");

function faits(extra: Partial<FaitsParcours> = {}): FaitsParcours {
  return {
    actif: false,
    finCollaborationAt: null,
    activationValideeAt: null,
    dossierStatut: null,
    dossierOuvertAt: null,
    dossierEnvoyeAt: null,
    dossierVerifieAt: null,
    dernierVerdict: null,
    contrat: null,
    ...extra,
  };
}

describe("etapeFormateurIndependant", () => {
  it("trois candidats de test, trois étapes (critère « Fini » du lot)", () => {
    const etapes = [
      faits({ dossierStatut: "en_cours", dossierOuvertAt: D }),
      faits({ contrat: { statutSignature: "partielle", signeLe: D, contresigneLe: null } }),
      faits({ actif: true, activationValideeAt: D }),
    ].map(etapeFormateurIndependant);
    expect(etapes.map((e) => [e.cle, e.libelle, e.onglet])).toEqual([
      ["dossier_ouvert", "Dossier ouvert le 14/10/2026", "dossier_en_cours"],
      ["contrat_signe", "Contrat signé le 14/10/2026", "a_verifier"],
      ["actif", "Actif", "actifs"],
    ]);
    expect(etapes[1]!.aVerifier).toBe(true);
  });

  it("l'ordre de priorité : fin > actif > retiré > rouge > contrat > dossier", () => {
    const tout = faits({
      finCollaborationAt: D,
      actif: true,
      dernierVerdict: "rouge",
      contrat: { statutSignature: "signee", signeLe: D, contresigneLe: D },
      dossierStatut: "a_verifier",
    });
    expect(etapeFormateurIndependant(tout).cle).toBe("termine");
    expect(etapeFormateurIndependant({ ...tout, finCollaborationAt: null }).cle).toBe("actif");
    expect(
      etapeFormateurIndependant({
        ...tout,
        finCollaborationAt: null,
        actif: false,
        activationValideeAt: D,
      }).cle,
    ).toBe("retire");
    expect(etapeFormateurIndependant({ ...tout, finCollaborationAt: null, actif: false }).cle).toBe(
      "registre_rouge",
    );
  });

  it("chaque statut du dossier a son étape", () => {
    expect(
      etapeFormateurIndependant(faits({ dossierStatut: "a_verifier", dossierEnvoyeAt: D })).libelle,
    ).toBe("Dossier reçu le 14/10/2026");
    expect(etapeFormateurIndependant(faits({ dossierStatut: "a_completer" })).cle).toBe(
      "dossier_a_completer",
    );
    expect(etapeFormateurIndependant(faits({ dossierStatut: "verifie" })).cle).toBe(
      "dossier_verifie",
    );
    expect(etapeFormateurIndependant(faits()).cle).toBe("fiche_creee");
  });

  it("compteurs par onglet", () => {
    const n = compterParOnglet(
      [faits({ actif: true }), faits({ actif: true }), faits()].map(etapeFormateurIndependant),
    );
    expect(n).toEqual({ actifs: 2, a_verifier: 0, dossier_en_cours: 1, retires: 0, termines: 0 });
    expect(estOnglet("actifs")).toBe(true);
    expect(estOnglet("x")).toBe(false);
  });

  it("aucun mot interdit dans les libellés", () => {
    const libelles = [
      faits(),
      faits({ actif: true }),
      faits({ dernierVerdict: "rouge" }),
      faits({ dossierStatut: "a_completer" }),
    ]
      .map((f) => etapeFormateurIndependant(f).libelle)
      .join(" ");
    expect(libelles).not.toMatch(/poste|entretien|recrutement|salaire|rémunération|obligatoire/i);
  });
});
