import { describe, it, expect } from "vitest";
import {
  unifiedContactSchema,
  UNIFIED_CONTACT_TYPES,
  unifiedTypeLabel,
} from "@/lib/schemas/unified-contact-schema";

const validBase = {
  type: "autre" as const,
  nom: "Jane Doe",
  email: "jane@example.com",
  telephone: "+33 6 12 34 56 78",
  ville: "Paris",
  message: "Bonjour, je souhaite un échange à propos de votre offre IA.",
  consent: true as const,
};

describe("unifiedContactSchema", () => {
  it("accepts a valid minimal payload (5 base fields + consent)", () => {
    expect(unifiedContactSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects an empty payload", () => {
    expect(unifiedContactSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an unknown type", () => {
    const r = unifiedContactSchema.safeParse({ ...validBase, type: "newsletter" });
    expect(r.success).toBe(false);
  });

  it("accepts all enum types", () => {
    for (const type of UNIFIED_CONTACT_TYPES) {
      expect(unifiedContactSchema.safeParse({ ...validBase, type }).success).toBe(true);
    }
  });

  it("covers devis + partenariat (2026-05-26 extension)", () => {
    expect(UNIFIED_CONTACT_TYPES).toContain("devis");
    expect(UNIFIED_CONTACT_TYPES).toContain("partenariat");
  });

  it("rejects email malformé", () => {
    expect(unifiedContactSchema.safeParse({ ...validBase, email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("rejects téléphone trop court", () => {
    expect(unifiedContactSchema.safeParse({ ...validBase, telephone: "12345" }).success).toBe(
      false,
    );
  });

  it("rejects téléphone avec caractères invalides", () => {
    expect(
      unifiedContactSchema.safeParse({ ...validBase, telephone: "abc-def-ghij" }).success,
    ).toBe(false);
  });

  it("rejects message < 20 caractères", () => {
    expect(unifiedContactSchema.safeParse({ ...validBase, message: "trop court" }).success).toBe(
      false,
    );
  });

  it("rejects message > 2000 caractères", () => {
    const long = "a".repeat(2001);
    expect(unifiedContactSchema.safeParse({ ...validBase, message: long }).success).toBe(false);
  });

  it("rejects nom < 2 caractères", () => {
    expect(unifiedContactSchema.safeParse({ ...validBase, nom: "A" }).success).toBe(false);
  });

  it("rejects ville < 2 caractères", () => {
    expect(unifiedContactSchema.safeParse({ ...validBase, ville: "P" }).success).toBe(false);
  });

  it("rejects consent absent", () => {
    const { consent: _, ...rest } = validBase;
    void _;
    expect(unifiedContactSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects consent=false", () => {
    expect(unifiedContactSchema.safeParse({ ...validBase, consent: false }).success).toBe(false);
  });

  it("accepts advanced fields (companyName, companySize, sector, budget, timing)", () => {
    const r = unifiedContactSchema.safeParse({
      ...validBase,
      type: "audit",
      companyName: "ACME SAS",
      companySize: "pme",
      companySector: "Industrie",
      budgetIndicative: "10-20 k€",
      timingWeeks: "4-8",
    });
    expect(r.success).toBe(true);
  });

  it("rejects companySize invalide", () => {
    expect(
      unifiedContactSchema.safeParse({ ...validBase, companySize: "freelance" as never }).success,
    ).toBe(false);
  });

  it("rejects timingWeeks invalide", () => {
    expect(
      unifiedContactSchema.safeParse({ ...validBase, timingWeeks: "20+" as never }).success,
    ).toBe(false);
  });

  it("default locale = fr", () => {
    const r = unifiedContactSchema.safeParse(validBase);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.locale).toBe("fr");
  });

  it("accepts source + subType metadata", () => {
    const r = unifiedContactSchema.safeParse({
      ...validBase,
      type: "implementation",
      source: "/implementation/chatbot",
      subType: "chatbot",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.source).toBe("/implementation/chatbot");
      expect(r.data.subType).toBe("chatbot");
    }
  });

  it("trim whitespace on nom/email/ville/message", () => {
    const r = unifiedContactSchema.safeParse({
      ...validBase,
      nom: "  Jane Doe  ",
      email: "  jane@example.com  ",
      ville: "  Paris  ",
      message: "  Bonjour, je souhaite un échange à propos de votre offre IA.  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.nom).toBe("Jane Doe");
      expect(r.data.ville).toBe("Paris");
    }
  });
});

describe("unifiedTypeLabel", () => {
  it("returns FR labels for all types", () => {
    expect(unifiedTypeLabel("autre", "fr")).toBe("Autre demande");
    expect(unifiedTypeLabel("devis", "fr")).toBe("Devis");
    expect(unifiedTypeLabel("audit", "fr")).toBe("Audit IA");
    expect(unifiedTypeLabel("implementation", "fr")).toBe("Implémentation IA");
    expect(unifiedTypeLabel("formation", "fr")).toBe("Formation");
    expect(unifiedTypeLabel("un_a_un", "fr")).toBe("Coaching 1-à-1");
    expect(unifiedTypeLabel("partenariat", "fr")).toBe("Partenariat");
  });

  it("returns EN labels for all types", () => {
    expect(unifiedTypeLabel("audit", "en")).toBe("AI audit");
    expect(unifiedTypeLabel("implementation", "en")).toBe("AI implementation");
    expect(unifiedTypeLabel("devis", "en")).toBe("Quote");
    expect(unifiedTypeLabel("partenariat", "en")).toBe("Partnership");
  });
});
