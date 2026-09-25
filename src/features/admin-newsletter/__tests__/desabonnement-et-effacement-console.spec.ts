// @vitest-environment node
//
// Lot L3 (2026-09-24) — le bouton « Désabonner » et le bouton « Effacer (RGPD) »
// de la console passent par les chemins PUBLICS.
//
// 🔴 Constat de l'audit du 24/09, en production : un désabonnement fait depuis
// la console, et ZÉRO `optout` au registre de preuve, ZÉRO `newsletter_optout`
// dans l'outbox du CRM. Le bouton ne faisait que le statut et le journal.

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  session: { user: { id: "admin-1", role: "admin" } } as unknown,
  subFindUnique: vi.fn(),
  subUpdate: vi.fn(),
  activityCreate: vi.fn(),
  syncOptOut: vi.fn(),
  recordConsent: vi.fn(),
  notify: vi.fn(),
  eraseNewsletter: vi.fn(),
  eraseTraces: vi.fn(),
  propagate: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: async () => d.session }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => d.revalidatePath(...a) }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletterSubscriber: {
      findUnique: (...a: unknown[]) => d.subFindUnique(...a),
      update: (...a: unknown[]) => d.subUpdate(...a),
    },
    activityLog: { create: (...a: unknown[]) => d.activityCreate(...a) },
  },
}));
vi.mock("@/server/crm-sync", () => ({
  syncNewsletterOptOutToCrm: (...a: unknown[]) => d.syncOptOut(...a),
}));
vi.mock("@/lib/consents", () => ({
  CONSENT_FORM_REFS: { newsletter: "newsletter-double-optin" },
  recordConsentEvent: (...a: unknown[]) => d.recordConsent(...a),
}));
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => d.notify(...a) }));
vi.mock("@/lib/rgpd-erase", () => ({
  eraseNewsletterForEmail: (...a: unknown[]) => d.eraseNewsletter(...a),
  eraseEmailTracesForEmail: (...a: unknown[]) => d.eraseTraces(...a),
}));
vi.mock("@/server/crm-sync/gdpr", () => ({
  propagateGdprToCrm: (...a: unknown[]) => d.propagate(...a),
}));
// Tirés par le module d'actions, sans rapport avec ces deux gestes.
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));

import { forceUnsubscribeAction, eraseSubscriberAction } from "../actions";

const ABONNE = {
  id: "00000000-0000-4000-8000-0000000000a1",
  email: "lecteur@example.invalid",
  locale: "fr" as const,
  status: "confirmed",
  consentFormRef: "newsletter-guide-ia",
  consentVersion: "lettre-guide-v1",
};

function form(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  d.session = { user: { id: "admin-1", role: "admin" } };
  d.subFindUnique.mockResolvedValue(ABONNE);
  d.subUpdate.mockResolvedValue({});
  d.activityCreate.mockResolvedValue({});
  d.syncOptOut.mockResolvedValue(undefined);
  d.recordConsent.mockResolvedValue(true);
  d.notify.mockResolvedValue({ ok: true });
  d.eraseNewsletter.mockResolvedValue({ deleted: 1, guideDeleted: 1 });
  d.eraseTraces.mockResolvedValue({ logsPseudonymises: 2, outboxSupprimes: 0 });
  d.propagate.mockResolvedValue({ status: "deferred", detail: "drapeau" });
});

