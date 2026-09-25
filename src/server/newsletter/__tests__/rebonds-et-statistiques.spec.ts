// @vitest-environment node
//
// Lot L3 (2026-09-24) :
//   · un rebond se lit sur l'abonné (dur → `bounced`, mou → compteur) ;
//   · une opposition venue du CRM écrit son `optout` au registre de preuve,
//     sans rien réémettre vers le CRM ;
//   · les statistiques de la lettre (taux, courbe mensuelle).

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  subUpdateMany: vi.fn(),
  subFindMany: vi.fn(),
  subUpdate: vi.fn(),
  subGroupBy: vi.fn(),
  guideCount: vi.fn(),
  guideFindMany: vi.fn(),
  guideGroupBy: vi.fn(),
  recordConsent: vi.fn(),
  inboundFind: vi.fn(),
  inboundCreate: vi.fn(),
  subCount: vi.fn(),
  outboxFindMany: vi.fn(),
  logFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletterSubscriber: {
      updateMany: (...a: unknown[]) => d.subUpdateMany(...a),
      findMany: (...a: unknown[]) => d.subFindMany(...a),
      update: (...a: unknown[]) => d.subUpdate(...a),
      groupBy: (...a: unknown[]) => d.subGroupBy(...a),
      count: (...a: unknown[]) => d.subCount(...a),
    },
    emailOutbox: { findMany: (...a: unknown[]) => d.outboxFindMany(...a) },
    emailLog: { findMany: (...a: unknown[]) => d.logFindMany(...a) },
    guideRequest: {
      count: (...a: unknown[]) => d.guideCount(...a),
      findMany: (...a: unknown[]) => d.guideFindMany(...a),
      groupBy: (...a: unknown[]) => d.guideGroupBy(...a),
    },
    crmInboundEvent: {
      findUnique: (...a: unknown[]) => d.inboundFind(...a),
      create: (...a: unknown[]) => d.inboundCreate(...a),
    },
  },
}));
vi.mock("@/lib/consents", () => ({
  CONSENT_FORM_REFS: { newsletter: "newsletter-double-optin" },
  recordConsentEvent: (...a: unknown[]) => d.recordConsent(...a),
}));
vi.mock("@/server/crm-sync/alerts", () => ({ alertCrmSync: vi.fn() }));

import { createHash } from "node:crypto";
import { noterRebondSurAbonne } from "../rebonds";
import {
  baseDInscription,
  derniersMois,
  lireStatistiquesLettre,
  lireTuileGuideLettre,
  pourcentage,
} from "../console";
import { processInboundEvent } from "@/server/crm-sync/inbound";

beforeEach(() => {
  vi.clearAllMocks();
  d.subUpdateMany.mockResolvedValue({ count: 1 });
  d.recordConsent.mockResolvedValue(true);
});

describe("rebond sur l'abonné", () => {
  it("🔴 dur → `bounced`, seulement pour un abonné actif (un désabonné le reste)", async () => {
    const n = await noterRebondSurAbonne("boite-morte@example.invalid", "hard");
    expect(n).toBe(1);
    expect(d.subUpdateMany).toHaveBeenCalledWith({
      where: { email: "boite-morte@example.invalid", status: { in: ["pending", "confirmed"] } },
      data: { status: "bounced" },
    });
  });

  it("mou → compteur et date, le statut ne bouge pas", async () => {
    const quand = new Date("2026-09-24T10:00:00Z");
    await noterRebondSurAbonne("pleine@example.invalid", "soft", quand);
    expect(d.subUpdateMany).toHaveBeenCalledWith({
      where: { email: "pleine@example.invalid" },
      data: { softBounceCount: { increment: 1 }, lastSoftBounceAt: quand },
    });
  });

  it("base indisponible : ne lève jamais (le webhook doit répondre 200)", async () => {
    d.subUpdateMany.mockRejectedValue(new Error("base coupée"));
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(noterRebondSurAbonne("x@example.invalid", "hard")).resolves.toBe(0);
    erreur.mockRestore();
  });

  it("le webhook ZeptoMail appelle bien ce module (câblage)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/app/api/zeptomail/webhook/route.ts", "utf-8");
    expect(source).toMatch(/await noterRebondSurAbonne\(rebond\.destinataire, rebond\.type/);
  });
});

