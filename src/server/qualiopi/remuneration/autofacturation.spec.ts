/**
 * Tests — autofacturation (module PUR).
 *
 * Ce qui se teste ici n'est pas « la fonction rend true » : c'est le REFUS. Une
 * autofacture à laquelle il manque un seul des quatre éléments réglementaires
 * est irrégulière et sa TVA non déductible ; le code doit refuser d'émettre, et
 * il doit dire POURQUOI, en une fois.
 */

import { describe, expect, it } from "vitest";

import {
  contestationOuverte,
  dateLimiteContestation,
  DELAI_CONTESTATION_JOURS,
  LIBELLE_REFUS_AUTOFACTURE,
  mandatEnVigueur,
  MENTION_AUTOFACTURATION,
  verifierEligibiliteAutofacture,
  type MotifRefusAutofacture,
  type ReleveAutofacturable,
  type SousTraitantAutofacture,
} from "./autofacturation";

const LE_10 = new Date("2026-09-10T09:00:00.000Z");

function sousTraitant(over: Partial<SousTraitantAutofacture> = {}): SousTraitantAutofacture {
  return {
    siret: "93812345600017",
    numeroTvaIntracom: "FR12938123456",
    adresseProfessionnelle: "12 rue des Alpes, 38000 Grenoble",
    mandatAutofacturationSigneAt: new Date("2026-08-01T00:00:00.000Z"),
    mandatAutofacturationRevoqueAt: null,
    ...over,
  };
}

function releve(over: Partial<ReleveAutofacturable> = {}): ReleveAutofacturable {
  return {
    statut: "valide",
    tvaRegime: "assujetti_20",
    totalTtcCents: 144_000,
    numeroFacture: null,
    autofactureAt: null,
    ...over,
  };
}

/** Les motifs rendus par un refus, ou `[]` si la pièce est éligible. */
function refusDe(r: ReleveAutofacturable, s: SousTraitantAutofacture, at = LE_10) {
  const v = verifierEligibiliteAutofacture(r, s, at);
  return v.eligible ? [] : [...v.refus];
}

describe("mandatEnVigueur — « préalable » se vérifie contre la date de la PIÈCE", () => {
  it("couvre une pièce émise après la signature", () => {
    expect(mandatEnVigueur(sousTraitant(), LE_10)).toBe(true);
  });

  it("🔴 ne couvre PAS une pièce datée d'AVANT la signature", () => {
    // Un mandat signé le 15 ne régularise pas une facture du 10 : la signature
    // postérieure ne rétroagit pas. C'est exactement pourquoi la colonne est une
    // date et non un booléen — un booléen aurait dit « oui » ici.
    expect(
      mandatEnVigueur(
        sousTraitant({ mandatAutofacturationSigneAt: new Date("2026-09-15T00:00:00.000Z") }),
        LE_10,
      ),
    ).toBe(false);
  });

  it("sans mandat, jamais", () => {
    expect(mandatEnVigueur(sousTraitant({ mandatAutofacturationSigneAt: null }), LE_10)).toBe(
      false,
    );
  });

  it("🔑 la révocation n'est PAS rétroactive", () => {
    // Révoqué le 12 : la pièce du 10 reste couverte, celle du 20 ne l'est plus.
    const revoque = sousTraitant({
      mandatAutofacturationRevoqueAt: new Date("2026-09-12T00:00:00.000Z"),
    });
    expect(mandatEnVigueur(revoque, LE_10)).toBe(true);
    expect(mandatEnVigueur(revoque, new Date("2026-09-20T00:00:00.000Z"))).toBe(false);
  });
});

