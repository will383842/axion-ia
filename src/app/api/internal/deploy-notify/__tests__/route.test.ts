// Route de notification de déploiement (2026-07-29).
//
// Elle porte un secret partagé et déclenche une alerte : les deux angles à
// couvrir sont donc l'AUTHENTIFICATION (personne ne doit pouvoir faire sonner
// Telegram depuis l'extérieur) et la FIDÉLITÉ du signal (un échec de build ne
// doit jamais être annoncé comme un succès).

import { describe, it, expect, vi, beforeEach } from "vitest";

const notifyMock = vi.fn();
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notifyMock(...a) }));

const rateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => rateLimitMock(...a),
}));

import { POST } from "../route";

const SECRET = "secret-de-test-suffisamment-long";

function req(body: unknown, opts: { secret?: string | null } = {}): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const s = opts.secret === undefined ? SECRET : opts.secret;
  if (s !== null) headers["X-Revalidate-Secret"] = s;
  return new Request("https://axion-ia.com/api/internal/deploy-notify", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const OK_BODY = {
  success: true,
  sha: "abc12345",
  branch: "main",
  actor: "will383842",
  subject: "feat: quelque chose",
  buildResult: "success",
  deployResult: "success",
  runUrl: "https://github.com/will383842/axion-ia/actions/runs/1",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REVALIDATE_SECRET = SECRET;
  rateLimitMock.mockResolvedValue({ allowed: true });
  notifyMock.mockResolvedValue({ ok: true, channels: {} });
});

describe("POST /api/internal/deploy-notify — authentification", () => {
  it("503 si le secret n'est pas configuré côté serveur (anti-bypass public)", async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await POST(req(OK_BODY) as never);
    expect(res.status).toBe(503);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("401 sans en-tête, et sans jamais notifier", async () => {
    const res = await POST(req(OK_BODY, { secret: null }) as never);
    expect(res.status).toBe(401);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("401 avec un mauvais secret", async () => {
    const res = await POST(req(OK_BODY, { secret: "mauvais" }) as never);
    expect(res.status).toBe(401);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("429 quand le rate-limit refuse — avant toute notification", async () => {
    rateLimitMock.mockResolvedValueOnce({ allowed: false });
    const res = await POST(req(OK_BODY) as never);
    expect(res.status).toBe(429);
    expect(notifyMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/deploy-notify — fidélité du signal", () => {
  it("succès → DEPLOY_SUCCESS, avec le contexte utile", async () => {
    const res = await POST(req(OK_BODY) as never);
    expect(res.status).toBe(200);
    const call = notifyMock.mock.calls[0]?.[0] as {
      category: string;
      payload: Record<string, unknown>;
      dedupKey: string;
    };
    expect(call.category).toBe("DEPLOY_SUCCESS");
    expect(call.payload).toMatchObject({
      sha: "abc12345",
      branch: "main",
      actor: "will383842",
      subject: "feat: quelque chose",
    });
    // Pas d'`error` sur un succès — sinon le message inquiète pour rien.
    expect(call.payload).not.toHaveProperty("error");
  });

  it("échec → DEPLOY_FAILED, en disant LEQUEL des deux jobs a lâché", async () => {
    await POST(
      req({ ...OK_BODY, success: false, buildResult: "success", deployResult: "failure" }) as never,
    );
    const call = notifyMock.mock.calls[0]?.[0] as {
      category: string;
      payload: { error?: string };
    };
    expect(call.category).toBe("DEPLOY_FAILED");
    // build ≠ deploy : l'info oriente immédiatement le diagnostic.
    expect(call.payload.error).toContain("build=success");
    expect(call.payload.error).toContain("deploy=failure");
  });

  // Un workflow relancé sur le même commit ne doit pas re-sonner.
  it("déduplique par SHA et par sens du résultat", async () => {
    await POST(req(OK_BODY) as never);
    await POST(req({ ...OK_BODY, success: false }) as never);
    const keys = notifyMock.mock.calls.map((c) => (c[0] as { dedupKey: string }).dedupKey);
    expect(keys[0]).toBe("deploy-ok-abc12345");
    expect(keys[1]).toBe("deploy-ko-abc12345");
  });

  it("400 sur JSON illisible ou payload invalide", async () => {
    expect((await POST(req("pas-du-json{{") as never)).status).toBe(400);
    expect((await POST(req({ success: "oui" }) as never)).status).toBe(400);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("tolère un payload minimal (seul `success` est requis)", async () => {
    const res = await POST(req({ success: true }) as never);
    expect(res.status).toBe(200);
    const call = notifyMock.mock.calls[0]?.[0] as { payload: { sha: string } };
    expect(call.payload.sha).toBe("inconnu");
  });
});
