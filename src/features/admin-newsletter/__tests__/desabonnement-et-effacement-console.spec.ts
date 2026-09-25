// @vitest-environment node
//
// Lot L3 (2026-09-24) — le bouton « Désabonner » et le bouton « Effacer de la
// lettre et du guide (RGPD) » de la console passent par les chemins PUBLICS.
//
// 🔴 Avant ce lot, le bouton de la console ne changeait que le statut : ni le
// registre de preuve ni le CRM n'apprenaient la désinscription.

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  session: { user: { id: "admin-1", role: "admin" } } as unknown,
  subFindUnique: vi.fn(),
  subUpdateMany: vi.fn(),
  transaction: vi.fn(),
  activityCreate: vi.fn(),
  syncOptOut: vi.fn(),
  recordConsent: vi.fn(),
  notify: vi.fn(),
  eraseNewsletter: vi.fn(),
  eraseTraces: vi.fn(),
  propagate: vi.fn(),
  revalidatePath: vi.fn(),
  envoyerGuide: vi.fn(),
  renvoyerGuide: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: async () => d.session }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => d.revalidatePath(...a) }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletterSubscriber: {
      findUnique: (...a: unknown[]) => d.subFindUnique(...a),
      updateMany: (...a: unknown[]) => d.subUpdateMany(...a),
    },
    activityLog: { create: (...a: unknown[]) => d.activityCreate(...a) },
    // La transaction reçoit un client de transaction : ici, le même faux
    // client, marqué pour que le test voie qu'il a bien été TRANSMIS à l'outbox.
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => d.transaction(fn),
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
vi.mock("@/server/guide-ia/envoi-console", () => ({
  envoyerGuideAAbonne: (...a: unknown[]) => d.envoyerGuide(...a),
  renvoyerGuide: (...a: unknown[]) => d.renvoyerGuide(...a),
  LIBELLE_ISSUE_CONSOLE: { "en-file": "Guide mis en file." },
}));

import {
  forceUnsubscribeAction,
  eraseSubscriberAction,
  envoyerGuideAAbonneAction,
  renvoyerGuideAction,
} from "../actions";

