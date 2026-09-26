/**
 * INT-T02 contre un VRAI Postgres — ce qu'un faux client ne peut pas prouver.
 *
 *   (7) une transaction métier annulée après l'écriture de l'événement laisse ZÉRO ligne ; la même,
 *       validée, en laisse exactement UNE (REQ-INT-001) ;
 *   (8) deux transactions validées dans l'ORDRE INVERSE de leur création : un lecteur qui avance
 *       par `after_sequence` ne saute aucune ligne (partners/ADR-0022 point 15) ; et deux relais
 *       concurrents ne posent jamais deux fois le même numéro ;
 *   (9) le corps est rendu octet pour octet — par la base, par l'envoi, par la relecture.
 *
 * Joué par Gate D (`ci.yml`), sur la base fraîchement migrée. Sans `DATABASE_URL`, ce fichier
 * ÉCHOUE — il ne se saute pas : un test qui s'efface faute de banc est un vert qui ne regarde rien.
 */
import { createHmac, randomBytes } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";
import fixtures from "../../../src/server/partners/contrat/fixtures.v1.json";
import {
  ecrireEvenementPartners,
  type FaitPartners,
} from "../../../src/server/partners-sync/outbox";
import {
  envoyerLigne,
  numeroterEnAttente,
  type ClientRelais,
} from "../../../src/server/partners-sync/relais";
import {
  repondreRelecture,
  type LecteurRelecture,
} from "../../../src/server/partners-sync/relecture";

const URL_BASE = process.env.DATABASE_URL;
if (!URL_BASE || URL_BASE.includes("stub.invalid")) {
  throw new Error(
    "[partners-sync] DATABASE_URL absente ou stub : ce test exige un vrai Postgres migré (Gate D).",
  );
}

const prisma = new PrismaClient();
const relais = prisma as unknown as ClientRelais;
const lecteur = prisma as unknown as LecteurRelecture;

type EvenementFixture = {
  event_type: string;
  occurred_at: string;
  subject_ref: Record<string, string>;
  payload: Record<string, unknown>;
};
const EVENEMENTS = fixtures.evenements as unknown as EvenementFixture[];

function fait(i: number, cle: string): FaitPartners {
  const e = EVENEMENTS[i % EVENEMENTS.length]!;
  return {
    type: e.event_type,
    cleDeFait: cle,
    occurredAt: new Date(e.occurred_at),
    sujet: e.subject_ref,
    payload: e.payload,
  };
}

const SECRET = randomBytes(32).toString("hex");
const SECRET_RELECTURE = randomBytes(32).toString("hex");

async function lignes() {
  return prisma.partnersSyncOutbox.findMany({ orderBy: { createdAt: "asc" } });
}

/** Ce qu'un lecteur de Partners voit : les lignes au-delà de son curseur, par séquence. */
async function lire(apres: bigint) {
  return prisma.partnersSyncOutbox.findMany({
    where: { sequence: { gt: apres } },
    orderBy: { sequence: "asc" },
  });
}

beforeAll(async () => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.PARTNERS_SYNC_SECRET = SECRET;
  process.env.PARTNERS_SYNC_URL = "https://partners.exemple.test/api/webhooks/axionia";
  process.env.PARTNERS_RELECTURE_SECRET = SECRET_RELECTURE;
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "it_partners_metier" (id TEXT PRIMARY KEY)',
  );
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "partners_sync_outbox", "it_partners_metier"');
});

afterAll(async () => {
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "it_partners_metier"');
  await prisma.$executeRawUnsafe('TRUNCATE "partners_sync_outbox"');
  await prisma.$disconnect();
});

