// @vitest-environment node
//
// Lot S2 — INSTANTANÉ du chemin « adresse tapée dans la conversation » (`traiterDemande`).
// Écrit AVANT l'extraction du cœur réutilisé par la page : il fige ce que le chemin fait
// aujourd'hui (appels de limites, lignes écrites, preuve, charge de l'e-mail). L'extraction
// ne doit pas le faire bouger d'un octet.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Ligne = Record<string, unknown>;
const bd = vi.hoisted(() => ({
  demandes: [] as Ligne[],
  preuves: [] as Ligne[],
  envois: [] as unknown[][],
  limites: [] as unknown[][],
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
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (...a: unknown[]) => {
    bd.limites.push(a);
    return { allowed: true };
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));
vi.mock("@/lib/consents", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  recordConsentEvent: async (i: Ligne) => {
    bd.preuves.push(i);
    return true;
  },
}));
vi.mock("@/server/email/opposition", () => ({ estOpposee: async () => false }));
vi.mock("@/server/guide-ia/mx", () => ({ domaineRecoitDesEmails: async () => "oui" }));
vi.mock("@/server/guide-ia/coupe-circuit", () => ({ coupeCircuitDeclenche: async () => false }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async (...a: unknown[]) => {
    bd.envois.push(a);
    return { enqueued: true };
  },
}));
vi.mock("@/server/guides-reseau/origines", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  enregistrerOrigine: async () => ({ creee: true, archivees: 0 }),
}));
vi.mock("@/server/guides-reseau/synchro-v3", () => ({
  transmettreOriginesV3: async () => undefined,
}));

import * as traitement from "../traitement";

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

beforeEach(() => {
  bd.demandes.length = bd.preuves.length = bd.envois.length = bd.limites.length = 0;
  bd.n = 0;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("traiterDemande — instantané du chemin actuel (ne doit pas bouger)", () => {
  it("résultat, limites, ligne de demande, preuve et charge de l'e-mail", async () => {
    const r = await traitement.traiterDemande(D, MAINTENANT);
    expect({
      r,
      limites: bd.limites,
      demande: bd.demandes.map(({ downloadToken: _t, ...reste }) => reste),
      jetonLong: String(bd.demandes[0]!["downloadToken"]).length,
      preuves: bd.preuves,
      envois: bd.envois.map(([g, to, loc, payload, opts]) => ({
        g,
        to,
        loc,
        payloadCles: Object.keys(payload as object).sort(),
        reseau: (payload as Ligne)["reseau"],
        opts,
      })),
    }).toMatchInlineSnapshot(`
      {
        "demande": [
          {
            "aimant": "guide-ia",
            "derniereDemandeFormulaireAt": 2026-11-08T10:00:00.000Z,
            "email": "personne@example.test",
            "emailKey": "h:personne@example.test",
            "id": "d1",
            "locale": "fr",
            "origine": "message_prive",
            "queuedAt": 2026-11-08T10:00:00.000Z,
            "source": "mot-guide:instagram",
            "version": "m1-2026-11",
          },
        ],
        "envois": [
          {
            "g": "guide-ia-envoi",
            "loc": "fr",
            "opts": {
              "entityId": "d1",
              "entityType": "GuideRequest",
              "priority": 10,
            },
            "payloadCles": [
              "downloadToken",
              "reseau",
            ],
            "reseau": true,
            "to": "personne@example.test",
          },
        ],
        "jetonLong": 64,
        "limites": [
          [
            "guides-reseau:pers:h:personne@example.test:2026-11-08",
            {
              "limit": 20,
              "windowSec": 86400,
            },
          ],
          [
            "guides-reseau:post:post_exemple_0001:commentaire:2026-11-08",
            {
              "limit": 5000,
              "windowSec": 86400,
            },
          ],
        ],
        "preuves": [
          {
            "action": "information",
            "consentVersion": "m1-2026-11",
            "email": "personne@example.test",
            "formRef": "guide-reseau-message-prive",
            "occurredAt": 2026-11-08T10:00:00.000Z,
          },
        ],
        "r": {
          "demandeId": "d1",
          "guide": "en-file",
          "nouvelle": true,
          "ok": true,
        },
      }
    `);
  });

  it("une reprise du même run : pas de nouvelle ligne, mêmes limites", async () => {
    await traitement.traiterDemande(D, MAINTENANT);
    const r2 = await traitement.traiterDemande(D, MAINTENANT);
    expect({ r2: { ...r2, demandeId: "…" }, lignes: bd.demandes.length }).toMatchInlineSnapshot(`
      {
        "lignes": 1,
        "r2": {
          "demandeId": "…",
          "guide": "en-file",
          "nouvelle": false,
          "ok": true,
        },
      }
    `);
  });
});

describe("cœur réutilisé par la page (extraction)", () => {
  it("retrouverOuCreerDemande et sousLesLimites sont exportés pour la page", () => {
    expect(typeof (traitement as Record<string, unknown>)["retrouverOuCreerDemande"]).toBe(
      "function",
    );
    expect(typeof (traitement as Record<string, unknown>)["sousLesLimites"]).toBe("function");
  });
});
