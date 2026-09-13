/**
 * Tests — éligibilité au contrat de travail.
 *
 * 🔑 CE QUI SE TESTE ICI EST UN REFUS. Un contrat de travail incomplet n'est pas
 * « un peu moins bon » : une mention manquante déclenche un régime supplétif
 * toujours plus favorable au salarié, et deux omissions sur un CDD le
 * requalifient en CDI. Les tests qui comptent sont donc ceux qui vérifient que
 * la pièce n'est PAS produite.
 */

import { describe, expect, it } from "vitest";

import {
  motifSpecimenContrat,
  plafondLegalEssaiMois,
  plafondLegalEssai,
  verifierEligibiliteContrat,
  type SalarieContrat,
} from "./contrat-travail";

function salarie(over: Partial<SalarieContrat> = {}): SalarieContrat {
  return {
    statut: "salarie",
    nom: "Roux",
    prenom: "Camille",
    dateNaissance: new Date("1990-04-12T00:00:00.000Z"),
    lieuNaissance: "Grenoble",
    adressePersonnelle: "4 rue des Écoles, 38000 Grenoble",
    dateEmbauche: new Date("2026-10-01T00:00:00.000Z"),
    contratType: "cdi",
    contratPoste: "Formateur en intelligence artificielle",
    contratClassification: "Technicien — niveau C, coefficient 200",
    contratDureeHebdoHeures: 35,
    contratPeriodeEssaiMois: 2,
    contratLieuTravail: "11 Avenue Paul Verlaine, 38100 Grenoble",
    contratDateFin: null,
    contratMotifCdd: null,
    fixeMensuelBrutCents: 200_000,
    ...over,
  };
}

function refusDe(s: SalarieContrat): string[] {
  const v = verifierEligibiliteContrat(s);
  return v.eligible ? [] : [...v.refus];
}

describe("verifierEligibiliteContrat — un CDI complet", () => {
  it("accepte un dossier complet", () => {
    expect(verifierEligibiliteContrat(salarie())).toEqual({ eligible: true });
  });

  it("🔴 REFUSE à un sous-traitant, et dit pourquoi c'est dangereux", () => {
    // Établir un contrat de travail à un indépendant créerait de toutes pièces
    // le lien de subordination que tout le domaine s'emploie à ne pas avoir.
    const refus = refusDe(salarie({ statut: "sous_traitant" }));
    expect(refus).toContain("pas_un_salarie");
  });

  it("refuse à un dirigeant — mandat social, pas contrat de travail", () => {
    expect(refusDe(salarie({ statut: "dirigeant" }))).toContain("pas_un_salarie");
  });

  it("🔴 rend TOUS les motifs à la fois, pas le premier", () => {
    // Sur un contrat de travail, chaque mention manquante a une conséquence
    // propre : les découvrir une par une fait franchir quatre obstacles en
    // quatre jours au lieu d'un.
    const refus = refusDe(
      salarie({
        contratPoste: null,
        contratClassification: "  ",
        contratLieuTravail: null,
        fixeMensuelBrutCents: null,
      }),
    );
    expect(refus).toEqual(
      expect.arrayContaining([
        "poste_absent",
        "classification_absente",
        "lieu_travail_absent",
        "remuneration_absente",
      ]),
    );
  });

  it("🔑 la DURÉE manquante est refusée — un temps partiel muet est présumé plein", () => {
    // Art. L.3123-6 : un contrat à temps partiel qui n'énonce pas la durée est
    // présumé à temps complet, et c'est à l'employeur de prouver le contraire.
    // L'omission ne crée donc pas un flou : elle crée une dette.
    expect(refusDe(salarie({ contratDureeHebdoHeures: null }))).toContain("duree_absente");
    expect(refusDe(salarie({ contratDureeHebdoHeures: 0 }))).toContain("duree_absente");
  });

  it("refuse une identité incomplète", () => {
    expect(refusDe(salarie({ dateNaissance: null }))).toContain("identite_incomplete");
    expect(refusDe(salarie({ adressePersonnelle: " " }))).toContain("identite_incomplete");
  });
});

