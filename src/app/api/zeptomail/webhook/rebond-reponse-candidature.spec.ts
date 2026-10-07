// @vitest-environment node
//
// Lot L2 « Candidatures unifiées » (2026-10-07) — une réponse écrite à un
// CANDIDAT depuis la console passe « rejetée » quand son adresse rebondit.
//
// Deux moitiés :
//   1. ce qui change — la dernière `JobApplicationReply` `sent` du candidat
//      passe `bounced`, et seulement elle ;
//   2. ce qui NE change PAS — journal des envois, réponses aux demandes de
//      contact, abonnés, alerte, signature, événements qui ne sont pas des
//      rebonds : mêmes appels, mêmes arguments, même réponse rendue.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const p = vi.hoisted(() => ({
  emailLogFindFirst: vi.fn(),
  emailLogUpdate: vi.fn(),
  submissionFindMany: vi.fn(),
  submissionReplyUpdateMany: vi.fn(),
  candReplyFindFirst: vi.fn(),
  candReplyUpdateMany: vi.fn(),
  signature: vi.fn(),
  creerOuDedup: vi.fn(),
  notify: vi.fn(),
  noterRebondSurAbonne: vi.fn(),
  noterAppelRecu: vi.fn(),
  noterAppelWebhook: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findFirst: (...a: unknown[]) => p.emailLogFindFirst(...a),
      update: (...a: unknown[]) => p.emailLogUpdate(...a),
    },
    submission: { findMany: (...a: unknown[]) => p.submissionFindMany(...a) },
    submissionReply: { updateMany: (...a: unknown[]) => p.submissionReplyUpdateMany(...a) },
    jobApplicationReply: {
      findFirst: (...a: unknown[]) => p.candReplyFindFirst(...a),
      updateMany: (...a: unknown[]) => p.candReplyUpdateMany(...a),
    },
  },
}));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), set: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/server/notifications", () => ({
  notify: (...a: unknown[]) => p.notify(...a),
}));
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
  noterAppelRecu: (...a: unknown[]) => p.noterAppelRecu(...a),
  noterAppelWebhook: (...a: unknown[]) => p.noterAppelWebhook(...a),
}));

import { POST } from "./route";
import { hashEmailForLookup } from "@/lib/security/email-hash";

const INSTANT = "2026-10-07T08:00:00Z";
const SURVENU = new Date(INSTANT);
const DEPUIS = new Date(SURVENU.getTime() - 72 * 3600_000);