/** Le client de transaction transmis par `$transaction` — reconnaissable. */
const TX = {
  marque: "client-de-transaction",
  newsletterSubscriber: { updateMany: (...a: unknown[]) => d.subUpdateMany(...a) },
};

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
  d.subUpdateMany.mockResolvedValue({ count: 1 });
  d.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(TX));
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

    // Statut — CONDITIONNEL : seul l'appel qui fait la transition émet.
    expect(d.subUpdateMany).toHaveBeenCalledWith({
      where: { id: ABONNE.id, status: { not: "unsubscribed" } },
      data: expect.objectContaining({ status: "unsubscribed", confirmToken: null }),
    });
    // Outbox CRM (newsletter_optout), avec le motif console, DANS la
    // transaction du statut (le client de transaction lui est transmis).
    expect(d.syncOptOut).toHaveBeenCalledWith({
      subjectRef: `site:newsletter_subscriber:${ABONNE.id}`,
      person: { email: ABONNE.email },
      payload: { reason: "admin-console" },
      tx: TX,
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
    expect(d.subUpdateMany).not.toHaveBeenCalled();
    expect(d.syncOptOut).not.toHaveBeenCalled();
    expect(d.recordConsent).not.toHaveBeenCalled();
  });

  it("🔴 course (deux clics, ou le lien public entre-temps) : la transition perdue n'émet RIEN", async () => {
    // La lecture voit « inscrit », mais l'écriture conditionnelle ne touche
    // aucune ligne : quelqu'un d'autre vient de désabonner.
    d.subUpdateMany.mockResolvedValue({ count: 0 });
    const r = await forceUnsubscribeAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    expect(r).toEqual({ ok: true });
    // Discriminant positif : l'écriture conditionnelle a bien été TENTÉE…
    expect(d.subUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ABONNE.id, status: { not: "unsubscribed" } } }),
    );
    // … et rien de ce qui suit une transition n'a eu lieu.
    expect(d.syncOptOut).not.toHaveBeenCalled();
    expect(d.recordConsent).not.toHaveBeenCalled();
    expect(d.activityCreate).not.toHaveBeenCalled();
  });

  it("transaction en échec : repli hors transaction, la personne est quand même désabonnée", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    d.transaction.mockRejectedValue(new Error("transaction avortée"));
    const r = await forceUnsubscribeAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    expect(r).toEqual({ ok: true });
    expect(d.subUpdateMany).toHaveBeenCalledTimes(1);
    // L'outbox est écrite HORS transaction (aucun `tx` transmis).
    expect(d.syncOptOut).toHaveBeenCalledWith(
      expect.not.objectContaining({ tx: expect.anything() }),
    );
    expect(d.recordConsent).toHaveBeenCalledWith(expect.objectContaining({ action: "optout" }));
    expect(erreur).toHaveBeenCalledWith(
      expect.stringContaining("repli hors transaction"),
      "transaction avortée",
    );
    erreur.mockRestore();
  });

  it("🔴 preuve `optout` NON écrite : alerte (journal + Telegram, adresse MASQUÉE)", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    d.recordConsent.mockResolvedValue(false);
    const r = await forceUnsubscribeAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    expect(r).toEqual({ ok: true });
    const incident = d.notify.mock.calls
      .map((c) => c[0] as { category: string; payload: Record<string, string> })
      .find((n) => n.category === "INCIDENT_DETECTED");
    expect(incident).toBeDefined();
    expect(incident!.payload["title"]).toMatch(/sans preuve « optout »/);
    expect(JSON.stringify(incident)).not.toContain(ABONNE.email);
    expect(erreur).toHaveBeenCalledWith(expect.stringContaining("NON écrite au registre"));
    erreur.mockRestore();
  });

  it("preuve écrite : aucune alerte d'incident", async () => {
    await forceUnsubscribeAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    const categories = d.notify.mock.calls.map((c) => (c[0] as { category: string }).category);
    expect(categories).toEqual(["NEWSLETTER_UNSUBSCRIBED"]);
  });

  it("un rôle sans droit d'écriture est refusé, et rien n'est écrit", async () => {
    d.session = { user: { id: "lecteur-1", role: "editor" } };
    const r = await forceUnsubscribeAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    expect(r).toEqual({ ok: false, error: "Permission insuffisante." });
    expect(d.subUpdateMany).not.toHaveBeenCalled();
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

describe("envoyer / renvoyer le guide : droits", () => {
  const DEMANDE = "00000000-0000-4000-8000-0000000000d1";

  it("🔴 « Envoyer le guide » : un rôle editor est refusé, rien ne part", async () => {
    d.session = { user: { id: "lecteur-1", role: "editor" } };
    const r = await envoyerGuideAAbonneAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    expect(r).toEqual({ ok: false, error: "Permission insuffisante." });
    expect(d.envoyerGuide).not.toHaveBeenCalled();
  });

  it("🔴 « Renvoyer le guide » : un rôle editor est refusé, rien ne part", async () => {
    d.session = { user: { id: "lecteur-1", role: "editor" } };
    const r = await renvoyerGuideAction({ ok: false, error: "" }, form({ id: DEMANDE }));
    expect(r).toEqual({ ok: false, error: "Permission insuffisante." });
    expect(d.renvoyerGuide).not.toHaveBeenCalled();
  });

  it("le témoin : un admin passe, et le geste est bien appelé", async () => {
    d.envoyerGuide.mockResolvedValue({ resultat: "en-file", demandeId: DEMANDE, creee: true });
    d.renvoyerGuide.mockResolvedValue({ resultat: "en-file", demandeId: DEMANDE, creee: false });
    const a = await envoyerGuideAAbonneAction({ ok: false, error: "" }, form({ id: ABONNE.id }));
    const b = await renvoyerGuideAction({ ok: false, error: "" }, form({ id: DEMANDE }));
    expect(a).toMatchObject({ ok: true, resultat: "en-file" });
    expect(b).toMatchObject({ ok: true, resultat: "en-file" });
    expect(d.envoyerGuide).toHaveBeenCalledWith(ABONNE.id, expect.anything());
    expect(d.renvoyerGuide).toHaveBeenCalledWith(DEMANDE, expect.anything());
  });
});
