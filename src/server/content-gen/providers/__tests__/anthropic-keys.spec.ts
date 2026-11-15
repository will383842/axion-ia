import { describe, it, expect, vi } from "vitest";
import { ProviderError } from "../IProvider";
import {
  creerEtatCles,
  listerCles,
  choisirCle,
  marquerEpuisee,
  toutesEpuisees,
  appelerAvecRotationCles,
  DUREE_EPUISEMENT_MS,
  type EnvCles,
} from "../anthropic-keys";

const K1 = "factice-cle-un-AAAA1111";
const K2 = "factice-cle-deux-BBBB2222";
const K3 = "factice-cle-trois-CCCC3333";

const ENV: EnvCles = {
  ANTHROPIC_API_KEY: K1,
  ANTHROPIC_API_KEY_2: K2,
  ANTHROPIC_API_KEY_3: K3,
};

const facturation = () =>
  new ProviderError("Anthropic quota épuisé : Your credit balance is too low", "quota_exhausted", "anthropic", false);

function horloge(debut = 1_000_000) {
  let t = debut;
  return { now: () => t, avancer: (ms: number) => (t += ms) };
}

describe("listerCles", () => {
  it("ordre par défaut 1,2,3", () => {
    expect(listerCles(ENV, "content_gen").map((c) => c.index)).toEqual([1, 2, 3]);
  });
  it("ordre personnalisé « 2,1 »", () => {
    const env = { ...ENV, ANTHROPIC_KEY_ORDER_CONTENT_GEN: "2,1" };
    expect(listerCles(env, "content_gen").map((c) => c.index)).toEqual([2, 1]);
  });
  it("ignore les clés vides", () => {
    const env = { ANTHROPIC_API_KEY: K1, ANTHROPIC_API_KEY_2: "  ", ANTHROPIC_API_KEY_3: K3 };
    expect(listerCles(env, "content_gen").map((c) => c.index)).toEqual([1, 3]);
  });
  it("ignore les doublons (même valeur)", () => {
    const env = { ANTHROPIC_API_KEY: K1, ANTHROPIC_API_KEY_2: K1, ANTHROPIC_API_KEY_3: K3 };
    expect(listerCles(env, "content_gen").map((c) => c.index)).toEqual([1, 3]);
  });
  it("ordre invalide : repli sur le défaut", () => {
    const env = { ...ENV, ANTHROPIC_KEY_ORDER_CONTENT_GEN: "x,9" };
    expect(listerCles(env, "content_gen").map((c) => c.index)).toEqual([1, 2, 3]);
  });
});

describe("état d'épuisement", () => {
  it("choisit la première non épuisée, puis la suivante", () => {
    const h = horloge();
    const etat = creerEtatCles(h.now);
    expect(choisirCle(ENV, "content_gen", etat)?.index).toBe(1);
    marquerEpuisee(etat, K1);
    expect(choisirCle(ENV, "content_gen", etat)?.index).toBe(2);
  });
  it("expire après 24 h", () => {
    const h = horloge();
    const etat = creerEtatCles(h.now);
    marquerEpuisee(etat, K1);
    h.avancer(DUREE_EPUISEMENT_MS - 1);
    expect(choisirCle(ENV, "content_gen", etat)?.index).toBe(2);
    h.avancer(1);
    expect(choisirCle(ENV, "content_gen", etat)?.index).toBe(1);
  });
  it("toutes épuisées", () => {
    const etat = creerEtatCles(horloge().now);
    for (const k of [K1, K2, K3]) marquerEpuisee(etat, k);
    expect(toutesEpuisees(ENV, "content_gen", etat)).toBe(true);
    expect(choisirCle(ENV, "content_gen", etat)).toBeNull();
  });
  it("aucune clé configurée : pas « toutes épuisées »", () => {
    expect(toutesEpuisees({}, "content_gen", creerEtatCles())).toBe(false);
  });
});

