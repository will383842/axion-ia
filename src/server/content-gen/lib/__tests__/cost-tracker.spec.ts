/**
 * Régression Fix 2026-08-15 (audit e2e, F1 + F2 + F6) — cost-tracker.
 *
 * Deux bugs BLOQUANTS verrouillés ici :
 *
 *  F2 — le kill switch auto du cost-cap ne pouvait JAMAIS se déclencher pour le
 *  texte : la décision comptait les `ProviderConfig` role=text enabled EN BASE
 *  (anthropic y est seedé enabled=true) alors que la chaîne réelle du routeur
 *  est `text: [openaiProvider]` SEUL. Cap OpenAI atteint ⇒ openai désactivé ⇒
 *  kill switch jamais posé ⇒ jobs en échec `auth_failed` en boucle.
 *
 *  F1 — le reset mensuel ne réactivait RIEN : il remettait le compteur à 0 mais
 *  `assertCostCapAvailable` throw sur `!config.enabled` quel que soit le
 *  compteur. Cap atteint le 20 du mois ⇒ génération morte à perpétuité, alors
 *  que l'alerte Telegram promettait « reset 1er du mois ».
 *
 *  F6 — le bandeau `cost_cap_80_active` n'était jamais repassé à false.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  providerFindUniqueMock,
  providerUpdateMock,
  providerUpdateManyMock,
  providerFindManyMock,
  providerCountMock,
  configFindUniqueMock,
  configUpsertMock,
  configUpdateMock,
  configUpdateManyMock,
  sendTelegramMock,
} = vi.hoisted(() => ({
  providerFindUniqueMock: vi.fn(),
  providerUpdateMock: vi.fn(),
  providerUpdateManyMock: vi.fn(),
  providerFindManyMock: vi.fn(),
  providerCountMock: vi.fn(),
  configFindUniqueMock: vi.fn(),
  configUpsertMock: vi.fn(),
  configUpdateMock: vi.fn(),
  configUpdateManyMock: vi.fn(),
  sendTelegramMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    providerConfig: {
      findUnique: providerFindUniqueMock,
      update: providerUpdateMock,
      updateMany: providerUpdateManyMock,
      findMany: providerFindManyMock,
      count: providerCountMock,
    },
    contentGenConfig: {
      findUnique: configFindUniqueMock,
      upsert: configUpsertMock,
      update: configUpdateMock,
      updateMany: configUpdateManyMock,
    },
  },
}));

vi.mock("@/lib/telegram", () => ({
  sendTelegram: (...args: unknown[]) => sendTelegramMock(...args),
}));

import {
  assertCostCapAvailable,
  resetMonthlyCostCounters,
  TEXT_CHAIN_PROVIDERS,
} from "../cost-tracker";

/** Extrait les clés des upserts ContentGenConfig capturés. */
function upsertedConfigKeys(): string[] {
  return configUpsertMock.mock.calls.map((c) => (c[0] as { where: { key: string } }).where.key);
}

beforeEach(() => {
  vi.clearAllMocks();
  providerUpdateMock.mockResolvedValue({});
  providerUpdateManyMock.mockResolvedValue({ count: 0 });
  providerFindManyMock.mockResolvedValue([]);
  configFindUniqueMock.mockResolvedValue(null);
  configUpsertMock.mockResolvedValue({});
  configUpdateMock.mockResolvedValue({});
  configUpdateManyMock.mockResolvedValue({ count: 0 });
  sendTelegramMock.mockResolvedValue(undefined);
});

