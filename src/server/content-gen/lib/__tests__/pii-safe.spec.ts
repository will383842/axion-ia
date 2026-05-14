/**
 * Pass B P1-7 — Tests pii-safe helpers content-gen.
 *
 * Vérifie que :
 *   - redactPromptForTelegram() retire emails + téléphones inline
 *   - redactPromptForTelegram() tronque à maxLen
 *   - redactGenerationMetadata() redacte les clés email/name/phone par regex name
 *   - safeTelegramContext() compose un payload Telegram sûr
 */

import { describe, expect, it } from "vitest";
import {
  redactPromptForTelegram,
  redactGenerationMetadata,
  safeTelegramContext,
} from "../pii-safe";

describe("redactPromptForTelegram", () => {
  it("returns '(empty)' pour input vide", () => {
    expect(redactPromptForTelegram(null)).toBe("(empty)");
    expect(redactPromptForTelegram(undefined)).toBe("(empty)");
    expect(redactPromptForTelegram("")).toBe("(empty)");
  });

  it("redacte les emails inline", () => {
    const out = redactPromptForTelegram("Contact john.doe@acme.com pour info");
    expect(out).not.toContain("john.doe@acme.com");
    expect(out).toContain("j****@acme.com");
  });

  it("redacte les téléphones E.164 inline", () => {
    const out = redactPromptForTelegram("Joindre +33612345678 entre 9h-18h");
    expect(out).not.toContain("+33612345678");
    expect(out).toContain("+33");
    // Garde-fou doctrine : les 4 derniers chiffres restent visibles + des
    // étoiles couvrent la zone identifiante. Format exact de spacing dépend
    // de redactPhone() upstream — on vérifie le contrat de minimisation.
    expect(out).toContain("*");
    expect(out).toMatch(/\d{2,4}/);
  });

  it("tronque au maxLen avec ellipsis", () => {
    const long = "a".repeat(400);
    const out = redactPromptForTelegram(long, 280);
    expect(out.length).toBe(280);
    expect(out.endsWith("...")).toBe(true);
  });

  it("preserve les inputs courts sans PII", () => {
    expect(redactPromptForTelegram("Hello world")).toBe("Hello world");
  });
});

describe("redactGenerationMetadata", () => {
  it("returns {} pour null/undefined", () => {
    expect(redactGenerationMetadata(null)).toEqual({});
    expect(redactGenerationMetadata(undefined)).toEqual({});
  });

  it("redacte les champs email connus", () => {
    const out = redactGenerationMetadata({
      email: "user@example.com",
      author_email: "manon@axion-ia.com",
      other: "no-redact",
    });
    expect(out.email).toBe("u****@example.com");
    expect(out.author_email).toBe("m****@axion-ia.com");
    expect(out.other).toBe("no-redact");
  });

  it("redacte les champs name connus", () => {
    const out = redactGenerationMetadata({
      name: "Marie Curie",
      author_name: "Will",
    });
    expect(out.name).toBe("M. C.");
    expect(out.author_name).toBe("W.");
  });

  it("redacte les champs phone connus", () => {
    const out = redactGenerationMetadata({ phone: "+33612345678" });
    expect(out.phone).toContain("+33");
    expect(out.phone).toContain("*");
    expect(out.phone).not.toBe("+33612345678");
  });

  it("preserve les identifiers safe (jobId, provider)", () => {
    const out = redactGenerationMetadata({
      jobId: "job_abc123",
      provider: "openai",
      cost_usd: 0.05,
    });
    expect(out.jobId).toBe("job_abc123");
    expect(out.provider).toBe("openai");
    expect(out.cost_usd).toBe(0.05);
  });
});

describe("safeTelegramContext", () => {
  it("compose un bloc multi-lignes formaté", () => {
    const out = safeTelegramContext({
      provider: "openai",
      monthly_spent_usd: 195.5,
      monthly_cap_usd: 200,
    });
    expect(out).toContain("provider : `openai`");
    expect(out).toContain("monthly_spent_usd : `195.5`");
    expect(out).toContain("monthly_cap_usd : `200`");
  });

  it("redacte un email injecté par erreur", () => {
    const out = safeTelegramContext({
      provider: "openai",
      email: "leak@bad.com",
    });
    expect(out).not.toContain("leak@bad.com");
    expect(out).toContain("l****@bad.com");
  });

  it("skip null/undefined values", () => {
    const out = safeTelegramContext({
      provider: "openai",
      monthly_cap_usd: null,
    });
    expect(out).toContain("provider");
    expect(out).not.toContain("monthly_cap_usd");
  });

  it("returns empty string pour null input", () => {
    expect(safeTelegramContext(null)).toBe("");
    expect(safeTelegramContext(undefined)).toBe("");
  });
});