function rebond(adresse: string, type: "hardbounce" | "softbounce" = "hardbounce"): string {
  return JSON.stringify({
    event_name: type,
    event_message: {
      request_id: "req-1",
      email_info: {
        to: [{ email_address: [{ address: adresse }] }],
        subject: "Votre candidature",
      },
      event_data: { details: { time: INSTANT, reason: "550 no such user" } },
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
  p.emailLogFindFirst.mockResolvedValue(null);
  p.emailLogUpdate.mockResolvedValue({});
  p.submissionFindMany.mockResolvedValue([]);
  p.submissionReplyUpdateMany.mockResolvedValue({ count: 0 });
  p.candReplyFindFirst.mockResolvedValue(null);
  p.candReplyUpdateMany.mockResolvedValue({ count: 0 });
  p.creerOuDedup.mockResolvedValue(null);
  p.notify.mockResolvedValue({ ok: true });
  p.noterRebondSurAbonne.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Ce qui change
// ─────────────────────────────────────────────────────────────────────────────

describe("L2 — la réponse à un candidat passe « rejetée » quand elle rebondit", () => {
  it("🔴 cherche la DERNIÈRE réponse partie, par empreinte et dans la fenêtre, puis la marque bounced", async () => {
    p.candReplyFindFirst.mockResolvedValue({ id: "rep-2", deliveryStatus: "sent" });
    p.candReplyUpdateMany.mockResolvedValue({ count: 1 });

    const res = await POST(requete(rebond("  Candidat@Exemple.FR ")));
    expect(res.status).toBe(200);

    expect(p.candReplyFindFirst).toHaveBeenCalledTimes(1);
    expect(p.candReplyFindFirst).toHaveBeenCalledWith({
      where: {
        application: { emailHash: hashEmailForLookup("candidat@exemple.fr") },
        sentAt: { gte: DEPUIS, lte: SURVENU },
        deliveryStatus: { in: ["sent", "bounced"] },
      },
      orderBy: { sentAt: "desc" },
      select: { id: true, deliveryStatus: true },
    });
    expect(p.candReplyUpdateMany).toHaveBeenCalledTimes(1);
    expect(p.candReplyUpdateMany).toHaveBeenCalledWith({
      where: { id: "rep-2", deliveryStatus: "sent" },
      data: { deliveryStatus: "bounced" },
    });
  });

  it("un `pending` (ou un `failed`) ne bouge pas : il n'est jamais candidat", async () => {
    // `pending`/`failed` n'ont pas de `sentAt` et sont hors du filtre d'état :
    // la base ne rend rien.
    await POST(requete(rebond("candidat@exemple.fr")));
    const where = (p.candReplyFindFirst.mock.calls[0]![0] as { where: Record<string, unknown> })
      .where;
    expect(where["deliveryStatus"]).toEqual({ in: ["sent", "bounced"] });
    expect(where["sentAt"]).toEqual({ gte: DEPUIS, lte: SURVENU });
    expect(p.candReplyUpdateMany).not.toHaveBeenCalled();
  });

  it("idempotent : si la dernière réponse est DÉJÀ rejetée, on ne descend pas à la précédente", async () => {
    p.candReplyFindFirst.mockResolvedValue({ id: "rep-2", deliveryStatus: "bounced" });
    await POST(requete(rebond("candidat@exemple.fr")));
    expect(p.candReplyUpdateMany).not.toHaveBeenCalled();
  });

  it("un rebond doux marque aussi la réponse, comme le journal des envois", async () => {
    p.candReplyFindFirst.mockResolvedValue({ id: "rep-1", deliveryStatus: "sent" });
    p.candReplyUpdateMany.mockResolvedValue({ count: 1 });
    await POST(requete(rebond("candidat@exemple.fr", "softbounce")));
    expect(p.candReplyUpdateMany).toHaveBeenCalledTimes(1);
    // Pas d'alerte sur un doux : inchangé.
    expect(p.creerOuDedup).not.toHaveBeenCalled();
  });

  it("l'alerte « rebond dur » existante le signale quand une réponse candidat est rejetée", async () => {
    p.candReplyFindFirst.mockResolvedValue({ id: "rep-1", deliveryStatus: "sent" });
    p.candReplyUpdateMany.mockResolvedValue({ count: 1 });
    await POST(requete(rebond("candidat@exemple.fr")));
    const alerte = p.creerOuDedup.mock.calls[0]![0] as { message: string; code: string };
    expect(alerte.code).toBe("email_rebond_dur");
    expect(alerte.message).toContain("marquée « rejetée » sur sa candidature");
  });

  it("une panne sur les réponses candidats n'empêche ni les demandes, ni l'abonné, ni l'alerte", async () => {
    p.candReplyFindFirst.mockRejectedValue(new Error("base indisponible"));
    p.submissionFindMany.mockResolvedValue([{ id: "sub-1" }]);
    const res = await POST(requete(rebond("candidat@exemple.fr")));
    expect(res.status).toBe(200);
    expect(p.submissionReplyUpdateMany).toHaveBeenCalledTimes(1);
    expect(p.noterRebondSurAbonne).toHaveBeenCalledTimes(1);
    expect(p.creerOuDedup).toHaveBeenCalledTimes(1);
  });

  it("une panne du rattachement principal n'empêche pas de marquer la réponse candidat", async () => {
    p.emailLogFindFirst.mockRejectedValue(new Error("base indisponible"));
    p.candReplyFindFirst.mockResolvedValue({ id: "rep-1", deliveryStatus: "sent" });
    p.candReplyUpdateMany.mockResolvedValue({ count: 1 });
    const res = await POST(requete(rebond("candidat@exemple.fr")));
    expect(res.status).toBe(200);
    expect(p.candReplyUpdateMany).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Ce qui ne change pas
// ─────────────────────────────────────────────────────────────────────────────

describe("non-régression — le reste du webhook est strictement identique", () => {
  it("journal des envois : même recherche, même écriture qu'avant", async () => {
    p.emailLogFindFirst.mockResolvedValue({ id: "log-1" });
    await POST(requete(rebond("prospect@societe.fr")));
    expect(p.emailLogFindFirst).toHaveBeenCalledWith({
      where: {
        recipient: "prospect@societe.fr",
        createdAt: { gte: DEPUIS, lte: SURVENU },
        status: "sent",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    expect(p.emailLogUpdate).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: {
        status: "bounced",
        bounceType: "hard",
        bounceReason: "550 no such user",
        bouncedAt: SURVENU,
      },
    });
  });

  it("réponses aux demandes de contact (`SubmissionReply`) : mêmes appels, avec ou sans candidat", async () => {
    p.submissionFindMany.mockResolvedValue([{ id: "sub-1" }, { id: "sub-2" }]);
    const attendu = {
      where: {
        submissionId: { in: ["sub-1", "sub-2"] },
        sentAt: { gte: DEPUIS, lte: SURVENU },
        deliveryStatus: "sent",
      },
      data: { deliveryStatus: "bounced" },
    };

    await POST(requete(rebond("prospect@societe.fr")));
    expect(p.submissionFindMany).toHaveBeenCalledWith({
      where: { contactEmailHash: hashEmailForLookup("prospect@societe.fr") },
      select: { id: true },
    });
    expect(p.submissionReplyUpdateMany).toHaveBeenCalledWith(attendu);

    // Même personne, aussi candidate : le traitement des demandes ne bouge pas.
    vi.clearAllMocks();
    p.signature.mockReturnValue({ ok: true });
    p.emailLogFindFirst.mockResolvedValue(null);
    p.submissionFindMany.mockResolvedValue([{ id: "sub-1" }, { id: "sub-2" }]);
    p.submissionReplyUpdateMany.mockResolvedValue({ count: 1 });
    p.candReplyFindFirst.mockResolvedValue({ id: "rep-1", deliveryStatus: "sent" });
    p.candReplyUpdateMany.mockResolvedValue({ count: 1 });
    p.creerOuDedup.mockResolvedValue(null);
    p.noterRebondSurAbonne.mockResolvedValue(undefined);

    await POST(requete(rebond("prospect@societe.fr")));
    expect(p.submissionReplyUpdateMany).toHaveBeenCalledTimes(1);
    expect(p.submissionReplyUpdateMany).toHaveBeenCalledWith(attendu);
  });

  it("une réponse candidat rejetée n'est jamais mêlée aux réponses des demandes", async () => {
    p.candReplyFindFirst.mockResolvedValue({ id: "rep-1", deliveryStatus: "sent" });
    p.candReplyUpdateMany.mockResolvedValue({ count: 1 });
    await POST(requete(rebond("candidat@exemple.fr")));
    expect(p.submissionReplyUpdateMany).not.toHaveBeenCalled();
  });

  it("abonné à la lettre : toujours noté, avec les mêmes arguments", async () => {
    await POST(requete(rebond("prospect@societe.fr", "softbounce")));
    expect(p.noterRebondSurAbonne).toHaveBeenCalledWith("prospect@societe.fr", "soft", SURVENU);
  });

  it("réponse rendue à ZeptoMail : même forme, que la réponse candidat soit marquée ou non", async () => {
    const sans = await (await POST(requete(rebond("x@y.fr")))).json();
    expect(sans).toEqual({ ok: true, type: "hard", rattache: false });

    p.candReplyFindFirst.mockResolvedValue({ id: "rep-1", deliveryStatus: "sent" });
    p.candReplyUpdateMany.mockResolvedValue({ count: 1 });
    const avec = await (await POST(requete(rebond("x@y.fr")))).json();
    expect(avec).toEqual({ ok: true, type: "hard", rattache: false });

    p.emailLogFindFirst.mockResolvedValue({ id: "log-1" });
    const rattachee = await (await POST(requete(rebond("x@y.fr")))).json();
    expect(rattachee).toEqual({ ok: true, type: "hard", rattache: true });
  });

  it("alerte « rebond dur » : texte, code et cible inchangés quand aucun candidat n'est concerné", async () => {
    await POST(requete(rebond("prospect@societe.fr")));
    expect(p.creerOuDedup).toHaveBeenCalledWith({
      code: "email_rebond_dur",
      niveau: "important",
      titre: "Un e-mail a définitivement rebondi",
      message:
        "L'adresse « prospect@societe.fr » a refusé définitivement un envoi (« Votre candidature »). " +
        "Motif du serveur : 550 no such user. " +
        "Aucun envoi n'a pu être rattaché — le rebond est consigné ici. " +
        "Tant que l'adresse n'est pas corrigée, cette personne ne recevra ni convocation, ni attestation.",
      cibleType: "EmailLog",
      cibleId: "prospect@societe.fr",
    });
  });

  it("événements qui ne sont pas des rebonds (remis, ouvert, plainte…) : rien n'est écrit", async () => {
    for (const nom of ["delivered", "email_open", "email_link_click", "feedback_loop"]) {
      const res = await POST(
        requete(JSON.stringify({ event_name: nom, event_message: { email_info: {} } })),
      );
      expect(await res.json()).toEqual({ ok: true, ignored: "not_a_bounce" });
    }
    expect(p.emailLogFindFirst).not.toHaveBeenCalled();
    expect(p.submissionFindMany).not.toHaveBeenCalled();
    expect(p.candReplyFindFirst).not.toHaveBeenCalled();
    expect(p.candReplyUpdateMany).not.toHaveBeenCalled();
    expect(p.noterRebondSurAbonne).not.toHaveBeenCalled();
    expect(p.creerOuDedup).not.toHaveBeenCalled();
    // Le battement, lui, est toujours posé.
    expect(p.noterAppelWebhook).toHaveBeenCalledTimes(4);
  });

  it("signature invalide : 200 muet, alerte de sécurité, et AUCUNE écriture", async () => {
    p.signature.mockReturnValue({ ok: false, reason: "mismatch" });
    const res = await POST(requete(rebond("candidat@exemple.fr")));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: "invalid_signature" });
    expect(p.notify).toHaveBeenCalledTimes(1);
    expect(p.noterAppelWebhook).not.toHaveBeenCalled();
    expect(p.candReplyFindFirst).not.toHaveBeenCalled();
    expect(p.candReplyUpdateMany).not.toHaveBeenCalled();
    expect(p.emailLogUpdate).not.toHaveBeenCalled();
    expect(p.submissionReplyUpdateMany).not.toHaveBeenCalled();
  });

  it("clé absente : 200 muet, rien n'est lu ni écrit", async () => {
    delete process.env["ZEPTOMAIL_WEBHOOK_KEY"];
    const res = await POST(requete(rebond("candidat@exemple.fr")));
    expect(await res.json()).toEqual({ ok: true, skipped: "not_configured" });
    expect(p.signature).not.toHaveBeenCalled();
    expect(p.candReplyFindFirst).not.toHaveBeenCalled();
  });

  it("rebond sans destinataire : aucune recherche de candidat", async () => {
    const corps = JSON.stringify({
      event_name: "hardbounce",
      event_message: { email_info: {}, event_data: { details: { time: INSTANT } } },
    });
    const res = await POST(requete(corps));
    expect(res.status).toBe(200);
    expect(p.candReplyFindFirst).not.toHaveBeenCalled();
    expect(p.noterRebondSurAbonne).not.toHaveBeenCalled();
  });
});
