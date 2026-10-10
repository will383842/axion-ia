import { describe, expect, it } from "vitest";

import { personnesDuRegistre, type PersonneRegistre, type ResultatRegistre } from "../annuaire";
import { comparerNomAuRegistre, verdictNomRegistre } from "../nom-registre";

// Décision de Will (10/10) : le nom du contrat doit correspondre à une personne que le
// registre rattache à l'entreprise. Une alerte, jamais un blocage.

const pp = (nom: string, prenoms: string, qualite: string | null = null): PersonneRegistre => ({
  nom,
  prenoms,
  qualite,
});

describe("comparerNomAuRegistre", () => {
  it.each<[string, { prenom: string; nom: string }, PersonneRegistre[], string]>([
    ["identique", { prenom: "Marie", nom: "Dupont" }, [pp("DUPONT", "MARIE")], "correspond"],
    [
      "accents oubliés au contrat",
      { prenom: "Helene", nom: "Lefevre" },
      [pp("LEFÈVRE", "HÉLÈNE")],
      "correspond",
    ],
    [
      "majuscules et minuscules mêlées",
      { prenom: "mArIe", nom: "DUpont" },
      [pp("Dupont", "Marie")],
      "correspond",
    ],
    [
      "plusieurs prénoms au registre",
      { prenom: "Marie", nom: "Dupont" },
      [pp("DUPONT", "MARIE CLAIRE LOUISE")],
      "correspond",
    ],
    [
      "deuxième prénom utilisé au contrat",
      { prenom: "Claire", nom: "Dupont" },
      [pp("DUPONT", "Marie, Claire")],
      "correspond",
    ],
    [
      "prénom composé avec tiret",
      { prenom: "Jean-Pierre", nom: "Martin" },
      [pp("MARTIN", "JEAN PIERRE")],
      "correspond",
    ],
    [
      "apostrophe dans le nom",
      { prenom: "Yann", nom: "Le Goff" },
      [pp("LE GOFF", "YANN")],
      "correspond",
    ],
    [
      "nom avec apostrophe tapé sans",
      { prenom: "Paul", nom: "D'Almeida" },
      [pp("D ALMEIDA", "PAUL")],
      "correspond",
    ],
    [
      "prénom et nom inversés au contrat",
      { prenom: "Dupont", nom: "Marie" },
      [pp("DUPONT", "MARIE")],
      "correspond",
    ],
    [
      "nom d'usage composé au contrat, nom de naissance au registre",
      { prenom: "Sophie", nom: "Martin-Dupont" },
      [pp("DUPONT", "SOPHIE")],
      "correspond",
    ],
    [
      "nom composé au registre, une partie au contrat",
      { prenom: "Sophie", nom: "Martin" },
      [pp("MARTIN DUPONT", "SOPHIE")],
      "correspond",
    ],
    [
      "homonyme de nom, prénom différent",
      { prenom: "Marie", nom: "Dupont" },
      [pp("DUPONT", "PAUL ANDRÉ")],
      "ne_correspond_pas",
    ],
    [
      "même prénom, autre nom",
      { prenom: "Marie", nom: "Dupont" },
      [pp("DURAND", "MARIE")],
      "ne_correspond_pas",
    ],
    [
      "une particule seule ne suffit pas",
      { prenom: "Marie", nom: "de Villiers" },
      [pp("DE LA TOUR", "MARIE")],
      "ne_correspond_pas",
    ],
    [
      "société, trois dirigeants dont le troisième correspond",
      { prenom: "Luc", nom: "Bernard" },
      [
        pp("MOREAU", "ALICE", "Président"),
        pp("PETIT", "LUC", "Directeur général"),
        pp("BERNARD", "LUC ANTOINE", "Directeur général délégué"),
      ],
      "correspond",
    ],
    [
      "société, trois dirigeants, aucun ne correspond",
      { prenom: "Luc", nom: "Bernard" },
      [pp("MOREAU", "ALICE"), pp("PETIT", "LUC"), pp("ROUX", "JEAN")],
      "ne_correspond_pas",
    ],
    [
      "titulaire lu en un seul libellé (entrepreneur individuel)",
      { prenom: "Marie", nom: "Dupont" },
      [{ nom: "MARIE CLAIRE DUPONT", prenoms: "", qualite: null, enBloc: true }],
      "correspond",
    ],
    [
      "titulaire en un seul libellé, autre personne",
      { prenom: "Marie", nom: "Dupont" },
      [{ nom: "PAUL DURAND", prenoms: "", qualite: null, enBloc: true }],
      "ne_correspond_pas",
    ],
    [
      "aucune personne au registre (diffusion partielle)",
      { prenom: "Marie", nom: "Dupont" },
      [],
      "non_verifiable",
    ],
    [
      "nom du contrat incomplet (un seul mot)",
      { prenom: "Marie", nom: "" },
      [pp("DUPONT", "MARIE")],
      "non_verifiable",
    ],
  ])("%s → %s", (_cas, contrat, personnes, attendu) => {
    expect(comparerNomAuRegistre(contrat, personnes)).toBe(attendu);
  });
});

