/**
 * Schéma du premier contact Facebook — ce qu'il accepte, ce qu'il refuse.
 *
 * Le point qui compte : `consent` est un `literal(true)`. Un `false` qui
 * passerait serait enregistré comme un consentement absent sur une ligne
 * pourtant créée — le pire des deux mondes.
 */
import { describe, it, expect } from "vitest";
import {
  extraireFbclid,
  leadApporteurSchema,
  LEAD_APPORTEUR_SOURCE,
  leadCompteChezMeta,
  sourceConnueDepuisUtm,
  suiteDuPremierContact,
  sourceDepuisUtm,
} from "../lead-apporteur";
import { SOURCE_OPTIONS } from "../model";

const valide = {
  prenom: "Nadia",
  email: "nadia@example.com",
  telephone: "06 12 34 56 78",
  ville: "Grenoble",
  statut: "salarie",
  consent: true as const,
  contexte: {
    query: "?utm_source=facebook&utm_campaign=apporteurs-sept&fbclid=IwAR0abcdefghijklmnop",
    consentPub: "accepted" as const,
  },
};

describe("leadApporteurSchema", () => {
  it("accepte un premier contact complet", () => {
    const r = leadApporteurSchema.safeParse(valide);
    expect(r.success).toBe(true);
  });

  it("accepte sans statut ni contexte : seuls cinq champs comptent", () => {
    const { statut: _s, contexte: _c, ...min } = valide;
    expect(leadApporteurSchema.safeParse(min).success).toBe(true);
  });

  it("refuse consent=false — jamais enregistré comme un consentement absent", () => {
    expect(leadApporteurSchema.safeParse({ ...valide, consent: false }).success).toBe(false);
  });

  it("refuse un téléphone qui n'en est pas un, et un e-mail sans domaine", () => {
    expect(leadApporteurSchema.safeParse({ ...valide, telephone: "abc" }).success).toBe(false);
    expect(leadApporteurSchema.safeParse({ ...valide, email: "nadia" }).success).toBe(false);
  });

  it("refuse un statut hors liste et un champ inconnu (strict)", () => {
    expect(leadApporteurSchema.safeParse({ ...valide, statut: "pdg" }).success).toBe(false);
    expect(leadApporteurSchema.safeParse({ ...valide, nom: "Dupont" }).success).toBe(false);
  });

  it("borne le contexte : un fbp mal formé est refusé, une requête trop longue aussi", () => {
    expect(
      leadApporteurSchema.safeParse({ ...valide, contexte: { fbp: "pas-un-fbp" } }).success,
    ).toBe(false);
    expect(
      leadApporteurSchema.safeParse({ ...valide, contexte: { query: "x".repeat(2001) } }).success,
    ).toBe(false);
  });

  it("la source posée automatiquement existe dans SOURCE_OPTIONS — sinon l'écran de pilotage ne la nomme pas", () => {
    expect(SOURCE_OPTIONS.some((o) => o.id === LEAD_APPORTEUR_SOURCE)).toBe(true);
  });
});

describe("extraireFbclid", () => {
  it("lit le fbclid d'une requête, avec ou sans le « ? »", () => {
    expect(extraireFbclid("?utm_source=facebook&fbclid=IwAR0abcdefghijklmnop")).toBe(
      "IwAR0abcdefghijklmnop",
    );
    expect(extraireFbclid("fbclid=IwAR0abcdefghijklmnop")).toBe("IwAR0abcdefghijklmnop");
  });

  it("renvoie null sans fbclid, ou si la valeur ne ressemble pas à un identifiant Meta", () => {
    expect(extraireFbclid("?utm_source=facebook")).toBeNull();
    expect(extraireFbclid("?fbclid=<script>")).toBeNull();
    expect(extraireFbclid(undefined)).toBeNull();
  });
});

describe("sourceDepuisUtm — le canal suit le lien d'arrivée (29/09)", () => {
  it("reprend un canal connu de SOURCE_OPTIONS, quelle que soit la casse", () => {
    expect(sourceDepuisUtm("linkedin")).toBe("linkedin");
    expect(sourceDepuisUtm(" LinkedIn ")).toBe("linkedin");
    expect(sourceDepuisUtm("indeed")).toBe("indeed");
  });
  it("ramène les alias usuels à leur canal", () => {
    expect(sourceDepuisUtm("instagram")).toBe("facebook");
    expect(sourceDepuisUtm("lnkd")).toBe("linkedin");
  });
  it("retombe sur facebook quand l'utm_source est absent, inconnu ou « autre »", () => {
    expect(sourceDepuisUtm(undefined)).toBe(LEAD_APPORTEUR_SOURCE);
    expect(sourceDepuisUtm("")).toBe(LEAD_APPORTEUR_SOURCE);
    expect(sourceDepuisUtm("<script>")).toBe(LEAD_APPORTEUR_SOURCE);
    expect(sourceDepuisUtm("autre")).toBe(LEAD_APPORTEUR_SOURCE);
  });
  it("tout canal rendu existe dans SOURCE_OPTIONS", () => {
    for (const v of ["linkedin", "fb", "ig", "meta", "linkedin.com", "leboncoin"]) {
      const id = sourceConnueDepuisUtm(v);
      expect(id && SOURCE_OPTIONS.some((o) => o.id === id)).toBe(true);
    }
    expect(sourceConnueDepuisUtm("inconnu")).toBeNull();
  });
});

describe("Meta et Plausible suivent le canal réel (29/09)", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("seul un contact Facebook (ou sans source) compte comme Lead Meta", () => {
    expect(leadCompteChezMeta("facebook")).toBe(true);
    expect(leadCompteChezMeta(undefined)).toBe(true);
    expect(leadCompteChezMeta("linkedin")).toBe(false);
    expect(leadCompteChezMeta("indeed")).toBe(false);
  });

  it("Facebook : page merci AVEC l'identifiant (pixel Lead), landing facebook", () => {
    expect(suiteDuPremierContact(ID, "facebook")).toEqual({
      merci: `/apporteur-affaires/merci?c=${ID}`,
      landing: "facebook",
      source: "facebook",
    });
  });

  it("LinkedIn : page merci SANS identifiant (aucun Lead Meta), landing linkedin", () => {
    expect(suiteDuPremierContact(ID, "linkedin")).toEqual({
      merci: "/apporteur-affaires/merci",
      landing: "linkedin",
      source: "linkedin",
    });
  });

  it("un serveur plus ancien qui ne rend pas la source : repli facebook, comme avant", () => {
    expect(suiteDuPremierContact(ID, undefined)).toEqual({
      merci: `/apporteur-affaires/merci?c=${ID}`,
      landing: "facebook",
      source: "facebook",
    });
  });
});
