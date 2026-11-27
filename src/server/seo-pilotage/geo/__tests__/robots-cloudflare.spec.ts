import { describe, expect, it, vi } from "vitest";

import {
  collecterRobotsCloudflare,
  enregistrerRobotsJours,
  fenetreJours,
  tacheRobotsIa,
} from "../robots-cloudflare";

const ENV_OK = { CLOUDFLARE_API_TOKEN: "jeton-test", CLOUDFLARE_ZONE_ID: "zone-test" };
const NOW = () => new Date("2026-11-28T06:00:00Z");

function reponseGraphql(groupes: unknown[], erreurs?: unknown[]) {
  return new Response(
    JSON.stringify({
      data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: groupes }] } },
      ...(erreurs ? { errors: erreurs } : {}),
    }),
    { status: 200 },
  );
}

describe("fenêtre de collecte", () => {
  it("trois jours finis, le plus ancien d'abord, jamais le jour en cours (UTC)", () => {
    expect(fenetreJours(NOW())).toEqual(["2026-11-25", "2026-11-26", "2026-11-27"]);
  });
});

describe("collecte Cloudflare : « indisponible » sans jeton ou avec le stub", () => {
  it("sans jeton ou sans zone : aucun appel réseau", async () => {
    const f = vi.fn();
    for (const env of [{}, { CLOUDFLARE_API_TOKEN: "x" }, { CLOUDFLARE_ZONE_ID: "z" }]) {
      const r = await collecterRobotsCloudflare({ env, fetchFn: f as never, maintenant: NOW });
      expect(r.statut).toBe("indisponible");
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("build stub : aucun appel réseau", async () => {
    const f = vi.fn();
    const r = await collecterRobotsCloudflare({
      env: { ...ENV_OK, DATABASE_URL: "postgresql://s:s@stub.invalid:5432/s" },
      fetchFn: f as never,
      maintenant: NOW,
    });
    expect(r.statut).toBe("indisponible");
    expect(f).not.toHaveBeenCalled();
  });

  it("403, erreur GraphQL, réseau en panne : « indisponible », jamais d'exception ni d'écho du corps", async () => {
    for (const rep of [
      () => Promise.resolve(new Response("secret-corps", { status: 403 })),
      () => Promise.resolve(reponseGraphql([], [{ message: "not authorized secret" }])),
      () => Promise.reject(new Error("réseau secret")),
    ]) {
      const r = await collecterRobotsCloudflare({
        env: ENV_OK,
        fetchFn: rep as never,
        maintenant: NOW,
      });
      expect(r.statut).toBe("indisponible");
      expect(JSON.stringify(r)).not.toMatch(/secret/);
    }
  });
});

describe("collecte Cloudflare : agrégat", () => {
  it("envoie la bonne requête (jeton en en-tête, zone, plage) et agrège sans user-agent brut", async () => {
    const f = vi.fn(async () =>
      reponseGraphql([
        {
          count: 5,
          dimensions: {
            date: "2026-11-26",
            userAgent: "Mozilla/5.0 GPTBot/1.2",
            clientRequestPath: "/fr/blog/a",
          },
        },
        {
          count: 9,
          dimensions: { date: "2026-11-26", userAgent: "Mozilla Chrome", clientRequestPath: "/fr" },
        },
      ]),
    );
    const r = await collecterRobotsCloudflare({
      env: ENV_OK,
      fetchFn: f as never,
      maintenant: NOW,
    });
    expect(r).toEqual({
      statut: "ok",
      jours: ["2026-11-25", "2026-11-26", "2026-11-27"],
      lignes: [
        {
          date: "2026-11-26",
          robot: "gptbot",
          famille: "entrainement",
          familleChemin: "article",
          nombre: 5,
        },
      ],
    });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/graphql");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer jeton-test");
    const corps = JSON.parse(String(init.body));
    expect(corps.variables).toMatchObject({
      zone: "zone-test",
      debut: "2026-11-25",
      fin: "2026-11-27",
    });
    expect(corps.query).toContain("httpRequestsAdaptiveGroups");
    expect(JSON.stringify(r)).not.toMatch(/Mozilla/);
  });
});

describe("enregistrement : jour remplacé en une transaction, rejouable", () => {
  it("remplace chaque jour de la fenêtre puis insère les lignes", async () => {
    const appels: string[] = [];
    const tx = {
      robotIaJour: {
        deleteMany: vi.fn(async (a: unknown) => appels.push(`del:${JSON.stringify(a)}`)),
        createMany: vi.fn(async (a: { data: unknown[] }) => appels.push(`add:${a.data.length}`)),
      },
    };
    const prisma = { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    await enregistrerRobotsJours(
      prisma as never,
      ["2026-11-26", "2026-11-27"],
      [
        {
          date: "2026-11-26",
          robot: "gptbot",
          famille: "entrainement",
          familleChemin: "article",
          nombre: 5,
        },
      ],
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.robotIaJour.deleteMany).toHaveBeenCalledTimes(2);
    expect(appels.at(-1)).toBe("add:1");
  });
});

describe("tâche robots-ia", () => {
  it("indisponible : saute, n'écrit rien", async () => {
    const prisma = { $transaction: vi.fn(), robotIaJour: { deleteMany: vi.fn() } };
    const r = await tacheRobotsIa({ prisma: prisma as never, env: {}, maintenant: NOW });
    expect(r).toEqual({ tache: "robots-ia", issue: "saute", motif: "indisponible" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("disponible : écrit, puis ménage au-delà de 400 jours", async () => {
    const tx = { robotIaJour: { deleteMany: vi.fn(), createMany: vi.fn() } };
    const prisma = {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      robotIaJour: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    };
    const f = vi.fn(async () => reponseGraphql([]));
    const r = await tacheRobotsIa({
      prisma: prisma as never,
      env: ENV_OK,
      fetchFn: f as never,
      maintenant: NOW,
    });
    expect(r).toMatchObject({ tache: "robots-ia", issue: "fait", lignes: 0 });
    expect(prisma.$transaction).toHaveBeenCalled();
    const arg = prisma.robotIaJour.deleteMany.mock.calls[0] as unknown as [
      { where: { date: { lt: Date } } },
    ];
    expect(arg[0].where.date.lt.toISOString().slice(0, 10)).toBe("2025-10-24");
  });
});
