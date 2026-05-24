import { describe, it, expect } from "vitest";
import { newsletterSchema, bookingSchema, option48hSchema } from "@/lib/schemas/forms";

// Schemas restants après unification (2026-05-24) :
//   - newsletter : double opt-in RFC 8058
//   - booking    : acte transactionnel /reserver
//   - option48h  : option calendrier 48h (Booking V1)
// Les schemas contact/audit/auditRequest/implementation/quoteRequest/intervention
// ont migré vers `unified-contact-schema.ts` (cf. unified-contact-schema.test.ts).

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

describe("bookingSchema", () => {
  const valid = {
    date: "2026-06-15",
    time: "09:00",
    contact: "Jane Doe",
    email: "jane@example.com",
    consent: true as const,
    interventionType: "essentielle" as const,
    participantsCount: 5,
  };

  it("accepts a valid payload", () => {
    expect(bookingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid date format", () => {
    expect(bookingSchema.safeParse({ ...valid, date: "15/06/2026" }).success).toBe(false);
  });

  it("rejects invalid time format", () => {
    expect(bookingSchema.safeParse({ ...valid, time: "9h00" }).success).toBe(false);
  });

  it("rejects invalid intervention slug", () => {
    expect(
      bookingSchema.safeParse({ ...valid, interventionType: "unknown-slug" as never }).success,
    ).toBe(false);
  });

  it("rejects participantsCount < 1", () => {
    expect(bookingSchema.safeParse({ ...valid, participantsCount: 0 }).success).toBe(false);
  });

  it("rejects participantsCount > 500", () => {
    expect(bookingSchema.safeParse({ ...valid, participantsCount: 501 }).success).toBe(false);
  });

  it("coerces participantsCount from string", () => {
    const r = bookingSchema.safeParse({ ...valid, participantsCount: "12" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.participantsCount).toBe(12);
  });
});

describe("option48hSchema", () => {
  const valid = {
    slotId: "00000000-0000-0000-0000-000000000000",
    companyName: "ACME SAS",
    companySector: "Industrie",
    participantsCount: 10,
    interventionType: "essentielle" as const,
    contactName: "Jane Doe",
    contactEmail: "jane@acme.fr",
    contactPhone: "+33612345678",
    consentDisplay: true as const,
    consent: true as const,
  };

  it("accepts a complete valid payload", () => {
    expect(option48hSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts consentDisplay as string 'true'", () => {
    expect(option48hSchema.safeParse({ ...valid, consentDisplay: "true" }).success).toBe(true);
  });

  it("rejects consent=false", () => {
    expect(option48hSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });

  it("rejects invalid slotId (not UUID)", () => {
    expect(option48hSchema.safeParse({ ...valid, slotId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects contactPhone too short", () => {
    expect(option48hSchema.safeParse({ ...valid, contactPhone: "12345" }).success).toBe(false);
  });

  it("rejects empty companyName", () => {
    expect(option48hSchema.safeParse({ ...valid, companyName: "" }).success).toBe(false);
  });
});
