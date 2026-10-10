// FAC-4 — la fabrique commune de liens signés.
//
// Ce que la fabrique promet, et que ce fichier tient : HMAC-SHA256 en base64url,
// comparaison à temps constant, refus (`null`) sans secret en production,
// expiration signée facultative, version dans le domaine.

import { afterEach, describe, expect, it, vi } from "vitest";

import { fabriqueLienSigne } from "@/lib/security/lien-signe";

const SECRET = "secret-de-test-fac4-fige-0123456789abcdef";
const A = fabriqueLienSigne({ domaine: "essai-a", version: 1, cle: "axion-essai" });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fabriqueLienSigne", () => {
  it("signe en base64url (43 caractères) et vérifie sa propre signature", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const jeton = A.signer("charge");
    expect(jeton).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(A.verifier("charge", jeton!)).toBe(true);
  });

  it("refuse un jeton altéré, ou une autre charge", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const jeton = A.signer("charge")!;
    const altere = (jeton[0] === "A" ? "B" : "A") + jeton.slice(1);
    expect(A.verifier("charge", altere)).toBe(false);
    expect(A.verifier("charge", jeton.slice(1))).toBe(false);
    expect(A.verifier("autre", jeton)).toBe(false);
    expect(A.verifier("charge", "")).toBe(false);
  });

  it("refuse un jeton d'un autre domaine ou d'une autre version, même clé", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const autreDomaine = fabriqueLienSigne({ domaine: "essai-b", version: 1, cle: "axion-essai" });
    const autreVersion = fabriqueLienSigne({ domaine: "essai-a", version: 2, cle: "axion-essai" });
    const jeton = A.signer("charge")!;
    expect(autreDomaine.verifier("charge", jeton)).toBe(false);
    expect(autreVersion.verifier("charge", jeton)).toBe(false);
    expect(A.verifier("charge", autreDomaine.signer("charge")!)).toBe(false);
  });

  it("refuse un jeton signé avec un autre secret", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const jeton = A.signer("charge")!;
    vi.stubEnv("AUTH_SECRET", `${SECRET}-autre`);
    expect(A.verifier("charge", jeton)).toBe(false);
  });

  it("sans secret EN PRODUCTION : ne signe rien et ne valide rien", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");
    const jetonDev = A.signer("charge")!;
    vi.stubEnv("NODE_ENV", "production");
    expect(A.signer("charge")).toBeNull();
    expect(A.signer("charge", { expireA: 4_000_000_000 })).toBeNull();
    expect(A.verifier("charge", jetonDev)).toBe(false);
  });

  it("expiration signée : valide avant l'échéance, refusée après", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const jeton = A.signer("charge", { expireA: 1_000 })!;
    expect(A.verifier("charge", jeton, { maintenant: 999 })).toBe(true);
    expect(A.verifier("charge", jeton, { maintenant: 1_000 })).toBe(false);
    expect(A.verifier("charge", jeton, { maintenant: 5_000 })).toBe(false);
  });

  it("l'échéance est signée : la repousser invalide le jeton", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const jeton = A.signer("charge", { expireA: 1_000 })!;
    const [, mac] = jeton.split(".");
    expect(A.verifier("charge", `9999999999.${mac}`, { maintenant: 999 })).toBe(false);
    // Retirer l'échéance ne transforme pas le jeton en jeton sans fin.
    expect(A.verifier("charge", mac!, { maintenant: 999 })).toBe(false);
  });

  it("un jeton sans échéance n'est pas accepté comme jeton à échéance", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const sansFin = A.signer("charge")!;
    expect(A.verifier("charge", `9999999999.${sansFin}`, { maintenant: 1 })).toBe(false);
  });

  it("refuse une échéance mal formée à la signature", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    expect(A.signer("charge", { expireA: Number.NaN })).toBeNull();
    expect(A.signer("charge", { expireA: 1.5 })).toBeNull();
    expect(A.signer("charge", { expireA: -1 })).toBeNull();
  });

  it("refuse une configuration de domaine ambiguë", () => {
    expect(() => fabriqueLienSigne({ domaine: "a:b", version: 1, cle: "k" })).toThrow();
    expect(() => fabriqueLienSigne({ domaine: "a", version: 0, cle: "k" })).toThrow();
  });
});
