/**
 * ⛔ G14 — L'ÉBAUCHE DE DEVIS NE CONTIENT AUCUN PRIX.
 *
 * Les prix sont calculés par le SITE (C4, `chiffrerEbauche`), jamais par
 * l'IA : une ébauche qui écrit « € », « euros », « TVA », « HT » est rejetée
 * ENTIÈRE (nouvel essai). Et le catalogue envoyé à l'IA ne contient aucun
 * montant. Le chiffrage du code ne pose un prix que s'il est FERME (jamais un
 * plancher « à partir de »).
 *
 * Mutation qui rougit : retirer le contrôle `contientUnPrix` de
 * `controlerEbauche` → l'ébauche passe. Contre-témoin : une ébauche sans
 * montant passe. Angle mort : un prix écrit en toutes lettres sans « euros »
 * (« mille neuf cents ») n'est pas vu — le site n'utilise de toute façon que
 * ses propres prix.
 */

import { describe, expect, it } from "vitest";

import { chiffrerEbauche } from "../../catalogue-ia";
import { controlerEbauche } from "../../consolider";
import type { EbaucheV1 } from "../../schemas/autres";
import { catalogueDeTest } from "../../../../../tests/outils/faux-circuit-visio";

function ebauche(p: Partial<EbaucheV1> = {}): EbaucheV1 {
  return {
    lignes: [
      {
        ref_catalogue: "OFF:AXI-OFF-001",
        quantite: 1,
        unite: "groupes",
        faits_refs: ["F01"],
        justification: "12 personnes, un groupe",
      },
    ],
    sans_reference: [],
    activite: "formation",
    financement_suggere: null,
    nb_participants: 12,
    duree_heures: 7,
    modalite_opco: null,
    ref_client: null,
    hypotheses: [],
    alternatives: [],
    manquant_pour_chiffrer: [],
    personnalisation_formation: null,
    ...p,
  };
}

describe("l'ébauche de devis ne contient aucun prix", () => {
  it.each([
    [
      "€ dans une justification",
      {
        lignes: [
          {
            ref_catalogue: "OFF:AXI-OFF-001",
            quantite: 1,
            unite: "groupes" as const,
            faits_refs: [],
            justification: "soit 1 900 € la journée",
          },
        ],
      },
    ],
    ["TVA dans une hypothèse", { hypotheses: ["TVA à 20 % en sus"] }],
    ["euros dans une alternative", { alternatives: ["deux jours pour 3800 euros"] }],
  ])("%s → rejetée entière", (_n, p) => {
    expect(controlerEbauche(ebauche(p), catalogueDeTest().refs).ok).toBe(false);
  });

  it("le catalogue envoyé à l'IA ne porte aucun montant", () => {
    const c = catalogueDeTest();
    expect(c.texte).not.toMatch(/€|\beuros?\b|1900|1 900/);
  });

  it("contre-témoin : sans montant, l'ébauche passe, et le SITE chiffre ce qui est ferme seulement", () => {
    const r = controlerEbauche(ebauche(), catalogueDeTest().refs);
    expect(r.ok).toBe(true);
    const chiffre = chiffrerEbauche(
      [
        ...ebauche().lignes,
        { ref_catalogue: "TIER:audit-cible-standard", quantite: 1, unite: "forfait" },
      ],
      catalogueDeTest(),
    );
    expect(chiffre.lignes.map((l) => l.prixUnitaireHtCents)).toEqual([190000, null]);
    expect(chiffre.totalHtCents).toBe(190000);
    expect(chiffre.lignesSurDevis).toBe(1);
  });
});
