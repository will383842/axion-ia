// W1-S4 T1 : le pool ne renvoie rien de lui-même et les délais SMTP sont bornés.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createTransportMock = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: (...a: unknown[]) => createTransportMock(...a) },
}));

const ENV_ORIGINE = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env["SMTP_HOST"] = "smtppro.zoho.eu";
  process.env["SMTP_PORT"] = "465";
  process.env["SMTP_USER"] = "contact@exemple.fr";
  process.env["SMTP_PASS"] = "secret-de-test";
});
afterEach(() => {
  process.env = { ...ENV_ORIGINE };
});

describe("T1 : options du transport", () => {
  it("maxRequeues 0, quatre délais explicites, pool de 2", async () => {
    vi.resetModules();
    createTransportMock.mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: "<m@x>", accepted: ["a@exemple.fr"] }),
    });
    const { sendEmail } = await import("../client");
    await sendEmail({ to: "a@exemple.fr", subject: "s", html: "<p>x</p>", text: "x" });
    const o = createTransportMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(o["maxRequeues"]).toBe(0);
    expect(o["connectionTimeout"]).toBe(30_000);
    expect(o["greetingTimeout"]).toBe(30_000);
    expect(o["socketTimeout"]).toBe(120_000);
    expect(o["dnsTimeout"]).toBe(30_000);
    expect(o["pool"]).toBe(true);
    expect(o["maxConnections"]).toBe(2);
  });
});
