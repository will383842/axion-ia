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
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletterSubscriber: {
      updateMany: (...a: unknown[]) => d.subUpdateMany(...a),
      findMany: (...a: unknown[]) => d.subFindMany(...a),
      update: (...a: unknown[]) => d.subUpdate(...a),
      groupBy: (...a: unknown[]) => d.subGroupBy(...a),
    },
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
import { derniersMois, lireStatistiquesLettre, pourcentage } from "../console";
import { processInboundEvent } from "@/server/crm-sync/inbound";

beforeEach(() => {
  vi.clearAllMocks();
  d.subUpdateMany.mockResolvedValue({ count: 1 });
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
