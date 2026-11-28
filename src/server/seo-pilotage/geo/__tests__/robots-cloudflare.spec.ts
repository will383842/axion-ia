import { describe, expect, it, vi } from "vitest";

import {
  collecterRobotsCloudflare,
  enregistrerRobotsJours,
  REQUETE_ROBOTS_CLOUDFLARE,
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
  const gptbot = (date: string, count = 5) => ({
    count,
    dimensions: { date, userAgent: "Mozilla/5.0 GPTBot/1.2", clientRequestPath: "/fr/blog/a" },
  });

  it("une requête par jour (jeton en en-tête, zone, jour), agrège sans user-agent brut", async () => {
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      const { jour } = JSON.parse(String(init.body)).variables;
      return reponseGraphql([
        gptbot(jour),
        {
          count: 9,
          dimensions: { date: jour, userAgent: "Mozilla Chrome", clientRequestPath: "/fr" },
        },
      ]);
    });
    const r = await collecterRobotsCloudflare({
      env: ENV_OK,
      fetchFn: f as never,
      maintenant: NOW,
    });
    expect(f).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({
      statut: "ok",
      jours: ["2026-11-25", "2026-11-26", "2026-11-27"],
      incomplets: 0,
    });
    if (r.statut === "ok") expect(r.lignes).toHaveLength(3);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/graphql");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer jeton-test");
    expect(JSON.parse(String(init.body)).variables).toEqual({
      zone: "zone-test",
      jour: "2026-11-25",
    });
    expect(JSON.stringify(r)).not.toMatch(/Mozilla/);
  });

  it("fige les types de variables de la requête (zoneTag = string, jour = Date)", () => {
    expect(REQUETE_ROBOTS_CLOUDFLARE).toContain("query($zone:string,$jour:Date)");
    expect(REQUETE_ROBOTS_CLOUDFLARE).toContain("zoneTag:$zone");
    expect(REQUETE_ROBOTS_CLOUDFLARE).toContain("httpRequestsAdaptiveGroups");
  });

  it("un jour tronqué (10 000 lignes) ou vide n'est pas à remplacer", async () => {
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      const { jour } = JSON.parse(String(init.body)).variables;
      if (jour === "2026-11-25")
        return reponseGraphql(Array.from({ length: 10_000 }, () => gptbot(jour)));
      if (jour === "2026-11-26") return reponseGraphql([]);
      return reponseGraphql([gptbot(jour)]);
    });
    const r = await collecterRobotsCloudflare({
      env: ENV_OK,
      fetchFn: f as never,
      maintenant: NOW,
    });
    expect(r).toMatchObject({ statut: "ok", jours: ["2026-11-27"], incomplets: 1 });
  });

  it("ignore une date hors du jour demandé ; une zone vide donne « indisponible »", async () => {
    const f = vi.fn(async () => reponseGraphql([gptbot("2020-01-01")]));
    const r = await collecterRobotsCloudflare({
      env: ENV_OK,
      fetchFn: f as never,
      maintenant: NOW,
    });
    expect(r).toMatchObject({ statut: "ok", jours: [] });
    const vide = vi.fn(
      async () => new Response(JSON.stringify({ data: { viewer: { zones: [] } } })),
    );
    const r2 = await collecterRobotsCloudflare({
      env: ENV_OK,
      fetchFn: vide as never,
      maintenant: NOW,
    });
    expect(r2.statut).toBe("indisponible");
  });
});

describe("enregistrement : jour remplacé en une transaction, rejouable", () => {
  it("supprime chaque jour demandé PUIS insère, avec les bonnes dates et les bons champs", async () => {
    const appels: Array<[string, unknown]> = [];
    const tx = {
      robotIaJour: {
        deleteMany: vi.fn(async (a: unknown) => void appels.push(["del", a])),
        createMany: vi.fn(async (a: unknown) => void appels.push(["add", a])),
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
    expect(appels.map((a) => a[0])).toEqual(["del", "del", "add"]);
    expect(appels[0]?.[1]).toEqual({ where: { date: new Date("2026-11-26T00:00:00Z") } });
    expect(appels[1]?.[1]).toEqual({ where: { date: new Date("2026-11-27T00:00:00Z") } });
    expect(appels[2]?.[1]).toEqual({
      data: [
        {
          date: new Date("2026-11-26T00:00:00Z"),
          robot: "gptbot",
          famille: "entrainement",
          familleChemin: "article",
          nombre: 5,
        },
      ],
    });
  });

  it("aucun jour à remplacer : aucune transaction", async () => {
    const prisma = { $transaction: vi.fn() };
    await enregistrerRobotsJours(prisma as never, [], []);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("tâche robots-ia", () => {
  it("sans jeton : saute (état normal), n'écrit rien ; raison fixe remontée", async () => {
    const prisma = { $transaction: vi.fn(), robotIaJour: { deleteMany: vi.fn() } };
    const r = await tacheRobotsIa({ prisma: prisma as never, env: {}, maintenant: NOW });
    expect(r).toMatchObject({ tache: "robots-ia", issue: "saute", anormal: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refus 403 : saut ANORMAL avec la raison", async () => {
    const prisma = { $transaction: vi.fn(), robotIaJour: { deleteMany: vi.fn() } };
    const f = vi.fn(async () => new Response("x", { status: 403 }));
    const r = await tacheRobotsIa({
      prisma: prisma as never,
      env: ENV_OK,
      fetchFn: f as never,
      maintenant: NOW,
    });
    expect(r).toMatchObject({ issue: "saute", anormal: true });
    expect(JSON.stringify(r)).toContain("Analytics:Read");
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
    const arg = prisma.robotIaJour.deleteMany.mock.calls[0] as unknown as [
      { where: { date: { lt: Date } } },
    ];
    expect(arg[0].where.date.lt.toISOString().slice(0, 10)).toBe("2025-10-24");
  });
});
