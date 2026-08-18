import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LOT L5 — observabilité, réconciliation, webhook entrant.
 *
 * Trois assertions portent le lot, et elles sont écrites pour ROUGIR si on
 * casse ce qu'elles protègent :
 *   1. ANTI-BOUCLE — un événement reçu du CRM n'émet RIEN vers le CRM ;
 *   2. IDEMPOTENCE — le même `event_id` deux fois n'applique l'effet qu'une ;
 *   3. ANTI-BRUIT — au plus une alerte par heure et par type d'anomalie.
 *
 * Le reste vérifie l'INERTIE : drapeau à OFF, le batch sort avant la moindre
 * requête, et la console ne peut rien déclencher.
 */

// ── Doubles ─────────────────────────────────────────────────────────────────

// `vi.hoisted` et non de simples `const` : Vitest REMONTE les `vi.mock`
// au-dessus du corps du module. Des doubles déclarés en `const` seraient donc
// lus avant leur initialisation (« Cannot access before initialization »).
const {
  outbox,
  inbound,
  subscriber,
  submission,
  jobApplication,
  calendlyEvent,
  customerReview,
  queueAdd,
  enqueueSpy,
  siteSettingUpsert,
} = vi.hoisted(() => ({
  outbox: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  inbound: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  subscriber: { findMany: vi.fn(), update: vi.fn() },
  submission: { findMany: vi.fn() },
  jobApplication: { findMany: vi.fn() },
  calendlyEvent: { findMany: vi.fn() },
  customerReview: { findMany: vi.fn() },
  queueAdd: vi.fn(),
  enqueueSpy: vi.fn(),
  siteSettingUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmSyncOutbox: outbox,
    crmInboundEvent: inbound,
    newsletterSubscriber: subscriber,
    submission,
    jobApplication,
    calendlyEvent,
    customerReview,
    siteSetting: {
      upsert: (...args: unknown[]) => siteSettingUpsert(...args),
    },
  },
}));

vi.mock("@/server/queue/queues", () => ({
  crmSyncQueue: { add: (...args: unknown[]) => queueAdd(...args) },
}));

// Espion sur la porte de SORTIE. C'est lui qui rend l'anti-boucle démontrable :
// si un jour quelqu'un « propage » un opt-out reçu du CRM vers le CRM, il passe
// forcément par ici.
vi.mock("@/server/crm-sync/enqueue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../enqueue")>();
  return {
    ...actual,
    enqueueCrmSyncEvent: (...args: unknown[]) => {
      enqueueSpy(...args);
      return Promise.resolve(null);
    },
  };
});

// Redis en mémoire avec la sémantique EXACTE de `SET NX EX` : "OK" si la clé
// est posée, `null` si elle existait déjà. C'est ce `null` qui fait la dédup —
// un faux double qui répondrait toujours "OK" rendrait le test vert pour rien.
const { redisStore } = vi.hoisted(() => ({ redisStore: new Map<string, string>() }));
vi.mock("@/lib/redis", () => ({
  redis: {
    set: (key: string, value: string) => {
      if (redisStore.has(key)) return Promise.resolve(null);
      redisStore.set(key, value);
      return Promise.resolve("OK");
    },
    incr: () => Promise.resolve(1),
    expire: () => Promise.resolve(1),
  },
}));

// Le canal Sentry n'a rien à dire ici et tirerait tout le SDK.
vi.mock("@/server/notifications/channels/sentry", () => ({
  sendSentryBreadcrumb: () => Promise.resolve(true),
}));

