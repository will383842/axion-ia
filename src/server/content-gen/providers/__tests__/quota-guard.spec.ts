/**
 * Auto-arrêt sur panne permanente d'un provider.
 *
 * Ce que ces tests protègent : entre le 09/07 et le 24/07/2026, le compte OpenAI
 * s'est vidé trois fois et RIEN n'a arrêté la production — ni le circuit breaker
 * (qui ne fait qu'échouer vite), ni le plafond de dépense (qu'un appel refusé
 * n'approche jamais, puisqu'il ne coûte rien). Résultat : ~1 500 jobs partis en
 * échec pour une cause purement administrative.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const persistMock = vi.fn();
const readDirectMock = vi.fn();
const alertMock = vi.fn();

vi.mock("../../config-store", () => ({
  persistContentGenConfig: (...args: unknown[]) => persistMock(...args),
  readContentGenConfigDirect: (...args: unknown[]) => readDirectMock(...args),
}));

vi.mock("../../shared/content-gen-alerts", () => ({
  alertGenerationHalted: (...args: unknown[]) => alertMock(...args),
}));

import {
  clearProviderFailureStreak,
  isPermanentProviderCode,
  QUOTA_HALT_THRESHOLD,
  recordPermanentProviderFailure,
} from "../quota-guard";

/** Simule l'état stocké : compteur du garde-fou + état du kill switch. */
function mockState(opts: {
  consecutive?: number;
  killSwitchActive?: boolean;
  killSwitchAuto?: boolean;
}): void {
  readDirectMock.mockImplementation(async (key: string) => {
    if (key === "kill_switch") {
      return opts.killSwitchActive
        ? { active: true, reason: "déjà arrêté", auto: opts.killSwitchAuto ?? false }
        : { active: false };
    }
    return opts.consecutive
      ? {
          openai: {
            consecutive: opts.consecutive,
            code: "quota_exhausted",
            firstAt: "2026-08-15T00:00:00.000Z",
            lastAt: "2026-08-15T00:00:00.000Z",
            lastMessage: "",
          },
        }
      : {};
  });
}

function killSwitchWrites(): unknown[][] {
  return (persistMock.mock.calls as unknown[][]).filter((call) => call[0] === "kill_switch");
}

beforeEach(() => {
  vi.clearAllMocks();
  persistMock.mockResolvedValue(undefined);
  alertMock.mockResolvedValue(undefined);
});

describe("isPermanentProviderCode", () => {
  it("ne retient que les pannes qui ne guérissent pas seules", () => {
    expect(isPermanentProviderCode("quota_exhausted")).toBe(true);
    expect(isPermanentProviderCode("auth_failed")).toBe(true);
    // Transitoires : le retry et le circuit breaker sont là pour ça, couper la
    // production serait une sur-réaction.
    expect(isPermanentProviderCode("rate_limited")).toBe(false);
    expect(isPermanentProviderCode("timeout")).toBe(false);
    expect(isPermanentProviderCode("down")).toBe(false);
    expect(isPermanentProviderCode(undefined)).toBe(false);
  });
});

