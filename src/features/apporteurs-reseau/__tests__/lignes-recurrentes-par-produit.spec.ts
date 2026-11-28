// #2464 point 16 : le classement récurrent / non récurrent d'une ligne de devis passe par le CATALOGUE
// (offreCode / offreTierId, seuls champs produit stockés), la désignation n'est qu'un filet.
import { describe, expect, it } from "vitest";

import { MAINTENANCE_TIERS, UN_A_UN_RECURRING_TIER } from "@/content/pricing";
import { lignesVersFormulaire } from "@/components/admin/qualiopi/devis-edition-lignes";

import { htLignesRecurrentesCents, TIERS_RECURRENTS } from "../regles";

const l = (o: Record<string, unknown>) => ({ quantite: 1, prixUnitaireHtCents: 10_000, ...o });

describe("le catalogue : paliers récurrents", () => {
  it("la maintenance et le coaching régulier, rien d'autre", () => {
    expect([...TIERS_RECURRENTS].sort()).toEqual(
      [...MAINTENANCE_TIERS.map((t) => t.id), UN_A_UN_RECURRING_TIER.id].sort(),
    );
  });
});

describe("ligne réelle de devis : « Forfait mensuel » + code de maintenance → 0 de base", () => {
  it("la forme STOCKÉE (designation, quantite, prixUnitaireHtCents, offreCode) est classée par le code", () => {
    const stockee = l({ designation: "Forfait mensuel", offreCode: "maintenance-standard" });
    expect(htLignesRecurrentesCents([stockee])).toBe(10_000);
  });
  it("même chose par offreTierId, et avec la colonne mixte (code rangé dans offreTierId)", () => {
    expect(
      htLignesRecurrentesCents([
        l({ designation: "Forfait mensuel", offreTierId: "maintenance-standard" }),
      ]),
    ).toBe(10_000);
    expect(
      htLignesRecurrentesCents([
        l({ designation: "Forfait", offreTierId: "un-a-un-recurrent", offreCode: "AXI-OFF-001" }),
      ]),
    ).toBe(10_000);
  });
  it("la ligne passe le schéma STRICT réel des lignes stockées, avec son code", () => {
    const stockee = {
      designation: "Forfait mensuel",
      quantite: 1,
      prixUnitaireHtCents: 29_000,
      offreCode: "maintenance-standard",
    };
    const lue = lignesVersFormulaire([stockee]);
    expect(lue?.[0]?.offreCode).toBe("maintenance-standard");
    expect(htLignesRecurrentesCents([stockee])).toBe(29_000);
  });
  it("casse et espaces ne trompent pas", () => {
    expect(
      htLignesRecurrentesCents([l({ designation: "X", offreCode: " Maintenance-Standard " })]),
    ).toBe(10_000);
  });
  it("une offre de formation du catalogue n'est pas récurrente", () => {
    expect(
      htLignesRecurrentesCents([
        l({ designation: "Journée IA", offreCode: "AXI-OFF-042", offreTierId: "intervention-4h" }),
      ]),
    ).toBe(0);
  });
});

describe("le filet de désignation, en dernier recours (lignes libres sans produit)", () => {
  it("attrape support mensuel, TMA, infogérance et les mots d'avant", () => {
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
