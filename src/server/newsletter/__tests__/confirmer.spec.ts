// @vitest-environment node
//
// Confirmation de la lettre (lot L2) : toutes les branches, et ce qu'elles
// écrivent. Aucun test ne couvrait `confirmNewsletterAction` jusqu'ici.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();
const syncNewsletterOptInToCrm = vi.fn();
const recordConsentEvent = vi.fn();
const notify = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletterSubscriber: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));
vi.mock("@/server/crm-sync", () => ({
  syncNewsletterOptInToCrm: (...a: unknown[]) => syncNewsletterOptInToCrm(...a),
}));
vi.mock("@/lib/consents", () => ({
  CONSENT_FORM_REFS: { newsletter: "newsletter-double-optin" },
  recordConsentEvent: (...a: unknown[]) => recordConsentEvent(...a),
}));
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { confirmerLettre } from "../confirmer";

const JETON = "c".repeat(64);
const MAINTENANT = new Date("2026-09-24T10:00:00Z");
const ABONNE = {
  id: "abonne-1",
  email: "jeanne@example.invalid",
  locale: "fr",
  status: "pending",
  source: "guide-ia",
  consentFormRef: "newsletter-guide-ia",
  consentVersion: "lettre-guide-v2-2026-09-24",
};

beforeEach(() => {
  findUnique.mockReset().mockResolvedValue(ABONNE);
  update.mockReset().mockResolvedValue({});
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  syncNewsletterOptInToCrm.mockReset().mockResolvedValue(undefined);
  recordConsentEvent.mockReset().mockResolvedValue(true);
  notify.mockReset().mockResolvedValue({ ok: true });
});

describe("confirmerLettre", () => {
  it("jeton absent ou trop court : missing_token, sans lire la base", async () => {
    expect(await confirmerLettre(null)).toEqual({ ok: false, error: "missing_token" });
    expect(await confirmerLettre("court")).toEqual({ ok: false, error: "missing_token" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("jeton inconnu : invalid_token", async () => {
    findUnique.mockResolvedValue(null);
    expect(await confirmerLettre(JETON)).toEqual({ ok: false, error: "invalid_token" });
  });

  it("🔴 RÉINSCRIPTION : un désabonné qui présente SON jeton est réinscrit, au POST seulement", async () => {
    findUnique.mockResolvedValue({
      ...ABONNE,
      status: "unsubscribed",
      consentFormRef: "newsletter-reinscription-email",
      consentVersion: "lettre-reinscription-email-v1-2026-09-24",
    });
    const r = await confirmerLettre(JETON, { maintenant: MAINTENANT });
    expect(r).toEqual({ ok: true, alreadyConfirmed: false, locale: "fr" });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "abonne-1", confirmToken: JETON, status: { in: ["pending", "unsubscribed"] } },
      data: {
        status: "confirmed",
        confirmedAt: MAINTENANT,
        confirmToken: null,
        // C'est ICI, sur son geste, que la date de désabonnement s'efface.
        unsubscribedAt: null,
      },
    });
    expect(recordConsentEvent.mock.calls[0]?.[0]).toMatchObject({
      action: "optin",
      formRef: "newsletter-reinscription-email",
      consentVersion: "lettre-reinscription-email-v1-2026-09-24",
    });
  });

  it("rebond dur : aucune réinscription possible, rien n'est écrit", async () => {
    findUnique.mockResolvedValue({ ...ABONNE, status: "bounced" });
    expect(await confirmerLettre(JETON)).toEqual({ ok: false, error: "unsubscribed" });
    expect(updateMany).not.toHaveBeenCalled();
    expect(recordConsentEvent).not.toHaveBeenCalled();
  });

  it("🔴 déjà confirmé : le jeton est RETIRÉ (il restait valable indéfiniment)", async () => {
    findUnique.mockResolvedValue({ ...ABONNE, status: "confirmed" });
    expect(await confirmerLettre(JETON)).toEqual({
      ok: true,
      alreadyConfirmed: true,
      locale: "fr",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "abonne-1" },
      data: { confirmToken: null },
      select: { id: true },
    });
    expect(recordConsentEvent).not.toHaveBeenCalled();
  });

  it("🔴 succès : preuve au registre avec le TEXTE accepté, l'IP et l'agent du geste", async () => {
    const r = await confirmerLettre(JETON, {
      ip: "192.0.2.1",
      userAgent: "Navigateur",
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ ok: true, alreadyConfirmed: false, locale: "fr" });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "abonne-1", confirmToken: JETON, status: { in: ["pending", "unsubscribed"] } },
      data: {
        status: "confirmed",
        confirmedAt: MAINTENANT,
        confirmToken: null,
        unsubscribedAt: null,
      },
    });
    expect(recordConsentEvent).toHaveBeenCalledWith({
      email: ABONNE.email,
      formRef: "newsletter-guide-ia",
      consentVersion: "lettre-guide-v2-2026-09-24",
      action: "optin",
      occurredAt: MAINTENANT,
      ip: "192.0.2.1",
      userAgent: "Navigateur",
    });
    expect(syncNewsletterOptInToCrm).toHaveBeenCalledTimes(1);
  });

  it("inscription antérieure au lot L2 : repli sur la référence et la version historiques", async () => {
    findUnique.mockResolvedValue({ ...ABONNE, consentFormRef: null, consentVersion: null });
    await confirmerLettre(JETON, { maintenant: MAINTENANT });
    expect(recordConsentEvent.mock.calls[0]?.[0]).toMatchObject({
      formRef: "newsletter-double-optin",
      consentVersion: "newsletter-v1-2026-08-13",
    });
  });

  it("double clic : la seconde requête ne produit ni seconde preuve ni second envoi au CRM", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    expect(await confirmerLettre(JETON)).toEqual({
      ok: true,
      alreadyConfirmed: true,
      locale: "fr",
    });
    expect(recordConsentEvent).not.toHaveBeenCalled();
    expect(syncNewsletterOptInToCrm).not.toHaveBeenCalled();
  });

  it("Telegram : adresse masquée", async () => {
    await confirmerLettre(JETON);
    expect(JSON.stringify(notify.mock.calls[0]?.[0])).not.toContain(ABONNE.email);
  });
});