describe("désabonnement forcé depuis la console", () => {
  it("🔴 écrit l'optout au registre ET met newsletter_optout dans l'outbox du CRM", async () => {
    const r = await forceUnsubscribeAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    expect(r).toEqual({ ok: true });

    // Statut
    expect(d.subUpdate).toHaveBeenCalledWith({
      where: { id: ABONNE.id },
      data: expect.objectContaining({ status: "unsubscribed", confirmToken: null }),
    });
    // Outbox CRM (newsletter_optout), avec le motif console
    expect(d.syncOptOut).toHaveBeenCalledWith({
      subjectRef: `site:newsletter_subscriber:${ABONNE.id}`,
      person: { email: ABONNE.email },
      payload: { reason: "admin-console" },
    });
    // Registre de preuve : le retrait, sous la référence de l'accord retiré,
    // sans l'IP de l'administrateur.
    expect(d.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        email: ABONNE.email,
        formRef: ABONNE.consentFormRef,
        consentVersion: ABONNE.consentVersion,
        action: "optout",
      }),
    );
    const preuve = d.recordConsent.mock.calls[0]![0] as Record<string, unknown>;
    expect(preuve["ip"]).toBeUndefined();
    // Journal de l'administrateur
    expect(d.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "newsletter.force_unsubscribe",
        targetId: ABONNE.id,
      }),
    });
  });

  it("une inscription antérieure (sans référence) retombe sur la référence historique", async () => {
    d.subFindUnique.mockResolvedValue({ ...ABONNE, consentFormRef: null, consentVersion: null });
    await forceUnsubscribeAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    expect(d.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        formRef: "newsletter-double-optin",
        consentVersion: "newsletter-v1-2026-08-13",
      }),
    );
  });

  it("déjà désabonné : rien n'est réécrit, rien ne repart au CRM", async () => {
    d.subFindUnique.mockResolvedValue({ ...ABONNE, status: "unsubscribed" });
    const r = await forceUnsubscribeAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    expect(r).toEqual({ ok: true });
    expect(d.subUpdate).not.toHaveBeenCalled();
    expect(d.syncOptOut).not.toHaveBeenCalled();
    expect(d.recordConsent).not.toHaveBeenCalled();
  });

  it("un rôle sans droit d'écriture est refusé, et rien n'est écrit", async () => {
    d.session = { user: { id: "lecteur-1", role: "editor" } };
    const r = await forceUnsubscribeAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    expect(r.ok).toBe(false);
    expect(d.subUpdate).not.toHaveBeenCalled();
    expect(d.syncOptOut).not.toHaveBeenCalled();
  });

  it("une fiche absente se dit, elle ne fait pas tomber l'écran", async () => {
    d.subFindUnique.mockResolvedValue(null);
    const r = await forceUnsubscribeAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/introuvable/i) });
  });
});

describe("effacement RGPD depuis la console", () => {
  beforeEach(() => {
    d.session = { user: { id: "super-1", role: "super_admin" } };
  });

  it("passe par les fonctions de l'effacement public et par le CRM, sans l'adresse au journal", async () => {
    const r = await eraseSubscriberAction(
      { ok: false, error: "" },
      form({ id: ABONNE.id, reason: "demande écrite de la personne" }),
    );
    expect(r).toEqual({ ok: true });
    expect(d.eraseNewsletter).toHaveBeenCalledWith(ABONNE.email);
    expect(d.eraseTraces).toHaveBeenCalledWith(ABONNE.email);
    expect(d.propagate).toHaveBeenCalledWith(
      expect.objectContaining({ action: "erase", email: ABONNE.email }),
    );

    const journal = d.activityCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(journal.data["action"]).toBe("newsletter.erased");
    const serialise = JSON.stringify(journal);
    expect(serialise).not.toContain(ABONNE.email);
    expect(serialise).not.toContain("@");
    expect((journal.data["changes"] as { emailHash: string }).emailHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("🔴 une fiche absente rend « introuvable » au lieu de lever (l'écran tombait)", async () => {
    d.subFindUnique.mockResolvedValue(null);
    const r = await eraseSubscriberAction(
      { ok: false, error: "" },
      form({ id: ABONNE.id, reason: "doublon" }),
    );
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/introuvable/i) });
    expect(d.eraseNewsletter).not.toHaveBeenCalled();
    expect(d.propagate).not.toHaveBeenCalled();
  });

  it("réservé super_admin", async () => {
    d.session = { user: { id: "admin-1", role: "admin" } };
    const r = await eraseSubscriberAction(
      { ok: false, error: "" },
      form({ id: ABONNE.id, reason: "motif" }),
    );
    expect(r.ok).toBe(false);
    expect(d.eraseNewsletter).not.toHaveBeenCalled();
  });
});
