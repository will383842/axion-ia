import { describe, expect, it } from "vitest";
import { htLignesRecurrentesCents } from "../regles";

const l = (o: Record<string, unknown>) => ({ quantite: 1, prixUnitaireHtCents: 10_000, ...o });

describe("lignes récurrentes : le produit ou le type de ligne d'abord, la désignation en filet", () => {
  it("repère par le type de ligne, quelle que soit la désignation", () => {
    for (const champ of ["type", "typeLigne", "produit", "produitSlug", "categorie", "famille"])
      for (const v of [
        "abonnement",
        "maintenance",
        "tma",
        "infogérance",
        "support-mensuel",
        "Hébergement",
      ])
        expect(
          htLignesRecurrentesCents([l({ designation: "Prestation", [champ]: v })]),
          `${champ}=${v}`,
        ).toBe(10_000);
  });
  it("le drapeau explicite `recurrent` suffit", () => {
    expect(htLignesRecurrentesCents([l({ designation: "Forfait", recurrent: true })])).toBe(10_000);
  });
  it("un type non récurrent n'est pas arrêté par un mot absent de la désignation", () => {
    expect(htLignesRecurrentesCents([l({ designation: "Mise en service", type: "service" })])).toBe(
      0,
    );
  });
  it("le filet de désignation attrape support mensuel, TMA, infogérance et les mots d'avant", () => {
    for (const d of [
      "Support mensuel",
      "TMA du site",
      "Infogérance serveur",
      "Infogerance",
      "Tierce maintenance applicative",
      "Maintenance évolutive",
      "Abonnement annuel",
      "Hébergement",
      "Licence logicielle",
    ])
      expect(htLignesRecurrentesCents([l({ designation: d })]), d).toBe(10_000);
  });
  it("ne prend pas un mot qui contient seulement les lettres (pas de faux positif)", () => {
    for (const d of ["Ultimatum commercial", "Support de formation", "Audit"])
      expect(htLignesRecurrentesCents([l({ designation: d })]), d).toBe(0);
  });
  it("quantité × prix, en centimes entiers ; option à quantité 0 ignorée", () => {
    expect(
      htLignesRecurrentesCents([
        l({ designation: "TMA", quantite: 3, prixUnitaireHtCents: 33_333 }),
        l({ designation: "Support mensuel", quantite: 0 }),
      ]),
    ).toBe(99_999);
  });
});