describe("opposition venue du CRM", () => {
  it("🔴 écrit l'`optout` au registre de preuve, sous la référence de l'accord", async () => {
    process.env.SITE_SYNC_HMAC_SECRET = "secret-de-test";
    process.env.CRM_SYNC_ENABLED = "true";
    const email = "opposant@example.invalid";
    d.subFindMany.mockResolvedValue([
      { id: "sub-1", email, consentFormRef: "newsletter-guide-ia", consentVersion: "v-case" },
    ]);
    d.subUpdate.mockResolvedValue({});
    d.inboundFind.mockResolvedValue(null);
    d.inboundCreate.mockResolvedValue({ id: "inb-1" });

    const r = await processInboundEvent({
      event_id: "crm-evt-l3-1",
      event_type: "consent_optout",
      email_hash: createHash("sha256").update(email).digest("hex"),
      scope: "business",
      origin: "crm",
      occurred_at: "2026-09-24T09:00:00.000Z",
    } as never);

    expect(r.outcome).toBe("applied");
    expect(d.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        email,
        formRef: "newsletter-guide-ia",
        consentVersion: "v-case",
        action: "optout",
      }),
    );
  });

  function evenement(email: string, extra: Record<string, unknown> = {}) {
    return {
      event_id: `crm-evt-${Math.random().toString(36).slice(2)}`,
      event_type: "consent_optout",
      email_hash: createHash("sha256").update(email).digest("hex"),
      scope: "business",
      origin: "crm",
      occurred_at: "2026-09-24T09:00:00.000Z",
      ...extra,
    } as never;
  }

  it("🔴 un `pending` (ancien double opt-in) est trouvé et fermé, avec sa preuve", async () => {
    const email = "en-attente@example.invalid";
    d.subFindMany.mockResolvedValue([
      { id: "sub-p", email, consentFormRef: null, consentVersion: null },
    ]);
    d.subUpdate.mockResolvedValue({});
    d.inboundFind.mockResolvedValue(null);
    d.inboundCreate.mockResolvedValue({ id: "inb-p" });

    const r = await processInboundEvent(evenement(email));
    expect(r.outcome).toBe("applied");
    expect(d.subFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ["pending", "confirmed"] } } }),
    );
    expect(d.subUpdate).toHaveBeenCalledWith({
      where: { id: "sub-p" },
      data: expect.objectContaining({ status: "unsubscribed" }),
    });
    expect(d.recordConsent).toHaveBeenCalledWith(expect.objectContaining({ action: "optout" }));
  });

  it("🔴 `scope: lettre` (lot L4-C du CRM) est accepté et désabonne comme `business`", async () => {
    const email = "lettre-seule@example.invalid";
    d.subFindMany.mockResolvedValue([
      { id: "sub-l", email, consentFormRef: null, consentVersion: null },
    ]);
    d.subUpdate.mockResolvedValue({});
    d.inboundFind.mockResolvedValue(null);
    d.inboundCreate.mockResolvedValue({ id: "inb-l" });

    const { parseInboundPayload } = await import("@/server/crm-sync/inbound");
    const brut = { ...(evenement(email) as object), scope: "lettre" };
    const analyse = parseInboundPayload(brut);
    expect(analyse).not.toBeNull();
    expect(analyse!.scope).toBe("lettre");

    const r = await processInboundEvent(analyse!);
    expect(r.outcome).toBe("applied");
    expect(d.subUpdate).toHaveBeenCalledTimes(1);
    // Un univers inconnu reste refusé.
    expect(parseInboundPayload({ ...brut, scope: "partout" })).toBeNull();
  });

  it("🔴 statut en échec : la preuve est DÉJÀ écrite, et la nouvelle tentative du CRM retrouve l'abonné", async () => {
    const email = "reessai@example.invalid";
    const ligne = { id: "sub-r", email, consentFormRef: null, consentVersion: null };
    d.subFindMany.mockResolvedValue([ligne]);
    d.inboundFind.mockResolvedValue(null);
    d.inboundCreate.mockResolvedValue({ id: "inb-r" });
    d.subUpdate.mockRejectedValueOnce(new Error("base coupée")).mockResolvedValue({});

    const ev = evenement(email);
    await expect(processInboundEvent(ev)).rejects.toThrow("base coupée");
    // L'`optout` est au registre malgré l'échec du statut…
    expect(d.recordConsent).toHaveBeenCalledTimes(1);
    // … et rien n'a été consigné : le CRM retentera.
    expect(d.inboundCreate).not.toHaveBeenCalled();

    // Nouvelle tentative : l'abonné n'a pas bougé, il est retrouvé → `applied`.
    const r = await processInboundEvent(ev);
    expect(r.outcome).toBe("applied");
    expect(d.recordConsent).toHaveBeenCalledTimes(2);
  });

  it("le sens entrant n'importe toujours AUCUNE fonction d'émission vers le CRM", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/server/crm-sync/inbound.ts", "utf-8");
    expect(source).not.toMatch(/import[^;]*sync\w*ToCrm/);
    expect(source).not.toMatch(/from "@\/server\/newsletter\/desabonner"/);
  });
});

