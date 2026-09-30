/**
 * L'aide au devis ne propose ni prix, ni TVA (PR 7) — et rappelle la mise en
 * relation validée. Ces tests remplacent, après la décision de Will du 29/09
 * (aucun pré-remplissage), `la-tva-n-est-jamais-proposee`,
 * `une-ebauche-d-audit-ne-pre-remplit-jamais-de-prix` et
 * `la-mise-en-relation-validee-est-proposee-sur-le-devis`.
 *
 *   · un prix annoncé par Williams (`prix_annonce_axion`) n'apparaît JAMAIS ;
 *   · une offre envisagée (audit, formation) est rappelée par sa référence,
 *     sans aucun montant ;
 *   · aucune TVA, aucun « HT » n'est écrit par l'aide ;
 *   · la mise en relation VALIDÉE est rappelée ; une mise en relation
 *     seulement proposée ne l'est pas.
 *
 * Mutation qui rougit : retirer `prix_annonce_axion` de `TYPES_EXCLUS_DE_L_AIDE`
 * (et l'ajouter à une rubrique), ou montrer les faits proposés.
 * Angle mort : le budget DIT PAR LE CLIENT est montré (demandé par Will) : c'est
 * une information sur le client, pas un prix du devis.
 */

import { describe, expect, it } from "vitest";

import { aide, element, PROJET } from "./_aide";
import { faitProjet, fait } from "./_faits";

describe("l'aide au devis ne propose ni prix ni TVA", () => {
  const a = aide([
    faitProjet(PROJET, { type: "prix_annonce_axion", montantMinCents: 190000 }),
    faitProjet(PROJET, {
      type: "offre_envisagee",
      cle: "OFF:AXI-OFF-301",
      refCatalogue: "OFF:AXI-OFF-301",
      texteCourt: "Audit IA",
    }),
    fait({ type: "mise_en_relation", texteCourt: "Paul, apporteur fictif" }),
    fait({ type: "mise_en_relation", cle: "autre", texteCourt: "Non validé", statut: "propose" }),
  ]);
  const texte = JSON.stringify(a);

  it("un prix annoncé par Williams n'apparaît jamais", () => {
    expect(element(a, "prix_annonce_axion")).toBeUndefined();
    expect(texte).not.toMatch(/1\s?900/);
  });

  it("l'offre envisagée est rappelée par sa référence, sans montant", () => {
    const e = element(a, "offre_envisagee");
    expect(e?.valeurs[0]?.reference).toBe("OFF:AXI-OFF-301");
    expect(e?.valeurs[0]?.texte).toBe("Audit IA");
    expect(texte).not.toContain("€");
  });

  it("aucune TVA, aucun HT", () => {
    expect(texte).not.toMatch(/\bTVA\b|\bHT\b|\bTTC\b/);
  });

  it("la mise en relation validée est rappelée, pas celle seulement proposée", () => {
    const e = element(a, "mise_en_relation");
    expect(e?.valeurs.map((v) => v.texte)).toEqual(["Paul, apporteur fictif"]);
    expect(texte).not.toContain("Non validé");
  });
});