describe("recordPermanentProviderFailure", () => {
  it("compte sans couper tant que le seuil n'est pas atteint", async () => {
    mockState({ consecutive: 0 });

    const halted = await recordPermanentProviderFailure("openai", "quota_exhausted", "no credits");

    expect(halted).toBe(false);
    expect(killSwitchWrites()).toHaveLength(0);
  });

  it("coupe la production au seuil atteint et alerte", async () => {
    mockState({ consecutive: QUOTA_HALT_THRESHOLD - 1 });

    const halted = await recordPermanentProviderFailure(
      "openai",
      "quota_exhausted",
      "You have no credits remaining",
    );

    expect(halted).toBe(true);
    const writes = killSwitchWrites();
    expect(writes).toHaveLength(1);
    const value = writes[0]?.[1] as { active: boolean; auto: boolean; reason: string };
    expect(value.active).toBe(true);
    // `auto: true` distingue cet arrêt d'une décision humaine — le reset mensuel
    // et la reprise s'appuient dessus.
    expect(value.auto).toBe(true);
    expect(value.reason).toMatch(/quota/i);
    expect(alertMock).toHaveBeenCalledOnce();
  });

  it("n'écrase JAMAIS un kill switch déjà posé", async () => {
    // Un arrêt saisi par un humain porte un motif ; le remplacer effacerait une
    // information que personne d'autre ne détient.
    mockState({ consecutive: QUOTA_HALT_THRESHOLD - 1, killSwitchActive: true });

    const halted = await recordPermanentProviderFailure("openai", "quota_exhausted", "no credits");

    expect(halted).toBe(false);
    expect(killSwitchWrites()).toHaveLength(0);
  });

  it("ignore les causes transitoires", async () => {
    mockState({ consecutive: QUOTA_HALT_THRESHOLD - 1 });

    const halted = await recordPermanentProviderFailure("openai", "rate_limited", "429 slow down");

    expect(halted).toBe(false);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it("ignore les providers non critiques pour la production de texte", async () => {
    // Une panne Perplexity (données) ou Unsplash (illustrations) dégrade le
    // contenu mais ne justifie pas d'arrêter toute la chaîne.
    mockState({ consecutive: QUOTA_HALT_THRESHOLD - 1 });

    const halted = await recordPermanentProviderFailure(
      "perplexity",
      "quota_exhausted",
      "no credits",
    );

    expect(halted).toBe(false);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it("ne fait jamais échouer l'appelant si la base est indisponible", async () => {
    // Fail-open absolu : ce garde-fou ne doit pas casser une génération qui,
    // elle, fonctionnait.
    readDirectMock.mockRejectedValue(new Error("DB down"));

    await expect(
      recordPermanentProviderFailure("openai", "quota_exhausted", "no credits"),
    ).resolves.toBe(false);
  });
});

describe("clearProviderFailureStreak", () => {
  it("efface la série après un appel réussi", async () => {
    mockState({ consecutive: 2 });

    await clearProviderFailureStreak("openai");

    const write = (persistMock.mock.calls as unknown[][]).find(
      (call) => call[0] === "provider_quota_guard",
    );
    expect(write).toBeDefined();
    expect(write?.[1]).toEqual({});
  });

  it("n'écrit rien quand il n'y a aucune série en cours", async () => {
    mockState({ consecutive: 0 });

    await clearProviderFailureStreak("openai");

    expect(persistMock).not.toHaveBeenCalled();
  });
});

describe("anthropic : rotation de clés, seule « toutesEpuisees » compte", () => {
  it("une seule clé épuisée (sans drapeau, ou drapeau faux) ne compte JAMAIS, même au seuil", async () => {
    mockState({ consecutive: QUOTA_HALT_THRESHOLD - 1 });

    expect(await recordPermanentProviderFailure("anthropic", "quota_exhausted", "une clé")).toBe(
      false,
    );
    expect(
      await recordPermanentProviderFailure("anthropic", "quota_exhausted", "une clé", {
        toutesEpuisees: false,
      }),
    ).toBe(false);
    expect(
      await recordPermanentProviderFailure("anthropic", "auth_failed", "une clé", {
        toutesEpuisees: false,
      }),
    ).toBe(false);

    expect(persistMock).not.toHaveBeenCalled();
    expect(killSwitchWrites()).toHaveLength(0);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("toutesEpuisees : compte, et coupe au seuil", async () => {
    mockState({ consecutive: 0 });
    expect(
      await recordPermanentProviderFailure("anthropic", "quota_exhausted", "tout", {
        toutesEpuisees: true,
      }),
    ).toBe(false);
    const comptes = (persistMock.mock.calls as unknown[][]).find(
      (c) => c[0] === "provider_quota_guard",
    );
    expect(Object.keys(comptes?.[1] as object)).toContain("anthropic");

    vi.clearAllMocks();
    persistMock.mockResolvedValue(undefined);
    readDirectMock.mockImplementation(async (key: string) =>
      key === "kill_switch"
        ? { active: false }
        : {
            anthropic: {
              consecutive: QUOTA_HALT_THRESHOLD - 1,
              code: "quota_exhausted",
              firstAt: "x",
              lastAt: "x",
              lastMessage: "",
            },
          },
    );
    expect(
      await recordPermanentProviderFailure("anthropic", "auth_failed", "toutes refusées", {
        toutesEpuisees: true,
      }),
    ).toBe(true);
    expect(killSwitchWrites()).toHaveLength(1);
  });

  it("un code transitoire ne compte pas, même avec le drapeau", async () => {
    mockState({ consecutive: 0 });
    expect(
      await recordPermanentProviderFailure("anthropic", "rate_limited", "429", {
        toutesEpuisees: true,
      }),
    ).toBe(false);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it("OpenAI inchangé : compte sans drapeau", async () => {
    mockState({ consecutive: QUOTA_HALT_THRESHOLD - 1 });
    expect(await recordPermanentProviderFailure("openai", "quota_exhausted", "x")).toBe(true);
  });
});
