/**
 * Tests — enveloppe d'expédition (I0b-2).
 *
 * Source unique de « De » et « Répondre à » : `client.ts` s'en sert sans changer
 * de comportement. Les constantes sont figées à l'import : chaque cas passe par
 * `vi.resetModules()` + import dynamique.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createTransportMock = vi.fn();
const sendMailMock = vi.fn();

vi.mock("nodemailer", () => ({
  default: { createTransport: (...a: unknown[]) => createTransportMock(...a) },
}));

const ENV_ORIGINE = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  sendMailMock.mockResolvedValue({ messageId: "<id@test>" });
  createTransportMock.mockReturnValue({ sendMail: sendMailMock });
  process.env["SMTP_HOST"] = "smtp.test";
  process.env["SMTP_PORT"] = "587";
  process.env["SMTP_USER"] = "u";
  process.env["SMTP_PASS"] = "p";
});

afterEach(() => {
  process.env = { ...ENV_ORIGINE };
  vi.restoreAllMocks();
});

describe("sendEmail — from et replyTo viennent de enveloppeExpedition", () => {
  for (const marketing of [true, false]) {
    it(`marketing=${marketing} : égalité exacte, nom assaini pareil`, async () => {
      process.env["SMTP_FROM_NAME"] = 'A\r\nB"';
      vi.resetModules();
      const { sendEmail } = await import("../client");
      const { enveloppeExpedition } = await import("../enveloppe");
      await sendEmail({ to: "a@b.fr", subject: "s", html: "<p>h</p>", text: "h", marketing });
      const envoye = sendMailMock.mock.calls[0]?.[0] as { from: string; replyTo: string };
      const attendu = enveloppeExpedition({ marketing });
      expect(envoye.from).toBe(attendu.from);
      expect(envoye.replyTo).toBe(attendu.replyTo);
      expect(envoye.from).toBe(
        `"AB" <${marketing ? "news@axion-ia.com" : "contact@axion-ia.com"}>`,
      );
      expect(envoye.from).not.toMatch(/[\r\n]/);
    });
  }

  it("un replyTo d'appelant surcharge le défaut", async () => {
    vi.resetModules();
    const { sendEmail } = await import("../client");
    await sendEmail({ to: "a@b.fr", subject: "s", html: "h", replyTo: "x@axion-ia.com" });
    expect((sendMailMock.mock.calls[0]?.[0] as { replyTo: string }).replyTo).toBe("x@axion-ia.com");
  });
});

describe("enveloppeExpedition", () => {
  it("défauts : contact@ transactionnel, news@ marketing, Reply-To contact@", async () => {
    vi.resetModules();
    const { enveloppeExpedition } = await import("../enveloppe");
    expect(enveloppeExpedition()).toMatchObject({
      from: '"Axion-IA" <contact@axion-ia.com>',
      replyTo: "contact@axion-ia.com",
    });
    expect(enveloppeExpedition({ marketing: true }).from).toBe('"Axion-IA" <news@axion-ia.com>');
  });

  it("ADMIN_REPLY_FROM devient le Reply-To par défaut", async () => {
    process.env["ADMIN_REPLY_FROM"] = "reponses@axion-ia.com";
    vi.resetModules();
    const { enveloppeExpedition } = await import("../enveloppe");
    expect(enveloppeExpedition().replyTo).toBe("reponses@axion-ia.com");
    expect(enveloppeExpedition({ replyTo: "z@axion-ia.com" }).replyTo).toBe("z@axion-ia.com");
  });

  it("fromName facultatif (F3) : assaini comme le nom par défaut", async () => {
    vi.resetModules();
    const { enveloppeExpedition } = await import("../enveloppe");
    expect(enveloppeExpedition({ fromName: 'Le fondateur "X"\r\n' }).from).toBe(
      '"Le fondateur X" <contact@axion-ia.com>',
    );
    expect(enveloppeExpedition({ fromName: "<>" }).fromName).toBe("Axion-IA");
  });

  it("une adresse noreply@ est refusée (repli contact@), pour les deux natures", async () => {
    process.env["SMTP_FROM_ADDRESS"] = "noreply@axion-ia.com";
    process.env["SMTP_FROM_MARKETING"] = "no-reply@axion-ia.com";
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();
    const { enveloppeExpedition, refuserNoReply } = await import("../enveloppe");
    expect(enveloppeExpedition().fromAddress).toBe("contact@axion-ia.com");
    expect(enveloppeExpedition({ marketing: true }).fromAddress).toBe("contact@axion-ia.com");
    expect(refuserNoReply("donotreply@x.fr")).toBe("contact@axion-ia.com");
    expect(refuserNoReply("contact@x.fr")).toBe("contact@x.fr");
    expect(erreur).toHaveBeenCalled();
  });
});

describe("garde de source — une seule source pour l'enveloppe", () => {
  it("client.ts ne lit plus SMTP_FROM_NAME, SMTP_FROM_ADDRESS ni ADMIN_REPLY_FROM", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/email/client.ts"), "utf8");
    for (const nom of [
      "SMTP_FROM_NAME",
      "SMTP_FROM_ADDRESS",
      "SMTP_FROM_MARKETING",
      "ADMIN_REPLY_FROM",
    ]) {
      expect(src, nom).not.toContain(nom);
    }
    expect(src).toContain("enveloppeExpedition(");
  });

  it("enveloppe.ts est un module pur (aucun import)", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/email/enveloppe.ts"), "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
  });
});
