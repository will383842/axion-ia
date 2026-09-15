/**
 * T3 — décisions pures du rattrapage de chiffrement de la précision de santé
 * rangée dans une réponse de positionnement (RGPD art. 9).
 */

import { describe, expect, it } from "vitest";
import {
  CLE_DETAIL_ADAPTATION_CHIFFRE,
  CLE_DETAIL_ADAPTATION_CLAIR,
} from "@/server/qualiopi/positionnement/lecture-positionnement";
import {
  deciderRattrapage,
  reporterDetailChiffre,
  retirerCleReservee,
} from "./detail-adaptation-chiffre";

const CHIFFRE = "enc:v1:aa:bb:cc";

describe("deciderRattrapage — ce que le script a le droit de chiffrer", () => {
  it("a_chiffrer : clé en clair, texte non vide — la valeur EXACTE est rendue", () => {
    expect(
      deciderRattrapage({ besoinAdaptation: true, [CLE_DETAIL_ADAPTATION_CLAIR]: " Rampe " }),
    ).toEqual({ statut: "a_chiffrer", clair: " Rampe " });
  });

  it("deja_chiffre : seul le chiffré est présent", () => {
    expect(deciderRattrapage({ [CLE_DETAIL_ADAPTATION_CHIFFRE]: CHIFFRE })).toEqual({
      statut: "deja_chiffre",
    });
  });

  it("rien : ni clair ni chiffré, ou JSON qui n'est pas un objet", () => {
    expect(deciderRattrapage({ besoinAdaptation: false })).toEqual({ statut: "rien" });
    expect(deciderRattrapage(null)).toEqual({ statut: "rien" });
    expect(deciderRattrapage([CLE_DETAIL_ADAPTATION_CLAIR])).toEqual({ statut: "rien" });
    expect(deciderRattrapage("texte")).toEqual({ statut: "rien" });
  });

  it("anomalie vide : chaîne vide ou blanche — jamais chiffrée", () => {
    expect(deciderRattrapage({ [CLE_DETAIL_ADAPTATION_CLAIR]: "" })).toEqual({
      statut: "anomalie",
      motif: "vide",
    });
    expect(deciderRattrapage({ [CLE_DETAIL_ADAPTATION_CLAIR]: "  \n" })).toEqual({
      statut: "anomalie",
      motif: "vide",
    });
  });

  it("anomalie non_texte : nombre, booléen, objet ou null JSON", () => {
    for (const valeur of [42, true, { a: 1 }, null]) {
      expect(deciderRattrapage({ [CLE_DETAIL_ADAPTATION_CLAIR]: valeur })).toEqual({
        statut: "anomalie",
        motif: "non_texte",
      });
    }
  });

  it("anomalie deux_cles : clair ET chiffré — on ne choisit pas, on ne touche à rien", () => {
    expect(
      deciderRattrapage({
        [CLE_DETAIL_ADAPTATION_CLAIR]: "Rampe",
        [CLE_DETAIL_ADAPTATION_CHIFFRE]: CHIFFRE,
      }),
    ).toEqual({ statut: "anomalie", motif: "deux_cles" });
  });

  it("un null JSON sous la clé chiffrée compte comme PRÉSENT (comme `->'k' IS NOT NULL`)", () => {
    expect(deciderRattrapage({ [CLE_DETAIL_ADAPTATION_CHIFFRE]: null })).toEqual({
      statut: "deja_chiffre",
    });
  });
});

describe("retirerCleReservee — un client ne pose jamais le marqueur", () => {
  it("retire la clé réservée et laisse le reste intact, sans muter l'entrée", () => {
    const entree = { attentes: "x", [CLE_DETAIL_ADAPTATION_CHIFFRE]: "forgé" };
    expect(retirerCleReservee(entree)).toEqual({ attentes: "x" });
    expect(entree).toHaveProperty(CLE_DETAIL_ADAPTATION_CHIFFRE);
  });
});

describe("reporterDetailChiffre — une nouvelle soumission n'efface pas le chiffré", () => {
  it("reporte le chiffré existant dans le JSON qui remplace la réponse", () => {
    expect(
      reporterDetailChiffre(
        { besoinAdaptation: true, [CLE_DETAIL_ADAPTATION_CHIFFRE]: CHIFFRE },
        { besoinAdaptation: true, attentes: "y" },
      ),
    ).toEqual({ besoinAdaptation: true, attentes: "y", [CLE_DETAIL_ADAPTATION_CHIFFRE]: CHIFFRE });
  });

  it("rien à reporter : ancien absent, sans chiffré, ou valeur hors format `enc:v1:`", () => {
    const nouveau = { attentes: "y" };
    expect(reporterDetailChiffre(undefined, nouveau)).toEqual(nouveau);
    expect(reporterDetailChiffre({ attentes: "z" }, nouveau)).toEqual(nouveau);
    expect(reporterDetailChiffre({ [CLE_DETAIL_ADAPTATION_CHIFFRE]: "x" }, nouveau)).toEqual(
      nouveau,
    );
  });
});
