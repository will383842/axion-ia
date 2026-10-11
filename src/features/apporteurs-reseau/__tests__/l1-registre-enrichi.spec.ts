/**
 * Lot L1 (chantier formateurs freelance) — le registre enrichi, À LA DEMANDE.
 *
 * Ce que le registre public dit d'un organisme de formation (déclaré, numéros
 * listés, Qualiopi), de sa commune et de sa forme. Sans `enrichi: true`, la
 * lecture rend EXACTEMENT ce qu'elle rendait : non-régression apporteurs.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { luhnValid } from "@/lib/siret";

import {
  enrichissementDuRegistre,
  lireEntrepriseParSiren,
  lireEtablissementParSiret,
} from "../annuaire";

const SIREN = "732829320";
let SIRET = "";
for (let i = 0; i < 100000 && !SIRET; i++) {
  const c = `${SIREN}${String(i).padStart(5, "0")}`;
  if (luhnValid(c)) SIRET = c;
}

const RESULTAT = {
  siren: SIREN,
  nom_complet: "MARIE EXEMPLE",
  etat_administratif: "A",
  nature_juridique: "1000",
  date_creation: "2021-03-15",
  nombre_etablissements_ouverts: 1,
  activite_principale: "85.59A",
  activite_principale_naf25: "85.59Y",
  complements: {
    est_entrepreneur_individuel: true,
    est_organisme_formation: true,
    est_qualiopi: false,
    liste_id_organisme_formation: ["84691234569"],
  },
  dirigeants: [],
  siege: {
    siret: SIRET,
    adresse: "1 rue de l'Exemple 69100 Villeurbanne",
    activite_principale: "85.59A",
    etat_administratif: "A",
    code_postal: "69100",
    commune: "69266",
    latitude: "45.7667",
    longitude: "4.8800",
  },
  matching_etablissements: [
    {
      siret: SIRET,
      adresse: "1 rue de l'Exemple 69100 Villeurbanne",
      activite_principale: "85.59A",
      etat_administratif: "A",
      code_postal: "69100",
      commune: "69266",
      latitude: "45.7667",
      longitude: "4.8800",
    },
  ],
};

const registre = () =>
  vi.fn(async () => new Response(JSON.stringify({ results: [RESULTAT] }), { status: 200 }));

const ATTENDU = {
  estOrganismeFormation: true,
  ndaListe: ["84691234569"],
  estQualiopi: false,
  naf25: "85.59Y",
  codePostal: "69100",
  communeInsee: "69266",
  latitude: 45.7667,
  longitude: 4.88,
  dateCreation: "2021-03-15",
  natureJuridique: "1000",
  estEntrepreneurIndividuel: true,
  nombreEtablissementsOuverts: 1,
};

describe("L1 — non-régression apporteurs de `annuaire.ts`", () => {
  it("par SIREN, sans option : aucun champ nouveau", async () => {
    const r = await lireEntrepriseParSiren(SIREN, { fetch: registre() });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.entreprise).sort()).toEqual(
        [
          "siren",
          "denomination",
          "adresse",
          "naf",
          "active",
          "francaise",
          "statutSuggere",
          "diffusionPartielle",
          "personnes",
          "dirigeantsSocietes",
        ].sort(),
      );
    }
  });

  it("par SIRET, sans option : aucun champ nouveau", async () => {
    const r = await lireEtablissementParSiret(SIRET, { fetch: registre() });
    expect(r.ok).toBe(true);
    if (r.ok) expect("enrichissement" in r.entreprise).toBe(false);
  });
});

describe("L1 — registre enrichi, à la demande", () => {
  it("par SIREN : ce que le registre dit de l'organisme", async () => {
    const r = await lireEntrepriseParSiren(SIREN, { fetch: registre(), enrichi: true });
    expect(r.ok && r.entreprise.enrichissement).toEqual(ATTENDU);
  });

  it("par SIRET : la commune est celle de l'établissement", async () => {
    const r = await lireEtablissementParSiret(SIRET, { fetch: registre(), enrichi: true });
    expect(r.ok && r.entreprise.enrichissement).toEqual(ATTENDU);
  });

  it("un registre muet ne devient jamais un « non » : null, pas false", () => {
    expect(enrichissementDuRegistre({}, {})).toEqual({
      estOrganismeFormation: null,
      ndaListe: [],
      estQualiopi: null,
      naf25: null,
      codePostal: null,
      communeInsee: null,
      latitude: null,
      longitude: null,
      dateCreation: null,
      natureJuridique: null,
      estEntrepreneurIndividuel: null,
      nombreEtablissementsOuverts: null,
    });
  });

  it("numéros de déclaration normalisés, illisibles écartés", () => {
    const e = enrichissementDuRegistre(
      { complements: { liste_id_organisme_formation: ["84 69 1234569", "x", 12] } },
      { latitude: "n/a" },
    );
    expect(e.ndaListe).toEqual(["84691234569"]);
    expect(e.latitude).toBeNull();
  });
});