describe("le CDD, et les deux omissions qui le requalifient", () => {
  const cdd = (over: Partial<SalarieContrat> = {}) =>
    salarie({
      contratType: "cdd",
      contratDateFin: new Date("2027-03-31T00:00:00.000Z"),
      contratMotifCdd: "Accroissement temporaire d'activité — déploiement du catalogue IA.",
      ...over,
    });

  it("accepte un CDD avec terme et motif", () => {
    expect(verifierEligibiliteContrat(cdd())).toEqual({ eligible: true });
  });

  it("🔴 REFUSE un CDD sans terme — il serait réputé à durée indéterminée", () => {
    expect(refusDe(cdd({ contratDateFin: null }))).toContain("cdd_sans_terme");
  });

  it("🔴 REFUSE un CDD sans motif — requalification en CDI", () => {
    expect(refusDe(cdd({ contratMotifCdd: "   " }))).toContain("cdd_sans_motif");
  });

  it("refuse un terme antérieur à l'entrée en fonction", () => {
    expect(refusDe(cdd({ contratDateFin: new Date("2026-09-01T00:00:00.000Z") }))).toContain(
      "cdd_terme_avant_debut",
    );
  });

  it("🔑 CONTRE-TÉMOIN : un CDI n'a PAS besoin de terme ni de motif", () => {
    // Sans lui, les trois refus ci-dessus resteraient verts si la règle exigeait
    // un terme de TOUT LE MONDE — on mesurerait une exigence générale au lieu
    // d'une exigence propre au CDD.
    expect(
      verifierEligibiliteContrat(salarie({ contratDateFin: null, contratMotifCdd: null })),
    ).toEqual({ eligible: true });
  });
});

describe("le SPÉCIMEN, quand la convention collective manque", () => {
  it("🔴 sans convention, la pièce est marquée et le motif est écrit", () => {
    const motif = motifSpecimenContrat(null);
    expect(motif).not.toBeNull();
    expect(motif).toMatch(/classification/i);
  });

  it("un libellé vide vaut absence", () => {
    expect(motifSpecimenContrat({ libelle: "  ", idcc: "1516" })).not.toBeNull();
  });

  it("avec convention renseignée, aucun marquage", () => {
    expect(
      motifSpecimenContrat({
        libelle: "Convention collective nationale des organismes de formation",
        idcc: "1516",
      }),
    ).toBeNull();
  });
});

