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

const TEXTE_CREDIT = "Your credit balance is too low to access the Anthropic API";

const facturation = () =>
  new ProviderError(
    `Anthropic quota épuisé : ${TEXTE_CREDIT}`,
    "quota_exhausted",
    "anthropic",
    false,
  );

/** Erreur brute façon SDK : statut HTTP + message. */
const brute = (statut: number, message: string) =>
  Object.assign(new Error(message), { status: statut });

function horloge(debut = 1_000_000) {
  let t = debut;
  return { now: () => t, avancer: (ms: number) => (t += ms) };
}

const indexes = (env: EnvCles, journal?: (m: string) => void) =>
  listerCles(env, "content_gen", journal).map((c) => c.index);

describe("listerCles", () => {
  it("ordre par défaut 1,2,3", () => {
    expect(indexes(ENV)).toEqual([1, 2, 3]);
  });
  it("ordre personnalisé « 2,1 » : 2, 1, puis les non listés en secours", () => {
    expect(indexes({ ...ENV, ANTHROPIC_KEY_ORDER_CONTENT_GEN: "2,1" })).toEqual([2, 1, 3]);
  });
  it("ignore les clés vides", () => {
    const env = { ANTHROPIC_API_KEY: K1, ANTHROPIC_API_KEY_2: "  ", ANTHROPIC_API_KEY_3: K3 };
    expect(indexes(env)).toEqual([1, 3]);
  });
  it("ignore les doublons (même valeur)", () => {
    const env = { ANTHROPIC_API_KEY: K1, ANTHROPIC_API_KEY_2: K1, ANTHROPIC_API_KEY_3: K3 };
    expect(indexes(env)).toEqual([1, 3]);
  });
  it("ordre « 2,1 » avec la clé 2 vide : 1 puis 3", () => {
    const env = { ...ENV, ANTHROPIC_API_KEY_2: "", ANTHROPIC_KEY_ORDER_CONTENT_GEN: "2,1" };
    expect(indexes(env)).toEqual([1, 3]);
  });
  it("ordre « 2 » seul avec la clé 2 vide : secours 1 et 3", () => {
    const env = { ...ENV, ANTHROPIC_API_KEY_2: "", ANTHROPIC_KEY_ORDER_CONTENT_GEN: "2" };
    expect(indexes(env)).toEqual([1, 3]);
  });
  it("ordre invalide : repli sur le défaut ET journalisé, sans valeur de clé", () => {
    const journal = vi.fn();
    expect(indexes({ ...ENV, ANTHROPIC_KEY_ORDER_CONTENT_GEN: "x,9" }, journal)).toEqual([1, 2, 3]);
    expect(journal).toHaveBeenCalledTimes(1);
    expect(String(journal.mock.calls[0]![0])).toMatch(/ordre/i);
    for (const k of [K1, K2, K3]) expect(JSON.stringify(journal.mock.calls)).not.toContain(k);
  });
  it("ordre valide : rien n'est journalisé", () => {
    const journal = vi.fn();
    indexes({ ...ENV, ANTHROPIC_KEY_ORDER_CONTENT_GEN: "3,2" }, journal);
    expect(journal).not.toHaveBeenCalled();
  });
});

