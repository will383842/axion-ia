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
  auditRequestSchema,
  auditRequestStep1Schema,
  auditRequestStep2Schema,
  auditRequestStep3Schema,
  auditRequestStep4Schema,
  auditRequestStep5Schema,
  auditRequestStep6Schema,
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

describe("auditRequestSchema (6 steps)", () => {
  const validFull = {
    auditType: "flash" as const,
    size: "pme" as const,
    industry: "Industrie",
    companyName: "ACME SAS",
    modality: "onsite" as const,
    city: "Paris",
    country: "France",
    scope: "global" as const,
    scopeDetail:
      "Cartographier l'ensemble des process commerciaux et opérationnels pour identifier les automatisations IA possibles.",
    maturity: "starting" as const,
    goals: "Réduire le temps passé sur les tâches répétitives de saisie et de relance commerciale.",
    contact: "Jane Doe",
    email: "jane@example.com",
    phone: "+33612345678",
    role: "Directrice opérations",
    consent: true as const,
  };

  it("step 1 accepts each audit level", () => {
    for (const auditType of ["flash", "process", "strategique-pme", "strategique-eti"] as const) {
      expect(auditRequestStep1Schema.safeParse({ auditType }).success).toBe(true);
    }
  });

  it("step 1 rejects unknown audit level", () => {
    expect(auditRequestStep1Schema.safeParse({ auditType: "ghost" }).success).toBe(false);
  });

  it("step 2 requires size + industry", () => {
    expect(auditRequestStep2Schema.safeParse({ size: "pme", industry: "Tech" }).success).toBe(true);
    expect(auditRequestStep2Schema.safeParse({ size: "pme", industry: "" }).success).toBe(false);
  });

  it("step 3 requires modality + city + country", () => {
    expect(
      auditRequestStep3Schema.safeParse({
        modality: "remote",
        city: "Lyon",
        country: "France",
      }).success,
    ).toBe(true);
    expect(
      auditRequestStep3Schema.safeParse({
        modality: "onsite",
        city: "",
        country: "France",
      }).success,
    ).toBe(false);
  });

  it("step 4 requires scope + maturity + ≥20 char detail/goals", () => {
    expect(
      auditRequestStep4Schema.safeParse({
        scope: "global",
        scopeDetail: "trop court",
        maturity: "zero",
        goals: "trop court",
      }).success,
    ).toBe(false);
    expect(
      auditRequestStep4Schema.safeParse({
        scope: "single-area",
        scopeDetail: "Service commercial uniquement, équipe de 12 personnes.",
        maturity: "starting",
        goals: "Réduire le temps consacré aux relances clients.",
      }).success,
    ).toBe(true);
  });

  it("step 4 accepts optional tools array + free text", () => {
    expect(
      auditRequestStep4Schema.safeParse({
        scope: "global",
        scopeDetail: "Service commercial uniquement, équipe de 12 personnes.",
        maturity: "starting",
        goals: "Réduire le temps consacré aux relances clients.",
        tools: ["Excel", "CRM", "ChatGPT"],
        toolsOther: "Pipedrive, Zapier",
      }).success,
    ).toBe(true);
    // Tools omis → toujours valide
    expect(
      auditRequestStep4Schema.safeParse({
        scope: "global",
        scopeDetail: "Service commercial uniquement, équipe de 12 personnes.",
        maturity: "starting",
        goals: "Réduire le temps consacré aux relances clients.",
      }).success,
    ).toBe(true);
  });

  it("step 5 requires contact + email, role/phone optional", () => {
    expect(
      auditRequestStep5Schema.safeParse({
        contact: "Jane",
        email: "jane@example.com",
      }).success,
    ).toBe(true);
    expect(
      auditRequestStep5Schema.safeParse({
        contact: "Jane",
        email: "broken",
      }).success,
    ).toBe(false);
  });

  it("step 6 requires consent literal true", () => {
    expect(auditRequestStep6Schema.safeParse({ consent: false }).success).toBe(false);
    expect(auditRequestStep6Schema.safeParse({ consent: true }).success).toBe(true);
  });

  it("merged auditRequestSchema accepts a full valid payload", () => {
    expect(auditRequestSchema.safeParse(validFull).success).toBe(true);
  });

  it("merged auditRequestSchema rejects when any step is invalid", () => {
    expect(auditRequestSchema.safeParse({ ...validFull, scopeDetail: "trop court" }).success).toBe(
      false,
    );
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
  // Sprint 15 audit Fork 2 C2-2 : interventionType + participantsCount sont
  // desormais requis dans le schema (avant: lus brut hors safeParse).
  const valid = {
    date: "2026-06-15",
    time: "09:00",
    contact: "Jane Doe",
    email: "jane@example.com",
    phone: "+33612345678",
    consent: true as const,
    interventionType: "essentielle" as const,
    participantsCount: 5,
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

  it("rejects unknown interventionType slug", () => {
    expect(bookingSchema.safeParse({ ...valid, interventionType: "managers" }).success).toBe(false);
  });

  it("coerces participantsCount string to number", () => {
    const result = bookingSchema.safeParse({ ...valid, participantsCount: "12" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.participantsCount).toBe(12);
  });

  it("rejects participantsCount < 1", () => {
    expect(bookingSchema.safeParse({ ...valid, participantsCount: 0 }).success).toBe(false);
  });
});
