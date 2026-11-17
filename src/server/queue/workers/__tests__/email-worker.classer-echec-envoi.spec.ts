// W1-S4 : classement des échecs d'envoi (C1 à C8), avec de VRAIES erreurs nodemailer.
import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import SMTPConnection from "nodemailer/lib/smtp-connection";

vi.mock("bullmq", () => ({ Worker: class {}, DelayedError: class extends Error {} }));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({}) }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { classerEchecEnvoi } from "../email-worker";

const err = (o: Record<string, unknown>, message = "x") => Object.assign(new Error(message), o);
const lire = (p: string) => readFileSync(p, "utf8");

/** Vraie erreur nodemailer : `send()` sur une connexion déjà fermée. */
function erreurConnexionDetruite(): Promise<Error & { code?: string }> {
  const c = new SMTPConnection({ host: "127.0.0.1", port: 1 });
  c.close();
  return new Promise((resolve, reject) => {
    c.send({ from: "a@exemple.fr", to: ["b@exemple.fr"] }, "x", (e: Error | null) =>
      e ? resolve(e) : reject(new Error("aucune erreur levée")),
    );
  });
}

describe("classerEchecEnvoi : nouvelles règles W1-S4", () => {
  it("C1 : connexion détruite (vraie erreur nodemailer) → rien_parti", async () => {
    const e = await erreurConnexionDetruite();
    expect(e.code).toBe("ECONNECTION");
    expect(e.message).toMatch(/^Cannot send message - smtp connection /);
    expect(classerEchecEnvoi(e)).toBe("rien_parti");
  });

  it("C2 : « Unexpected socket close » sans code → ambigu", () => {
    expect(classerEchecEnvoi(new Error("Unexpected socket close"))).toBe("ambigu");
  });

  it.each([
    ["C3", err({ code: "ECONNECTION", command: "CONN" }, "Connection closed unexpectedly")],
    ["C4", new Error("Reached maximum number of retries after connection was closed")],
    ["C5", err({ code: "ETIMEDOUT", command: "CONN" }, "Timeout")],
    ["C6", err({ code: "ESOCKET", syscall: "read", errno: -104 }, "read ECONNRESET")],
    ["C7", err({ code: "ESOCKET", command: "CONN" }, "certificate has expired")],
  ])("%s : reste ambigu", (_n, e) => {
    expect(classerEchecEnvoi(e)).toBe("ambigu");
  });

  it("« Unexpected socket close » avec un code autre que ETLS (ex. ESOCKET) reste ambigu", () => {
    expect(classerEchecEnvoi(err({ code: "ESOCKET" }, "Unexpected socket close"))).toBe("ambigu");
  });

  it("« Unexpected socket close » avec le code ETLS (STARTTLS) → rien_parti (règle 2)", () => {
    expect(classerEchecEnvoi(err({ code: "ETLS" }, "Unexpected socket close"))).toBe("rien_parti");
  });

  it("C8 : épingles sur nodemailer 9.0.5 et client.ts", () => {
    expect(lire("node_modules/nodemailer/lib/smtp-connection/index.js")).toContain(
      "_isDestroyedMessage('send message')",
    );
    expect(lire("node_modules/nodemailer/lib/smtp-pool/index.js")).toContain(
      "this.options.maxRequeues",
    );
    expect(lire("src/lib/email/client.ts")).toContain("pool: true");
  });
});
