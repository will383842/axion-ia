// @req REQ-SEC-028
/**
 * Chantier Axion Partners — INT-T41 : axion-ia émet l'identifiant de sa clé de signature.
 *
 * Partners vérifie la signature d'un webhook avec l'un de ses secrets ; pendant une rotation, il
 * en garde DEUX (QA-T52). L'en-tête `X-Axionia-Kid` CHOISIT la clé : absent ou inconnu, c'est
 * un refus, aucun autre secret n'est essayé (REQ-QA-030). Le kid est
 * DÉRIVÉ de la valeur du secret, par la même fonction que `kidDe` de Partners
 * (partners/ADR-0013 d.8) : il change donc AVEC la clé, et jamais sans elle.
 */
import { createHash, createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import contrat from "@/server/partners/contrat/contracts.v2.json";
import { ENTETE_KID, kidDe } from "@/server/partners/enveloppe";

import { envoyerLigne, type ClientRelais } from "../relais";
import { repondreReconciliation } from "../reconciliation";
import {
  ENTETE_HORODATAGE_RELECTURE,
  ENTETE_SIGNATURE_RELECTURE,
  repondreRelecture,
  signerCibleRelecture,
} from "../relecture";

const SECRET_A = "a".repeat(48);
const SECRET_B = "b".repeat(48);

describe("REQ-SEC-028 — kidDe, la dérivation de Partners recopiée à l'identique", () => {
  it("REQ-SEC-028 : huit caractères hexadécimaux, stables pour une valeur", () => {
    expect(kidDe(SECRET_A)).toMatch(/^[0-9a-f]{8}$/);
    expect(kidDe(SECRET_A)).toBe(kidDe(SECRET_A));
  });

  it("REQ-SEC-028 : la formule de partners/ADR-0013 d.8, séparateur U+001F compris", () => {
    const attendu = createHash("sha256")
      .update(`partners.kid.v1\u001f${SECRET_A}`, "utf8")
      .digest("hex")
      .slice(0, 8);
    expect(kidDe(SECRET_A)).toBe(attendu);
    // Vecteur fixe : une dérivation modifiée d'un côté seulement ferait rougir ce témoin.
    expect(kidDe("abc")).toBe("2e5419d4");
  });

  it("REQ-SEC-028 — TÉMOIN : le kid change quand la clé tourne", () => {
    expect(kidDe(SECRET_B)).not.toBe(kidDe(SECRET_A));
  });

  it("REQ-SEC-028 : le nom émis est celui que le contrat recopié DÉCLARE (webhook et coordonnées)", () => {
    const defs = (contrat as unknown as { $defs: Record<string, { properties: object }> }).$defs;
    for (const nom of ["webhook_entetes", "api_coordonnees_candidature_reponse_entetes"]) {
      expect(Object.keys(defs[nom]!.properties)).toContain(ENTETE_KID.toLowerCase());
    }
  });

  it("REQ-SEC-028 : le kid ne révèle pas le secret", () => {
    expect(SECRET_A).not.toContain(kidDe(SECRET_A));
  });
});

describe("REQ-SEC-028 — le webhook signé porte le kid de SA clé", () => {
  const ENV = { ...process.env };
  beforeEach(() => {
    process.env.PARTNERS_SYNC_ENABLED = "true";
    process.env.PARTNERS_SYNC_URL = "https://partners.example.test/api/webhooks/axionia";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });
  afterEach(() => {
    process.env = { ...ENV };
  });

  async function envoyerAvec(secret: string): Promise<Headers> {
    process.env.PARTNERS_SYNC_SECRET = secret;
    const ligne = {
      id: "l1",
      eventId: "e1",
      eventType: "client.cree",
      subjectRef: "client:1",
      sequence: 1n,
      status: "pending",
      attempts: 0,
      corps: '{"event_type":"client.cree"}',
    };
    let entetes = new Headers();
    const prisma = {
      partnersSyncOutbox: {
        findUnique: async () => ligne,
        update: async () => ligne,
      },
    } as unknown as ClientRelais;
    await envoyerLigne("l1", {
      prisma,
      fetch: async (_url, init) => {
        entetes = new Headers(init.headers);
        return new Response(null, { status: 204 });
      },
      alerter: async () => undefined,
      maintenant: () => new Date("2026-09-30T00:00:00Z"),
    });
    return entetes;
  }

  it("REQ-SEC-028 : X-Axionia-Kid = kidDe(secret d'émission), à côté de la signature", async () => {
    const h = await envoyerAvec(SECRET_A);
    expect(ENTETE_KID).toBe("X-Axionia-Kid");
    expect(h.get(ENTETE_KID)).toBe(kidDe(SECRET_A));
    const t = h.get("X-Axionia-Timestamp")!;
    expect(h.get("X-Axionia-Signature")).toBe(
      createHmac("sha256", SECRET_A).update(`${t}.{"event_type":"client.cree"}`).digest("hex"),
    );
  });

  it("REQ-SEC-028 — TÉMOIN : après rotation, le même envoi porte le kid de la NOUVELLE clé", async () => {
    const avant = (await envoyerAvec(SECRET_A)).get(ENTETE_KID);
    const apres = (await envoyerAvec(SECRET_B)).get(ENTETE_KID);
    expect(apres).toBe(kidDe(SECRET_B));
    expect(apres).not.toBe(avant);
  });
});

/**
 * INT-T72-A (REQ-QA-030) : les réponses SIGNÉES de la relecture et du rejeu portent, elles aussi, le
 * kid de la clé qui les a signées. Partners (`verifierSignatureAxionia`) refuse une réponse sans kid
 * (`kid_absent`) : sans lui, le canal réel de la réconciliation serait bloqué.
 */
describe("REQ-QA-030 — les réponses de relecture et de rejeu portent le kid de LEUR clé", () => {
  const ENV = { ...process.env };
  const SECRET_RELECTURE = "r".repeat(40);
  const MAINTENANT_MS = Date.UTC(2026, 9, 5, 12, 0, 0);
  const T = String(Math.floor(MAINTENANT_MS / 1000));
  beforeEach(() => {
    process.env.PARTNERS_SYNC_ENABLED = "true";
    process.env.PARTNERS_RELECTURE_SECRET = SECRET_RELECTURE;
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });
  afterEach(() => {
    process.env = { ...ENV };
  });

  async function relectureAvec(secret: string): Promise<Response> {
    process.env.PARTNERS_SYNC_SECRET = secret;
    const cible = "/api/partners/evenements?after_sequence=0&limit=100";
    return repondreRelecture(
      new Request(`https://axion-ia.com${cible}`, {
        headers: {
          [ENTETE_HORODATAGE_RELECTURE]: T,
          [ENTETE_SIGNATURE_RELECTURE]: signerCibleRelecture(SECRET_RELECTURE, T, cible),
        },
      }),
      {
        prisma: {
          partnersSyncOutbox: { findMany: async () => [{ sequence: 1n, corps: '{"a":1}' }] },
        },
        maintenantMs: MAINTENANT_MS,
      },
    );
  }

  async function rejeuAvec(secret: string): Promise<Response> {
    process.env.PARTNERS_SYNC_SECRET = secret;
    const chemin = "/api/partners/reconciliation";
    const corps = JSON.stringify({ eventIds: ["0a1b2c3d-0001-4000-8000-000000000001"] });
    return repondreReconciliation(
      new Request(`https://axion-ia.com${chemin}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [ENTETE_HORODATAGE_RELECTURE]: T,
          [ENTETE_SIGNATURE_RELECTURE]: signerCibleRelecture(
            SECRET_RELECTURE,
            T,
            `${chemin}\n${corps}`,
          ),
        },
        body: corps,
      }),
      {
        prisma: { partnersSyncOutbox: { updateMany: async () => ({ count: 1 }) } },
        maintenantMs: MAINTENANT_MS,
        limiter: async () => ({ allowed: true }),
        journal: () => undefined,
      },
    );
  }

  it("REQ-QA-030 : TÉMOIN — la réponse de RELECTURE porte X-Axionia-Kid = kidDe(secret d'émission)", async () => {
    const r = await relectureAvec(SECRET_A);
    expect(r.status).toBe(200);
    expect(r.headers.get(ENTETE_KID)).toBe(kidDe(SECRET_A));
    expect(r.headers.get("x-axionia-signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("REQ-QA-030 : TÉMOIN — la réponse de REJEU porte X-Axionia-Kid = kidDe(secret d'émission)", async () => {
    const r = await rejeuAvec(SECRET_A);
    expect(r.status).toBe(200);
    expect(r.headers.get(ENTETE_KID)).toBe(kidDe(SECRET_A));
    expect(r.headers.get("x-axionia-signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("REQ-QA-030 — TÉMOIN : après rotation, les deux réponses portent le kid de la NOUVELLE clé", async () => {
    for (const repondre of [relectureAvec, rejeuAvec]) {
      const avant = (await repondre(SECRET_A)).headers.get(ENTETE_KID);
      const apres = (await repondre(SECRET_B)).headers.get(ENTETE_KID);
      expect(apres).toBe(kidDe(SECRET_B));
      expect(apres).not.toBe(avant);
    }
  });
});
