/**
 * Tests — construction de la pièce d'autofacturation.
 *
 * Le test qui compte est l'INVERSION : sur cette pièce, le vendeur est le
 * formateur et l'acheteur est l'organisme. Une pièce qui porterait notre SIRET
 * en vendeur serait impeccable à l'œil et irrégulière en droit.
 */

import { describe, expect, it } from "vitest";

import { genererXmlCII } from "../financements/e-invoicing/cii";
import type { OrganismeIdentite } from "../documents/organisme";
import {
  acheteurCII,
  autofactureVersCII,
  lignesFacture,
  mentionsAutofacture,
  regimeFactureDepuisHonoraires,
  vendeurCII,
  verifierTotauxConformes,
  type ConstruireAutofactureInput,
  type IdentiteSousTraitant,
} from "./autofacture-pieces";
import { MENTION_AUTOFACTURATION } from "./autofacturation";

const SOUS_TRAITANT: IdentiteSousTraitant = {
  nom: "Camille Roux",
  siret: "93812345600017",
  numeroTvaIntracom: "FR55938123456",
  adresseProfessionnelle: "12 rue des Alpes, 38000 Grenoble",
  email: "camille@example.test",
};

const ORGANISME = {
  raisonSociale: "Axion-IA SAS",
  nda: "84380000000",
  qualiopi: "Q-2026-001",
  siret: "93800000000011",
  adresseSiege: "1 place Victor Hugo, 38000 Grenoble",
  adresseExercice: "1 place Victor Hugo, 38000 Grenoble",
  email: "contact@axion-ia.test",
  telephone: "0400000000",
  site: "https://axion-ia.test",
  tvaIntracom: "FR11938000000",
} as OrganismeIdentite;

function input(over: Partial<ConstruireAutofactureInput> = {}): ConstruireAutofactureInput {
  return {
    numero: "AXI-AUTOF-2026-001",
    dateEmission: new Date("2026-09-10T00:00:00.000Z"),
    dateEcheance: new Date("2026-10-10T00:00:00.000Z"),
    contestationAvantAt: new Date("2026-09-18T00:00:00.000Z"),
    periodeLabel: "août 2026",
    sousTraitant: SOUS_TRAITANT,
    organisme: ORGANISME,
    lignes: [
      { designation: "Formation collective — 2 journées animées", montantHtCents: 100_000 },
      { designation: "Coaching 1-to-1 — 4 heures", montantHtCents: 20_000 },
    ],
    regimeHonoraires: "assujetti_20",
    ...over,
  };
}

describe("regimeFactureDepuisHonoraires — deux énumérations, une réalité fiscale", () => {
  it("traduit les trois régimes", () => {
    expect(regimeFactureDepuisHonoraires("assujetti_20")).toBe("assujetti");
    expect(regimeFactureDepuisHonoraires("franchise_293b")).toBe("franchise_293b");
    // Même texte : art. 261-4-4° du CGI.
    expect(regimeFactureDepuisHonoraires("exonere_formation")).toBe("exoneration_261");
  });
});

describe("🔴 l'inversion vendeur / acheteur", () => {
  it("le VENDEUR est le sous-traitant, avec SON identité fiscale", () => {
    const v = vendeurCII(SOUS_TRAITANT);
    expect(v.nom).toBe("Camille Roux");
    expect(v.siret).toBe("93812345600017");
    expect(v.tvaIntracom).toBe("FR55938123456");
  });

  it("l'ACHETEUR est l'organisme", () => {
    const a = acheteurCII(ORGANISME);
    expect(a.nom).toBe("Axion-IA SAS");
    expect(a.siret).toBe("93800000000011");
  });

  it("🔑 CONTRE-TÉMOIN : les deux identités ne sont jamais échangées dans le XML", () => {
    // C'est LE défaut que ce module existe pour empêcher, et le seul test qui
    // le prouve de bout en bout : on lit le XML réellement produit et on vérifie
    // que le SIRET du formateur est du côté vendeur, le nôtre du côté acheteur.
    const xml = genererXmlCII(autofactureVersCII(input()));
    const vendeur = xml.indexOf("SellerTradeParty");
    const acheteur = xml.indexOf("BuyerTradeParty");
    expect(vendeur).toBeGreaterThan(-1);
    expect(acheteur).toBeGreaterThan(vendeur);

    const blocVendeur = xml.slice(vendeur, acheteur);
    const blocAcheteur = xml.slice(acheteur);
    expect(blocVendeur).toContain("93812345600017");
    expect(blocVendeur).not.toContain("93800000000011");
    expect(blocAcheteur).toContain("93800000000011");
  });

  it("réutilise genererXmlCII et produit les totaux attendus", () => {
    const xml = genererXmlCII(autofactureVersCII(input()));
    // 1 200,00 HT + 20 % = 1 440,00 TTC.
    expect(xml).toContain("1200.00");
    expect(xml).toContain("1440.00");
    expect(xml).toContain("AXI-AUTOF-2026-001");
  });
});

