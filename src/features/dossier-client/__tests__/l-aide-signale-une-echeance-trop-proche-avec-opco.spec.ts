/**
 * L'aide au devis signale une échéance trop proche avec un financement OPCO
 * (PR 7) — par la SOURCE UNIQUE `signalEcheanceOpco`, partagée avec
 * « Préparer » (bloc 9) : aucune règle recopiée.
 *
 * Mutation qui rougit : dans `aideAuDevis`, calculer `signalOpco` sur la portée
 * entreprise, ou le mettre à `null`.
 * Contre-témoins : échéance lointaine → rien ; financement direct → rien ;
 * une échéance d'un AUTRE projet ne déclenche rien ici.
 * Angle mort : « OPCO » est reconnu dans le texte du fait financement.
 */

import { describe, expect, it } from "vitest";

import { DELAI_OPCO_JOURS } from "../seuils";
import { aide, AUTRE_PROJET, PROJET } from "./_aide";
import { faitProjet, ilYA } from "./_faits";

describe("l'aide au devis signale une échéance trop proche avec l'OPCO", () => {
  it("échéance dans 20 jours + OPCO : signalé, avec le seuil", () => {
    const a = aide([
      faitProjet(PROJET, { type: "echeance", dateCible: ilYA(-20) }),
      faitProjet(PROJET, { type: "financement", texteCourt: "OPCO Atlas" }),
    ]);
    expect(a.signalOpco?.seuilJours).toBe(DELAI_OPCO_JOURS);
    expect(a.signalOpco?.joursRestants).toBeLessThan(DELAI_OPCO_JOURS);
  });

  it("contre-témoin : échéance lointaine, rien", () => {
    const a = aide([
      faitProjet(PROJET, { type: "echeance", dateCible: ilYA(-(DELAI_OPCO_JOURS + 30)) }),
      faitProjet(PROJET, { type: "financement", texteCourt: "OPCO Atlas" }),
    ]);
    expect(a.signalOpco).toBeNull();
  });

  it("contre-témoin : financement direct, rien", () => {
    const a = aide([
      faitProjet(PROJET, { type: "echeance", dateCible: ilYA(-10) }),
      faitProjet(PROJET, { type: "financement", texteCourt: "fonds propres" }),
    ]);
    expect(a.signalOpco).toBeNull();
  });

  it("l'échéance d'un autre projet ne compte pas", () => {
    const a = aide([
      faitProjet(AUTRE_PROJET, { type: "echeance", dateCible: ilYA(-10) }),
      faitProjet(AUTRE_PROJET, { type: "financement", texteCourt: "OPCO Atlas" }),
    ]);
    expect(a.signalOpco).toBeNull();
    expect(a.vide).toBe(true);
  });
});
