// Tests générateur .ics — Sprint X.6.

import { describe, it, expect } from "vitest";
import { generateIcsEvent, generateCadrageIcs } from "./ics-generator";

describe("generateIcsEvent", () => {
  it("respecte le contrat RFC 5545 minimal", () => {
    const ics = generateIcsEvent({
      uid: "test-uid@axion-ia.com",
      start: new Date("2026-06-15T09:00:00Z"),
      end: new Date("2026-06-15T09:30:00Z"),
      summary: "Cadrage Axion-IA",
      description: "Description",
      location: "https://meet.google.com/abc-defg-hij",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("UID:test-uid@axion-ia.com");
    expect(ics).toContain("DTSTART:20260615T090000Z");
    expect(ics).toContain("DTEND:20260615T093000Z");
    expect(ics).toContain("SUMMARY:Cadrage Axion-IA");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toMatch(/\r\n$/); // CRLF final
  });

  it("échappe les caractères spéciaux RFC 5545", () => {
    const ics = generateIcsEvent({
      uid: "test@axion-ia.com",
      start: new Date(),
      end: new Date(),
      summary: "Test, semi; back\\slash",
      description: "Line1\nLine2",
    });
    expect(ics).toContain("SUMMARY:Test\\, semi\\; back\\\\slash");
    expect(ics).toContain("DESCRIPTION:Line1\\nLine2");
  });

  it("inclut ORGANIZER quand fourni", () => {
    const ics = generateIcsEvent({
      uid: "test@axion-ia.com",
      start: new Date(),
      end: new Date(),
      summary: "Test",
      organizerEmail: "william@axion-ia.com",
      organizerName: "William",
    });
    expect(ics).toContain("ORGANIZER;CN=William:mailto:william@axion-ia.com");
  });

  it("n'inclut pas LOCATION quand absent", () => {
    const ics = generateIcsEvent({
      uid: "test@axion-ia.com",
      start: new Date(),
      end: new Date(),
      summary: "Test sans location",
    });
    expect(ics).not.toContain("LOCATION:");
  });
});

describe("generateCadrageIcs", () => {
  it("génère un événement de durée correcte", () => {
    const scheduledAt = new Date("2026-06-15T09:00:00Z");
    const ics = generateCadrageIcs({
      cadrageId: "abc-123",
      scheduledAt,
      durationMinutes: 30,
      visioUrl: "https://meet.google.com/test",
      locale: "fr",
    });
    expect(ics).toContain("DTSTART:20260615T090000Z");
    expect(ics).toContain("DTEND:20260615T093000Z"); // 09:00 + 30 min
    expect(ics).toContain("LOCATION:https://meet.google.com/test");
  });

  it("FR vs EN — summary localisé", () => {
    const opts = {
      cadrageId: "x",
      scheduledAt: new Date(),
      durationMinutes: 30,
      locale: "fr" as const,
    };
    const ics_fr = generateCadrageIcs(opts);
    const ics_en = generateCadrageIcs({ ...opts, locale: "en" });
    expect(ics_fr).toContain("SUMMARY:Cadrage Axion-IA");
    expect(ics_en).toContain("SUMMARY:Axion-IA scoping call");
  });

  it("UID basé sur cadrageId pour idempotence client (update vs create)", () => {
    const ics = generateCadrageIcs({
      cadrageId: "abc-123",
      scheduledAt: new Date(),
      durationMinutes: 30,
      locale: "fr",
    });
    expect(ics).toContain("UID:cadrage-abc-123@axion-ia.com");
  });
});
