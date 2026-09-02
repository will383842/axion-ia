// @vitest-environment node
//
// Rebond d'une RÉPONSE MANUELLE — lot 2 (2026-09-02).
//
// `SubmissionReply.toEmail` est la PII chiffrée de la demande (`encryptPii`,
// non déterministe). Comparer une adresse en clair à cette colonne ne pouvait
// jamais correspondre : le rattachement n'a jamais fonctionné. On passe par
// l'empreinte de recherche que porte la demande (`contactEmailHash`).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const p = vi.hoisted(() => ({
  emailLogFindFirst: vi.fn(),
  emailLogUpdate: vi.fn(),
  submissionFindMany: vi.fn(),
  replyUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findFirst: (...a: unknown[]) => p.emailLogFindFirst(...a),
      update: (...a: unknown[]) => p.emailLogUpdate(...a),
    },
    submission: { findMany: (...a: unknown[]) => p.submissionFindMany(...a) },
    submissionReply: { updateMany: (...a: unknown[]) => p.replyUpdateMany(...a) },
  },
}));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), set: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: vi.fn(async () => null),
}));
vi.mock("@/server/email/zeptomail-webhook-signature", () => ({
  verifierSignatureZeptomail: () => ({ ok: true }),
}));

import { POST } from "./route";
import { hashEmailForLookup } from "@/lib/security/email-hash";

function rebondDur(adresse: string): string {
  return JSON.stringify({
    event_name: "hardbounce",
    event_message: {
      request_id: "req-1",
      email_info: { to: [{ email_address: [{ address: adresse }] }], subject: "Re: votre demande" },
      event_data: { details: { time: "2026-09-02T08:00:00Z", reason: "550 no such user" } },
    },
  });
}

function requete(corps: string): NextRequest {
  return new NextRequest("https://axion-ia.com/api/zeptomail/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "Producer-Signature": "t=1,s=x" },
    body: corps,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["ZEPTOMAIL_WEBHOOK_KEY"] = "cle-de-test";
  p.emailLogFindFirst.mockResolvedValue(null);
  p.submissionFindMany.mockResolvedValue([]);
  p.replyUpdateMany.mockResolvedValue({ count: 0 });
});

describe("rattachement d'un rebond aux réponses manuelles", () => {
  it("🔴 cherche les demandes par EMPREINTE, puis marque leurs réponses envoyées dans la fenêtre", async () => {
    p.submissionFindMany.mockResolvedValue([{ id: "sub-1" }, { id: "sub-2" }]);
    p.replyUpdateMany.mockResolvedValue({ count: 1 });

    const res = await POST(requete(rebondDur("Prospect@Societe.FR")));
    expect(res.status).toBe(200);

    expect(p.submissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contactEmailHash: hashEmailForLookup("prospect@societe.fr") },
      }),
    );
    const appel = p.replyUpdateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(appel.where["submissionId"]).toEqual({ in: ["sub-1", "sub-2"] });
    expect(appel.where["deliveryStatus"]).toBe("sent");
    expect(appel.where).not.toHaveProperty("toEmail");
    expect(appel.data).toEqual({ deliveryStatus: "bounced" });
  });

  it("sans demande pour cette empreinte, ne touche à aucune réponse", async () => {
    await POST(requete(rebondDur("inconnu@societe.fr")));
    expect(p.replyUpdateMany).not.toHaveBeenCalled();
  });

  it("l'empreinte est calculée sur l'adresse normalisée (casse, espaces)", async () => {
    await POST(requete(rebondDur("  PROSPECT@societe.fr ")));
    expect(p.submissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contactEmailHash: hashEmailForLookup("prospect@societe.fr") },
      }),
    );
  });
});