import { alertCrmSync, crmSyncAlertDedupKey, CRM_SYNC_BACKLOG_THRESHOLD } from "../alerts";
import {
  findSubscriberIdByHash,
  parseInboundPayload,
  processInboundEvent,
  sha256Email,
  signInboundBody,
  verifyInboundRequest,
} from "../inbound";
import { collectReconciliation, runCrmSyncReconciliation } from "../reconcile";
import { sweepCrmSyncOutbox } from "@/server/queue/workers/crm-sync-worker";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  // Marqueur d'activation : par defaut, il vient d'etre pose (premier passage).
  siteSettingUpsert.mockImplementation((args: { create: { value: string } }) =>
    Promise.resolve({ value: args.create.value }),
  );
  vi.useRealTimers();
  redisStore.clear();
  process.env.SITE_SYNC_HMAC_SECRET = "secret-de-test-l5";
  process.env.TELEGRAM_BOT_TOKEN = "jeton-de-test";
  process.env.TELEGRAM_CHAT_ID = "salon-de-test";
  outbox.count.mockResolvedValue(0);
  outbox.findMany.mockResolvedValue([]);
  outbox.findFirst.mockResolvedValue(null);
  outbox.update.mockResolvedValue({});
  inbound.findUnique.mockResolvedValue(null);
  inbound.create.mockResolvedValue({ id: "inb-1" });
  subscriber.findMany.mockResolvedValue([]);
  subscriber.update.mockResolvedValue({});
  submission.findMany.mockResolvedValue([]);
  jobApplication.findMany.mockResolvedValue([]);
  calendlyEvent.findMany.mockResolvedValue([]);
  customerReview.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  process.env = { ...OLD_ENV };
});

function enable(): void {
  process.env.CRM_SYNC_ENABLED = "true";
  process.env.CRM_SYNC_URL = "https://api.crm.invalid/api/internal/site-sync";
}

