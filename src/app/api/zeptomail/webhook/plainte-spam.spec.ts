// @vitest-environment node
//
// L2c — une plainte pour spam (« feedback loop ») met l'adresse à l'écart des sollicitations.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const p = vi.hoisted(() => ({
  signature: vi.fn(),
  creerOuDedup: vi.fn(),
  opposition: vi.fn(),
  emailLogFindFirst: vi.fn(),
  notify: vi.fn(),
  noterRebondSurAbonne: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { findFirst: (...a: unknown[]) => p.emailLogFindFirst(...a), update: vi.fn() },
    submission: { findMany: vi.fn(async () => []) },
    submissionReply: { updateMany: vi.fn(async () => ({ count: 0 })) },
    jobApplicationReply: {
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), set: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => p.notify(...a) }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (...a: unknown[]) => p.creerOuDedup(...a),
}));
vi.mock("@/server/email/zeptomail-webhook-signature", () => ({
  verifierSignatureZeptomail: (...a: unknown[]) => p.signature(...a),
}));
vi.mock("@/server/newsletter/rebonds", () => ({
  noterRebondSurAbonne: (...a: unknown[]) => p.noterRebondSurAbonne(...a),
}));
vi.mock("@/server/email/webhook-battement", () => ({
  noterAppelRecu: vi.fn(),
  noterAppelWebhook: vi.fn(),
}));
vi.mock("@/server/email/opposition", () => ({
  enregistrerOppositionPourAdresse: (...a: unknown[]) => p.opposition(...a),
}));

import { POST } from "./route";
import { lirePlainte } from "@/server/email/bounce-service";

function evenement(
  nom: string | string[],
  adresse: string | null = "Plaignant@Exemple.FR",
): string {
  return JSON.stringify({
    event_name: nom,
    event_message: {
      request_id: "req-9",
      email_info: {
        to: adresse === null ? [] : [{ email_address: [{ address: adresse }] }],
        subject: "Une offre",
      },
      event_data: { details: { time: "2026-11-17T08:00:00Z" } },
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
  p.signature.mockReturnValue({ ok: true });
  p.creerOuDedup.mockResolvedValue(null);
  p.opposition.mockResolvedValue({ ok: true, email: "x", dejaOpposee: false, crmAverti: true });
  p.emailLogFindFirst.mockResolvedValue(null);
  p.notify.mockResolvedValue({ ok: true });
  p.noterRebondSurAbonne.mockResolvedValue(undefined);
});

describe("L2c — plainte pour spam", () => {
  it("🔴 plainte signée : opposition « plainte-spam » + alerte avec adresse masquée", async () => {
    const res = await POST(requete(evenement("feedback_loop")));
    expect(res.status).toBe(200);
    expect(p.opposition).toHaveBeenCalledTimes(1);
    expect(p.opposition).toHaveBeenCalledWith("plaignant@exemple.fr", { origine: "plainte-spam" });
    expect(p.creerOuDedup).toHaveBeenCalledTimes(1);
    const alerte = JSON.stringify(p.creerOuDedup.mock.calls[0]![0]);
    expect(alerte).toContain("p****@exemple.fr");
    expect(alerte).not.toContain("plaignant@");
  });

  it.each(["FeedbackLoop", "FBL", "Spam_Complaint", "complaint", ["FEEDBACK_LOOP"]])(
    "le nom %j est reconnu (casse libre, chaîne ou tableau)",
    async (nom) => {
      await POST(requete(evenement(nom)));
      expect(p.opposition).toHaveBeenCalledTimes(1);
    },
  );

  it("signature invalide : rien n'est écrit", async () => {
    p.signature.mockReturnValue({ ok: false, reason: "mismatch" });
    const res = await POST(requete(evenement("feedback_loop")));
    expect(res.status).toBe(200);
    expect(p.opposition).not.toHaveBeenCalled();
    expect(p.creerOuDedup).not.toHaveBeenCalled();
  });

  it("rebond dur : chemin inchangé, aucune opposition", async () => {
    await POST(requete(evenement("hardbounce")));
    expect(p.opposition).not.toHaveBeenCalled();
    expect(p.emailLogFindFirst).toHaveBeenCalledTimes(1);
    expect(p.creerOuDedup.mock.calls[0]![0]).toMatchObject({ code: "email_rebond_dur" });
  });

  it("événement inconnu : 200, aucune écriture, seul son nom (≤ 40 caractères) est journalisé", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const long = "evenement_inconnu_" + "x".repeat(60);
    const res = await POST(requete(evenement(long)));
    expect(res.status).toBe(200);
    expect(p.opposition).not.toHaveBeenCalled();
    expect(p.creerOuDedup).not.toHaveBeenCalled();
    const journal = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(journal).toContain("evenement_inconnu_");
    expect(journal).not.toContain("x".repeat(30));
    expect(journal).not.toContain("exemple.fr");
    warn.mockRestore();
  });

  it("adresse absente : 200, rien", async () => {
    const res = await POST(requete(evenement("feedback_loop", null)));
    expect(res.status).toBe(200);
    expect(p.opposition).not.toHaveBeenCalled();
    expect(p.creerOuDedup).not.toHaveBeenCalled();
  });

  it("deux plaintes : même adresse, appel idempotent et alerte dédoublonnée par la même clé", async () => {
    p.opposition
      .mockResolvedValueOnce({ ok: true, email: "x", dejaOpposee: false, crmAverti: true })
      .mockResolvedValueOnce({ ok: true, email: "x", dejaOpposee: true, crmAverti: true });
    await POST(requete(evenement("feedback_loop")));
    await POST(requete(evenement("feedback_loop")));
    expect(p.opposition.mock.calls[0]).toEqual(p.opposition.mock.calls[1]);
    const [a, b] = p.creerOuDedup.mock.calls.map(
      (c) => c[0] as { code: string; cibleId: string },
    ) as [{ code: string; cibleId: string }, { code: string; cibleId: string }];
    expect(a.code).toBe(b.code);
    expect(a.cibleId).toBe(b.cibleId);
  });

  it("aucun e-mail au plaignant ni notification sortante", async () => {
    await POST(requete(evenement("feedback_loop")));
    expect(p.notify).not.toHaveBeenCalled();
  });

  it("lirePlainte : un rebond n'est pas une plainte ; entrée illisible → null", () => {
    expect(lirePlainte(JSON.parse(evenement("hardbounce")))).toBeNull();
    expect(lirePlainte("n'importe quoi")).toBeNull();
    expect(lirePlainte(null)).toBeNull();
  });
});
