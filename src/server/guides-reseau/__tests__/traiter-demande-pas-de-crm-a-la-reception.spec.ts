// @vitest-environment node
//
// Lot S3 (correction de relecture) — chemin « adresse tapée dans la conversation » : à la RÉCEPTION
// de la demande, rien ne part au CRM (D1 : l'événement part au clic du lien, adresse vérifiée),
// même avec `SYNCHRO_CRM_V3` allumé. L'origine reste écrite dans l'historique du site.
// Et si `transmettreOriginesV3` est appelée, une adresse exclue ne part jamais.
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;
const bd = vi.hoisted(() => ({
  demandes: [] as Ligne[],
  evenements: [] as unknown[],
  origines: [] as Ligne[],
  n: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: {
      findUnique: async ({ where }: { where: Ligne }) => {
        const c = where["emailKey_aimant"] as Ligne;
        return bd.demandes.find((d) => d.emailKey === c.emailKey && d.aimant === c.aimant) ?? null;
      },
      create: async ({ data }: { data: Ligne }) => {
        const l = { id: `d${++bd.n}`, ...data };
        bd.demandes.push(l);
        return l;
      },
      update: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = bd.demandes.find((d) => d.id === where["id"])!;
        Object.assign(l, data);
        return l;
      },
    },
    emailLog: { count: async () => 0 },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));
vi.mock("@/lib/consents", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  recordConsentEvent: async () => true,
}));
vi.mock("@/server/email/opposition", () => ({ estOpposee: async () => false }));
vi.mock("@/server/guide-ia/mx", () => ({ domaineRecoitDesEmails: async () => "oui" }));
vi.mock("@/server/guide-ia/coupe-circuit", () => ({ coupeCircuitDeclenche: async () => false }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: async () => ({ enqueued: true }) }));
vi.mock("@/server/guides-reseau/origines", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  enregistrerOrigine: async (_k: string, o: Ligne) => {
    bd.origines.push(o);
    return { creee: true, archivees: 0 };
  },
}));
vi.mock("@/server/crm-sync/enqueue", () => ({
  enqueueCrmSyncEvent: async (e: unknown) => {
    bd.evenements.push(e);
    return "ligne-1";
  },
}));

import * as traitement from "../traitement";
import { transmettreOriginesV3 } from "../synchro-v3";
import { construireOrigine } from "../origines";

const MAINTENANT = new Date("2026-11-08T10:00:00.000Z");
const D = {
  schemaVersion: 3,
  cleIdempotence: "run_exemple_0001",
  email: "personne@example.test",
  mot: "GUIDE",
  reseau: "instagram",
  guide: "guide-ia",
  versionTexteM1: "m1-2026-11",
  locale: "fr",
  post_ref: "post_exemple_0001",
  canal: "commentaire",
} as unknown as Parameters<typeof traitement.traiterDemande>[0];

const ENV = ["SYNCHRO_CRM_V3", "CRM_SYNC_EXCLUSIONS_SHA256"] as const;
const avant: Record<string, string | undefined> = {};
for (const k of ENV) avant[k] = process.env[k];

beforeEach(() => {
  bd.demandes.length = bd.evenements.length = bd.origines.length = 0;
  bd.n = 0;
  process.env.SYNCHRO_CRM_V3 = "true";
  delete process.env.CRM_SYNC_EXCLUSIONS_SHA256;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  for (const k of ENV) {
    if (avant[k] === undefined) delete process.env[k];
    else process.env[k] = avant[k];
  }
});

describe("traiterDemande — aucun événement CRM à la réception", () => {
  it("SYNCHRO_CRM_V3 allumé : l'origine est écrite sur le site, AUCUN événement en file", async () => {
    const r = await traitement.traiterDemande(D, MAINTENANT);
    expect(r.ok).toBe(true);
    expect(bd.origines).toHaveLength(1);
    expect(bd.evenements).toHaveLength(0);
  });
});

describe("transmettreOriginesV3 — adresse exclue", () => {
  it("une adresse exclue de l'environnement n'est jamais mise en file", async () => {
    process.env.CRM_SYNC_EXCLUSIONS_SHA256 = createHash("sha256")
      .update("personne@example.test")
      .digest("hex");
    const origine = construireOrigine(
      {
        schemaVersion: 3,
        cleIdempotence: "run_exemple_0001",
        email: "personne@example.test",
        mot: "GUIDE",
        reseau: "instagram",
        guide: "guide-ia",
      } as never,
      MAINTENANT,
    );
    const r = await transmettreOriginesV3({
      email: "personne@example.test",
      cleIdempotence: "run_exemple_0001",
      origines: [origine],
      quand: MAINTENANT,
    });
    expect(r).toBe("ignoree");
    expect(bd.evenements).toHaveLength(0);
  });
});
