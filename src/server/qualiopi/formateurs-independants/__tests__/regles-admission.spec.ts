/**
 * Lot L5b — table de vérité des RÈGLES D'ADMISSION d'un formateur indépendant
 * (02-ARCHITECTURE §2.7, 05 E8, 10d F-5).
 *
 * Une seule vérité registre : celle du contrôle L4 (`jugerControleRegistre`).
 * L'admission y AJOUTE ses motifs (SIREN d'Axion-IA, hors de France, coopérative,
 * création récente, titulaire différent, diffusion partielle, ancien salarié) et
 * choisit l'ÉCRAN de l'étape 2 : jamais d'impasse, chaque écran dit le geste suivant.
 */

import { describe, expect, it } from "vitest";

import type { EntrepriseRegistre } from "@/server/registre-entreprises/annuaire";

import {
  ECRANS_QUI_LAISSENT_CONTINUER,
  NATURES_COOPERATIVES,
  jugerAdmissionFormateur,
  type EntreeAdmission,
} from "../regles-admission";

const MAINTENANT = new Date("2026-10-11T10:00:00.000Z");
const SIRET = "73282932000074";

function entreprise(p: Partial<EntrepriseRegistre> = {}): EntrepriseRegistre {
  return {
    siren: SIRET.slice(0, 9),
    siret: SIRET,
    denomination: "MARIE DUPONT",
    adresse: "12 RUE DES LILAS 69100 VILLEURBANNE",
    naf: "85.59A",
    active: true,
    francaise: true,
    statutSuggere: "micro_entrepreneur",
    diffusionPartielle: false,
    personnes: [{ nom: "DUPONT", prenoms: "MARIE", qualite: null }],
    enrichissement: {
      estOrganismeFormation: true,
      ndaListe: ["84691234569"],
      estQualiopi: false,
      naf25: null,
      codePostal: "69100",
      communeInsee: "69266",
      latitude: 45.77,
      longitude: 4.88,
      dateCreation: "2019-03-01",
      natureJuridique: "1000",
      estEntrepreneurIndividuel: true,
      nombreEtablissementsOuverts: 1,
    },
    ...p,
  };
}

function entree(p: Partial<EntreeAdmission> = {}): EntreeAdmission {
  return {
    siret: SIRET,
    nda: "84 69 12345 69",
    registre: { ok: true, entreprise: entreprise() },
    identite: { prenom: "Marie", nom: "Dupont" },
    ancienSalarieMoinsDe12Mois: false,
    maintenant: MAINTENANT,
    ...p,
  };
}

