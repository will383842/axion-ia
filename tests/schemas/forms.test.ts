import { describe, it, expect } from "vitest";
import {
  contactSchema,
  newsletterSchema,
  auditSchema,
  auditStep1Schema,
  auditStep2Schema,
  auditStep3Schema,
  auditStep4Schema,
  auditStep5Schema,
  implementationSchema,
  implementationStep1Schema,
  implementationStep2Schema,
  implementationStep3Schema,
  implementationStep4Schema,
  bookingSchema,
} from "@/lib/schemas/forms";

describe("contactSchema", () => {
  const valid = {
    name: "Jane Doe",
    email: "jane@example.com",
    company: "ACME",
    message: "Bonjour, je souhaite un devis pour un audit IA.",
    consent: true as const,
  };

  it("accepts a valid payload", () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const r = contactSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("rejects a message under 20 chars", () => {
    const r = contactSchema.safeParse({ ...valid, message: "trop court" });
    expect(r.success).toBe(false);
  });

  it("rejects missing consent", () => {
    const r = contactSchema.safeParse({ ...valid, consent: false });
    expect(r.success).toBe(false);
  });

  it("treats company as optional", () => {
    const { company: _omit, ...withoutCompany } = valid;
    expect(contactSchema.safeParse(withoutCompany).success).toBe(true);
  });
});

describe("newsletterSchema", () => {
  it("accepts email + consent", () => {
    expect(newsletterSchema.safeParse({ email: "lead@example.com", consent: true }).success).toBe(
      true,
    );
  });

  it("rejects without consent", () => {
    expect(newsletterSchema.safeParse({ email: "lead@example.com", consent: false }).success).toBe(
      false,
    );
  });

  it("rejects malformed email", () => {
    expect(newsletterSchema.safeParse({ email: "x@", consent: true }).success).toBe(false);
  });
});

describe("auditSchema (5 steps)", () => {
  const validFull = {
    size: "pme" as const,
    modality: "remote" as const,
    industry: "industrie",
    goals: "Identifier les automatisations IA possibles dans nos process internes.",
    contact: "Jane Doe",
    email: "jane@example.com",
    phone: "+33612345678",
    consent: true as const,
  };

  it("step 1 accepts each enum size", () => {
    for (const size of ["tpe", "pme", "mid", "enterprise"] as const) {
      expect(auditStep1Schema.safeParse({ size }).success).toBe(true);
    }
  });

  it("step 1 rejects unknown size", () => {
    expect(auditStep1Schema.safeParse({ size: "unicorn" }).success).toBe(false);
  });

  it("step 2 accepts remote/onsite", () => {
    expect(auditStep2Schema.safeParse({ modality: "remote" }).success).toBe(true);
    expect(auditStep2Schema.safeParse({ modality: "onsite" }).success).toBe(true);
  });

  it("step 3 requires industry + goals (≥ 20 chars)", () => {
    expect(auditStep3Schema.safeParse({ industry: "x", goals: "" }).success).toBe(false);
    expect(
      auditStep3Schema.safeParse({
        industry: "industrie",
        goals: "Vingt caractères au minimum exigés.",
      }).success,
    ).toBe(true);
  });

  it("step 4 makes phone optional", () => {
    expect(
      auditStep4Schema.safeParse({
        contact: "Jane",
        email: "jane@example.com",
      }).success,
    ).toBe(true);
  });

  it("step 5 requires consent literal true", () => {
    expect(auditStep5Schema.safeParse({ consent: false }).success).toBe(false);
    expect(auditStep5Schema.safeParse({ consent: true }).success).toBe(true);
  });

  it("merged auditSchema accepts a full valid payload", () => {
    expect(auditSchema.safeParse(validFull).success).toBe(true);
  });

  it("merged auditSchema rejects when any step is invalid", () => {
    expect(auditSchema.safeParse({ ...validFull, email: "broken" }).success).toBe(false);
  });
});

describe("implementationSchema (4 steps)", () => {
  const validFull = {
    type: "chatbot" as const,
    budget: "5-15k" as const,
    description:
      "Nous voulons un chatbot relation client multilingue intégré au CRM HubSpot, avec base de connaissances FAQ.",
    contact: "Jane Doe",
    email: "jane@example.com",
    consent: true as const,
  };

  it("step 1 accepts every project type", () => {
    const types = [
      "chatbot",
      "processus",
      "structuration",
      "crm-erp",
      "documents",
      "agents",
      "integrations",
      "no-code",
      "ia-custom",
    ] as const;
    for (const type of types) {
      expect(implementationStep1Schema.safeParse({ type }).success).toBe(true);
    }
  });

  it("step 2 accepts each budget bucket", () => {
    for (const budget of ["lt-5k", "5-15k", "15-50k", "gt-50k"] as const) {
      expect(implementationStep2Schema.safeParse({ budget }).success).toBe(true);
    }
  });

  it("step 3 requires ≥ 40 char description", () => {
    expect(implementationStep3Schema.safeParse({ description: "trop court" }).success).toBe(false);
    expect(
      implementationStep3Schema.safeParse({
        description: validFull.description,
      }).success,
    ).toBe(true);
  });

  it("step 4 requires consent + valid email", () => {
    expect(
      implementationStep4Schema.safeParse({
        contact: "Jane",
        email: "jane@example.com",
        consent: true,
      }).success,
    ).toBe(true);
    expect(
      implementationStep4Schema.safeParse({
        contact: "Jane",
        email: "jane@example.com",
        consent: false,
      }).success,
    ).toBe(false);
  });

  it("merged implementationSchema accepts a full valid payload", () => {
    expect(implementationSchema.safeParse(validFull).success).toBe(true);
  });
});

describe("bookingSchema", () => {
  const valid = {
    date: "2026-06-15",
    time: "09:00",
    contact: "Jane Doe",
    email: "jane@example.com",
    phone: "+33612345678",
    consent: true as const,
  };

  it("accepts a fully valid booking", () => {
    expect(bookingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects malformed date", () => {
    expect(bookingSchema.safeParse({ ...valid, date: "15/06/2026" }).success).toBe(false);
  });

  it("rejects malformed time", () => {
    expect(bookingSchema.safeParse({ ...valid, time: "9h" }).success).toBe(false);
  });

  it("treats phone as optional", () => {
    const { phone: _omit, ...withoutPhone } = valid;
    expect(bookingSchema.safeParse(withoutPhone).success).toBe(true);
  });

  it("rejects without consent", () => {
    expect(bookingSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });
});