describe("lignes et mentions", () => {
  it("porte le montant en prix unitaire, quantité 1", () => {
    // Recomposer en quantité × PU réintroduirait un arrondi là où le moteur de
    // rémunération en a déjà fait un — et le total de la facture cesserait
    // d'égaler le total du relevé.
    const lignes = lignesFacture(input().lignes);
    expect(lignes).toEqual([
      {
        designation: "Formation collective — 2 journées animées",
        quantite: 1,
        prixUnitaireHtCents: 100_000,
      },
      { designation: "Coaching 1-to-1 — 4 heures", quantite: 1, prixUnitaireHtCents: 20_000 },
    ]);
  });

  it("🔴 la mention « au nom et pour le compte » NOMME le sous-traitant", () => {
    // « établie au nom et pour le compte du sous-traitant » sans dire DUQUEL ne
    // vaut rien : c'est l'identification du fournisseur qui est en jeu.
    const m = mentionsAutofacture("Camille Roux");
    expect(m.titre).toBe(MENTION_AUTOFACTURATION);
    expect(m.pourLeCompte).toContain("Camille Roux");
    expect(m.pourLeCompte).toMatch(/au nom et pour le compte/i);
  });

  it("🔑 n'inscrit AUCUN IBAN sur la pièce", () => {
    // La facture est écrite par le DÉBITEUR. Y porter des coordonnées bancaires
    // reviendrait à faire dire au créancier où l'on veut bien payer.
    const cii = autofactureVersCII(input());
    expect(cii.iban).toBeUndefined();
    expect(genererXmlCII(cii)).not.toContain("PayeePartyCreditorFinancialAccount");
  });

  it("porte la mention d'exonération hors assujettissement, jamais avec", () => {
    expect(
      autofactureVersCII(input({ regimeHonoraires: "assujetti_20" })).mentionExoneration,
    ).toBeUndefined();
    expect(
      autofactureVersCII(input({ regimeHonoraires: "exonere_formation" })).mentionExoneration,
    ).toBe(MENTION_AUTOFACTURATION);
  });
});

describe("verifierTotauxConformes — le point de rencontre des deux calculs", () => {
  it("accepte quand la pièce dit exactement ce que le relevé doit", () => {
    // 1 200,00 HT + 20 % = 1 440,00 TTC, ce que `calcul.ts` a figé au relevé.
    expect(verifierTotauxConformes(input().lignes, "assujetti_20", 144_000)).toEqual({
      conforme: true,
    });
  });

  it("🔴 refuse une divergence, et DIT ce qu'elle a calculé", () => {
    // Un refus qui ne rend pas son chiffre oblige à rouvrir le code pour savoir
    // de combien on s'est trompé — et c'est un écart d'argent.
    const v = verifierTotauxConformes(input().lignes, "assujetti_20", 143_900);
    expect(v.conforme).toBe(false);
    expect(v).toMatchObject({ calculeTtcCents: 144_000 });
  });

  it("🔴 un formateur en FRANCHISE 293 B ne porte AUCUNE TVA", () => {
    // ⚠️ L'ordre permanent « TVA toujours facturée » vise NOS ventes. L'étendre
    // ici ferait réclamer 20 % à un formateur qui n'est pas redevable, sur une
    // facture que nous écrivons en son nom — et nous ferait déduire une TVA
    // inexistante. Le régime d'un tiers n'est pas un réglage de l'organisme.
    expect(verifierTotauxConformes(input().lignes, "franchise_293b", 120_000)).toEqual({
      conforme: true,
    });
    expect(verifierTotauxConformes(input().lignes, "exonere_formation", 120_000)).toEqual({
      conforme: true,
    });
  });
});