describe("personnesDuRegistre : lecture de la réponse du registre", () => {
  it("société : garde les personnes physiques, compte les sociétés dirigeantes", () => {
    const r = personnesDuRegistre(
      {
        nom_complet: "ACME",
        dirigeants: [
          {
            type_dirigeant: "personne physique",
            nom: "DUPONT",
            prenoms: "MARIE",
            qualite: "Gérant",
          },
          { type_dirigeant: "personne morale", siren: "123456789", denomination: "HOLDING X" },
          { type_dirigeant: "personne physique", prenoms: "SANS NOM" },
          null,
        ],
      },
      false,
    );
    expect(r).toEqual({
      personnes: [{ nom: "DUPONT", prenoms: "MARIE", qualite: "Gérant" }],
      dirigeantsSocietes: 1,
    });
  });

  it("société dirigée par une personne morale seulement → non vérifiable", () => {
    const r = personnesDuRegistre(
      { dirigeants: [{ type_dirigeant: "personne morale", denomination: "HOLDING X" }] },
      false,
    );
    expect(r.personnes).toEqual([]);
    expect(comparerNomAuRegistre({ prenom: "Marie", nom: "Dupont" }, r.personnes)).toBe(
      "non_verifiable",
    );
  });

  it("entrepreneur individuel sans dirigeant publié : titulaire lu dans nom_complet", () => {
    const r = personnesDuRegistre({ nom_complet: "MARIE DUPONT" }, true);
    expect(r.personnes).toEqual([
      { nom: "MARIE DUPONT", prenoms: "", qualite: "entrepreneur individuel", enBloc: true },
    ]);
  });

  it("entrepreneur individuel en diffusion partielle : aucune personne", () => {
    expect(personnesDuRegistre({ nom_complet: "[NON-DIFFUSIBLE]" }, true).personnes).toEqual([]);
    expect(personnesDuRegistre({}, true).personnes).toEqual([]);
  });

  it("champ dirigeants absent ou mal formé : aucune personne, sans erreur", () => {
    expect(personnesDuRegistre({ dirigeants: "?" }, false)).toEqual({
      personnes: [],
      dirigeantsSocietes: 0,
    });
  });
});

describe("verdictNomRegistre : les quatre messages de la console", () => {
  const entreprise = (over: Record<string, unknown> = {}): ResultatRegistre =>
    ({
      ok: true,
      entreprise: {
        siren: "732829320",
        siret: "73282932000074",
        denomination: "ACME",
        adresse: "1 rue X",
        naf: "7022Z",
        active: true,
        francaise: true,
        statutSuggere: null,
        diffusionPartielle: false,
        personnes: [pp("DUPONT", "Marie Claire", "Gérante")],
        dirigeantsSocietes: 0,
        ...over,
      },
    }) as ResultatRegistre;

  it("correspond", () => {
    expect(verdictNomRegistre({ prenom: "Marie", nom: "Dupont" }, entreprise())).toEqual({
      niveau: "correspond",
      message:
        "Le nom du contrat correspond au titulaire de l'entreprise (Marie Claire DUPONT, gérante).",
    });
  });

  it("ne correspond pas : alerte avec les personnes trouvées", () => {
    expect(verdictNomRegistre({ prenom: "Paul", nom: "Durand" }, entreprise())).toEqual({
      niveau: "alerte",
      message:
        "Le nom du contrat (Paul Durand) ne correspond à personne dans le registre pour ce SIRET : personnes trouvées : Marie Claire DUPONT, gérante. Vérifiez la pièce d'identité et le RIB avant de contresigner.",
    });
  });

  it("diffusion partielle : vérification impossible, pas d'alerte", () => {
    const v = verdictNomRegistre(
      { prenom: "Paul", nom: "Durand" },
      entreprise({ personnes: [], diffusionPartielle: true }),
    );
    expect(v.niveau).toBe("impossible");
    expect(v.message).toBe(
      "Vérification automatique impossible (le registre ne publie pas le nom de cet entrepreneur, à sa demande) : comparez vous-même la pièce d'identité avec l'entreprise.",
    );
  });

  it("dirigée par une société : vérification impossible", () => {
    const v = verdictNomRegistre(
      { prenom: "Paul", nom: "Durand" },
      entreprise({ personnes: [], dirigeantsSocietes: 1 }),
    );
    expect(v.niveau).toBe("impossible");
    expect(v.message).toContain("dirigée par une autre société");
  });

  it("registre muet", () => {
    expect(
      verdictNomRegistre({ prenom: "Paul", nom: "Durand" }, { ok: false, raison: "indisponible" }),
    ).toEqual({
      niveau: "registre_muet",
      message: "Registre indisponible, rechargez dans quelques minutes.",
    });
  });
});