describe("statistiques de la lettre", () => {
  it("un taux sans dénominateur n'est pas 0 %, il est absent", () => {
    expect(pourcentage(0, 0)).toBeNull();
    expect(pourcentage(1, 3)).toBe(33.3);
  });

  it("les 12 derniers mois, le plus ancien d'abord, passage d'année compris", () => {
    const m = derniersMois(new Date("2026-02-15T12:00:00Z"), 12);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2025-03");
    expect(m[11]).toBe("2026-02");
  });

  it("taux, courbe mensuelle et provenances", async () => {
    d.subGroupBy.mockImplementation(async (arg: { by: string[] }) =>
      arg.by[0] === "status"
        ? [
            { status: "confirmed", _count: { _all: 3 } },
            { status: "unsubscribed", _count: { _all: 1 } },
          ]
        : [{ source: "guide-ia", _count: { _all: 3 } }],
    );
    d.guideCount.mockImplementation(async (arg: { where: Record<string, unknown> }) => {
      if ("firstClickAt" in arg.where) return 1;
      if ("firstSeenAt" in arg.where) return 3;
      if ("sentAt" in arg.where) return 4;
      return 5;
    });
    d.subFindMany.mockImplementation(async (arg: { select: Record<string, boolean> }) =>
      arg.select["confirmedAt"]
        ? [
            { confirmedAt: new Date("2026-09-02T10:00:00Z") },
            { confirmedAt: new Date("2026-08-02T10:00:00Z") },
          ]
        : [{ unsubscribedAt: new Date("2026-09-20T10:00:00Z") }],
    );
    d.guideFindMany.mockResolvedValue([{ createdAt: new Date("2026-09-03T10:00:00Z") }]);
    d.guideGroupBy.mockResolvedValue([
      { source: "blog-fin-article", _count: { _all: 1 } },
      { source: "guide-ia", _count: { _all: 4 } },
    ]);

    const s = await lireStatistiquesLettre(new Date("2026-09-25T10:00:00Z"));
    expect(s.tauxDesabonnement).toBe(25);
    expect(s.tauxClic).toBe(25);
    expect(s.parMois).toHaveLength(12);
    expect(s.parMois[11]).toEqual({
      mois: "2026-09",
      inscriptions: 1,
      desabonnements: 1,
      demandesGuide: 1,
    });
    expect(s.parMois[10]!.inscriptions).toBe(1);
    // Trié du plus grand au plus petit.
    expect(s.demandesParSource.map((x) => x.source)).toEqual(["guide-ia", "blog-fin-article"]);
  });
});

