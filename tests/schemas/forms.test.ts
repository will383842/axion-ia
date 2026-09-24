import { describe, it, expect } from "vitest";
import { demandeGuideSchema } from "@/lib/schemas/forms";

// Schema restant après unification (2026-05-24) :
//   - demandeGuideSchema : formulaire du guide IA (lot L2, 2026-09-24), qui
//     remplace `newsletterSchema` et sa case OBLIGATOIRE couvrant deux finalités.
// Les schemas contact/audit/auditRequest/implementation/quoteRequest/intervention
// ont migré vers `unified-contact-schema.ts` (cf. unified-contact-schema.test.ts).
// `bookingSchema` et `option48hSchema` ont été supprimés avec le système de
// réservation payante (2026-08-26).

describe("demandeGuideSchema", () => {
  it("🔴 l'adresse SEULE suffit : le guide ne dépend d'aucune case (RGPD art. 7.4)", () => {
    const r = demandeGuideSchema.safeParse({ email: "jeanne@example.invalid" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.lettre).toBe(false);
  });

  it("la case « lettre » est facultative et transmise telle quelle", () => {
    const r = demandeGuideSchema.safeParse({ email: "jeanne@example.invalid", lettre: true });
    expect(r.success && r.data.lettre).toBe(true);
  });

  it("normalise l'adresse (espaces, casse)", () => {
    const r = demandeGuideSchema.safeParse({ email: "  Jeanne@Example.INVALID " });
    expect(r.success && r.data.email).toBe("jeanne@example.invalid");
  });

  it("rejects email malformé", () => {
    expect(demandeGuideSchema.safeParse({ email: "broken" }).success).toBe(false);
  });

  it("rejects empty payload", () => {
    expect(demandeGuideSchema.safeParse({}).success).toBe(false);
  });
});