describe("verifierEligibiliteAutofacture", () => {
  it("accepte un relevé validé, avec mandat et identité complète", () => {
    expect(verifierEligibiliteAutofacture(releve(), sousTraitant(), LE_10)).toEqual({
      eligible: true,
    });
  });

  it("🔴 refuse SANS MANDAT — le refus le plus coûteux à ne pas poser", () => {
    // Émettre ici produirait une pièce irrégulière dont la TVA n'est pas
    // déductible, et personne ne s'en apercevrait avant un contrôle.
    expect(refusDe(releve(), sousTraitant({ mandatAutofacturationSigneAt: null }))).toContain(
      "mandat_absent_ou_revoque",
    );
  });

  it("refuse un relevé non validé — le fait générateur est la VALIDATION", () => {
    expect(refusDe(releve({ statut: "a_valider" }), sousTraitant())).toContain("releve_non_valide");
  });

  it("refuse un relevé déjà facturé, par l'une ou l'autre voie", () => {
    expect(refusDe(releve({ numeroFacture: "F-77" }), sousTraitant())).toContain(
      "facture_deja_presente",
    );
    expect(refusDe(releve({ autofactureAt: LE_10 }), sousTraitant())).toContain(
      "facture_deja_presente",
    );
  });

  it("refuse une identité fiscale incomplète", () => {
    expect(refusDe(releve(), sousTraitant({ siret: null }))).toContain("siret_manquant");
    expect(refusDe(releve(), sousTraitant({ adresseProfessionnelle: "  " }))).toContain(
      "adresse_manquante",
    );
  });

  it("🔑 n'exige le n° de TVA QUE de l'assujetti", () => {
    // Le réclamer en franchise 293 B produirait un refus qu'aucun geste ne
    // lève : ces régimes n'ont pas de numéro à donner. C'est le motif « une
    // alerte qu'aucun geste ne ferme » que ce dépôt refuse partout ailleurs.
    const sansNumero = sousTraitant({ numeroTvaIntracom: null });
    expect(refusDe(releve({ tvaRegime: "assujetti_20" }), sansNumero)).toContain(
      "tva_intracom_manquante",
    );
    expect(refusDe(releve({ tvaRegime: "franchise_293b" }), sansNumero)).toEqual([]);
    expect(refusDe(releve({ tvaRegime: "exonere_formation" }), sansNumero)).toEqual([]);
  });

  it("🔴 rend TOUS les motifs, pas le premier", () => {
    // Un opérateur qui découvre les obstacles un par un finit par croire qu'il
    // n'en reste plus qu'un. Trois manques ici, trois motifs rendus.
    const refus = refusDe(
      releve({ statut: "brouillon" }),
      sousTraitant({ siret: null, mandatAutofacturationSigneAt: null }),
    );
    expect(refus).toEqual(
      expect.arrayContaining(["releve_non_valide", "mandat_absent_ou_revoque", "siret_manquant"]),
    );
    expect(refus.length).toBeGreaterThanOrEqual(3);
  });

  it("🔑 chaque motif a un libellé qui nomme le GESTE qui le lève", () => {
    // Contre-témoin d'exhaustivité : un motif ajouté au type sans libellé
    // afficherait sa clé technique à un comptable.
    const motifs: MotifRefusAutofacture[] = [
      "releve_non_valide",
      "releve_sans_montant",
      "facture_deja_presente",
      "mandat_absent_ou_revoque",
      "siret_manquant",
      "tva_intracom_manquante",
      "adresse_manquante",
    ];
    expect(Object.keys(LIBELLE_REFUS_AUTOFACTURE).sort()).toEqual([...motifs].sort());
    for (const m of motifs) {
      expect(LIBELLE_REFUS_AUTOFACTURE[m].length, `« ${m} » sans libellé utile`).toBeGreaterThan(
        30,
      );
    }
  });
});

describe("fenêtre de contestation", () => {
  it("court 8 jours depuis la TRANSMISSION", () => {
    expect(DELAI_CONTESTATION_JOURS).toBe(8);
    expect(dateLimiteContestation(LE_10).toISOString()).toBe("2026-09-18T09:00:00.000Z");
  });

  it("ne mute pas la date reçue", () => {
    const source = new Date(LE_10);
    dateLimiteContestation(source);
    expect(source.toISOString()).toBe(LE_10.toISOString());
  });

  it("est ouverte avant le terme, close après", () => {
    const avant = { contestationAvantAt: new Date("2026-09-18T09:00:00.000Z"), contesteeAt: null };
    expect(contestationOuverte(avant, LE_10)).toBe(true);
    expect(contestationOuverte(avant, new Date("2026-09-19T00:00:00.000Z"))).toBe(false);
  });

  it("🔴 une pièce JAMAIS TRANSMISE n'a pas de fenêtre — ce n'est pas la même chose qu'expirée", () => {
    // « Le formateur a laissé passer » et « le formateur n'a jamais reçu la
    // pièce » se ressemblent à l'écran et ne s'arbitrent pas pareil.
    expect(contestationOuverte({ contestationAvantAt: null, contesteeAt: null }, LE_10)).toBe(
      false,
    );
  });

  it("une pièce déjà contestée n'est plus « ouverte »", () => {
    expect(
      contestationOuverte(
        { contestationAvantAt: new Date("2026-09-18T09:00:00.000Z"), contesteeAt: LE_10 },
        LE_10,
      ),
    ).toBe(false);
  });
});

describe("mentions obligatoires", () => {
  it("🔴 la mention « Autofacturation » est une CONSTANTE, pas une chaîne de gabarit", () => {
    // C'est l'un des quatre éléments de régularité. Un gabarit peut être
    // reformulé par mégarde ; une constante lue par la garde ne le peut pas.
    expect(MENTION_AUTOFACTURATION).toBe("Autofacturation");
  });
});
