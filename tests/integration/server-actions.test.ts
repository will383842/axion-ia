// Tests integration Server Actions (Sprint 21 / M10).
//
// Necessite : DATABASE_URL pointant sur DB de test. Utilise les Server
// Actions reelles (pas de mock) pour valider le pipeline complet : Zod
// → Prisma → activityLog → BullMQ enqueue (best-effort).
//
// Run : DATABASE_URL=... pnpm test:integration
//
// V1 minimal : on verifie les schemas Zod + helpers (pas les mutations
// DB reelles qui exigent un setup test DB dedie).

import { describe, it, expect } from "vitest";
import {
  bookingSchema,
  option48hSchema,
  contactSchema,
  newsletterSchema,
  auditSchema,
  implementationSchema,
} from "@/lib/schemas/forms";
import { signInSchema } from "@/lib/schemas/auth";
import { localeSchema, parseLocale } from "@/lib/schemas/locale";
import {
  interventionSlugSchema,
  slugToEnum,
  getInterventionPriceCents,
} from "@/lib/intervention-type";

describe("Server Actions integration — schemas chain", () => {
  describe("booking flow", () => {
    it("bookingSchema accepts complete payload from form", () => {
      const result = bookingSchema.safeParse({
        date: "2026-06-15",
        time: "09:00",
        contact: "Will Test",
        email: "test@example.com",
        consent: true,
        interventionType: "essentielle",
        participantsCount: 5,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid intervention slug", () => {
      const result = bookingSchema.safeParse({
        date: "2026-06-15",
        time: "09:00",
        contact: "Will",
        email: "test@example.com",
        consent: true,
        interventionType: "old-equipes-slug",
        participantsCount: 5,
      });
      expect(result.success).toBe(false);
    });

    it("slugToEnum converts UI slug to Postgres enum", () => {
      expect(slugToEnum("essentielle")).toBe("essentielle");
      expect(slugToEnum("gagner-du-temps")).toBe("gagner_du_temps");
      expect(slugToEnum("intervention-claude")).toBe("intervention_claude");
    });

    it("getInterventionPriceCents derives correct pricing", () => {
      // Essentielle 5 participants → bracket 2-8 → 490€ → 49000c
      const r = getInterventionPriceCents("essentielle", 5);
      expect(r.cents).toBe(49000);

      // Approfondie 12 participants → bracket 9-15 → 1420€ → 142000c
      const r2 = getInterventionPriceCents("approfondie", 12);
      expect(r2.cents).toBe(142000);

      // Conference onQuote → cents = null
      const r3 = getInterventionPriceCents("conference", 50);
      expect(r3.cents).toBe(null);
    });
  });

  describe("option 48h flow", () => {
    it("option48hSchema requires consent + consentDisplay", () => {
      const valid = option48hSchema.safeParse({
        slotId: "00000000-0000-0000-0000-000000000000",
        companyName: "ACME SAS",
        companySector: "Industrie",
        participantsCount: 10,
        interventionType: "essentielle",
        contactName: "Jane Doe",
        contactEmail: "jane@acme.fr",
        contactPhone: "+33612345678",
        consentDisplay: "true",
        consent: true,
      });
      expect(valid.success).toBe(true);
    });

    it("rejects without consent", () => {
      const invalid = option48hSchema.safeParse({
        slotId: "00000000-0000-0000-0000-000000000000",
        companyName: "ACME",
        companySector: "Industrie",
        participantsCount: 10,
        interventionType: "essentielle",
        contactName: "Jane",
        contactEmail: "jane@acme.fr",
        contactPhone: "+33612345678",
        consentDisplay: false,
        consent: false,
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("auth flow", () => {
    it("signInSchema accepts strict 6-digit TOTP", () => {
      const r = signInSchema.safeParse({
        email: "admin@axion-ia.com",
        password: "AdminAxion2026!",
        totp: "123456",
      });
      expect(r.success).toBe(true);
    });

    it("rejects non-numeric TOTP", () => {
      expect(
        signInSchema.safeParse({
          email: "admin@axion-ia.com",
          password: "password123",
          totp: "abc456",
        }).success,
      ).toBe(false);
    });
  });

  describe("locale parsing helper", () => {
    it("falls back safely on invalid locale", () => {
      expect(parseLocale("xx")).toBe("fr");
      expect(parseLocale(null)).toBe("fr");
      expect(parseLocale("")).toBe("fr");
    });

    it("preserves valid locales", () => {
      expect(parseLocale("fr")).toBe("fr");
      expect(parseLocale("en")).toBe("en");
    });
  });

  describe("contact + newsletter + audit + implementation schemas", () => {
    it("all reject empty payloads", () => {
      expect(contactSchema.safeParse({}).success).toBe(false);
      expect(newsletterSchema.safeParse({}).success).toBe(false);
      expect(auditSchema.safeParse({}).success).toBe(false);
      expect(implementationSchema.safeParse({}).success).toBe(false);
    });

    it("intervention slug schema is strict", () => {
      expect(interventionSlugSchema.safeParse("essentielle").success).toBe(true);
      expect(interventionSlugSchema.safeParse("approfondie").success).toBe(true);
      expect(interventionSlugSchema.safeParse("equipes").success).toBe(false); // ancien slug
      expect(interventionSlugSchema.safeParse("foo-bar").success).toBe(false);
    });

    it("locale schema rejects unsupported", () => {
      expect(localeSchema.safeParse("es").success).toBe(false);
      expect(localeSchema.safeParse("de").success).toBe(false);
    });
  });
});
