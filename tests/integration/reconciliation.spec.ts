/**
 * INT-T08-A contre un VRAI Postgres — le rejeu réarme la ligne, et l'octet exact repart.
 *
 * CE QU'IL PROUVE, sur la table réelle :
 *   — une ligne `sent`, puis une ligne `gave_up` (huit tentatives, erreur posée), redeviennent
 *     `pending`, tentatives à zéro, dues maintenant, erreur effacée ;
 *   — leur CORPS et leur SÉQUENCE sont inchangés, octet pour octet : la relecture rend le même texte ;
 *   — un identifiant inconnu n'écrit rien ;
 *   — une requête signée pour un autre corps n'écrit rien.
 *
 * Les lignes du banc portent leurs propres identifiants et des séquences hors de la plage des autres
 * bancs : aucune table n'est vidée, rien d'autre n'est touché.
 *
 * Joué par Gate D (`ci.yml`), sur la base fraîchement migrée. Sans `DATABASE_URL`, ce fichier
 * ÉCHOUE — il ne se saute pas.
 */
import { randomBytes, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../prisma/generated/client";
import {
  repondreReconciliation,
  type EcrivainRejeu,
} from "../../src/server/partners-sync/reconciliation";
import { signerCibleRelecture } from "../../src/server/partners-sync/relecture";

const URL_BASE = process.env.DATABASE_URL;
if (!URL_BASE || URL_BASE.includes("stub.invalid")) {
  throw new Error(
    "[partners-sync] DATABASE_URL absente ou stub : ce test exige un vrai Postgres migré (Gate D).",
  );
}

const prisma = new PrismaClient();
const ecrivain = prisma as unknown as EcrivainRejeu;
const SECRET = randomBytes(32).toString("hex");
const SECRET_RELECTURE = randomBytes(32).toString("hex");
const CHEMIN = "/api/partners/reconciliation";
const MAINTENANT_MS = Date.UTC(2026, 9, 2, 12, 0, 0);
const T = String(Math.floor(MAINTENANT_MS / 1000));

/** Une plage de séquences que les autres bancs n'atteignent pas. */
const SEQUENCE_DU_BANC = 9_000_000_000n + BigInt(Math.floor(Math.random() * 1_000_000)) * 10n;

const SENT = randomUUID();
const ABANDONNEE = randomUUID();
const CORPS_SENT = `{"event_id":"${SENT}","payload":{"x":"é"}}`;
const CORPS_ABANDONNEE = `{"event_id":"${ABANDONNEE}","payload":{"z":1,"a":2}}`;

function requete(corps: string, corpsSigne = corps) {
  return new Request(`https://axion-ia.com${CHEMIN}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-partners-timestamp": T,
      "x-partners-signature": signerCibleRelecture(SECRET_RELECTURE, T, `${CHEMIN}\n${corpsSigne}`),
    },
    body: corps,
  });
}

async function ligne(eventId: string) {
  return prisma.partnersSyncOutbox.findUniqueOrThrow({ where: { eventId } });
}

beforeAll(async () => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.PARTNERS_SYNC_SECRET = SECRET;
  process.env.PARTNERS_SYNC_URL = "https://partners.exemple.test/api/webhooks/axionia";
  process.env.PARTNERS_RELECTURE_SECRET = SECRET_RELECTURE;
  await prisma.partnersSyncOutbox.create({
    data: {
      eventId: SENT,
      eventType: "devis.signe",
      subjectRef: "devis:banc-reconciliation",
      sequence: SEQUENCE_DU_BANC,
      corps: CORPS_SENT,
      status: "sent",
      attempts: 1,
      sentAt: new Date(MAINTENANT_MS - 3_600_000),
    },
  });
  await prisma.partnersSyncOutbox.create({
    data: {
      eventId: ABANDONNEE,
      eventType: "devis.signe",
      subjectRef: "devis:banc-reconciliation",
      sequence: SEQUENCE_DU_BANC + 1n,
      corps: CORPS_ABANDONNEE,
      status: "gave_up",
      attempts: 8,
      lastError: "http_500",
    },
  });
});

afterAll(async () => {
  await prisma.partnersSyncOutbox.deleteMany({ where: { eventId: { in: [SENT, ABANDONNEE] } } });
  await prisma.$disconnect();
});

describe("REQ-INT-013 — le rejeu en base réelle", () => {
  it("TÉMOIN — une requête signée pour un autre corps n'écrit rien", async () => {
    const r = await repondreReconciliation(
      requete(JSON.stringify({ eventIds: [SENT] }), JSON.stringify({ eventIds: [ABANDONNEE] })),
      { prisma: ecrivain, maintenantMs: MAINTENANT_MS },
    );
    expect(r.status).toBe(401);
    expect((await ligne(SENT)).status).toBe("sent");
  });

  it("TÉMOIN — sent et gave_up redeviennent pending, tentatives à zéro, dues maintenant ; corps et séquence inchangés ; l'inconnu n'écrit rien", async () => {
    const inconnu = randomUUID();
    const r = await repondreReconciliation(
      requete(JSON.stringify({ eventIds: [SENT, ABANDONNEE, inconnu] })),
      { prisma: ecrivain, maintenantMs: MAINTENANT_MS },
    );
    expect(r.status).toBe(200);
    expect(JSON.parse(await r.text())).toEqual({
      rearmes: [SENT, ABANDONNEE],
      introuvables: [inconnu],
    });
    for (const [eventId, corps, sequence] of [
      [SENT, CORPS_SENT, SEQUENCE_DU_BANC],
      [ABANDONNEE, CORPS_ABANDONNEE, SEQUENCE_DU_BANC + 1n],
    ] as const) {
      const l = await ligne(eventId);
      expect(l.status).toBe("pending");
      expect(l.attempts).toBe(0);
      expect(l.lastError).toBeNull();
      expect(l.nextAttemptAt).toEqual(new Date(MAINTENANT_MS));
      expect(l.corps).toBe(corps);
      expect(l.sequence).toBe(sequence);
    }
    expect(await prisma.partnersSyncOutbox.count({ where: { eventId: inconnu } })).toBe(0);
  });
});