describe("appelerAvecRotationCles", () => {
  const options = (etat = creerEtatCles(horloge().now), log = vi.fn()) => ({
    env: ENV,
    usage: "content_gen" as const,
    etat,
    journal: log,
  });

  it("refus de facturation : passe à la clé suivante", async () => {
    const appel = vi.fn(async (cle: string) => {
      if (cle === K1) throw facturation();
      return "ok";
    });
    await expect(appelerAvecRotationCles(appel, options())).resolves.toBe("ok");
    expect(appel.mock.calls.map((c) => c[0])).toEqual([K1, K2]);
  });

  it("429 : aucune bascule", async () => {
    const e = new ProviderError("rate limited", "rate_limited", "anthropic", true);
    const appel = vi.fn(async () => {
      throw e;
    });
    await expect(appelerAvecRotationCles(appel, options())).rejects.toBe(e);
    expect(appel).toHaveBeenCalledTimes(1);
  });

  it("429 brut (même texte de crédit) : aucune bascule", async () => {
    const e = Object.assign(new Error("credit balance is too low"), { status: 429 });
    const appel = vi.fn(async () => {
      throw e;
    });
    await expect(appelerAvecRotationCles(appel, options())).rejects.toBe(e);
    expect(appel).toHaveBeenCalledTimes(1);
  });

  it("5xx : aucune bascule", async () => {
    const e = new ProviderError("Anthropic server 503", "down", "anthropic", true);
    const appel = vi.fn(async () => {
      throw e;
    });
    await expect(appelerAvecRotationCles(appel, options())).rejects.toBe(e);
    expect(appel).toHaveBeenCalledTimes(1);
  });

  it("délai dépassé : aucune bascule", async () => {
    const e = new ProviderError("timeout", "timeout", "anthropic", true);
    const appel = vi.fn(async () => {
      throw e;
    });
    await expect(appelerAvecRotationCles(appel, options())).rejects.toBe(e);
    expect(appel).toHaveBeenCalledTimes(1);
  });

  it("toutes épuisées : quota_exhausted, 3 essais au plus, jamais deux fois la même clé", async () => {
    const appel = vi.fn(async (_cle: string) => {
      throw facturation();
    });
    const err = await appelerAvecRotationCles(appel, options()).catch((x) => x);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe("quota_exhausted");
    const cles = appel.mock.calls.map((c) => c[0]);
    expect(cles).toEqual([K1, K2, K3]);
    expect(new Set(cles).size).toBe(3);
  });

  it("état déjà tout épuisé : aucun appel, quota_exhausted", async () => {
    const etat = creerEtatCles(horloge().now);
    for (const k of [K1, K2, K3]) marquerEpuisee(etat, k);
    const appel = vi.fn(async () => "ok");
    const err = await appelerAvecRotationCles(appel, options(etat)).catch((x) => x);
    expect(err.code).toBe("quota_exhausted");
    expect(appel).not.toHaveBeenCalled();
  });

  it("aucune clé configurée : auth_failed", async () => {
    const appel = vi.fn(async () => "ok");
    const err = await appelerAvecRotationCles(appel, { env: {}, usage: "content_gen", etat: creerEtatCles() }).catch(
      (x) => x,
    );
    expect(err.code).toBe("auth_failed");
  });

  it("ordre personnalisé respecté", async () => {
    const appel = vi.fn(async (_cle: string) => "ok");
    await appelerAvecRotationCles(appel, {
      ...options(),
      env: { ...ENV, ANTHROPIC_KEY_ORDER_CONTENT_GEN: "2,1" },
    });
    expect(appel.mock.calls[0]![0]).toBe(K2);
  });

  it("aucune clé en clair dans les journaux ni la console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const journal = vi.fn();
    const appel = vi.fn(async () => {
      throw new ProviderError(`refus pour ${K1} : credit balance is too low`, "quota_exhausted", "anthropic", false);
    });
    const err = await appelerAvecRotationCles(appel, options(creerEtatCles(horloge().now), journal)).catch((x) => x);
    // Journal injecté ET sortie console par défaut
    await appelerAvecRotationCles(appel, { env: ENV, usage: "content_gen", etat: creerEtatCles() }).catch(() => {});
    const sortie = JSON.stringify([journal.mock.calls, ...spies.map((s) => s.mock.calls)]);
    spies.forEach((s) => s.mockRestore());
    for (const k of [K1, K2, K3]) expect(sortie).not.toContain(k);
    expect(sortie).toContain("clé 1");
    expect(err.message).not.toContain(K1);
  });
});
