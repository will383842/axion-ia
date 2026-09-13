// @vitest-environment node

/**
 * Tests — ce qu'on a le droit de faire d'un contrat déjà établi.
 *
 * ⚠️ Ces témoins portent sur la DÉCISION, pas sur l'affichage. Ce qu'ils
 * protègent n'est pas un libellé : c'est qu'un contrat signé ne puisse pas
 * sortir de l'écran de la personne qui l'a signé.
 */

import { describe, it, expect } from "vitest";

import {
  empreinteMentions,
  empreinteScellee,
  pieceDesynchronisee,
  refusReemission,
  refusNotification,
  CLE_EMPREINTE_MENTIONS,
  type PieceContratEnCours,
} from "./contrat-piece-en-cours";
import type { SalarieContrat } from "../qualiopi/trainers/contrat-travail";

function salarie(o: Partial<SalarieContrat> = {}): SalarieContrat {
  return {
    statut: "salarie",
    nom: "Martin",
    prenom: "Camille",
    dateNaissance: new Date("1992-04-03T00:00:00.000Z"),
    lieuNaissance: "Lyon",
    adressePersonnelle: "12 rue des Lilas, 69003 Lyon",
    dateEmbauche: new Date("2026-10-01T00:00:00.000Z"),
    contratType: "cdd",
    contratPoste: "Secrétaire administrative",
    contratClassification: "Employé niveau B",
    contratDureeHebdoHeures: 35,
    contratPeriodeEssai: { valeur: 1, unite: "mois" },
    contratLieuTravail: "Lyon",
    contratDateFin: new Date("2027-03-31T00:00:00.000Z"),
    contratMotifCdd: "Accroissement temporaire d'activité",
    fixeMensuelBrutCents: 210000,
    ...o,
  };
}

function piece(o: Partial<PieceContratEnCours> = {}): PieceContratEnCours {
  return { numero: "AXI-DOC-2026-050", partiesSignataires: [], empreinte: null, ...o };
}

describe("empreinteMentions — ne bouge QUE si une mention bouge", () => {
  it("deux fiches identiques rendent la même empreinte", () => {
    expect(empreinteMentions(salarie())).toBe(empreinteMentions(salarie()));
  });

  it("🔴 changer le POSTE change l'empreinte", () => {
    // Le cas réel : on corrige « Formatrice IA » en « Secrétaire », l'e-mail
    // annonce le nouveau poste et le PDF signé porte l'ancien.
    expect(empreinteMentions(salarie({ contratPoste: "Formatrice IA" }))).not.toBe(
      empreinteMentions(salarie({ contratPoste: "Secrétaire administrative" })),
    );
  });

  it.each([
    ["la rémunération", { fixeMensuelBrutCents: 250000 }],
    ["l'entrée en fonction", { dateEmbauche: new Date("2026-11-02T00:00:00.000Z") }],
    ["le terme du CDD", { contratDateFin: new Date("2027-06-30T00:00:00.000Z") }],
    ["le motif de recours", { contratMotifCdd: "Remplacement d'un salarié absent" }],
    ["la nature du contrat", { contratType: "cdi" as const }],
    ["la durée hebdomadaire", { contratDureeHebdoHeures: 28 }],
    ["la période d'essai", { contratPeriodeEssai: { valeur: 2, unite: "mois" as const } }],
    ["le lieu de travail", { contratLieuTravail: "Villeurbanne" }],
    ["la classification", { contratClassification: "Cadre position 2.1" }],
  ])("changer %s change l'empreinte", (_libelle, patch) => {
    expect(empreinteMentions(salarie(patch))).not.toBe(empreinteMentions(salarie()));
  });

  it("🔑 l'HEURE d'une date ne compte pas — le contrat n'imprime pas d'heure", () => {
    // Sans cette réduction au jour, un fuseau ou une saisie à une heure
    // différente déclarerait périmée une pièce strictement identique à l'écrit.
    expect(empreinteMentions(salarie({ dateEmbauche: new Date("2026-10-01T23:30:00.000Z") }))).toBe(
      empreinteMentions(salarie({ dateEmbauche: new Date("2026-10-01T00:00:00.000Z") })),
    );
  });

  it("🔑 un champ vide et un champ absent se valent — « ␣␣ » n'est pas une mention", () => {
    expect(empreinteMentions(salarie({ contratLieuTravail: "   " }))).toBe(
      empreinteMentions(salarie({ contratLieuTravail: null })),
    );
  });

  it("⚠️ le STATUT ne compte pas : il ne s'imprime pas au contrat", () => {
    // Témoin discriminant. Si l'empreinte prenait toute la fiche, consigner la
    // remise ou changer un champ hors contrat la ferait bouger — et
    // l'avertissement se déclencherait sur des pièces parfaitement à jour.
    expect(empreinteMentions(salarie({ statut: "dirigeant" }))).toBe(
      empreinteMentions(salarie({ statut: "salarie" })),
    );
  });
});

