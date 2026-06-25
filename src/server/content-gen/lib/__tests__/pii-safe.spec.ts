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
  redactGenerationMetadataDeep,
  redactSensitiveText,
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

describe("redactSensitiveText (value-level scrub — RGPD + secret-leak)", () => {
  it("returns '' pour null/undefined", () => {
    expect(redactSensitiveText(null)).toBe("");
    expect(redactSensitiveText(undefined)).toBe("");
  });

  it("preserve un texte propre sans PII ni secret", () => {
    const clean = "Generated 1024 words, seoScore 78, published OK";
    expect(redactSensitiveText(clean)).toBe(clean);
  });

  it("masque une clé API OpenAI sk-…", () => {
    const out = redactSensitiveText("auth failed with key sk-abcdef0123456789ABCDEF");
    expect(out).not.toContain("sk-abcdef0123456789ABCDEF");
    expect(out).toContain("[redacted-secret]");
  });

  it("masque une clé Anthropic sk-ant-… et sk-proj-…", () => {
    const ant = redactSensitiveText("sk-ant-api03-aB12cD34eF56gH78iJ90kL12mN34");
    expect(ant).not.toContain("sk-ant-api03-aB12cD34eF56gH78iJ90kL12mN34");
    expect(ant).toContain("[redacted-secret]");
    const proj = redactSensitiveText("token=sk-proj-ZZ11yy22XX33ww44VV55uu66TT77");
    expect(proj).not.toContain("sk-proj-ZZ11yy22XX33ww44VV55uu66TT77");
    expect(proj).toContain("[redacted-secret]");
  });

  it("masque un secret hex/base64 ≥ 32 chars (lettres + chiffres)", () => {
    const hex = "db error: token a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const out = redactSensitiveText(hex);
    expect(out).not.toContain("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
    expect(out).toContain("[redacted-secret]");
  });

  it("ne masque PAS un mot anglais long sans chiffre (faux positif évité)", () => {
    const word = "abcdefghijklmnopqrstuvwxyzabcdef"; // 32 lettres pures
    expect(redactSensitiveText(word)).toBe(word);
  });

  it("redacte un email inline dans du texte libre", () => {
    const out = redactSensitiveText("RSS author contact jane.roe@news.fr in feed");
    expect(out).not.toContain("jane.roe@news.fr");
    expect(out).toContain("j****@news.fr");
  });

  it("redacte un téléphone FR/intl inline", () => {
    const fr = redactSensitiveText("rappeler le 06 12 34 56 78 demain");
    expect(fr).not.toContain("06 12 34 56 78");
    const intl = redactSensitiveText("appel +33 6 12 34 56 78 urgent");
    expect(intl).not.toContain("+33 6 12 34 56 78");
  });

  it("scrubbe secret AVANT email (un base64 n'est pas pris pour un email)", () => {
    const out = redactSensitiveText("leak sk-live-AAAA1111BBBB2222CCCC3333DDDD");
    expect(out).toContain("[redacted-secret]");
  });
});

describe("redactGenerationMetadataDeep (key-based + value-based récursif)", () => {
  it("returns {} pour null/undefined", () => {
    expect(redactGenerationMetadataDeep(null)).toEqual({});
    expect(redactGenerationMetadataDeep(undefined)).toEqual({});
  });

  it("applique la redaction key-based (champs PII connus)", () => {
    const out = redactGenerationMetadataDeep({ email: "user@example.com" });
    expect(out.email).toBe("u****@example.com");
  });

  it("scrubbe une clé API cachée dans une valeur string arbitraire", () => {
    const out = redactGenerationMetadataDeep({
      error_message: "request failed: Bearer sk-abcdef0123456789ABCDEFGHIJ",
    });
    expect(String(out.error_message)).not.toContain("sk-abcdef0123456789ABCDEFGHIJ");
    expect(String(out.error_message)).toContain("[redacted-secret]");
  });

  it("scrubbe récursivement objets et arrays imbriqués", () => {
    const out = redactGenerationMetadataDeep({
      nested: { note: "ping ops@axion-ia.com" },
      list: ["sk-proj-XX11yy22ZZ33ww44VV55uu66"],
    });
    const nested = out.nested as { note: string };
    expect(nested.note).not.toContain("ops@axion-ia.com");
    expect((out.list as string[])[0]).toContain("[redacted-secret]");
  });

  it("preserve les valeurs non-string (numbers, booleans)", () => {
    const out = redactGenerationMetadataDeep({ cost_usd: 0.05, ok: true });
    expect(out.cost_usd).toBe(0.05);
    expect(out.ok).toBe(true);
  });
});