const EVENEMENT = {
  event_id: "crm-evt-0001",
  event_type: "consent_optout" as const,
  email_hash: sha256Email("ZZ.Test@Example.Invalid"),
  scope: "business" as const,
  origin: "crm" as const,
  occurred_at: "2026-08-14T09:00:00.000Z",
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. 🔴 ANTI-BOUCLE — la preuve centrale du sens entrant
// ─────────────────────────────────────────────────────────────────────────────

describe("anti-boucle du webhook entrant", () => {
  it("applique l'opposition localement et n'émet RIEN vers le CRM", async () => {
    enable();
    subscriber.findMany.mockResolvedValue([
      { id: "sub-1", email: "zz.test@example.invalid" },
      { id: "sub-2", email: "autre@example.invalid" },
    ]);

    const result = await processInboundEvent(EVENEMENT);

    // L'effet local a bien eu lieu : sans lui, « rien n'est émis » serait
    // trivialement vrai et le test ne prouverait rien.
    expect(result.outcome).toBe("applied");
    expect(subscriber.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: expect.objectContaining({ status: "unsubscribed" }),
    });

    // …et RIEN n'est reparti vers le CRM, à aucun des trois niveaux.
    expect(enqueueSpy).not.toHaveBeenCalled();
    expect(outbox.create).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("consigne l'événement même sans correspondance (jamais de perte silencieuse)", async () => {
    enable();
    subscriber.findMany.mockResolvedValue([{ id: "sub-2", email: "autre@example.invalid" }]);

    const result = await processInboundEvent(EVENEMENT);

    expect(result.outcome).toBe("no_match");
    expect(subscriber.update).not.toHaveBeenCalled();
    expect(inbound.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "no_match", eventId: "crm-evt-0001" }),
      }),
    );
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it("un opt-in venu du CRM ne ressuscite PAS une désinscription faite sur le site", async () => {
    enable();
    subscriber.findMany.mockResolvedValue([{ id: "sub-1", email: "zz.test@example.invalid" }]);

    const result = await processInboundEvent({ ...EVENEMENT, event_type: "consent_optin" });

    expect(result.outcome).toBe("ignored");
    expect(subscriber.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 🔴 IDEMPOTENCE par `event_id`
// ─────────────────────────────────────────────────────────────────────────────

describe("idempotence du webhook entrant", () => {
  it("un event_id déjà traité n'applique aucun effet et reste un succès", async () => {
    enable();
    inbound.findUnique.mockResolvedValue({ id: "inb-deja-la" });
    subscriber.findMany.mockResolvedValue([{ id: "sub-1", email: "zz.test@example.invalid" }]);

    const result = await processInboundEvent(EVENEMENT);

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("duplicate");
    expect(subscriber.update).not.toHaveBeenCalled();
    expect(inbound.create).not.toHaveBeenCalled();
  });

  it("deux livraisons successives n'appliquent l'effet qu'UNE fois", async () => {
    enable();
    subscriber.findMany.mockResolvedValue([{ id: "sub-1", email: "zz.test@example.invalid" }]);

    // 1re livraison : la base ne connaît pas encore l'événement.
    const premier = await processInboundEvent(EVENEMENT);
    // 2e livraison : la ligne existe désormais.
    inbound.findUnique.mockResolvedValue({ id: "inb-1" });
    const second = await processInboundEvent(EVENEMENT);

    expect(premier.outcome).toBe("applied");
    expect(second.outcome).toBe("duplicate");
    expect(subscriber.update).toHaveBeenCalledTimes(1);
  });

  it("une course sur la contrainte UNIQUE (P2002) reste un succès", async () => {
    enable();
    subscriber.findMany.mockResolvedValue([{ id: "sub-1", email: "zz.test@example.invalid" }]);
    inbound.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    const result = await processInboundEvent(EVENEMENT);

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("duplicate");
  });

  it("une panne DB au journal n'est PAS un doublon : l'erreur remonte, l'émetteur retentera", async () => {
    // 🔴 Revue adversariale : traiter TOUTE erreur comme un doublon renvoyait
    // 200 à l'émetteur — l'événement n'était jamais consigné, jamais retenté.
    enable();
    subscriber.findMany.mockResolvedValue([{ id: "sub-1", email: "zz.test@example.invalid" }]);
    inbound.create.mockRejectedValue(new Error("connection reset"));

    await expect(processInboundEvent(EVENEMENT)).rejects.toThrow("connection reset");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 🔴 ANTI-BRUIT — une alerte par heure et par type
// ─────────────────────────────────────────────────────────────────────────────

describe("anti-bruit des alertes de synchro", () => {
  it("la clé de dédup est stable dans l'heure et change à l'heure suivante", () => {
    const a = crmSyncAlertDedupKey("backlog", new Date("2026-08-14T09:00:00.000Z"));
    const b = crmSyncAlertDedupKey("backlog", new Date("2026-08-14T09:59:59.000Z"));
    const c = crmSyncAlertDedupKey("backlog", new Date("2026-08-14T10:00:00.000Z"));

    expect(a).toBe("crm-sync-alert-backlog-2026081409");
    expect(b).toBe(a);
    expect(c).toBe("crm-sync-alert-backlog-2026081410");
  });

  it("deux types différents dans la même heure ne se dédupliquent PAS l'un l'autre", () => {
    const now = new Date("2026-08-14T09:30:00.000Z");
    expect(crmSyncAlertDedupKey("backlog", now)).not.toBe(crmSyncAlertDedupKey("gave_up", now));
  });

  it("trois alertes du même type dans l'heure ne produisent QU'UN envoi", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T09:05:00.000Z"));

    await alertCrmSync({ kind: "backlog", count: 51 });
    vi.setSystemTime(new Date("2026-08-14T09:25:00.000Z"));
    await alertCrmSync({ kind: "backlog", count: 62 });
    vi.setSystemTime(new Date("2026-08-14T09:55:00.000Z"));
    await alertCrmSync({ kind: "backlog", count: 80 });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // L'heure suivante rouvre le droit d'alerter : l'anti-bruit ne doit pas
    // devenir un silence permanent sur une panne qui dure.
    vi.setSystemTime(new Date("2026-08-14T10:01:00.000Z"));
    await alertCrmSync({ kind: "backlog", count: 90 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un autre type d'anomalie passe malgré le backlog déjà signalé", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T09:05:00.000Z"));

    await alertCrmSync({ kind: "backlog", count: 51 });
    await alertCrmSync({ kind: "gave_up", subjectRef: "site:submission:abc" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Signature et contrat du webhook
// ─────────────────────────────────────────────────────────────────────────────

describe("signature du webhook entrant", () => {
  const corps = JSON.stringify(EVENEMENT);

  it("accepte une signature valide dans la fenêtre", () => {
    const ts = "1786000000";
    const sig = signInboundBody("secret-de-test-l5", ts, corps);
    const failure = verifyInboundRequest({
      rawBody: corps,
      timestamp: ts,
      signature: sig,
      now: new Date(1786000060 * 1000),
    });
    expect(failure).toBeNull();
  });

  it("refuse une signature calculée sur un AUTRE corps", () => {
    const ts = "1786000000";
    const sig = signInboundBody("secret-de-test-l5", ts, corps);
    const failure = verifyInboundRequest({
      rawBody: `${corps} `,
      timestamp: ts,
      signature: sig,
      now: new Date(1786000000 * 1000),
    });
    expect(failure).toBe("bad_signature");
  });

  it("refuse un horodatage hors fenêtre (anti-rejeu 300 s)", () => {
    const ts = "1786000000";
    const sig = signInboundBody("secret-de-test-l5", ts, corps);
    const failure = verifyInboundRequest({
      rawBody: corps,
      timestamp: ts,
      signature: sig,
      now: new Date((1786000000 + 301) * 1000),
    });
    expect(failure).toBe("stale");
  });

  it("refuse tout sans secret configuré (inertie)", () => {
    delete process.env.SITE_SYNC_HMAC_SECRET;
    expect(
      verifyInboundRequest({ rawBody: corps, timestamp: "1", signature: "a".repeat(64) }),
    ).toBe("missing_secret");
  });
});

describe("contrat du corps entrant", () => {
  it("accepte un corps conforme", () => {
    expect(parseInboundPayload(EVENEMENT)).not.toBeNull();
  });

  it("refuse un type d'événement inconnu", () => {
    expect(parseInboundPayload({ ...EVENEMENT, event_type: "consent_maybe" })).toBeNull();
  });

  it("refuse une empreinte qui n'est pas un sha256 hexadécimal", () => {
    expect(parseInboundPayload({ ...EVENEMENT, email_hash: "pas-un-hash" })).toBeNull();
  });

  it("refuse une origine autre que « crm » (l'anti-boucle a besoin de l'origine)", () => {
    expect(parseInboundPayload({ ...EVENEMENT, origin: "site" })).toBeNull();
  });

  it("refuse un univers hors périmètre", () => {
    expect(parseInboundPayload({ ...EVENEMENT, scope: "partout" })).toBeNull();
  });
});

describe("correspondance d'adresse (sha256 NON salé du CRM)", () => {
  it("ne balaie que les abonnés confirmés", async () => {
    subscriber.findMany.mockResolvedValue([]);
    await findSubscriberIdByHash(sha256Email("qui@example.invalid"));
    expect(subscriber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "confirmed" } }),
    );
  });

  it("retrouve un abonné quelle que soit la casse de son adresse", async () => {
    subscriber.findMany.mockResolvedValue([{ id: "sub-9", email: "Jean.Test@Example.Invalid" }]);
    const id = await findSubscriberIdByHash(sha256Email("jean.test@example.invalid"));
    expect(id).toBe("sub-9");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Réconciliation — inertie, bornes, écart
// ─────────────────────────────────────────────────────────────────────────────

describe("batch de réconciliation", () => {
  it("drapeau à OFF : sortie immédiate, AUCUNE requête", async () => {
    delete process.env.CRM_SYNC_ENABLED;

    const rapport = await runCrmSyncReconciliation();

    expect(rapport.enabled).toBe(false);
    expect(outbox.findFirst).not.toHaveBeenCalled();
    expect(submission.findMany).not.toHaveBeenCalled();
  });

  it("outbox VIDE : le filet compare quand même depuis le marqueur d'activation", async () => {
    // 🔴 Revue adversariale : borner sur la 1re ligne d'outbox rendait le
    // filet AVEUGLE au moment de l'allumage — si la toute premiere capture
    // tombe dans la fenetre post-commit, il n'existe AUCUNE ligne d'outbox et
    // l'ancien code concluait « rien a comparer ». Le marqueur d'activation
    // fait foi : une submission posterieure au marqueur SANS ligne d'outbox
    // est un ecart, des le premier passage.
    enable();
    submission.findMany.mockResolvedValue([{ id: "s-perdue" }]);
    outbox.findMany.mockResolvedValue([]);
    jobApplication.findMany.mockResolvedValue([]);
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const rapport = await runCrmSyncReconciliation();

    expect(siteSettingUpsert).toHaveBeenCalledTimes(1);
    const famille = rapport.families.find((f) => f.family === "submission");
    expect(famille?.missing).toBe(1);
    expect(famille?.missingIds).toEqual(["site:submission:s-perdue"]);
  });

  it("le marqueur d'activation est posé UNE fois puis fait foi (update: {})", async () => {
    enable();
    const posee = new Date(Date.now() - 2 * 86400000).toISOString();
    siteSettingUpsert.mockResolvedValue({ value: posee });
    submission.findMany.mockResolvedValue([]);
    jobApplication.findMany.mockResolvedValue([]);
    outbox.findMany.mockResolvedValue([]);

    const rapport = await collectReconciliation();

    // La borne basse est le marqueur EXISTANT, pas « maintenant ».
    expect(rapport.since).toBe(posee);
    const upsertArgs = siteSettingUpsert.mock.calls[0]?.[0] as { update: object };
    expect(upsertArgs.update).toEqual({});
  });

  it("compte les sources sans ligne d'outbox et alerte", async () => {
    enable();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    submission.findMany.mockResolvedValue([{ id: "s-1" }, { id: "s-2" }, { id: "s-3" }]);
    jobApplication.findMany.mockResolvedValue([]);
    // Seules deux des trois soumissions ont produit un événement.
    outbox.findMany.mockResolvedValue([
      { subjectRef: "site:submission:s-1" },
      { subjectRef: "site:submission:s-3" },
    ]);

    const rapport = await runCrmSyncReconciliation();

    const famille = rapport.families.find((f) => f.family === "submission");
    expect(famille?.sources).toBe(3);
    expect(famille?.emitted).toBe(2);
    expect(famille?.missing).toBe(1);
    expect(famille?.missingIds).toEqual(["site:submission:s-2"]);
    expect(rapport.totalMissing).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ne compare PAS le vivier tant que le flux candidats est fermé", async () => {
    enable();
    delete process.env.CRM_SYNC_CANDIDATES_ENABLED;
    submission.findMany.mockResolvedValue([]);
    outbox.findMany.mockResolvedValue([]);

    const rapport = await collectReconciliation();

    const vivier = rapport.families.find((f) => f.family === "job_application");
    expect(vivier?.skipped).toContain("CRM_SYNC_CANDIDATES_ENABLED");
    expect(jobApplication.findMany).not.toHaveBeenCalled();
  });

  it("aucun écart : le rapport reste émis (signal de vie) et n'alerte pas", async () => {
    enable();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    submission.findMany.mockResolvedValue([{ id: "s-1" }]);
    jobApplication.findMany.mockResolvedValue([]);
    outbox.findMany.mockResolvedValue([{ subjectRef: "site:submission:s-1" }]);

    const rapport = await runCrmSyncReconciliation();

    expect(rapport.totalMissing).toBe(0);
    expect(rapport.since).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Balayage — alerte de file au-dessus du seuil FERME
// ─────────────────────────────────────────────────────────────────────────────

describe("alerte de file d'attente", () => {
  it("le seuil du plan est 50, et il n'est pas franchi À 50", async () => {
    expect(CRM_SYNC_BACKLOG_THRESHOLD).toBe(50);

    enable();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    outbox.findMany.mockResolvedValue([]);
    outbox.count.mockResolvedValue(50);

    await sweepCrmSyncOutbox();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("alerte au-dessus du seuil", async () => {
    enable();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    outbox.findMany.mockResolvedValue([]);
    outbox.count.mockResolvedValue(51);

    const res = await sweepCrmSyncOutbox();

    expect(res.backlog).toBe(51);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("drapeau à OFF : le balayage ne mesure ni n'alerte", async () => {
    delete process.env.CRM_SYNC_ENABLED;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await sweepCrmSyncOutbox();

    expect(res).toEqual({
      emitted: 0,
      sent: 0,
      gaveUp: 0,
      backlog: 0,
      oldestPendingMinutes: null,
    });
    expect(outbox.count).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── Étape 0, ligne 12 (2026-08-18) — les cinq familles sont comparées ────────
describe("réconciliation — parité sur les CINQ familles de capture", () => {
  beforeEach(() => {
    process.env.CRM_SYNC_ENABLED = "true";
    process.env.CRM_SYNC_URL = "https://crm.test/api/internal/site-sync";
    process.env.CRM_SYNC_CANDIDATES_ENABLED = "true";
    outbox.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 6 * 24 * 3600 * 1000) });
  });

  it("le rapport porte les cinq familles, jamais moins", async () => {
    const rapport = await collectReconciliation();
    expect(rapport.families.map((f) => f.family).sort()).toEqual([
      "calendly_event",
      "customer_review",
      "job_application",
      "newsletter_subscriber",
      "submission",
    ]);
  });

  it("un rendez-vous Calendly avec adresse SANS ligne d'outbox est un manquant, avec sa référence exacte", async () => {
    calendlyEvent.findMany.mockResolvedValue([{ id: "cal-1" }, { id: "cal-2" }]);
    outbox.findMany.mockResolvedValue([{ subjectRef: "site:calendly_event:cal-1" }]);
    const rapport = await collectReconciliation();
    const famille = rapport.families.find((f) => f.family === "calendly_event");
    expect(famille?.sources).toBe(2);
    expect(famille?.emitted).toBe(1);
    expect(famille?.missingIds).toEqual(["site:calendly_event:cal-2"]);
    // Et la requête n'a demandé QUE les rendez-vous dont l'adresse est connue :
    // sans adresse, rien ne peut émettre — ce n'est pas un manquant de synchro.
    const appel = calendlyEvent.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(appel.where).toMatchObject({ inviteeEmail: { not: null } });
    expect(Object.keys(appel.where)).toContain("capturedAt");
  });

  it("newsletter : seules les inscriptions CONFIRMÉES sont attendues (fenêtre sur confirmedAt)", async () => {
    subscriber.findMany.mockResolvedValue([{ id: "nl-1" }]);
    outbox.findMany.mockResolvedValue([{ subjectRef: "site:newsletter_subscriber:nl-1" }]);
    const rapport = await collectReconciliation();
    const famille = rapport.families.find((f) => f.family === "newsletter_subscriber");
    expect(famille?.missing).toBe(0);
    const appel = subscriber.findMany.mock.calls.at(-1)?.[0] as { where: Record<string, unknown> };
    expect(Object.keys(appel.where)).toEqual(["confirmedAt"]);
  });

  it("avis : un avis créé sans ligne d'outbox est un manquant (référence site:customer_review:…)", async () => {
    customerReview.findMany.mockResolvedValue([{ id: "av-1" }]);
    outbox.findMany.mockResolvedValue([]);
    const rapport = await collectReconciliation();
    const famille = rapport.families.find((f) => f.family === "customer_review");
    expect(famille?.missingIds).toEqual(["site:customer_review:av-1"]);
    expect(rapport.totalMissing).toBe(1);
  });
});