describe("taux de clic et tuile d'accueil (lot L3)", () => {
  function statsDeBase(): void {
    d.subGroupBy.mockResolvedValue([]);
    d.subFindMany.mockResolvedValue([]);
    d.guideFindMany.mockResolvedValue([]);
    d.guideGroupBy.mockResolvedValue([]);
  }

  it("🔴 le taux de clic ne compte que les demandes ENVOYÉES, et ne dépasse jamais 100 %", async () => {
    statsDeBase();
    // 5 clics au total, dont 2 seulement sur des demandes envoyées ; 2 envoyées.
    d.guideCount.mockImplementation(async (arg: { where: Record<string, unknown> }) => {
      if ("firstClickAt" in arg.where && "sentAt" in arg.where) return 2;
      if ("firstClickAt" in arg.where) return 5;
      if ("sentAt" in arg.where) return 2;
      return 9;
    });
    const s = await lireStatistiquesLettre(new Date("2026-09-25T10:00:00Z"));
    expect(s.demandesCliquees).toBe(5);
    expect(s.tauxClic).toBe(100);

    // Deux comptages lus à deux instants peuvent se croiser : plafonné.
    d.guideCount.mockImplementation(async (arg: { where: Record<string, unknown> }) => {
      if ("firstClickAt" in arg.where && "sentAt" in arg.where) return 3;
      if ("sentAt" in arg.where) return 2;
      return 0;
    });
    expect((await lireStatistiquesLettre(new Date("2026-09-25T10:00:00Z"))).tauxClic).toBe(100);
  });

  it("le taux de rejet dit son dénominateur : toutes les fiches, tous statuts", async () => {
    statsDeBase();
    d.guideCount.mockResolvedValue(0);
    d.subGroupBy.mockImplementation(async (arg: { by: string[] }) =>
      arg.by[0] === "status"
        ? [
            { status: "confirmed", _count: { _all: 6 } },
            { status: "pending", _count: { _all: 1 } },
            { status: "bounced", _count: { _all: 1 } },
          ]
        : [],
    );
    const s = await lireStatistiquesLettre(new Date("2026-09-25T10:00:00Z"));
    expect(s.abonnesTous).toBe(8);
    expect(s.tauxRejet).toBe(12.5);
  });

  it("🔴 tuile : formulaire seulement, 7 jours, hors validation et hors rebond dur", async () => {
    const maintenant = new Date("2026-09-25T10:00:00Z");
    d.subCount.mockResolvedValue(4);
    d.guideCount.mockResolvedValue(2);
    d.guideFindMany.mockResolvedValue([
      { id: "g-attente", email: "attente@example.invalid" },
      { id: "g-validation", email: "validation@example.invalid" },
      { id: "g-morte", email: "morte@example.invalid" },
    ]);
    d.outboxFindMany.mockResolvedValue([{ entityId: "g-validation" }]);
    d.logFindMany.mockResolvedValue([{ recipient: "MORTE@example.invalid" }]);

    const t = await lireTuileGuideLettre(maintenant);
    expect(t.demandesEnSouffrance).toBe(1);

    const where = (d.guideFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where["origine"]).toBe("formulaire");
    expect(where["sentAt"]).toBeNull();
    const creee = where["createdAt"] as { gte: Date; lte: Date };
    expect(maintenant.getTime() - creee.gte.getTime()).toBe(7 * 24 * 3_600_000);
    expect(maintenant.getTime() - creee.lte.getTime()).toBe(3_600_000);
  });

  it("la base d'inscription se lit sur la DERNIÈRE preuve", () => {
    expect(baseDInscription([{ action: "information" }, { action: "optin" }])).toBe(
      "interet-legitime",
    );
    expect(baseDInscription([{ action: "optin" }])).toBe("consentement");
    expect(baseDInscription([{ action: "optout" }, { action: "optin" }])).toBe("non-etablie");
    expect(baseDInscription([])).toBe("non-etablie");
  });
});
