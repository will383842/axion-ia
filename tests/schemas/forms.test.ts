import { describe, it, expect } from "vitest";
import { newsletterSchema } from "@/lib/schemas/forms";

// Schema restant après unification (2026-05-24) :
//   - newsletter : double opt-in RFC 8058
// Les schemas contact/audit/auditRequest/implementation/quoteRequest/intervention
// ont migré vers `unified-contact-schema.ts` (cf. unified-contact-schema.test.ts).
// `bookingSchema` et `option48hSchema` ont été supprimés avec le système de
// réservation payante (2026-08-26).

describe("newsletterSchema", () => {
  const valid = { email: "jane@example.com", consent: true as const };

  it("accepts a valid payload", () => {
    expect(newsletterSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects email malformé", () => {
    expect(newsletterSchema.safeParse({ ...valid, email: "broken" }).success).toBe(false);
  });

  it("rejects consent=false", () => {
    expect(newsletterSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });

  it("rejects empty payload", () => {
    expect(newsletterSchema.safeParse({}).success).toBe(false);
  });
});
