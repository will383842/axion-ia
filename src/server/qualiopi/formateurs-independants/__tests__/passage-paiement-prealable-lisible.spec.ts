/**
 * Plan §8.10 n° 12 — le préalable de `passage_paiement` est LISIBLE : « le canal de
 * changement de compte bancaire est en service ». Jusqu'ici marqué ⛔ (« ce canal
 * n'existe pas encore »), il refusait toute date de passage. Le canal existe (lot E,
 * `formateurs.changement_coordonnees`) : le serveur le constate désormais dans les
 * réglages.
 *
 * « En service » = tout ce qu'il faut pour qu'un formateur change d'IBAN sans
 * fraude possible ni impasse :
 *  - l'interrupteur du canal est allumé ;
 *  - le dépôt de pièces est ouvert (le RIB du nouveau compte se dépose avec la demande) ;
 *  - l'avis F43 à l'adresse connue PEUT partir (`textes_valides` + texte validé) : sans
 *    lui, aucune demande d'IBAN n'est validable (C4) ;
 *  - la confirmation F44 est validée.
 */

import { describe, expect, it } from "vitest";

import { empreinteAttendue } from "@/server/email/textes-formateurs-a-valider";
import { cleTexteValide } from "@/server/email/textes-valides";

import {
  PREALABLES,
  etatsParDefaut,
  prealablesManquants,
  reglagesFillesACouper,
  type EtatsInterrupteurs,
} from "../interrupteurs";
import {
  GABARITS_CANAL_CHANGEMENT_COMPTE,
  faitsDepuisReglages,
  lireFaitsPrealables,
} from "../prealables-faits";

function etats(partiel: Partial<EtatsInterrupteurs> = {}): EtatsInterrupteurs {
  return { ...etatsParDefaut(), ...partiel };
}

/** Une validation de texte telle que la pose `validerTexteEmailAction` (empreinte comprise). */
function texteValide(gabarit: string) {
  const key = cleTexteValide(gabarit);
  const empreinte = empreinteAttendue(key);
  return { key, value: empreinte === null ? { valide: true } : { valide: true, empreinte } };
}

const CANAL_EN_SERVICE = [
  { key: "formateurs.changement_coordonnees", value: { actif: true } },
  { key: "formateurs.dossier_en_ligne", value: { actif: true } },
  { key: "formateurs.textes_valides", value: { actif: true } },
  texteValide("formateur-iban-changement"),
  texteValide("formateur-iban-valide"),
];

describe("passage_paiement : un préalable lisible", () => {
  it("n'a plus aucun préalable « non lisible » ; il exige le fait du canal", () => {
    expect(PREALABLES.passage_paiement.some((p) => p.sorte === "non_lisible")).toBe(false);
    expect(PREALABLES.passage_paiement).toContainEqual(
      expect.objectContaining({ sorte: "fait", fait: "canal_changement_compte_en_service" }),
    );
  });

  it("fait absent = refus (lecture prudente), et le motif parle du changement de compte", () => {
    const m = prealablesManquants("passage_paiement", "2026-12-01", etats());
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/changement de compte bancaire/);
    expect(m[0]).not.toMatch(/n'existe pas encore/);
  });

  it("canal en service : la date de passage est permise", () => {
    expect(
      prealablesManquants("passage_paiement", "2026-12-01", etats(), {
        canal_changement_compte_en_service: true,
      }),
    ).toEqual([]);
  });

  it("revenir à « pas de passage » reste toujours permis", () => {
    expect(prealablesManquants("passage_paiement", null, etats())).toEqual([]);
  });

  it("le fait du canal n'entraîne aucune coupure en cascade de la date (l'argent ne bascule pas en silence)", () => {
    const actifs = new Set(["formateurs.passage_paiement"]);
    expect(reglagesFillesACouper("formateurs.changement_coordonnees", actifs)).not.toContain(
      "formateurs.passage_paiement",
    );
  });

  it("les faits du code restent ceux d'avant (contrat arrêté)", () => {
    expect(lireFaitsPrealables()).toEqual({ version_contrat_arretee: true });
  });
});

describe("faitsDepuisReglages — le canal est-il en service ?", () => {
  it("les deux textes du canal sont F43 et F44", () => {
    expect([...GABARITS_CANAL_CHANGEMENT_COMPTE].sort()).toEqual([
      "formateur-iban-changement",
      "formateur-iban-valide",
    ]);
  });

  it("tout est réuni : en service", () => {
    expect(faitsDepuisReglages(CANAL_EN_SERVICE)).toEqual({
      canal_changement_compte_en_service: true,
    });
  });

  it("aucune ligne (tout éteint, l'état livré) : pas en service", () => {
    expect(faitsDepuisReglages([])).toEqual({ canal_changement_compte_en_service: false });
  });

  it.each([
    ["l'interrupteur du canal", "formateurs.changement_coordonnees"],
    ["le dépôt de pièces (RIB)", "formateurs.dossier_en_ligne"],
    ["la validation des textes", "formateurs.textes_valides"],
    ["F43 (avis à l'adresse connue)", cleTexteValide("formateur-iban-changement")],
    ["F44 (confirmation)", cleTexteValide("formateur-iban-valide")],
  ])("sans %s : pas en service", (_q, cle) => {
    expect(
      faitsDepuisReglages(CANAL_EN_SERVICE.filter((l) => l.key !== cle))
        .canal_changement_compte_en_service,
    ).toBe(false);
  });

  it("interrupteur du canal illisible ou coupé : pas en service", () => {
    for (const value of [{ actif: false }, { actif: "oui" }, null, "true"]) {
      const lignes = CANAL_EN_SERVICE.map((l) =>
        l.key === "formateurs.changement_coordonnees" ? { key: l.key, value } : l,
      );
      expect(faitsDepuisReglages(lignes).canal_changement_compte_en_service).toBe(false);
    }
  });

  it("F43 validé sur un ANCIEN texte (empreinte dépassée) : pas en service", () => {
    const lignes = CANAL_EN_SERVICE.map((l) =>
      l.key === cleTexteValide("formateur-iban-changement")
        ? { key: l.key, value: { valide: true, empreinte: "0".repeat(64) } }
        : l,
    );
    expect(faitsDepuisReglages(lignes).canal_changement_compte_en_service).toBe(false);
  });
});