describe("règles d'admission d'un formateur indépendant (L5b)", () => {
  it("vert : établissement ouvert, activité de formation, numéro listé au même SIREN", () => {
    const v = jugerAdmissionFormateur(entree());
    expect(v).toMatchObject({ verdict: "vert", motifs: [], ecran: "trouvee" });
  });

  it("entreprise fermée : rouge, écran « fermée » qui propose une autre issue, jamais une impasse", () => {
    const v = jugerAdmissionFormateur(
      entree({ registre: { ok: true, entreprise: entreprise({ active: false }) } }),
    );
    expect(v.verdict).toBe("rouge");
    expect(v.motifs).toContain("etablissement_ferme");
    expect(v.ecran).toBe("fermee");
    expect(ECRANS_QUI_LAISSENT_CONTINUER.has(v.ecran)).toBe(false);
  });

  it("registre muet : orange « à contrôler », jamais rouge, et l'on peut continuer", () => {
    const v = jugerAdmissionFormateur(entree({ registre: { ok: false, raison: "indisponible" } }));
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("registre_muet");
    expect(v.ecran).toBe("muette");
    expect(ECRANS_QUI_LAISSENT_CONTINUER.has(v.ecran)).toBe(true);
  });

  it("numéro introuvable au registre : rouge, écran « introuvable »", () => {
    const v = jugerAdmissionFormateur(entree({ registre: { ok: false, raison: "introuvable" } }));
    expect(v.verdict).toBe("rouge");
    expect(v.motifs).toContain("siret_introuvable");
    expect(v.ecran).toBe("introuvable");
  });

  it("SIRET mal formé : rouge, écran « introuvable », sans appel au registre", () => {
    const v = jugerAdmissionFormateur(
      entree({ siret: "123", registre: { ok: false, raison: "siren_invalide" } }),
    );
    expect(v.verdict).toBe("rouge");
    expect(v.ecran).toBe("introuvable");
  });

  it("le SIREN d'Axion-IA : rouge, écran dédié", () => {
    const v = jugerAdmissionFormateur(
      entree({
        siret: "10801863100010",
        registre: {
          ok: true,
          entreprise: entreprise({ siren: "108018631", siret: "10801863100010" }),
        },
      }),
    );
    expect(v.verdict).toBe("rouge");
    expect(v.motifs).toContain("siren_de_la_societe");
    expect(v.ecran).toBe("societe_axion");
  });

  it("hors de France : rouge pour le contrat, écran « hors de France » (contrat séparé)", () => {
    const v = jugerAdmissionFormateur(
      entree({ registre: { ok: true, entreprise: entreprise({ francaise: false }) } }),
    );
    expect(v.verdict).toBe("rouge");
    expect(v.motifs).toContain("hors_france");
    expect(v.ecran).toBe("hors_france");
  });

  it("coopérative (nature juridique) : orange, écran « statut pas encore ouvert »", () => {
    const nature = [...NATURES_COOPERATIVES][0]!;
    const e = entreprise();
    const v = jugerAdmissionFormateur(
      entree({
        registre: {
          ok: true,
          entreprise: { ...e, enrichissement: { ...e.enrichissement!, natureJuridique: nature } },
        },
      }),
    );
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("statut_non_ouvert");
    expect(v.ecran).toBe("statut_non_ouvert");
  });

  it("activité voisine (conseil en informatique) : orange, jamais rouge (le NAF est indicatif)", () => {
    const v = jugerAdmissionFormateur(
      entree({ registre: { ok: true, entreprise: entreprise({ naf: "62.02A" }) } }),
    );
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("activite_a_controler");
    expect(v.ecran).toBe("trouvee");
  });

  it("numéro de déclaration « en cours » : orange, on continue", () => {
    const v = jugerAdmissionFormateur(entree({ nda: "en cours" }));
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("nda_en_cours");
    expect(v.ecran).toBe("trouvee");
  });

  it("numéro absent de la liste publique : orange (la liste arrive en retard), jamais rouge", () => {
    const v = jugerAdmissionFormateur(entree({ nda: "11111111111" }));
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("nda_hors_liste");
  });

  it("création de moins de 3 mois : orange", () => {
    const e = entreprise();
    const v = jugerAdmissionFormateur(
      entree({
        registre: {
          ok: true,
          entreprise: {
            ...e,
            enrichissement: { ...e.enrichissement!, dateCreation: "2026-08-20" },
          },
        },
      }),
    );
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("creation_recente");
  });

  it("titulaire au registre différent du formateur : orange ; accents et casse ignorés", () => {
    const autre = jugerAdmissionFormateur(
      entree({
        registre: {
          ok: true,
          entreprise: entreprise({
            personnes: [{ nom: "MARTIN", prenoms: "PAUL", qualite: null }],
          }),
        },
      }),
    );
    expect(autre.motifs).toContain("titulaire_different");
    const accents = jugerAdmissionFormateur(
      entree({
        identite: { prenom: "Hélène", nom: "Lefèvre" },
        registre: {
          ok: true,
          entreprise: entreprise({
            personnes: [{ nom: "HELENE LEFEVRE", prenoms: "", qualite: null, enBloc: true }],
          }),
        },
      }),
    );
    expect(accents.motifs).not.toContain("titulaire_different");
  });

  it("diffusion partielle : orange (vérification impossible), jamais une alerte de titulaire", () => {
    const v = jugerAdmissionFormateur(
      entree({
        registre: { ok: true, entreprise: entreprise({ diffusionPartielle: true, personnes: [] }) },
      }),
    );
    expect(v.motifs).toContain("diffusion_partielle");
    expect(v.motifs).not.toContain("titulaire_different");
  });

  it("ancien salarié d'Axion-IA depuis moins de 12 mois : orange ; non déclaré : rien", () => {
    expect(jugerAdmissionFormateur(entree({ ancienSalarieMoinsDe12Mois: true })).motifs).toContain(
      "ancien_salarie",
    );
    expect(
      jugerAdmissionFormateur(entree({ ancienSalarieMoinsDe12Mois: null })).motifs,
    ).not.toContain("ancien_salarie");
  });

  it("pur : aucune horloge lue, même entrée → même verdict", () => {
    expect(jugerAdmissionFormateur(entree())).toEqual(jugerAdmissionFormateur(entree()));
  });
});
