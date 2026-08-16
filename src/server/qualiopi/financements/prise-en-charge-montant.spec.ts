/**
 * `priseEnChargeMontantCents` est un TARIF, jamais un total.
 *
 * Défaut trouvé le 16/08 par la vérification de bout en bout, et c'est le plus
 * coûteux de la journée : trois consommateurs additionnaient ce champ comme un
 * montant global sans lire `priseEnChargeUnite`. Le plus exposé était la
 * convention TRIPARTITE — la pièce que lit le financeur et que trois parties
 * signent.
 *
 * Le test qui doit rougir : un OPCO à 40 €/h sur 14 h pour 8 participants prend
 * en charge 4 480 €. Lire le tarif brut imprimait 40,00 € — un facteur 112.
 */

import { describe, expect, it } from "vitest";
import { montantPrisEnChargeCents, resteAChargeCents } from "./prise-en-charge-montant";

const BASE = {
  priseEnChargeMontantCents: 4000, // 40,00 €
  priseEnChargeUnite: "euro_heure" as const,
  dureeHeures: 14,
  nbParticipants: 8,
};

describe("le cas réel qui a motivé le correctif", () => {
  it("40 €/h × 14 h × 8 participants = 4 480 €, pas 40 €", () => {
    expect(montantPrisEnChargeCents(BASE)).toBe(448000);
  });

  it("le reste à charge suit — il était faux du même facteur", () => {
    // Prix de la session : 6 000 €. Reste réel : 1 520 €.
    // L'ancien calcul annonçait 5 960 € au client, sur une pièce signée.
    expect(resteAChargeCents(BASE, 600000)).toBe(152000);
  });
});

describe("chaque unité est calculée selon son sens", () => {
  it("euro_heure : tarif × heures × participants", () => {
    expect(montantPrisEnChargeCents({ ...BASE, priseEnChargeUnite: "euro_heure" })).toBe(448000);
  });

  it("euro_jour : tarif × jours (7 h par jour, arrondis au supérieur) × participants", () => {
    // 14 h → 2 jours ; 40 € × 2 × 8 = 640 €.
    expect(montantPrisEnChargeCents({ ...BASE, priseEnChargeUnite: "euro_jour" })).toBe(64000);
  });

  it("euro_formation : tarif × participants — PAS le tarif seul", () => {
    // Le piège de cette unité : elle ressemble à un total, et n'en est pas un.
    // 40 € × 8 = 320 €.
    expect(montantPrisEnChargeCents({ ...BASE, priseEnChargeUnite: "euro_formation" })).toBe(32000);
  });

  it("euro_an_salarie : tarif × salariés", () => {
    expect(montantPrisEnChargeCents({ ...BASE, priseEnChargeUnite: "euro_an_salarie" })).toBe(
      32000,
    );
  });

  it("les quatre unités donnent quatre résultats DIFFÉRENTS du tarif brut", () => {
    const unites = ["euro_heure", "euro_jour", "euro_formation", "euro_an_salarie"] as const;
    for (const u of unites) {
      expect(montantPrisEnChargeCents({ ...BASE, priseEnChargeUnite: u })).not.toBe(
        BASE.priseEnChargeMontantCents,
      );
    }
  });
});

describe("les plafonds bornent le montant par participant", () => {
  it("le plafond par formation s'applique avant la multiplication par l'effectif", () => {
    // 40 €/h × 14 h = 560 € par participant, plafonné à 300 € → 300 × 8 = 2 400 €.
    expect(montantPrisEnChargeCents({ ...BASE, priseEnChargePlafondFormationCents: 30000 })).toBe(
      240000,
    );
  });

  it("un plafond plus haut que le calcul ne change rien", () => {
    expect(montantPrisEnChargeCents({ ...BASE, priseEnChargePlafondFormationCents: 9999999 })).toBe(
      448000,
    );
  });
});

describe("🔴 quand le montant N'EST PAS ÉTABLI, on rend null — jamais zéro", () => {
  it("aucun tarif saisi", () => {
    expect(montantPrisEnChargeCents({ ...BASE, priseEnChargeMontantCents: null })).toBeNull();
    expect(montantPrisEnChargeCents({ ...BASE, priseEnChargeMontantCents: 0 })).toBeNull();
  });

  it("🔴 un tarif SANS unité — c'est exactement le défaut d'origine", () => {
    // On ne peut pas deviner si 40 € est un total ou 40 €/h. Retomber sur
    // « c'est un total » est ce qu'il ne faut plus jamais faire.
    expect(montantPrisEnChargeCents({ ...BASE, priseEnChargeUnite: null })).toBeNull();
  });

  it("une unité horaire sans durée connue", () => {
    expect(montantPrisEnChargeCents({ ...BASE, dureeHeures: null })).toBeNull();
    expect(montantPrisEnChargeCents({ ...BASE, dureeHeures: 0 })).toBeNull();
  });

  it("aucun effectif — le tarif est par participant dans les QUATRE unités", () => {
    expect(montantPrisEnChargeCents({ ...BASE, nbParticipants: null })).toBeNull();
    expect(montantPrisEnChargeCents({ ...BASE, nbParticipants: 0 })).toBeNull();
  });

  it("`euro_formation` n'exige PAS de durée — elle n'en dépend pas", () => {
    expect(
      montantPrisEnChargeCents({
        ...BASE,
        priseEnChargeUnite: "euro_formation",
        dureeHeures: null,
      }),
    ).toBe(32000);
  });

  it("le reste à charge est null aussi — un reste calculé sur un inconnu serait faux", () => {
    expect(resteAChargeCents({ ...BASE, priseEnChargeUnite: null }, 600000)).toBeNull();
  });
});

describe("🔴 le reste à charge ne devient JAMAIS négatif", () => {
  it("une prise en charge supérieure au prix rend 0, pas un avoir", () => {
    // Un nombre négatif se lirait comme une somme due AU client.
    expect(resteAChargeCents(BASE, 100000)).toBe(0);
  });

  it("une prise en charge exactement égale au prix rend 0", () => {
    expect(resteAChargeCents(BASE, 448000)).toBe(0);
  });
});