describe("F2 — kill switch décidé sur la chaîne texte RÉELLE, pas sur role=text en base", () => {
  // Provider openai en cap : spent=100 / cap=100, encore enabled (le hit est neuf).
  function primeOverCapOpenai(): void {
    providerFindUniqueMock.mockResolvedValue({
      monthlyCapUsd: 100,
      currentMonthSpentUsd: 100,
      enabled: true,
      extraConfig: null,
    });
  }

  it("la chaîne texte réelle = OpenAI seul (alignement provider-router décision Will 2026-07-09)", () => {
    expect(TEXT_CHAIN_PROVIDERS).toEqual(["openai"]);
  });

  it("cap openai atteint + chaîne texte épuisée → kill switch posé avec auto:true/source:cost_cap", async () => {
    primeOverCapOpenai();
    // Après désactivation d'openai, plus AUCUN provider de la chaîne texte
    // enabled — même si anthropic (role=text en base) est toujours enabled.
    providerCountMock.mockResolvedValue(0);

    await expect(assertCostCapAvailable("openai", 0.1)).rejects.toMatchObject({
      code: "cost_cap_reached",
      retryable: false,
    });

    // La décision porte sur les providers de la CHAÎNE (provider IN), pas sur
    // `role: "text"` — c'était le bug : anthropic comptait encore.
    expect(providerCountMock).toHaveBeenCalledWith({
      where: { provider: { in: ["openai"] }, enabled: true },
    });

    const killSwitchCall = configUpsertMock.mock.calls.find(
      (c) => (c[0] as { where: { key: string } }).where.key === "kill_switch",
    );
    expect(killSwitchCall).toBeDefined();
    const value = (
      killSwitchCall?.[0] as {
        create: { value: { active: boolean; auto: boolean; source: string } };
      }
    ).create.value;
    expect(value.active).toBe(true);
    // F1 : marqueurs permettant au reset mensuel de lever CE kill switch-là.
    expect(value.auto).toBe(true);
    expect(value.source).toBe("cost_cap");
  });

  it("chaîne texte pas épuisée → pas de kill switch", async () => {
    primeOverCapOpenai();
    providerCountMock.mockResolvedValue(1);

    await expect(assertCostCapAvailable("openai", 0.1)).rejects.toMatchObject({
      code: "cost_cap_reached",
    });

    expect(upsertedConfigKeys()).not.toContain("kill_switch");
  });

  it("F1 : la désactivation auto pose le marqueur extraConfig.disabled_by_cost_cap", async () => {
    primeOverCapOpenai();
    providerCountMock.mockResolvedValue(1);

    await expect(assertCostCapAvailable("openai", 0.1)).rejects.toMatchObject({
      code: "cost_cap_reached",
    });

    expect(providerUpdateMock).toHaveBeenCalledTimes(1);
    const updateArg = providerUpdateMock.mock.calls[0]?.[0] as {
      where: { provider: string };
      data: { enabled: boolean; extraConfig: Record<string, unknown> };
    };
    expect(updateArg.where.provider).toBe("openai");
    expect(updateArg.data.enabled).toBe(false);
    expect(updateArg.data.extraConfig["disabled_by_cost_cap"]).toBeDefined();
  });

  it("F2 : l'alerte Telegram ne prétend plus qu'un fallback prend le relais pour le texte", async () => {
    primeOverCapOpenai();
    providerCountMock.mockResolvedValue(1);

    await expect(assertCostCapAvailable("openai", 0.1)).rejects.toMatchObject({
      code: "cost_cap_reached",
    });

    const firstAlert = sendTelegramMock.mock.calls[0]?.[0] as { body: string };
    expect(firstAlert.body).toContain("AUCUN fallback");
    expect(firstAlert.body).not.toContain("Fallback chain prend le relais");
  });
});

