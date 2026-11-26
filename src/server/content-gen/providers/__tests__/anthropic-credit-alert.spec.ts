/** Alertes par clé Anthropic : une fois par jour (épuisée), critique (refusée), index seul. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const notify = vi.fn();
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));
vi.mock("@/lib/redis", async () => {
  const { creerFauxRedis } = await import("./faux-redis-cles");
  return { redis: creerFauxRedis() };
});

import { redis as redisImporte } from "@/lib/redis";
import { alerterCleAnthropic, __resetAlerteCleAnthropicMemoire } from "../anthropic-credit-alert";
import type { FauxRedis } from "./faux-redis-cles";

const redis = redisImporte as unknown as FauxRedis;

beforeEach(() => {
  notify.mockReset();
  notify.mockResolvedValue({ ok: true });
  redis.vider();
  __resetAlerteCleAnthropicMemoire();
});

describe("alerterCleAnthropic", () => {
  it("« clé N épuisée » : une seule alerte par jour et par clé (même après redémarrage)", async () => {
    expect(await alerterCleAnthropic(1, "epuisee")).toBe(true);
    expect(await alerterCleAnthropic(1, "epuisee")).toBe(false);
    __resetAlerteCleAnthropicMemoire(); // autre processus : Redis NX retient
    expect(await alerterCleAnthropic(1, "epuisee")).toBe(false);
    expect(await alerterCleAnthropic(2, "epuisee")).toBe(true);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(redis.ttls.get("anthropic:cle:1:alerte-epuisee")).toBe(24 * 3600);
    expect(JSON.stringify(notify.mock.calls[0])).toContain("Clé Anthropic 1 épuisée");
  });

  it("clé refusée (401/403) : sévérité critique", async () => {
    await alerterCleAnthropic(3, "invalide");
    expect((notify.mock.calls[0]![0] as { severity: string }).severity).toBe("critical");
  });

  it("Redis en panne : la mémoire de processus suffit pour ne pas répéter", async () => {
    redis.panne = true;
    expect(await alerterCleAnthropic(1, "epuisee")).toBe(true);
    expect(await alerterCleAnthropic(1, "epuisee")).toBe(false);
  });

  it("échec d'envoi : libère la marque, ne lève jamais", async () => {
    notify.mockResolvedValue({ ok: false });
    await expect(alerterCleAnthropic(1, "epuisee")).resolves.toBe(false);
    notify.mockRejectedValue(new Error("boom"));
    await expect(alerterCleAnthropic(2, "epuisee")).resolves.toBe(false);
  });

  it("index inattendu refusé (jamais autre chose que 1, 2, 3)", async () => {
    expect(await alerterCleAnthropic(7, "epuisee")).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
});
