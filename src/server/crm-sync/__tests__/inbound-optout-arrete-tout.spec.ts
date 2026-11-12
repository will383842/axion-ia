// @vitest-environment node

/**
 * STOP-T4-SITE (décision D-STOP-2 : « Oui, arrêter tout ») — un `consent_optout` reçu du CRM
 * arrête AUSSI le guide réseau et les messages privés, pas seulement la lettre, et pour TOUTES
 * les portées (vivier compris). Base simulée qui garde son état ; adresses fictives (example.test).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

const base = vi.hoisted(() => ({
  demandes: [] as Ligne[],
  contacts: [] as Ligne[],
  oppositions: [] as Ligne[],
  abonnes: [] as Ligne[],
  entrants: [] as Ligne[],
  upsertEchoue: false,
  upserts: 0,
  ecartEchoue: false,
  argsDemandes: [] as Ligne[],
  majAbonnes: [] as Ligne[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmInboundEvent: {
      findUnique: async ({ where }: { where: { eventId: string } }) =>
        base.entrants.find((e) => e.eventId === where.eventId) ?? null,
      create: async ({ data }: { data: Ligne }) => {
        base.entrants.push(data);
        return data;
      },
    },
    newsletterSubscriber: {
      findMany: async () => base.abonnes,
      update: async (a: Ligne) => {
        base.majAbonnes.push(a);
        return a;
      },
    },
    guideRequest: {
      findMany: async (a: { take?: number }) => {
        base.argsDemandes.push(a as Ligne);
        const toutes = base.demandes.map((d) => ({ email: d.email }));
        return a.take === undefined ? toutes : toutes.slice(0, a.take);
      },
    },
    emailOpposition: {
      upsert: async ({ where, create }: { where: { emailHash: string }; create: Ligne }) => {
        if (base.upsertEchoue) throw new Error("panne simulée");
        base.upserts += 1;
        if (!base.oppositions.some((o) => o.emailHash === where.emailHash)) {
          base.oppositions.push({ ...create });
        }
        return create;
      },
      findFirst: async ({ where }: { where: { emailHash: string } }) =>
        base.oppositions.find((o) => o.emailHash === where.emailHash && o.effacementDemandeLe) ??
        null,
      findUnique: async ({ where }: { where: { emailHash: string } }) =>
        base.oppositions.find((o) => o.emailHash === where.emailHash) ?? null,
    },
    contactGuideReseau: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { emailKey: string; merciStatut: { notIn: string[] } };
        data: Ligne;
      }) => {
        if (base.ecartEchoue) throw new Error("panne écart simulée");
        let n = 0;
        for (const c of base.contacts) {
          if (
            c.emailKey === where.emailKey &&
            !where.merciStatut.notIn.includes(c.merciStatut as string)
          ) {
            Object.assign(c, data);
            n += 1;
          }
        }
        return { count: n };
      },
    },
    emailLog: { findFirst: async () => null },
  },
}));
vi.mock("@/lib/consents", () => ({
  CONSENT_FORM_REFS: { newsletter: "n" },
  recordConsentEvent: vi.fn(async () => ({})),
}));
const alertes = vi.hoisted(() => ({ alertCrmSync: vi.fn() }));
vi.mock("../alerts", () => alertes);

const { processInboundEvent, sha256Email, MAX_SCAN_SUBSCRIBERS } = await import("../inbound");
const { verdictAvantEnvoi } = await import("@/server/email/verdict-envoi");
const { hashEmailForLookup } = await import("@/lib/security/email-hash");

const ADRESSE = "Personne.Reseau@example.test";
const CLE = hashEmailForLookup(ADRESSE) as string;

function evenement(over: Record<string, unknown> = {}) {
  return {
    event_id: "evt-1",
    event_type: "consent_optout" as const,
    email_hash: sha256Email(ADRESSE),
    scope: "business" as const,
    origin: "crm" as const,
    occurred_at: "2026-11-12T10:00:00.000Z",
    ...over,
  } as Parameters<typeof processInboundEvent>[0];
}

beforeEach(() => {
  base.demandes = [{ email: ADRESSE }];
  base.contacts = [
    { emailKey: CLE, merciStatut: "a_envoyer" },
    { emailKey: CLE, merciStatut: "ecarte" },
    { emailKey: "autre", merciStatut: "a_envoyer" },
  ];
  base.oppositions = [];
  base.abonnes = [];
  base.entrants = [];
  base.upsertEchoue = false;
  base.upserts = 0;
  base.ecartEchoue = false;
  base.argsDemandes = [];
  base.majAbonnes = [];
  alertes.alertCrmSync.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("consent_optout reçu du CRM : arrêter tout", () => {
  for (const scope of ["business", "vivier"] as const) {
    it(`portée ${scope} : opposition posée, contact écarté, envoi réseau opposé`, async () => {
      const r = await processInboundEvent(evenement({ scope }));
      expect(r).toEqual({ ok: true, outcome: "applied" });
      expect(base.oppositions).toHaveLength(1);
      expect(base.oppositions[0]).toMatchObject({
        emailHash: CLE,
        source: "crm-optout",
        crmEnAttenteDepuis: null,
      });
      expect(base.contacts[0]?.merciStatut).toBe("ecarte");
      expect(base.contacts[2]?.merciStatut).toBe("a_envoyer");
      const v = await verdictAvantEnvoi(ADRESSE, {
        template: "guide-ia-envoi",
        marketing: false,
        sollicitation: true,
      });
      expect(v).toMatchObject({ retenu: true, motif: "oppose" });
    });
  }

  it("portée lettre : abonné désabonné, AUCUNE opposition, contact du guide non écarté", async () => {
    base.abonnes = [{ id: "ab1", email: ADRESSE, consentFormRef: null, consentVersion: null }];
    const r = await processInboundEvent(evenement({ scope: "lettre" }));
    expect(r.outcome).toBe("applied");
    expect(base.majAbonnes).toHaveLength(1);
    expect(base.oppositions).toHaveLength(0);
    expect(base.upserts).toBe(0);
    expect(base.contacts[0]?.merciStatut).toBe("a_envoyer");
    expect(base.argsDemandes).toHaveLength(0);
  });

  it("portée vivier : la lettre n'est PAS touchée", async () => {
    base.abonnes = [{ id: "ab1", email: ADRESSE, consentFormRef: null, consentVersion: null }];
    await processInboundEvent(evenement({ scope: "vivier" }));
    expect(base.majAbonnes).toHaveLength(0);
    expect(base.oppositions).toHaveLength(1);
  });

  it("portée business, abonné sans demande de guide : opposition posée, rien vers le CRM", async () => {
    base.demandes = [];
    base.abonnes = [{ id: "ab1", email: ADRESSE, consentFormRef: null, consentVersion: null }];
    const r = await processInboundEvent(evenement({ scope: "business" }));
    expect(r.outcome).toBe("applied");
    expect(base.majAbonnes).toHaveLength(1);
    expect(base.oppositions).toHaveLength(1);
    expect(base.oppositions[0]).toMatchObject({
      emailHash: CLE,
      source: "crm-optout",
      crmEnAttenteDepuis: null,
    });
  });

  it("le balayage des demandes est borné et trié du plus récent au plus ancien", async () => {
    await processInboundEvent(evenement());
    const a = base.argsDemandes[0] as { take?: number; orderBy?: unknown };
    expect(a.take).toBe(MAX_SCAN_SUBSCRIBERS);
    expect(JSON.stringify(a.orderBy)).toContain('"createdAt":"desc"');
  });

  it("plafond atteint sans correspondance : alerte levée, sans adresse", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    base.demandes = Array.from({ length: MAX_SCAN_SUBSCRIBERS }, (_, i) => ({
      email: `x${i}@example.test`,
    }));
    const r = await processInboundEvent(evenement({ scope: "vivier" }));
    expect(r.outcome).toBe("no_match");
    expect(alertes.alertCrmSync).toHaveBeenCalledTimes(1);
    const arg = alertes.alertCrmSync.mock.calls[0]?.[0] as { kind: string; detail: string };
    expect(arg.kind).toBe("scan_capped");
    expect(arg.detail).not.toContain("@");
    for (const appel of warn.mock.calls) expect(JSON.stringify(appel)).not.toContain("@");
  });

  it("sous le plafond : pas d'alerte", async () => {
    await processInboundEvent(evenement({ scope: "vivier" }));
    expect(alertes.alertCrmSync).not.toHaveBeenCalled();
  });

  it("upsert réussi puis écart en échec : l'erreur remonte, et au rejeu tout s'applique", async () => {
    base.ecartEchoue = true;
    await expect(processInboundEvent(evenement())).rejects.toThrow();
    expect(base.oppositions).toHaveLength(1);
    expect(base.entrants).toHaveLength(0);
    expect(base.contacts[0]?.merciStatut).toBe("a_envoyer");
    base.ecartEchoue = false;
    const r = await processInboundEvent(evenement());
    expect(r.outcome).toBe("applied");
    expect(base.contacts[0]?.merciStatut).toBe("ecarte");
  });

  it("rejeu du même event_id : duplicate, aucune seconde écriture", async () => {
    await processInboundEvent(evenement());
    const avant = base.upserts;
    const r = await processInboundEvent(evenement());
    expect(r.outcome).toBe("duplicate");
    expect(base.upserts).toBe(avant);
  });

  it("adresse inconnue : no_match", async () => {
    base.demandes = [];
    expect((await processInboundEvent(evenement())).outcome).toBe("no_match");
    expect(base.oppositions).toHaveLength(0);
  });

  it("consent_optin : toujours ignoré, rien d'écrit", async () => {
    const r = await processInboundEvent(evenement({ event_type: "consent_optin" }));
    expect(r.outcome).toBe("ignored");
    expect(base.oppositions).toHaveLength(0);
    expect(base.contacts[0]?.merciStatut).toBe("a_envoyer");
  });

  it("panne de l'upsert : l'erreur remonte, contact non écarté, événement non consigné", async () => {
    base.upsertEchoue = true;
    await expect(processInboundEvent(evenement())).rejects.toThrow();
    expect(base.contacts[0]?.merciStatut).toBe("a_envoyer");
    expect(base.entrants).toHaveLength(0);
  });

  it("aucun journal ne contient d'arobase", async () => {
    const spies = [
      vi.spyOn(console, "error"),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "log").mockImplementation(() => undefined),
    ];
    await processInboundEvent(evenement());
    base.upsertEchoue = true;
    await processInboundEvent(evenement({ event_id: "evt-2" })).catch(() => undefined);
    for (const s of spies) {
      for (const appel of s.mock.calls) expect(JSON.stringify(appel)).not.toContain("@");
    }
  });

  it("garde anti-boucle : aucun sync*ToCrm ni enregistrerOppositionPourAdresse dans le module", () => {
    const src = readFileSync(join(__dirname, "..", "inbound.ts"), "utf8");
    const code = src
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(code).not.toMatch(/sync\w+ToCrm/);
    expect(code).not.toMatch(/enregistrerOppositionPourAdresse/);
    expect(code).not.toMatch(/from\s+["'][^"']*email\/opposition["']/);
  });
});
