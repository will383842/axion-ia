/**
 * La COPIE des e-mails envoyés n'est PLUS purgée (2026-10-07, Will : « coupe
 * tous les effacements »). Elle était supprimée à 12 mois depuis le 2026-09-27.
 *
 * Par l'EFFET : la table des copies est une base en mémoire, les autres
 * tables du worker de purge sont des doublures muettes. On lance la vraie
 * passe de purge et on regarde ce qui RESTE : tout, y compris une copie de
 * 13 mois, et quelle que soit la variable d'environnement d'autrefois.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { table, type Table } from "@/server/newsletter/__tests__/base-en-memoire";

const etat = vi.hoisted(() => ({ copies: null as unknown }));

function muette() {
  return {
    deleteMany: vi.fn(async () => ({ count: 0 })),
    findMany: vi.fn(async () => []),
    delete: vi.fn(async () => ({})),
    count: vi.fn(async () => 0),
  };
}

vi.mock("@/lib/prisma", () => {
  const cache = new Map<string, ReturnType<typeof muette>>();
  return {
    prisma: new Proxy(
      {},
      {
        get(_c, modele: string, recepteur: unknown) {
          // 2026-09-29 (chantier visio, PR 4) — la purge des 36 mois de
          // `calendly_events` passe par une transaction (elle fige d'abord les
          // rencontres du dossier client) : la transaction rejoue ce même proxy.
          if (modele === "$transaction") {
            return (fn: (tx: unknown) => unknown) => fn(recepteur);
          }
          if (modele === "emailLogContent") return etat.copies;
          if (!cache.has(modele)) cache.set(modele, muette());
          return cache.get(modele);
        },
      },
    ),
  };
});
vi.mock("@/server/careers/cv-storage", () => ({ deleteCv: vi.fn(async () => undefined) }));
vi.mock("bullmq", () => ({ Worker: class {} }));
vi.mock("../connection", () => ({ getBullConnectionOrThrow: () => ({}) }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/newsletter/retention", () => ({ purgerOutboxCrm: vi.fn(async () => 0) }));

import { executerPurgeRetention } from "../retention-purge-worker";

const ilYa = (mois: number): Date => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - mois);
  return d;
};

let copies: Table;

beforeEach(() => {
  delete process.env["RETENTION_EMAIL_CONTENTS_MONTHS"];
  copies = table([
    { emailLogId: "vieille", createdAt: ilYa(13), html: "<p>Camille</p>" },
    {
      emailLogId: "limite",
      createdAt: new Date(ilYa(12).getTime() - 86_400_000),
      html: "<p>Dominique</p>",
    },
    { emailLogId: "recente", createdAt: ilYa(11), html: "<p>Alex</p>" },
    { emailLogId: "du-jour", createdAt: new Date(), html: "<p>Sam</p>" },
  ]);
  etat.copies = copies;
});

describe("🛑 purge de rétention — la copie des e-mails n'est plus supprimée", () => {
  it("toutes les copies restent, même celles de plus de 12 mois", async () => {
    await executerPurgeRetention();
    expect(copies.lignes.map((l) => l["emailLogId"])).toEqual([
      "vieille",
      "limite",
      "recente",
      "du-jour",
    ]);
  });

  it("l'ancienne variable d'environnement ne réarme rien", async () => {
    process.env["RETENTION_EMAIL_CONTENTS_MONTHS"] = "1";
    await executerPurgeRetention();
    expect(copies.lignes).toHaveLength(4);
    delete process.env["RETENTION_EMAIL_CONTENTS_MONTHS"];
  });
});