describe("empreinteScellee — lire une colonne Json sans jamais caster", () => {
  it("rend l'empreinte quand elle est là", () => {
    expect(empreinteScellee({ [CLE_EMPREINTE_MENTIONS]: "v2:abc123" })).toBe("v2:abc123");
  });

  it.each([
    ["null", null],
    ["un tableau", ["inattendu"]],
    ["une chaîne", "pas un objet"],
    ["un objet sans la clé", { specimen: true }],
    ["une valeur non textuelle", { [CLE_EMPREINTE_MENTIONS]: 42 }],
    ["une chaîne vide", { [CLE_EMPREINTE_MENTIONS]: "" }],
    // 🔴 UNE EMPREINTE D'UNE AUTRE VERSION SE LIT COMME ABSENTE, jamais comme
    // différente : la déclarer différente bloquerait TOUS les contrats en
    // cours de signature au premier changement des entrées de l'empreinte.
    ["une empreinte d'une version ANTÉRIEURE", { [CLE_EMPREINTE_MENTIONS]: "9f2a1c" }],
    ["une empreinte d'une version INCONNUE", { [CLE_EMPREINTE_MENTIONS]: "v9:9f2a1c" }],
  ])("rend null sur %s", (_l, valeur) => {
    expect(empreinteScellee(valeur)).toBeNull();
  });
});

describe("refusReemission — un contrat signé ne se réécrit pas", () => {
  it("🔴 UNE SEULE signature suffit à refuser", () => {
    // Pas « les deux » : un contrat que le salarié a signé et que l'employeur
    // n'a pas encore contresigné est DÉJÀ son engagement. Le réécrire
    // effacerait sa signature de son écran.
    const r = refusReemission(piece({ partiesSignataires: ["formateur"] }));
    expect(r?.code).toBe("deja_signe");
    expect(r?.message).toContain("AXI-DOC-2026-050");
  });

  it("refuse aussi quand les deux parties ont signé", () => {
    expect(refusReemission(piece({ partiesSignataires: ["formateur", "axionia"] }))?.code).toBe(
      "deja_signe",
    );
  });

  it("🔑 autorise quand PERSONNE n'a signé — corriger avant signature est normal", () => {
    // Témoin discriminant : sans lui, un « toujours refuser » passerait les deux
    // tests ci-dessus et interdirait de corriger une coquille avant tout envoi.
    expect(refusReemission(piece({ partiesSignataires: [] }))).toBeNull();
  });

  it("autorise quand aucune pièce n'existe encore", () => {
    expect(refusReemission(null)).toBeNull();
  });
});

describe("refusNotification — ne pas annoncer un contrat que le PDF dément", () => {
  const actuelle = empreinteMentions(salarie());

  it("🔴 refuse quand les mentions ont bougé depuis l'émission", () => {
    const ancienne = empreinteMentions(salarie({ contratPoste: "Formatrice IA" }));
    const r = refusNotification(piece({ empreinte: ancienne }), actuelle);
    expect(r?.code).toBe("mentions_modifiees");
    expect(r?.message).toContain("AXI-DOC-2026-050");
  });

  it("autorise quand la pièce porte bien les mentions de la fiche", () => {
    expect(refusNotification(piece({ empreinte: actuelle }), actuelle)).toBeNull();
  });

  it("⚠️ autorise sur une pièce SANS empreinte — les tirages d'avant ce module", () => {
    /*
      Un correctif qui bloque l'existant n'en est pas un. Les pièces émises avant
      ce module ne portent aucune empreinte ; les déclarer périmées arrêterait
      d'un coup tous les contrats en cours de signature. Elles redeviennent
      surveillées dès leur première réémission.
    */
    expect(refusNotification(piece({ empreinte: null }), actuelle)).toBeNull();
    expect(pieceDesynchronisee(piece({ empreinte: null }), actuelle)).toBe(false);
  });
});

describe("🔴 l'UNITÉ de la période d'essai fait partie des mentions", () => {
  /*
    Trouvé par MUTATION, pas par lecture : retirer l'unité de l'empreinte
    laissait la suite entièrement verte.

    Le défaut qu'il ouvrait est précis : « 2 mois » et « 2 semaines » auraient
    produit LA MÊME empreinte. Corriger un essai de deux mois en deux semaines —
    exactement le geste que ce lot rend possible sur un CDD — n'aurait pas été vu
    comme une modification des mentions. La pièce déjà émise aurait continué
    d'être annoncée au salarié comme à jour, en portant l'ancienne durée.

    ⚠️ Et c'est la mention la plus sensible du contrat après la rémunération :
    une période d'essai fausse, c'est une rupture requalifiée en licenciement.
  */

  it("🔴 changer l'UNITÉ à valeur égale change l'empreinte", () => {
    expect(
      empreinteMentions(salarie({ contratPeriodeEssai: { valeur: 2, unite: "mois" } })),
    ).not.toBe(
      empreinteMentions(salarie({ contratPeriodeEssai: { valeur: 2, unite: "semaines" } })),
    );
  });

  it("🔑 la même durée dans la même unité rend la MÊME empreinte", () => {
    // Témoin discriminant : sans lui, une empreinte aléatoire passerait le test
    // ci-dessus et déclarerait périmée toute pièce, à chaque lecture.
    expect(
      empreinteMentions(salarie({ contratPeriodeEssai: { valeur: 2, unite: "semaines" } })),
    ).toBe(empreinteMentions(salarie({ contratPeriodeEssai: { valeur: 2, unite: "semaines" } })));
  });

  it("⚠️ retirer la période d'essai change l'empreinte", () => {
    expect(empreinteMentions(salarie({ contratPeriodeEssai: null }))).not.toBe(
      empreinteMentions(salarie({ contratPeriodeEssai: { valeur: 2, unite: "mois" } })),
    );
  });
});
