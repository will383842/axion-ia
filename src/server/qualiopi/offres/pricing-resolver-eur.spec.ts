/**
 * F3 — le pont catalogue → devis doit être MUET plutôt que faux.
 *
 * Chaque cas ci-dessous correspond à une offre réelle de `offres_site` ou à un
 * tier réel de `pricing.ts` : le risque n'est pas théorique, il se lit sur une
 * pièce commerciale ferme (devis « bon pour accord », puis convention).
 *
 * Fichier séparé de `pricing-resolver.spec.ts` à dessein : ce dernier est touché
 * par d'autres lots, et un conflit de merge sur un test de montant est le genre
 * de chose qu'on résout mal, tard, et à contresens.
 */
import { describe, expect, it } from "vitest";
import {
  resolveOffreDevisNoteFr,
  resolveOffrePrice,
  resolveOffrePriceEur,
} from "./pricing-resolver";

/** Offre du catalogue V2 : `tier_id` NULL, prix dérivé de la matrice. */
const catalogue = (gamme: string, dureeCode: string) => ({
  tierId: null,
  gamme,
  dureeCode,
  tarifType: "fixe" as const,
});

/** Offre legacy : prix porté par un tier de pricing.ts. */
const legacy = (tierId: string) => ({
  tierId,
  gamme: null,
  dureeCode: null,
  tarifType: "fixe" as const,
});

describe("resolveOffrePriceEur — catalogue V2 (matrice)", () => {
  it("rend le prix de la case", () => {
    expect(resolveOffrePriceEur(catalogue("generale", "4h"))).toBe(1200);
    expect(resolveOffrePriceEur(catalogue("generale", "1j"))).toBe(1900);
    expect(resolveOffrePriceEur(catalogue("metier", "1j"))).toBe(1900);
    expect(resolveOffrePriceEur(catalogue("secteur", "1j"))).toBe(2200);
    expect(resolveOffrePriceEur(catalogue("secteur", "2j"))).toBe(3900);
  });

  it("rend null pour une gamme absente de la matrice — jamais un prix inventé", () => {
    expect(resolveOffrePriceEur(catalogue("ia-standard", "4h"))).toBeNull();
    expect(resolveOffrePriceEur(catalogue("metier", "4h"))).toBeNull();
  });
});

describe("resolveOffrePriceEur — refus de tout montant NON ferme", () => {
  it("`sur_devis` prime sur toute dérivation, même quand la matrice répondrait", () => {
    expect(
      resolveOffrePriceEur({
        tierId: null,
        gamme: "generale",
        dureeCode: "4h",
        tarifType: "sur_devis",
      }),
    ).toBeNull();
  });

  it("fourchette priceMin/priceMax : on n'inscrit JAMAIS le plancher", () => {
    // codage-web : 2 000 → 30 000 € HT. Écrire 2 000 serait un facteur 15.
    expect(resolveOffrePriceEur(legacy("codage-web"))).toBeNull();
    // impl-poc : 990 → 4 900 € HT.
    expect(resolveOffrePriceEur(legacy("impl-poc"))).toBeNull();
  });

  it("tier à paliers d'effectif : `priceFlat` n'est que le prix d'ENTRÉE", () => {
    expect(resolveOffrePriceEur(legacy("intervention-essentielle"))).toBeNull();
    expect(resolveOffrePriceEur(legacy("intervention-claude"))).toBeNull();
  });

  it("tier `isFromPrice` (audits) : un plancher n'est pas un prix ferme", () => {
    // Règle Will 2026-07-17 : les audits sont TOUJOURS « à partir de ».
    // `formatPrice` préfixe « À partir de 1 190 € HT » — inscrire 1190 comme PU
    // HT d'un devis transformerait ce plancher en engagement ferme.
    expect(resolveOffrePriceEur(legacy("audit-flash-onsite"))).toBeNull();
    expect(resolveOffrePriceEur(legacy("audit-cible-standard"))).toBeNull();
    expect(resolveOffrePriceEur(legacy("audit-strategique-pme-50-250"))).toBeNull();
  });

  it("tier disparu de pricing.ts", () => {
    expect(resolveOffrePriceEur(legacy("tier-fantome"))).toBeNull();
  });

  it("prix ferme legacy : rendu tel quel", () => {
    expect(resolveOffrePriceEur(legacy("intervention-dirigeants"))).toBe(1390);
    expect(resolveOffrePriceEur(legacy("intervention-membre-equipe"))).toBe(990);
    expect(resolveOffrePriceEur(legacy("intervention-dirigeant-vision"))).toBe(1390);
  });
});

describe("parité libellé / montant", () => {
  const cas = [
    catalogue("generale", "4h"),
    catalogue("ia-standard", "4h"),
    legacy("codage-web"),
    legacy("impl-poc"),
    legacy("intervention-essentielle"),
    legacy("intervention-claude"),
    legacy("audit-flash-onsite"),
    legacy("audit-cible-standard"),
    legacy("intervention-dirigeants"),
    legacy("intervention-sur-demande"),
    legacy("tier-fantome"),
  ];

  it("un libellé qui n'annonce PAS un prix ferme ne rend jamais de montant", () => {
    // Bidirectionnel dans ce sens-ci : « Sur devis », « Tarif indisponible »,
    // « À partir de … » et « X - Y € HT » ne doivent JAMAIS pré-remplir un PU.
    for (const offre of cas) {
      const label = resolveOffrePrice(offre, "fr");
      const nonFerme =
        label === "Sur devis" ||
        label === "Tarif indisponible" ||
        label.startsWith("À partir de") ||
        label.includes(" - ");
      if (nonFerme) expect(resolveOffrePriceEur(offre)).toBeNull();
    }
  });

  it("et un montant rendu vient toujours d'un libellé ferme", () => {
    // Sens inverse : c'est lui qui attrape les tiers à `subTiers` si on relâchait
    // la garde — leur libellé, lui, est bien un nombre.
    for (const offre of cas) {
      if (resolveOffrePriceEur(offre) === null) continue;
      const label = resolveOffrePrice(offre, "fr");
      expect(label).not.toBe("Sur devis");
      expect(label).not.toBe("Tarif indisponible");
      expect(label.startsWith("À partir de")).toBe(false);
    }
  });
});

describe("resolveOffreDevisNoteFr", () => {
  it("catalogue : prix par groupe, quantité 1, hors frais de déplacement", () => {
    const note = resolveOffreDevisNoteFr(catalogue("secteur", "1j"));
    expect(note).toContain("participants");
    expect(note).toContain("Qté = 1");
    expect(note).toContain("déplacement");
  });

  it("journée 1-to-1 : effectif réel, et les frais sont EN SUS — jamais « hors »", () => {
    const note = resolveOffreDevisNoteFr(legacy("intervention-dirigeants"));
    expect(note).toContain("1 dirigeant (1-to-1)");
    expect(note).not.toContain("GROUPE");
    // pricing.ts : « Frais déplacement / hébergement / repas en sus systématiquement ».
    expect(note).toContain("EN SUS");
  });

  it("aucun prix ferme : la note le dit sans confondre les trois causes", () => {
    const note = resolveOffreDevisNoteFr(legacy("codage-web"));
    expect(note).toContain("Aucun prix ferme");
    expect(note).toContain("saisissez le PU HT");
  });
});
