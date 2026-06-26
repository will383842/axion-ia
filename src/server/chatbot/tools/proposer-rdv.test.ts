/**
 * T-15 — Tool proposer_rdv (lien RDV, pas de création serveur).
 */

import { describe, it, expect } from "vitest";
import { proposerRdv, ProposerRdvInputSchema } from "@/server/chatbot/tools/proposer-rdv";
import { isKnownFrUrl } from "@/lib/offer-url";

describe("T-15 proposer_rdv", () => {
  it("découverte → /fr/appel (route connue)", () => {
    const r = proposerRdv({ type_rdv: "decouverte" });
    expect(r.url).toBe("/fr/appel");
    expect(isKnownFrUrl(r.url)).toBe(true);
  });

  it("audit/formation → /fr/appel (route connue)", () => {
    expect(proposerRdv({ type_rdv: "audit" }).url).toBe("/fr/appel");
    expect(isKnownFrUrl(proposerRdv({ type_rdv: "formation" }).url)).toBe(true);
  });

  it("Zod refuse un type inconnu", () => {
    expect(() => ProposerRdvInputSchema.parse({ type_rdv: "mariage" })).toThrow();
  });
});
