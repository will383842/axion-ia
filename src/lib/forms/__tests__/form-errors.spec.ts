import { describe, it, expect } from "vitest";
import { isStaleServerActionError } from "../form-errors";

describe("isStaleServerActionError", () => {
  it("détecte les erreurs de Server Action introuvable (deploy-skew)", () => {
    expect(
      isStaleServerActionError(
        new Error('Server Action "600050b2aa252dad" was not found on the server.'),
      ),
    ).toBe(true);
    expect(isStaleServerActionError(new Error("Failed to find Server Action foo"))).toBe(true);
    const named = new Error("boom");
    named.name = "UnrecognizedActionError";
    expect(isStaleServerActionError(named)).toBe(true);
    expect(isStaleServerActionError("UnrecognizedActionError: nope")).toBe(true);
  });

  it("inspecte aussi le digest (erreurs serveur Next)", () => {
    const err = Object.assign(new Error("x"), { digest: "was not found on the server" });
    expect(isStaleServerActionError(err)).toBe(true);
  });

  it("ignore les autres erreurs (captcha, réseau, générique)", () => {
    expect(isStaleServerActionError(new Error("Une erreur est survenue"))).toBe(false);
    expect(isStaleServerActionError(new Error("Turnstile blocked"))).toBe(false);
    expect(isStaleServerActionError(null)).toBe(false);
    expect(isStaleServerActionError(undefined)).toBe(false);
    expect(isStaleServerActionError("network error")).toBe(false);
  });
});