describe("plafondLegalEssaiMois", () => {
  it("rend le plafond LÉGAL par catégorie", () => {
    expect(plafondLegalEssaiMois("Cadre — position 2.1")).toBe(4);
    expect(plafondLegalEssaiMois("Technicien niveau C")).toBe(3);
    expect(plafondLegalEssaiMois("Employé niveau B")).toBe(2);
  });

  it("🔑 rend `null` quand la classification ne permet pas de trancher", () => {
    // Mieux vaut ne rien dire que se tromper de catégorie : une période d'essai
    // trop longue est nulle, et le salarié réputé confirmé depuis le départ.
    expect(plafondLegalEssaiMois("Niveau 3, coefficient 210")).toBeNull();
    expect(plafondLegalEssaiMois(null)).toBeNull();
    expect(plafondLegalEssaiMois("   ")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Le vocabulaire de la convention, pas celui du Code du travail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 CONSTATÉ LE 13/09, QUAND LA CONVENTION A ÉTÉ ARBITRÉE : Syntec/Bétic
 * (IDCC 1486) ne classe pas en « cadre » ni en « technicien ». Elle classe en
 * **ETAM** et en **IC**.
 *
 * Une classification écrite « IC position 2.1, coefficient 100 » ne déclenchait
 * donc AUCUNE aide. Le repli `null` n'était pas faux — il se tait plutôt que de
 * se tromper — mais il se taisait précisément là où l'aide sert.
 */
describe("plafondLegalEssaiMois — il parle aussi le vocabulaire de la convention", () => {
  it("🔴 « IC » vaut cadre : 4 mois", () => {
    expect(plafondLegalEssaiMois("IC position 2.1, coefficient 100")).toBe(4);
    expect(plafondLegalEssaiMois("Ingénieur d'études")).toBe(4);
    // Sans accent : une saisie au clavier ne doit pas changer le verdict.
    expect(plafondLegalEssaiMois("Ingenieur d'etudes")).toBe(4);
  });

  it("🔴 LE TÉMOIN QUI COMPTE : « technicien » contient « ic » et reste à 3 mois", () => {
    /*
      🔑 C'est la raison d'être des bornes de mot dans le motif — et j'ai écrit
      ce bug avant de l'écrire dans le commentaire : un `/ic/` sans borne
      rendait 4 mois sur « technicien ». Quatre au lieu de trois, sur une durée
      dont le dépassement rend la rupture abusive.

      Ce témoin est le seul qui distingue le motif juste du motif faux.
    */
    expect(plafondLegalEssaiMois("Technicien de maintenance")).toBe(3);
    expect(plafondLegalEssaiMois("ETAM technicien position 2.2")).toBe(3);
  });

  it("⚠️ « ETAM » SEUL rend null — et c'est un refus, pas un oubli", () => {
    /*
      « Employés, Techniciens et Agents de Maîtrise » chevauche DEUX plafonds
      légaux : deux mois pour un employé, trois pour un technicien ou un agent
      de maîtrise. Rendre 3 sur un ETAM position 1.x annoncerait un plafond
      SUPÉRIEUR au vrai.

      Il suffit d'écrire « ETAM technicien » pour que l'aide reparle — le test
      au-dessus le montre.
    */
    expect(plafondLegalEssaiMois("ETAM position 1.1, coefficient 230")).toBeNull();
    expect(plafondLegalEssaiMois("ETAM")).toBeNull();
  });

  it("« cadre » l'emporte, quel que soit le reste du libellé", () => {
    // L'ordre des tests compte : « ingénieur cadre » doit rendre 4 par la
    // première branche, jamais retomber sur une catégorie inférieure.
    expect(plafondLegalEssaiMois("Ingénieur cadre, position 3.1")).toBe(4);
    expect(plafondLegalEssaiMois("Cadre dirigeant")).toBe(4);
  });

  it("le vocabulaire du Code du travail continue de fonctionner", () => {
    // 🔑 Témoin de non-régression : l'ajout ne doit rien retirer.
    expect(plafondLegalEssaiMois("Agent de maîtrise")).toBe(3);
    expect(plafondLegalEssaiMois("Employé administratif")).toBe(2);
    expect(plafondLegalEssaiMois("Ouvrier qualifié")).toBe(2);
    expect(plafondLegalEssaiMois("")).toBeNull();
    expect(plafondLegalEssaiMois(null)).toBeNull();
  });
});

describe("🔴 plafondLegalEssai — le CDD n'obéit PAS à l'article du CDI", () => {
  /*
    Recette du 13/09. `plafondLegalEssaiMois` ne reçoit que la CLASSIFICATION :
    elle rend donc toujours le plafond de l'art. L.1221-19, celui du CDI. Sur un
    CDD de six mois classé « Cadre », l'écran affichait en gris, rassurant :
    « Plafond légal : 4 mois ».

    Or l'art. L.1242-10 limite l'essai d'un CDD à UN JOUR PAR SEMAINE de durée
    prévue, dans la limite de deux semaines jusqu'à six mois, d'un mois au-delà.
    Quatre mois y sont NULS : le salarié est réputé confirmé depuis son premier
    jour, et une rupture pendant « l'essai » devient un licenciement sans cause
    réelle et sérieuse.

    ⚠️ Le gabarit PDF citait DÉJÀ L.1242-10 en note de bas de page — sans que
    rien ne l'ait jamais appliqué. Une référence juridique affichée sous une
    valeur qu'elle contredit ne prévient pas : elle atteste.
  */
  const cadre = "Cadre — position 2.1";
  const j = (s: string) => new Date(`${s}T00:00:00.000Z`);

  it("🔴 CDD de 6 mois classé CADRE : DEUX SEMAINES, pas quatre mois", () => {
    const p = plafondLegalEssai({
      contratType: "cdd",
      contratClassification: cadre,
      dateEmbauche: j("2026-10-01"),
      contratDateFin: j("2027-03-31"),
    });
    expect(p?.article).toBe("L.1242-10");
    expect(p?.plafondMois).toBe(0);
    expect(p?.libelle).toMatch(/DEUX SEMAINES/);
  });

  it("🔑 ce plafond est INEXPRIMABLE dans un champ en mois entiers, et le dit", () => {
    // Le champ est un `Int` en mois : aucune valeur non nulle n'y est légale.
    // Le taire ferait saisir « 1 » en croyant rester sous le plafond.
    const p = plafondLegalEssai({
      contratType: "cdd",
      contratClassification: cadre,
      dateEmbauche: j("2026-10-01"),
      contratDateFin: j("2027-01-31"),
    });
    expect(p?.inexprimableEnMois).toBe(true);
    expect(p?.libelle).toMatch(/laissez-le vide/i);
  });

  it("🔴 CDD de PLUS de six mois : un mois", () => {
    const p = plafondLegalEssai({
      contratType: "cdd",
      contratClassification: cadre,
      dateEmbauche: j("2026-10-01"),
      contratDateFin: j("2027-10-01"),
    });
    expect(p?.article).toBe("L.1242-10");
    expect(p?.plafondMois).toBe(1);
    expect(p?.inexprimableEnMois).toBe(false);
  });

  it("⚠️ un CDD pile à la limite bascule du côté PROTECTEUR du salarié", () => {
    // 183 jours exactement : on retient le plafond le plus court.
    const p = plafondLegalEssai({
      contratType: "cdd",
      contratClassification: cadre,
      dateEmbauche: j("2026-10-01"),
      contratDateFin: j("2027-04-02"),
    });
    expect(p?.plafondMois).toBe(0);
  });

  it("🔑 CDD sans terme connu : on se TAIT plutôt que d'appliquer au hasard", () => {
    expect(
      plafondLegalEssai({
        contratType: "cdd",
        contratClassification: cadre,
        dateEmbauche: j("2026-10-01"),
        contratDateFin: null,
      }),
    ).toBeNull();
    expect(
      plafondLegalEssai({
        contratType: "cdd",
        contratClassification: cadre,
        dateEmbauche: null,
        contratDateFin: j("2027-03-31"),
      }),
    ).toBeNull();
  });

  it("🔑 un terme AVANT l'embauche ne produit pas un plafond absurde", () => {
    expect(
      plafondLegalEssai({
        contratType: "cdd",
        contratClassification: cadre,
        dateEmbauche: j("2027-03-31"),
        contratDateFin: j("2026-10-01"),
      }),
    ).toBeNull();
  });

  it("🔑 LE CDI GARDE SON ARTICLE — le témoin qui discrimine", () => {
    /*
      Sans lui, « toujours rendre L.1242-10 » passerait tous les tests ci-dessus
      et ferait afficher « deux semaines » sur un CDI de cadre — l'erreur
      symétrique, tout aussi fausse, et qui ferait raccourcir des essais
      parfaitement légaux.
    */
    const p = plafondLegalEssai({
      contratType: "cdi",
      contratClassification: cadre,
      dateEmbauche: j("2026-10-01"),
      contratDateFin: null,
    });
    expect(p?.article).toBe("L.1221-19");
    expect(p?.plafondMois).toBe(4);
    expect(p?.libelle).toMatch(/convention peut en fixer un plus court/i);
  });

  it.each([
    ["Technicien niveau C", 3],
    ["Employé niveau B", 2],
  ])("CDI %s → %i mois", (classification, attendu) => {
    expect(
      plafondLegalEssai({
        contratType: "cdi",
        contratClassification: classification,
        dateEmbauche: null,
        contratDateFin: null,
      })?.plafondMois,
    ).toBe(attendu);
  });

  it("se tait sur une classification inclassable", () => {
    expect(
      plafondLegalEssai({
        contratType: "cdi",
        contratClassification: "Niveau 3, coefficient 210",
        dateEmbauche: null,
        contratDateFin: null,
      }),
    ).toBeNull();
  });
});
