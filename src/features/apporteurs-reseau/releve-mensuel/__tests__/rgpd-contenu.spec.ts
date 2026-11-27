import { describe, expect, it } from "vitest";

import { calculerReleve } from "../calcul";
import { commission, piece } from "./fixtures";

const INTERDITES = [
  "email",
  "e-mail",
  "mail",
  "telephone",
  "tel",
  "iban",
  "bic",
  "prenom",
  "nom",
  "contact",
  "adresse",
  "siren",
  "siret",
];

function cles(v: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => cles(x, acc));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      acc.add(k.toLowerCase());
      cles(x, acc);
    }
  return acc;
}

describe("le contenu ne porte aucune donnée personnelle", () => {
  // Champs parasites : s'ils étaient recopiés, ils apparaîtraient dans le contenu.
  const parasite = {
    email: "contact.fictif@example.invalid",
    telephone: "0102030405",
    iban: "FR7600000000000000000000000",
    prenom: "Prénomfictif",
    nom: "Nomfictif",
    contactNom: "Contactfictif",
  };
  const entree = {
    periode: "2026-10",
    preparationAt: new Date("2026-11-02T08:00:00Z"),
    commissions: [
      { ...commission(), ...parasite },
      { ...commission({ id: "p", parrainage: true }), ...parasite },
    ],
    pieces: [{ ...piece(), ...parasite }],
  };
  const { contenu } = calculerReleve(entree as never);
  const json = JSON.stringify(contenu);

  it("aucune clé de donnée personnelle", () => {
    const k = cles(contenu);
    for (const interdite of INTERDITES) expect(k.has(interdite), interdite).toBe(false);
  });

  it("aucune valeur parasite recopiée", () => {
    for (const v of Object.values(parasite)) expect(json).not.toContain(v);
  });

  it("aucun identifiant interne de commission", () => {
    expect(json).not.toContain('"id"');
    expect(json).not.toContain("commissionId");
  });

  it("la dénomination de l'entreprise présentée est la seule identité (jamais pour le parrainage)", () => {
    expect(json).toContain("Société fictive");
    const parrainage = contenu.facturees.lignes.find((l) => l.parrainage)!;
    expect(parrainage.entreprise).toBeNull();
  });
});
