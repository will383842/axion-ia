import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  isValidEmailSyntax,
  isRoleEmail,
  verifyEmail,
  isMxOk,
  matchEmailToPerson,
  type MxResolver,
} from "./email";

describe("normalizeEmail", () => {
  it("minuscule + retrait tag +alias", () => {
    expect(normalizeEmail("  Jean.Dupont+Devis@ACME.FR ")).toBe("jean.dupont@acme.fr");
  });
});

describe("syntaxe / rôle", () => {
  it("valide/invalide", () => {
    expect(isValidEmailSyntax("a@b.fr")).toBe(true);
    expect(isValidEmailSyntax("pas-un-email")).toBe(false);
  });
  it("email de rôle", () => {
    expect(isRoleEmail("contact@acme.fr")).toBe(true);
    expect(isRoleEmail("jean.dupont@acme.fr")).toBe(false);
  });
});

const okResolver: MxResolver = {
  async resolveMx() {
    return [{ exchange: "mx.acme.fr" }];
  },
};
const noMxResolver: MxResolver = {
  async resolveMx() {
    return [];
  },
};
const throwResolver: MxResolver = {
  async resolveMx() {
    throw new Error("dns");
  },
};

describe("verifyEmail (MX injecté)", () => {
  it("MX présent → mx_ok (07-DECISIONS Q2)", async () => {
    const s = await verifyEmail("jean.dupont@acme.fr", okResolver);
    expect(s).toBe("mx_ok");
    expect(isMxOk(s)).toBe(true);
  });
  it("email de rôle avec MX → mx_ok (validité) ; généricité via isRoleEmail", async () => {
    expect(await verifyEmail("contact@acme.fr", okResolver)).toBe("mx_ok");
    expect(isRoleEmail("contact@acme.fr")).toBe(true); // flag générique séparé
  });
  it("pas de MX → verified_syntax", async () => {
    expect(await verifyEmail("jean@acme.fr", noMxResolver)).toBe("verified_syntax");
  });
  it("syntaxe invalide → invalid", async () => {
    expect(await verifyEmail("nope", okResolver)).toBe("invalid");
  });
  it("resolver jette → fail-soft verified_syntax", async () => {
    expect(await verifyEmail("jean@acme.fr", throwResolver)).toBe("verified_syntax");
  });
});

describe("matchEmailToPerson", () => {
  const p = { nom: "Dupont", prenoms: "Jean Pierre" };
  it("prenom.nom → forte confiance", () => {
    expect(matchEmailToPerson("jean.dupont@acme.fr", p)).toBeGreaterThan(0.9);
  });
  it("p.nom (initiale) → confiance moyenne", () => {
    expect(matchEmailToPerson("j.dupont@acme.fr", p)).toBeCloseTo(0.85);
  });
  it("accents normalisés", () => {
    expect(
      matchEmailToPerson("herve.tellier@x.fr", { nom: "Tellier", prenoms: "Hervé" }),
    ).toBeGreaterThan(0.9);
  });
  it("pas de match → 0", () => {
    expect(matchEmailToPerson("contact@acme.fr", p)).toBe(0);
  });
});
