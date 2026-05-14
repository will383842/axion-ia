/**
 * KB V4 — Tests PII scan.
 */

import { describe, expect, it } from "vitest";
import { detectPii } from "./pii-scan";

describe("detectPii", () => {
  it("retourne hasPii=false sur texte clean", () => {
    expect(detectPii("Un texte propre sans PII").hasPii).toBe(false);
  });

  it("détecte email non whitelisté", () => {
    const r = detectPii("Contact : alice@example.com");
    expect(r.hasPii).toBe(true);
    expect(r.matches[0]!.kind).toBe("email");
  });

  it("whitelist contact@axion-ia.com", () => {
    expect(detectPii("Écrivez à contact@axion-ia.com").hasPii).toBe(false);
    expect(detectPii("Email dpo@axion-ia.com").hasPii).toBe(false);
  });

  it("détecte téléphone FR mobile", () => {
    const r = detectPii("Appelez 06 12 34 56 78");
    expect(r.hasPii).toBe(true);
    expect(r.matches[0]!.kind).toBe("phone");
  });

  it("détecte téléphone FR fixe", () => {
    expect(detectPii("Téléphone +33 1 23 45 67 89").hasPii).toBe(true);
  });

  it("détecte IBAN", () => {
    const r = detectPii("RIB : FR7630001007941234567890185");
    expect(r.hasPii).toBe(true);
    expect(r.matches.find((m) => m.kind === "iban")).toBeDefined();
  });

  it("détecte registry id 9 chiffres", () => {
    const r = detectPii("Identifiant 123 456 789");
    expect(r.hasPii).toBe(true);
  });

  it("retourne plusieurs matches", () => {
    const r = detectPii("alice@x.com et 06 12 34 56 78");
    expect(r.matches).toHaveLength(2);
  });

  it("ne match pas du texte normal", () => {
    expect(detectPii("Article sur l'IA générative en entreprise 2026").hasPii).toBe(false);
  });
});