describe("état d'épuisement", () => {
  it("choisit la première non épuisée, puis la suivante", () => {
    const etat = creerEtatCles(horloge().now);
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
  const options = (etat = creerEtatCles(horloge().now), journal = vi.fn()) => ({
    env: ENV,
    usage: "content_gen" as const,
    etat,
    journal,
  });
  const ne_bascule_pas = async (e: Error) => {
    const appel = vi.fn(async (_cle: string) => {
      throw e;
    });
    await expect(appelerAvecRotationCles(appel, options())).rejects.toBe(e);
    expect(appel).toHaveBeenCalledTimes(1);
  };

  it("refus de facturation : passe à la clé suivante", async () => {
    const appel = vi.fn(async (cle: string) => {
      if (cle === K1) throw facturation();
      return "ok";
    });
    await expect(appelerAvecRotationCles(appel, options())).resolves.toBe("ok");
    expect(appel.mock.calls.map((c) => c[0])).toEqual([K1, K2]);
  });

  it("après une rotation, l'appel suivant démarre directement sur la clé 2", async () => {
    const etat = creerEtatCles(horloge().now);
    const premier = vi.fn(async (cle: string) => {
      if (cle === K1) throw facturation();
      return "ok";
    });
    await appelerAvecRotationCles(premier, options(etat));
    const second = vi.fn(async (_cle: string) => "ok");
    await appelerAvecRotationCles(second, options(etat));
    expect(second.mock.calls.map((c) => c[0])).toEqual([K2]);
  });

  it("ProviderError rate_limited (429) : aucune bascule", async () => {
    await ne_bascule_pas(new ProviderError("rate limited", "rate_limited", "anthropic", true));
  });

  it("ProviderError quota_exhausted issue d'un 429 portant le texte de crédit : aucune bascule", async () => {
    await ne_bascule_pas(Object.assign(facturation(), { cause: { status: 429 } }));
  });

  it("ProviderError quota_exhausted avec statut 429 porté par l'erreur : aucune bascule", async () => {
    await ne_bascule_pas(Object.assign(facturation(), { status: 429 }));
  });

  it("quota_exhausted d'un autre fournisseur (openai) : aucune bascule", async () => {
    await ne_bascule_pas(new ProviderError(TEXTE_CREDIT, "quota_exhausted", "openai", false));
  });

  it("ProviderError 5xx (down) : aucune bascule", async () => {
    await ne_bascule_pas(new ProviderError("Anthropic server 503", "down", "anthropic", true));
  });

  it("délai dépassé : aucune bascule", async () => {
    await ne_bascule_pas(new ProviderError("timeout", "timeout", "anthropic", true));
  });

  it("erreur BRUTE 429 (même texte de crédit) : aucune bascule", async () => {
    await ne_bascule_pas(brute(429, TEXTE_CREDIT));
  });

  it("erreur BRUTE 5xx (même texte de crédit) : aucune bascule", async () => {
    await ne_bascule_pas(brute(503, TEXTE_CREDIT));
  });

  it("erreur BRUTE 401 contenant « billing » : aucune bascule", async () => {
    await ne_bascule_pas(brute(401, "invalid x-api-key, see billing settings"));
  });

  it("erreur BRUTE 403 contenant le texte de crédit : aucune bascule", async () => {
    await ne_bascule_pas(brute(403, TEXTE_CREDIT));
  });

  it("erreur BRUTE 400 avec le simple mot « billing » : aucune bascule", async () => {
    await ne_bascule_pas(brute(400, "unrelated request, see the billing page"));
  });

  it("erreur BRUTE 402 : bascule", async () => {
    const appel = vi.fn(async (cle: string) => {
      if (cle === K1) throw brute(402, "statut seul, sans texte explicite");
      return "ok";
    });
    await expect(appelerAvecRotationCles(appel, options())).resolves.toBe("ok");
    expect(appel.mock.calls.map((c) => c[0])).toEqual([K1, K2]);
  });

  it("erreur BRUTE 400 « credit balance is too low » : bascule", async () => {
    const appel = vi.fn(async (cle: string) => {
      if (cle === K1) throw brute(400, TEXTE_CREDIT);
      return "ok";
    });
    await expect(appelerAvecRotationCles(appel, options())).resolves.toBe("ok");
    expect(appel.mock.calls.map((c) => c[0])).toEqual([K1, K2]);
  });

  it("refus de facturation reçu EN COURS de flux : aucune bascule (risque de double facturation)", async () => {
    await ne_bascule_pas(Object.assign(facturation(), { enFlux: true }));
  });

  it("toutes épuisées : quota_exhausted, 3 essais, jamais deux fois la même clé, cause conservée", async () => {
    const origine = facturation();
    const appel = vi.fn(async (_cle: string) => {
      throw origine;
    });
    const err = await appelerAvecRotationCles(appel, options()).catch((x) => x);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe("quota_exhausted");
    expect(err.provider).toBe("anthropic");
    expect(err.cause).toBe(origine);
    const cles = appel.mock.calls.map((c) => c[0]);
    expect(cles).toEqual([K1, K2, K3]);
    expect(new Set(cles).size).toBe(3);
  });

  it("état déjà tout épuisé : aucun appel, quota_exhausted", async () => {
    const etat = creerEtatCles(horloge().now);
    for (const k of [K1, K2, K3]) marquerEpuisee(etat, k);
    const appel = vi.fn(async (_cle: string) => "ok");
    const err = await appelerAvecRotationCles(appel, options(etat)).catch((x) => x);
    expect(err.code).toBe("quota_exhausted");
    expect(appel).not.toHaveBeenCalled();
  });

  it("aucune clé configurée : auth_failed", async () => {
    const appel = vi.fn(async (_cle: string) => "ok");
    const err = await appelerAvecRotationCles(appel, {
      env: {},
      usage: "content_gen",
      etat: creerEtatCles(),
    }).catch((x) => x);
    expect(err.code).toBe("auth_failed");
  });

  it("ordre « 2 » avec la clé 2 vide : utilise 1, pas auth_failed", async () => {
    const appel = vi.fn(async (_cle: string) => "ok");
    await appelerAvecRotationCles(appel, {
      ...options(),
      env: { ...ENV, ANTHROPIC_API_KEY_2: "", ANTHROPIC_KEY_ORDER_CONTENT_GEN: "2" },
    });
    expect(appel.mock.calls[0]![0]).toBe(K1);
  });

  it("ordre personnalisé respecté", async () => {
    const appel = vi.fn(async (_cle: string) => "ok");
    await appelerAvecRotationCles(appel, {
      ...options(),
      env: { ...ENV, ANTHROPIC_KEY_ORDER_CONTENT_GEN: "2,1" },
    });
    expect(appel.mock.calls[0]![0]).toBe(K2);
  });

  it("une erreur non facturation dont le message contient la clé : la clé ne ressort pas", async () => {
    const e = new Error(`échec réseau avec ${K1} et sk-ant-api03-FACTICE_xyz`);
    e.stack = `Error: pile avec ${K1}`;
    const err = await appelerAvecRotationCles(async (_cle: string) => {
      throw e;
    }, options()).catch((x) => x);
    expect(err.message).not.toContain(K1);
    expect(err.message).not.toContain("sk-ant-api03-FACTICE_xyz");
    expect(String(err.stack ?? "")).not.toContain(K1);
  });

  it("l'erreur finale quota_exhausted et sa cause ne contiennent aucune clé", async () => {
    const appel = async (_cle: string) => {
      throw new ProviderError(
        `refus pour ${K2} : ${TEXTE_CREDIT}`,
        "quota_exhausted",
        "anthropic",
        false,
      );
    };
    const err = await appelerAvecRotationCles(appel, options()).catch((x) => x);
    expect(err.message).not.toContain(K2);
    expect(String(err.cause?.message)).not.toContain(K2);
  });

  it("aucune clé en clair dans le journal ni la console, seulement l'index", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const journal = vi.fn();
    const appel = async (_cle: string) => {
      throw new ProviderError(
        `refus pour ${K1} : ${TEXTE_CREDIT}`,
        "quota_exhausted",
        "anthropic",
        false,
      );
    };
    await appelerAvecRotationCles(appel, options(creerEtatCles(horloge().now), journal)).catch(
      () => {},
    );
    // Journal par défaut (console)
    await appelerAvecRotationCles(appel, {
      env: ENV,
      usage: "content_gen",
      etat: creerEtatCles(),
    }).catch(() => {});
    const sortie = JSON.stringify([journal.mock.calls, ...spies.map((s) => s.mock.calls)]);
    spies.forEach((s) => s.mockRestore());
    for (const k of [K1, K2, K3]) expect(sortie).not.toContain(k);
    // Plus de 4 derniers caractères : ni « 1111 » ni « 2222 » ni « 3333 ».
    for (const fin of ["1111", "2222", "3333"]) expect(sortie).not.toContain(fin);
    expect(sortie).toContain("clé 1");
  });
});
