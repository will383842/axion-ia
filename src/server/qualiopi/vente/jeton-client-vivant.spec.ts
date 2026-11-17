import { describe, it, expect } from "vitest";
import { filtreJetonClientVivant } from "./jeton-client-vivant";

describe("filtreJetonClientVivant", () => {
  it("ne retient que le jeton client, non révoqué, non expiré", () => {
    const now = new Date("2026-11-17T10:00:00Z");
    expect(filtreJetonClientVivant("doc-1", now)).toEqual({
      documentGenereId: "doc-1",
      partie: "client",
      revokedAt: null,
      expiresAt: { gt: now },
    });
  });
});
