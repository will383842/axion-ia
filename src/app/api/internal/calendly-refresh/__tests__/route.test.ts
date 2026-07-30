// Rafraîchissement automatique des réservations Calendly (2026-07-30).
//
// Ce que ces tests protègent, et pourquoi :
//
//   • L'AUTHENTIFICATION — la route déclenche des appels API sortants et des
//     alertes Telegram ; elle ne doit pas être actionnable de l'extérieur.
//   • LA SÉLECTION des candidats — c'est là que se joue l'utilité réelle. Un
//     filtre trop large martèle Calendly ; trop étroit, il rate l'annulation
//     qu'on voulait voir. Les critères sont donc verrouillés explicitement.
//   • L'ABSENCE DE TRONCATURE MUETTE — dépasser le plafond doit se dire.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: (...a: unknown[]) => findManyMock(...a) } },
}));

const enrichMock = vi.fn();
vi.mock("@/server/calendly/enrich", () => ({
  enrichCalendlyEvent: (...a: unknown[]) => enrichMock(...a),
}));

const apiConfiguredMock = vi.fn();
vi.mock("@/server/calendly/api", () => ({
  isCalendlyApiConfigured: () => apiConfiguredMock(),
}));

const rateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => rateLimitMock(...a) }));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));

import { POST } from "../route";

const SECRET = "secret-de-test-suffisamment-long";

function req(opts: { secret?: string | null } = {}): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const s = opts.secret === undefined ? SECRET : opts.secret;
  if (s !== null) headers["X-Revalidate-Secret"] = s;
  return new Request("https://axion-ia.com/api/internal/calendly-refresh", {
    method: "POST",
    headers,
    body: "{}",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REVALIDATE_SECRET = SECRET;
  rateLimitMock.mockResolvedValue({ allowed: true });
  apiConfiguredMock.mockReturnValue(true);
  findManyMock.mockResolvedValue([]);
  enrichMock.mockResolvedValue({ ok: true, updatedFields: [] });
});

describe("authentification", () => {
  it("503 si le secret n'est pas configuré côté serveur", async () => {
    delete process.env.REVALIDATE_SECRET;
    expect((await POST(req() as never)).status).toBe(503);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("401 sans en-tête ou avec un mauvais secret — sans rien interroger", async () => {
    expect((await POST(req({ secret: null }) as never)).status).toBe(401);
    expect((await POST(req({ secret: "mauvais" }) as never)).status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(enrichMock).not.toHaveBeenCalled();
  });

  it("429 quand le rate-limit refuse", async () => {
    rateLimitMock.mockResolvedValueOnce({ allowed: false });
    expect((await POST(req() as never)).status).toBe(429);
  });
});

describe("sélection des réservations à revoir", () => {
  it("ne retient que ce qui peut ENCORE changer", async () => {
    await POST(req() as never);
    const arg = findManyMock.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      take: number;
      orderBy: unknown;
    };
    // Un rendez-vous déjà annulé ou terminé est figé : inutile de le redemander.
    expect(arg.where["status"]).toBe("scheduled");
    // Sans URI, il n'y a rien à demander à Calendly.
    expect(arg.where["inviteeUri"]).toEqual({ not: null });
    // À venir OU sans horaire connu — ce second cas est précisément la capture
    // jamais enrichie qu'on veut rattraper.
    const or = arg.where["OR"] as Array<Record<string, unknown>>;
    expect(or).toHaveLength(2);
    expect(or[0]).toEqual({ startTime: null });
    expect(or[1]).toHaveProperty("startTime");
    // Les plus proches d'abord : c'est là que l'information vaut le plus.
    expect(arg.orderBy).toEqual([{ startTime: "asc" }, { capturedAt: "desc" }]);
  });

  it("sans jeton API : ne lit même pas la base, et ne fait pas rougir le cron", async () => {
    apiConfiguredMock.mockReturnValueOnce(false);
    const res = await POST(req() as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: "calendly_api_not_configured" });
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe("exécution", () => {
  it("distingue ce qui a changé de ce qui n'a pas bougé", async () => {
    findManyMock.mockResolvedValueOnce([
      { id: "a", startTime: null },
      { id: "b", startTime: null },
      { id: "c", startTime: null },
    ]);
    enrichMock
      .mockResolvedValueOnce({ ok: true, updatedFields: ["status"] })
      .mockResolvedValueOnce({ ok: true, updatedFields: [] })
      .mockResolvedValueOnce({ ok: false, reason: "forbidden" });

    const body = (await (await POST(req() as never)).json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      ok: true,
      examined: 3,
      updated: 1,
      unchanged: 1,
      failures: { forbidden: 1 },
    });
  });

  it("un échec sur une réservation n'interrompt pas les suivantes", async () => {
    findManyMock.mockResolvedValueOnce([
      { id: "a", startTime: null },
      { id: "b", startTime: null },
    ]);
    enrichMock
      .mockResolvedValueOnce({ ok: false, reason: "network_error" })
      .mockResolvedValueOnce({ ok: true, updatedFields: ["status"] });
    const body = (await (await POST(req() as never)).json()) as { examined: number };
    expect(body.examined).toBe(2);
    expect(enrichMock).toHaveBeenCalledTimes(2);
  });

  // Une troncature muette ferait croire à une couverture complète.
  it("signale explicitement le plafond atteint", async () => {
    findManyMock.mockResolvedValueOnce(
      Array.from({ length: 26 }, (_, i) => ({ id: `e${i}`, startTime: null })),
    );
    const body = (await (await POST(req() as never)).json()) as Record<string, unknown>;
    expect(body["examined"]).toBe(25);
    expect(body["remaining"]).toBeDefined();
    expect(enrichMock).toHaveBeenCalledTimes(25);
  });

  it("rien à faire → réponse propre, aucun appel à Calendly", async () => {
    const body = (await (await POST(req() as never)).json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, examined: 0, updated: 0 });
    expect(enrichMock).not.toHaveBeenCalled();
  });

  it("une base injoignable renvoie 500 sans planter", async () => {
    findManyMock.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(req() as never);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "db_read_failed" });
  });
});
