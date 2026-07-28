/**
 * Les surfaces OPPOSABLES lisent-elles toutes les heures sous le MÊME régime ?
 *
 * Ce fichier ne teste pas une fonction : il teste une PROPRIÉTÉ DU DÉPÔT. Le
 * défaut qu'il verrouille est déjà arrivé — `emargement-1to1.ts` produisait la
 * feuille d'émargement AFEST (pièce opposable) en appelant `sumHeuresReelles`,
 * qui force `legacy_boolean`, avec en prime un `select` local dépourvu de
 * `statut`. Sous `signature_reelle` la feuille aurait donc totalisé des séances
 * NON SIGNÉES et des séances ANNULÉES, pendant que la facture, le BPF, le
 * certificat et l'attestation du même parcours n'en comptaient aucune.
 *
 * 🔴 Le défaut était INERTE : tous les parcours étant en `legacy_boolean`, rien
 * n'était visible. Il se serait déclenché au moment EXACT de la bascule, c'est
 * à-dire quand plus personne ne l'aurait relié à ce chantier. Les tests de
 * comportement ne l'attrapent pas — seul un test de propriété le peut.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { heuresReellesSignees, type SeancePourHeures } from "./heures";

const ICI = join(process.cwd(), "src", "server", "qualiopi", "coaching-afest");

/**
 * Surfaces produisant une pièce opposable à un tiers (financeur, auditeur,
 * client). Y ajouter une entrée est volontairement pénible : c'est le point où
 * l'on se demande si la nouvelle surface lit bien le régime du parcours.
 */
const SURFACES_OPPOSABLES = [
  "emargement-1to1.ts",
  "attestation-1to1.ts",
  "facturation-1to1.ts",
  "kits-1to1.ts",
] as const;

describe("surfaces opposables — un seul régime de lecture", () => {
  it.each(SURFACES_OPPOSABLES)(
    "%s n'appelle pas sumHeuresReelles (qui force legacy_boolean)",
    (fichier) => {
      const source = readFileSync(join(ICI, fichier), "utf8");
      // On cherche l'APPEL, pas la mention : un commentaire qui explique
      // pourquoi on ne l'utilise pas doit rester autorisé.
      expect(source).not.toMatch(/\bsumHeuresReelles\s*\(/);
    },
  );

  it("emargement-1to1 lit regimePreuve et réutilise le select partagé", () => {
    const source = readFileSync(join(ICI, "emargement-1to1.ts"), "utf8");
    expect(source).toContain("regimePreuve: true");
    // Un select recopié à la main est la cause racine de la divergence
    // d'origine : il oubliait `statut` et la relation de signature.
    expect(source).toContain("...SEANCE_HEURES_SELECT");
  });
});

describe("heuresReellesSignees — régime signature_reelle", () => {
  const seance = (o: Partial<SeancePourHeures> = {}): SeancePourHeures => ({
    dureeMinutes: 120,
    statut: "realisee",
    presenceSigneeAt: null,
    beneficiairePresent: false,
    signaturesBeneficiaire: [],
    ...o,
  });

  it("ne compte que les séances portant une signature bénéficiaire", () => {
    const heures = heuresReellesSignees(
      [seance({ signaturesBeneficiaire: [{}] }), seance()],
      "signature_reelle",
    );
    expect(heures).toBe(2);
  });

  it("ignore beneficiairePresent : le cache d'affichage n'est pas un critère", () => {
    // Un cache posé tardivement, ou dont l'écriture a échoué, ne doit pas
    // zéro-er des heures pourtant réellement signées.
    const heures = heuresReellesSignees(
      [seance({ signaturesBeneficiaire: [{}], beneficiairePresent: false })],
      "signature_reelle",
    );
    expect(heures).toBe(2);
  });

  it("compte le mode dégradé : le critère est indépendant de la modalité", () => {
    // `confirmation_accessible` et `papier_scanne` n'ont pas de tracé. Les
    // exclure produirait un faux négatif de SOUS-DÉCLARATION — des heures
    // réellement tenues, non facturées parce que le réseau était mauvais ou que
    // le signataire utilise un lecteur d'écran (ind. 26).
    const heures = heuresReellesSignees(
      [seance({ signaturesBeneficiaire: [{ methode: "papier_scanne" }] })],
      "signature_reelle",
    );
    expect(heures).toBe(2);
  });

  it("neutralise une séance annulée même si elle porte une signature", () => {
    const heures = heuresReellesSignees(
      [seance({ statut: "annulee", signaturesBeneficiaire: [{}] })],
      "signature_reelle",
    );
    expect(heures).toBe(0);
  });

  it("legacy_boolean reste insensible aux signatures — zéro delta sur l'existant", () => {
    const seances = [seance(), seance({ signaturesBeneficiaire: [{}] })];
    expect(heuresReellesSignees(seances, "legacy_boolean")).toBe(4);
  });
});
