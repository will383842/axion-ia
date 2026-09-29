/**
 * La COPIE des e-mails envoyés est purgée à 12 mois ; la ligne du journal
 * qu'elle illustre, elle, reste (preuve d'envoi, 5 ans) — 2026-09-27.
 *
 * Par l'EFFET : la table des copies est une base en mémoire, les autres
 * tables du worker de purge sont des doublures muettes. On lance la vraie
 * passe de purge et on regarde ce qui RESTE.
 *
 * Témoins : une copie de 11 mois SURVIT (sinon « tout supprimer » passerait),
 * et une surcharge d'environnement invalide (`0`) ne vide pas la table — la
 * garde anti-misconfig de `readMonths` s'applique aussi ici.
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
        get(_c, modele: string) {
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

describe("🔴 purge de rétention — la copie des e-mails vit 12 mois", () => {
  it("les copies de plus de 12 mois disparaissent, les plus récentes restent", async () => {
    await executerPurgeRetention();
    expect(copies.lignes.map((l) => l["emailLogId"])).toEqual(["recente", "du-jour"]);
  });

  it("une surcharge d'environnement invalide ne vide pas la table (garde anti-misconfig)", async () => {
    process.env["RETENTION_EMAIL_CONTENTS_MONTHS"] = "0";
    await executerPurgeRetention();
    expect(copies.lignes.map((l) => l["emailLogId"])).toEqual(["recente", "du-jour"]);
  });

  it("une surcharge valide est lue (24 mois : les quatre copies restent)", async () => {
    process.env["RETENTION_EMAIL_CONTENTS_MONTHS"] = "24";
    await executerPurgeRetention();
    expect(copies.lignes).toHaveLength(4);
  });
});
