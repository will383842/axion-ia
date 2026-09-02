/**
 * Garde — chaque indicateur RNQ porte une décision explicite sur « où le
 * vérifier dans la console ».
 *
 * 🔑 La liste des indicateurs est DÉRIVÉE de `INDICATEURS_RNQ`, jamais recopiée.
 * Une garde qui nomme ses cibles ne peut pas voir le jumeau — c'est écrit noir
 * sur blanc dans la doctrine de ce dépôt, et c'est exactement ce qui avait
 * laissé passer cinq littéraux dans `conformite-service.ts`.
 */

import { describe, it, expect } from "vitest";

import { INDICATEURS_RNQ } from "./indicateurs-registre";
import { REGISTRES_PAR_INDICATEUR, registresDeIndicateur } from "./registres-par-indicateur";

describe("registres par indicateur", () => {
  it("porte une entrée pour CHACUN des 32 indicateurs du registre", () => {
    const manquants = INDICATEURS_RNQ.filter(
      (ind) => REGISTRES_PAR_INDICATEUR[ind.numero] === undefined,
    ).map((ind) => ind.numero);
    expect(manquants).toEqual([]);
  });

  it("ne porte AUCUNE entrée pour un numéro qui n'est pas un indicateur", () => {
    const connus = new Set(INDICATEURS_RNQ.map((ind) => ind.numero));
    const orphelins = Object.keys(REGISTRES_PAR_INDICATEUR)
      .map((k) => Number(k))
      .filter((n) => !connus.has(n));
    expect(orphelins).toEqual([]);
  });

  /**
   * Le témoin de non-vacuité : sans lui, un module entièrement vide passerait
   * les deux tests ci-dessus (toutes les entrées présentes, aucune orpheline).
   * Ce dépôt a déjà payé une garde vraie sur le vide.
   */
  it("renvoie réellement quelque part pour les indicateurs adossés à un registre", () => {
    // Ces huit-là n'ont AUCUNE pièce documentaire dans le manifeste : sans lien,
    // l'écran de l'auditrice ne propose littéralement rien à cliquer.
    for (const numero of [22, 23, 24, 25, 26, 27, 31, 32]) {
      expect(registresDeIndicateur(numero).length).toBeGreaterThan(0);
    }
  });

  it("ne renvoie que vers des chemins RELATIFS à la racine de la console", () => {
    for (const [numero, registres] of Object.entries(REGISTRES_PAR_INDICATEUR)) {
      for (const r of registres) {
        // Le préfixe admin est secret et variable : un chemin absolu ou une
        // URL le figerait, ou renverrait hors de la console.
        expect(r.chemin.startsWith("/qualiopi/"), `ind. ${numero} → ${r.chemin}`).toBe(true);
        expect(r.chemin).not.toContain("://");
        expect(r.libelle.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("laisse vides, et seulement vides, les indicateurs sans registre interne", () => {
    // 3/7/16 (certifiant : preuve statistique publiée), 13/14/15/20/29
    // (apprentissage, hors périmètre), 28 (AFEST, non déclaré).
    const vides = Object.entries(REGISTRES_PAR_INDICATEUR)
      .filter(([, r]) => r.length === 0)
      .map(([n]) => Number(n))
      .sort((a, b) => a - b);
    expect(vides).toEqual([3, 7, 13, 14, 15, 16, 20, 28, 29]);
  });
});