describe("F1 — resetMonthlyCostCounters réarme ce que le cost-cap a coupé (et SEULEMENT ça)", () => {
  it("ré-active les providers marqués disabled_by_cost_cap, épargne les désactivations manuelles", async () => {
    providerUpdateManyMock.mockResolvedValue({ count: 3 });
    providerFindManyMock.mockResolvedValue([
      {
        provider: "openai",
        extraConfig: { disabled_by_cost_cap: { at: "2026-07-20T00:00:00Z" }, autre_cle: "x" },
      },
      // Désactivé volontairement par un admin : pas de marqueur → intouchable.
      { provider: "unsplash", extraConfig: null },
    ]);

    const summary = await resetMonthlyCostCounters();

    expect(summary.countersReset).toBe(3);
    expect(summary.reenabledProviders).toEqual(["openai"]);

    expect(providerUpdateMock).toHaveBeenCalledTimes(1);
    const updateArg = providerUpdateMock.mock.calls[0]?.[0] as {
      where: { provider: string };
      data: { enabled: boolean; extraConfig: Record<string, unknown> };
    };
    expect(updateArg.where.provider).toBe("openai");
    expect(updateArg.data.enabled).toBe(true);
    // Le marqueur est consommé, le reste d'extraConfig est préservé.
    expect(updateArg.data.extraConfig["disabled_by_cost_cap"]).toBeUndefined();
    expect(updateArg.data.extraConfig["autre_cle"]).toBe("x");
  });

  it("lève le kill switch posé par le cost-cap (triggered_by system:cost-tracker)", async () => {
    providerUpdateManyMock.mockResolvedValue({ count: 1 });
    configFindUniqueMock.mockResolvedValue({
      key: "kill_switch",
      value: {
        active: true,
        triggered_by: "system:cost-tracker",
        reason: "Auto-trigger : toute la chaîne texte en cost cap (dernier=openai)",
      },
    });

    const summary = await resetMonthlyCostCounters();

    expect(summary.killSwitchLifted).toBe(true);
    expect(configUpdateMock).toHaveBeenCalledTimes(1);
    const updateArg = configUpdateMock.mock.calls[0]?.[0] as {
      where: { key: string };
      data: { value: { active: boolean } };
    };
    expect(updateArg.where.key).toBe("kill_switch");
    expect(updateArg.data.value.active).toBe(false);
  });

  it("ne touche JAMAIS à un kill switch manuel", async () => {
    providerUpdateManyMock.mockResolvedValue({ count: 1 });
    configFindUniqueMock.mockResolvedValue({
      key: "kill_switch",
      value: { active: true, reason: "Coupé à la main par Will" },
    });

    const summary = await resetMonthlyCostCounters();

    expect(summary.killSwitchLifted).toBe(false);
    expect(configUpdateMock).not.toHaveBeenCalled();
  });

  it("ne touche pas non plus au kill switch du quota-guard (auto:true mais pas cost_cap)", async () => {
    // Un compte à sec ne se recharge pas au changement de mois : le kill switch
    // posé par le quota-guard (auto:true, sans source cost_cap ni triggered_by
    // cost-tracker) doit survivre au reset mensuel.
    providerUpdateManyMock.mockResolvedValue({ count: 1 });
    configFindUniqueMock.mockResolvedValue({
      key: "kill_switch",
      value: { active: true, auto: true, reason: "Auto-arrêt : quota openai épuisé" },
    });

    const summary = await resetMonthlyCostCounters();

    expect(summary.killSwitchLifted).toBe(false);
    expect(configUpdateMock).not.toHaveBeenCalled();
  });

  it("F6 : éteint le bandeau cost_cap_80_active au reset", async () => {
    providerUpdateManyMock.mockResolvedValue({ count: 1 });

    await resetMonthlyCostCounters();

    expect(configUpdateManyMock).toHaveBeenCalledTimes(1);
    const arg = configUpdateManyMock.mock.calls[0]?.[0] as {
      where: { key: string };
      data: { value: { active: boolean } };
    };
    expect(arg.where.key).toBe("cost_cap_80_active");
    expect(arg.data.value.active).toBe(false);
  });

  it("alerte Telegram récapitulative quand quelque chose a été réarmé", async () => {
    providerUpdateManyMock.mockResolvedValue({ count: 2 });
    providerFindManyMock.mockResolvedValue([
      { provider: "openai", extraConfig: { disabled_by_cost_cap: {} } },
    ]);

    await resetMonthlyCostCounters();

    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    const body = (sendTelegramMock.mock.calls[0]?.[0] as { body: string }).body;
    expect(body).toContain("openai");
    expect(body).toContain("Reset mensuel");
  });

  it("rien à réarmer → pas d'alerte Telegram (pas de bruit)", async () => {
    providerUpdateManyMock.mockResolvedValue({ count: 4 });

    const summary = await resetMonthlyCostCounters();

    expect(summary.reenabledProviders).toEqual([]);
    expect(summary.killSwitchLifted).toBe(false);
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });
});
