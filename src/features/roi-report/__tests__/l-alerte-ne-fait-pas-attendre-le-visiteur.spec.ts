/**
 * Relecture PR 1553 — l'alerte Telegram ne fait plus attendre le visiteur.
 *
 * 🔴 Les sévérités info/warn partent en synchrone. Avec les relances du salon
 * « Clients » (429 attendu jusqu'à 5 s, supergroupe migré, plusieurs morceaux,
 * repli), un `await notify(...)` dans une Server Action pouvait figer le bouton
 * « Envoyer » une vingtaine de secondes.
 *
 * 🔑 Ici, Telegram NE RÉPOND JAMAIS (`fetch` pendant), et l'action rend quand
 * même la main : l'envoi est confié à `after()`, qui l'exécute après la
 * réponse. Le second cas prouve qu'aucune alerte n'est perdue quand `after`
 * refuse (hors requête) : elle part quand même, détachée.
 *
 * Mutation qui fait rougir : remettre `await notify(...)` dans
 * `attachRoiCallbackAction` → le premier test expire sur la course à 500 ms.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apres = vi.fn<(cb: () => unknown) => void>();
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (cb: () => unknown) => apres(cb),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn(async () => undefined) }));
vi.mock("@/server/notifications/dedup", () => ({
  isDuplicate: async () => false,
  libererDedup: async () => undefined,
}));
vi.mock("@/server/notifications/rate-limit", () => ({ checkCategoryRateLimit: async () => true }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const ID = "0b0f7a6e-2c41-4c8e-9a3e-5d6f7a8b9c0d";
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findUnique: async () => ({
        id: ID,
        contactPhone: null,
        companyName: "Exemple SAS",
        contactEmail: "jeanne.dupont@exemple.fr",
        contactName: "Jeanne Dupont",
        locale: "fr",
      }),
      update: async () => ({}),
    },
  },
}));

import { attachRoiCallbackAction } from "../actions";

const TELEPHONE = "+33 6 39 98 12 34";

/** Un `fetch` Telegram qui ne répond pas tant qu'on ne le libère pas. */
let liberer: () => void = () => {};
const fetchTelegram = vi.fn(
  () =>
    new Promise<Response>((resolve) => {
      liberer = () => resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }),
);

function formulaire(): FormData {
  const fd = new FormData();
  fd.set("submissionId", ID);
  fd.set("telephone", TELEPHONE);
  return fd;
}

beforeEach(() => {
  apres.mockReset();
  fetchTelegram.mockClear();
  vi.stubGlobal("fetch", fetchTelegram);
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
  vi.stubEnv("TELEGRAM_CHAT_ID_CLIENTS", "-100777");
  vi.stubEnv("CALLMEBOT_API_KEY", "");
});

afterEach(() => {
  liberer();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Server Action : l'alerte part APRÈS la réponse", () => {
  it("🔴 rend la main alors que Telegram ne répond jamais, et l'alerte part ensuite", async () => {
    const delai = new Promise<"bloquée">((r) => setTimeout(() => r("bloquée"), 500));
    const issue = await Promise.race([
      attachRoiCallbackAction({ ok: false, error: "" }, formulaire()),
      delai,
    ]);

    expect(issue, "la réponse au visiteur n'attend pas Telegram").toEqual({ ok: true });
    expect(apres, "l'envoi est confié à after()").toHaveBeenCalledOnce();
    expect(fetchTelegram, "rien n'est parti AVANT la réponse").not.toHaveBeenCalled();

    // La réponse est partie : Next exécute le rappel. Telegram reçoit alors
    // l'alerte complète du salon « Clients ».
    const envoi = apres.mock.calls[0]![0]();
    await vi.waitFor(() => expect(fetchTelegram).toHaveBeenCalled());
    const [url, init] = fetchTelegram.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/bot123:abc/sendMessage");
    const corps = JSON.parse(String(init.body)) as { chat_id: string; text: string };
    expect(corps.chat_id).toBe("-100777");
    expect(corps.text).toContain(TELEPHONE);

    liberer();
    await envoi;
  });

  it("aucune alerte perdue : hors requête (after refuse), elle part quand même", async () => {
    apres.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });
    const issue = await attachRoiCallbackAction({ ok: false, error: "" }, formulaire());

    expect(issue).toEqual({ ok: true });
    await vi.waitFor(() => expect(fetchTelegram).toHaveBeenCalled());
    liberer();
  });
});