describe("(7) TÉMOIN À DEUX FACES — la ligne suit le sort de la transaction métier", () => {
  it("annulée APRÈS l'écriture de l'événement : zéro ligne, et l'écriture métier disparaît aussi", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`INSERT INTO "it_partners_metier" (id) VALUES ('devis-1')`);
        const id = await ecrireEvenementPartners(tx, fait(2, "devis:1"));
        expect(id).not.toBeNull();
        throw new Error("retour arrière métier");
      }),
    ).rejects.toThrow("retour arrière métier");

    expect(await prisma.partnersSyncOutbox.count()).toBe(0);
    expect(
      await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        'SELECT count(*) AS n FROM "it_partners_metier"',
      ),
    ).toEqual([{ n: 0n }]);
  });

  it("validée : exactement une ligne — et rejouée, toujours une seule", async () => {
    for (let essai = 0; essai < 2; essai += 1) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "it_partners_metier" (id) VALUES ('devis-${essai}')`,
        );
        // Le MÊME fait, écrit deux fois dans la même transaction puis une troisième dans la
        // suivante : `ON CONFLICT DO NOTHING` n'avorte pas la transaction Postgres.
        await ecrireEvenementPartners(tx, fait(2, "devis:1"));
        await ecrireEvenementPartners(tx, fait(2, "devis:1"));
      });
    }
    expect(await prisma.partnersSyncOutbox.count()).toBe(1);
    expect(
      await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        'SELECT count(*) AS n FROM "it_partners_metier"',
      ),
    ).toEqual([{ n: 2n }]);
  });

  it("sans le drapeau, une transaction métier complète laisse ZÉRO ligne", async () => {
    delete process.env.PARTNERS_SYNC_ENABLED;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`INSERT INTO "it_partners_metier" (id) VALUES ('devis-x')`);
        expect(await ecrireEvenementPartners(tx, fait(2, "devis:x"))).toBeNull();
      });
      expect(await prisma.partnersSyncOutbox.count()).toBe(0);
      expect(await numeroterEnAttente(relais, new Date())).toBe(0);
    } finally {
      process.env.PARTNERS_SYNC_ENABLED = "true";
    }
  });
});

describe("(8) séquence d'ÉMISSION — globale, dense, sans ligne sautée", () => {
  it("deux transactions validées dans l'ORDRE INVERSE de leur création : aucune ligne sautée", async () => {
    let aEcrit!: () => void;
    const aAEcrit = new Promise<void>((r) => (aEcrit = r));
    let libererA!: () => void;
    const aPeutValider = new Promise<void>((r) => (libererA = r));

    // A est CRÉÉE la première… et validée la dernière.
    const transactionA = prisma.$transaction(
      async (tx) => {
        await ecrireEvenementPartners(tx, fait(0, "client:A"));
        aEcrit();
        await aPeutValider;
      },
      { timeout: 30_000 },
    );
    await aAEcrit;
    await new Promise((r) => setTimeout(r, 20));
    await prisma.$transaction(async (tx) => {
      await ecrireEvenementPartners(tx, fait(1, "client:B"));
    });

    // Le relais passe pendant que A est encore ouverte : il ne voit que B.
    expect(await numeroterEnAttente(relais, new Date())).toBe(1);
    const premiereLecture = await lire(0n);
    expect(premiereLecture.map((l) => l.sequence)).toEqual([1n]);
    const curseur = premiereLecture.at(-1)!.sequence!;

    libererA();
    await transactionA;
    expect(await numeroterEnAttente(relais, new Date())).toBe(1);
    const secondeLecture = await lire(curseur);

    // Le lecteur a tout vu, une fois chacun.
    const vus = [...premiereLecture, ...secondeLecture];
    expect(vus.map((l) => l.sequence)).toEqual([1n, 2n]);
    expect(new Set(vus.map((l) => l.id)).size).toBe(2);

    // CONTRE-TÉMOIN : le scénario est bien celui qui piège une numérotation à la création. A est
    // plus ancienne que B ; numérotée à l'insertion, elle aurait porté le plus PETIT numéro, et le
    // lecteur, déjà passé au numéro de B, ne l'aurait jamais relue.
    const [a, b] = await lignes();
    expect(a!.createdAt.getTime()).toBeLessThan(b!.createdAt.getTime());
    expect(a!.sequence).toBe(2n);
    expect(b!.sequence).toBe(1n);
  });

  it("deux relais concurrents : chaque ligne un numéro, aucun numéro deux fois, aucun trou", async () => {
    for (let i = 0; i < 40; i += 1) {
      await prisma.$transaction(async (tx) => {
        await ecrireEvenementPartners(tx, fait(i, `lot:${i}`));
      });
    }
    const [x, y] = await Promise.all([
      numeroterEnAttente(relais, new Date()),
      numeroterEnAttente(relais, new Date()),
    ]);
    expect(x + y).toBe(40);
    const seqs = (await lire(0n)).map((l) => Number(l.sequence));
    expect(seqs).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });
});

describe("(9) le corps est TEXTE, relu octet pour octet", () => {
  it("la base, l'envoi et la relecture rendent le même octet ; jsonb, lui, l'aurait réordonné", async () => {
    await prisma.$transaction(async (tx) => {
      await ecrireEvenementPartners(tx, fait(3, "facture:1"));
    });
    await numeroterEnAttente(relais, new Date("2026-09-26T12:00:00.000Z"));

    const lues = await prisma.$queryRawUnsafe<{ corps: string; sequence: bigint; id: string }[]>(
      'SELECT corps, sequence, id::text AS id FROM "partners_sync_outbox"',
    );
    expect(lues).toHaveLength(1);
    const { corps, sequence, id } = lues[0]!;
    expect(sequence).toBe(1n);

    // L'ENVOI transmet ce texte, et le signe tel quel.
    const fetch = vi.fn(async (_u: string, _i: RequestInit) => new Response("{}", { status: 200 }));
    expect(await envoyerLigne(id, { prisma: relais, fetch, alerter: vi.fn() })).toBe("sent");
    const init = fetch.mock.calls[0]![1];
    expect(init.body).toBe(corps);
    const t = new Headers(init.headers).get("x-axionia-timestamp");
    expect(new Headers(init.headers).get("x-axionia-signature")).toBe(
      createHmac("sha256", SECRET).update(`${t}.${corps}`).digest("hex"),
    );

    // La RELECTURE le rend aussi, octet pour octet.
    const cible = "/api/partners/evenements?after_sequence=0";
    const ts = String(Math.floor(Date.now() / 1000));
    const r = await repondreRelecture(
      new Request(`https://axion-ia.com${cible}`, {
        headers: {
          "x-partners-timestamp": ts,
          "x-partners-signature": createHmac("sha256", SECRET_RELECTURE)
            .update(`${ts}.${cible}`)
            .digest("hex"),
        },
      }),
      { prisma: lecteur },
    );
    expect(r.status).toBe(200);
    expect(Buffer.from(await r.arrayBuffer()).equals(Buffer.from(corps, "utf8"))).toBe(true);

    // CONTRE-TÉMOIN : la même valeur passée par jsonb ne revient pas à l'identique.
    const [{ viaJsonb } = { viaJsonb: "" }] = await prisma.$queryRawUnsafe<{ viaJsonb: string }[]>(
      'SELECT corps::jsonb::text AS "viaJsonb" FROM "partners_sync_outbox"',
    );
    expect(viaJsonb).not.toBe(corps);
    expect(JSON.parse(viaJsonb)).toEqual(JSON.parse(corps));
  });
});
