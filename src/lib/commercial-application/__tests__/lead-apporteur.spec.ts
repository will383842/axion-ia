/**
 * Schéma du premier contact Facebook — ce qu'il accepte, ce qu'il refuse.
 *
 * Le point qui compte : `consent` est un `literal(true)`. Un `false` qui
 * passerait serait enregistré comme un consentement absent sur une ligne
 * pourtant créée — le pire des deux mondes.
 */
import { describe, it, expect } from "vitest";
import { extraireFbclid, leadApporteurSchema, LEAD_APPORTEUR_SOURCE } from "../lead-apporteur";
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
