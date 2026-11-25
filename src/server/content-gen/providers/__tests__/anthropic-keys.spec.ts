import { describe, it, expect, vi } from "vitest";
import { ProviderError } from "../IProvider";
import {
  creerEtatCles,
  listerCles,
  choisirCle,
  toutesIndisponibles,
  appelerAvecRotationCles,
  cleRedisEtat,
  DUREE_EPUISEMENT_MS,
  DUREE_INVALIDITE_MS,
  type EnvCles,
  type EtatCles,
} from "../anthropic-keys";
import { creerFauxRedis } from "./faux-redis-cles";

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

/** Clé API -> index, pour marquer sans connaître l'index dans les tests. */
const INDEX: Record<string, 1 | 2 | 3> = { [K1]: 1, [K2]: 2, [K3]: 3 };

describe("état des clés (Redis partagé, repli mémoire)", () => {
  it("choisit la première non marquée, puis la suivante", async () => {
    const etat = creerEtatCles({ now: horloge().now });
    expect((await choisirCle(ENV, "content_gen", etat))?.index).toBe(1);
    await etat.marquer(1, "epuisee");
    expect((await choisirCle(ENV, "content_gen", etat))?.index).toBe(2);
  });
  it("Redis : épuisée = SET anthropic:cle:1:epuisee, durée de vie 6 h ; invalide = 1 h", async () => {
    const redis = creerFauxRedis();
    const etat = creerEtatCles({ redis });
    await etat.marquer(1, "epuisee");
    await etat.marquer(2, "invalide");
    expect(redis.ttls.get("anthropic:cle:1:epuisee")).toBe(6 * 3600);
    expect(redis.ttls.get("anthropic:cle:2:invalide")).toBe(3600);
    expect(cleRedisEtat(3, "epuisee")).toBe("anthropic:cle:3:epuisee");
    expect(DUREE_EPUISEMENT_MS).toBe(6 * 3600 * 1000);
    expect(DUREE_INVALIDITE_MS).toBe(3600 * 1000);
  });
  it("expire : épuisée après 6 h, invalide après 1 h (durée de vie Redis)", async () => {
    const h = horloge();
    const redis = creerFauxRedis(h.now);
    const etat = creerEtatCles({ now: h.now, redis });
    await etat.marquer(1, "epuisee");
    await etat.marquer(2, "invalide");
    h.avancer(DUREE_INVALIDITE_MS - 1);
    expect(await etat.motif(2)).toBe("invalide");
    h.avancer(1);
    expect(await etat.motif(2)).toBeNull();
    expect(await etat.motif(1)).toBe("epuisee");
    h.avancer(DUREE_EPUISEMENT_MS - DUREE_INVALIDITE_MS - 1);
    expect(await etat.motif(1)).toBe("epuisee");
    h.avancer(1);
    expect(await etat.motif(1)).toBeNull();
  });
  it("ÉTAT PARTAGÉ : deux « processus » (deux états, même Redis) voient la même marque", async () => {
    const redis = creerFauxRedis();
    const app = creerEtatCles({ redis });
    const worker = creerEtatCles({ redis });
    await app.marquer(1, "epuisee");
    expect(await worker.motif(1)).toBe("epuisee");
    expect((await choisirCle(ENV, "content_gen", worker))?.index).toBe(2);
    await worker.marquer(2, "invalide");
    expect((await choisirCle(ENV, "content_gen", app))?.index).toBe(3);
  });
  it("toutes indisponibles (épuisées ou invalides)", async () => {
    const etat = creerEtatCles({ redis: creerFauxRedis() });
    await etat.marquer(1, "epuisee");
    await etat.marquer(2, "invalide");
    expect(await toutesIndisponibles(ENV, "content_gen", etat)).toBe(false);
    await etat.marquer(3, "epuisee");
    expect(await toutesIndisponibles(ENV, "content_gen", etat)).toBe(true);
    expect(await choisirCle(ENV, "content_gen", etat)).toBeNull();
  });
  it("aucune clé configurée : pas « toutes indisponibles »", async () => {
    expect(await toutesIndisponibles({}, "content_gen", creerEtatCles())).toBe(false);
  });
  it("PANNE REDIS : repli sur la mémoire locale + un avertissement (sans texte de l'erreur)", async () => {
    const redis = creerFauxRedis();
    redis.panne = true;
    const journal = vi.fn();
    const etat = creerEtatCles({ redis, journal });
    await etat.marquer(1, "epuisee"); // écriture impossible -> mémoire
    expect(await etat.motif(1)).toBe("epuisee"); // la mémoire répond
    expect((await choisirCle(ENV, "content_gen", etat))?.index).toBe(2);
    expect(journal).toHaveBeenCalled();
    const texte = JSON.stringify(journal.mock.calls);
    expect(texte).toMatch(/Redis indisponible/);
    expect(texte).not.toContain("motdepasse");
  });
  it("panne Redis en lecture seule : clé non marquée = utilisable, rien ne casse", async () => {
    const redis = creerFauxRedis();
    redis.panne = true;
    const etat = creerEtatCles({ redis, journal: vi.fn() });
    expect(await etat.motif(2)).toBeNull();
  });
  it("avertissement Redis limité à un par minute", async () => {
    const h = horloge();
    const redis = creerFauxRedis(h.now);
    redis.panne = true;
    const journal = vi.fn();
    const etat = creerEtatCles({ now: h.now, redis, journal });
    for (let i = 0; i < 5; i++) await etat.motif(1);
    expect(journal).toHaveBeenCalledTimes(1);
    h.avancer(61_000);
    await etat.motif(1);
    expect(journal).toHaveBeenCalledTimes(2);
  });
  it("mémoire de repli : expire aussi (6 h)", async () => {
    const h = horloge();
    const redis = creerFauxRedis(h.now);
    redis.panne = true;
    const etat = creerEtatCles({ now: h.now, redis, journal: vi.fn() });
    await etat.marquer(1, "epuisee");
    h.avancer(DUREE_EPUISEMENT_MS - 1);
    expect(await etat.motif(1)).toBe("epuisee");
    h.avancer(1);
    expect(await etat.motif(1)).toBeNull();
  });
  it("Redis lent (ne répond jamais) : délai court puis repli, sans bloquer", async () => {
    vi.useFakeTimers();
    try {
      const etat = creerEtatCles({
        redis: { set: () => new Promise(() => {}), mget: () => new Promise(() => {}) },
        journal: vi.fn(),
      });
      const p = etat.marquer(1, "epuisee");
      await vi.advanceTimersByTimeAsync(1_100);
      await p;
      expect(await Promise.all([etat.motif(1)]).then(([m]) => m)).toBe("epuisee");
    } finally {
      vi.useRealTimers();
    }
  });
  it("réponse Redis inattendue (stub de build : null) : clé libre", async () => {
    const etat = creerEtatCles({
      redis: { set: async () => null, mget: async () => null },
    });
    expect(await etat.motif(1)).toBeNull();
  });
  it("UN seul mget par appel de rotation, même avec deux clés refusées puis une réussie", async () => {
    const redis = creerFauxRedis();
    const etat = creerEtatCles({ redis });
    const appel = vi.fn(async (cle: string) => {
      if (cle !== K3) throw brute(402, "x");
      return "ok";
    });
    await expect(
      appelerAvecRotationCles(appel, {
        env: ENV,
        usage: "content_gen",
        etat,
        journal: vi.fn(),
      }),
    ).resolves.toBe("ok");
    expect(appel.mock.calls.map((c) => c[0])).toEqual([K1, K2, K3]);
    expect(redis.lectures).toHaveLength(1);
    // Les marques posées pendant l'appel sont bien écrites.
    expect(redis.ttls.has("anthropic:cle:1:epuisee")).toBe(true);
    expect(redis.ttls.has("anthropic:cle:2:epuisee")).toBe(true);
  });
  it("UN seul mget aussi quand toutes les clés sont épuisées (erreur finale)", async () => {
    const redis = creerFauxRedis();
    const etat = creerEtatCles({ redis });
    const appel = vi.fn(async (_cle: string) => {
      throw brute(402, "x");
    });
    await expect(
      appelerAvecRotationCles(appel, {
        env: ENV,
        usage: "content_gen",
        etat,
        journal: vi.fn(),
      }),
    ).rejects.toMatchObject({ toutesEpuisees: true, code: "quota_exhausted" });
    expect(redis.lectures).toHaveLength(1);
  });
  it("après une erreur Redis : plus aucune requête Redis pendant 60 s (repli mémoire), puis reprise", async () => {
    const h = horloge();
    const set = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const mget = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const etat = creerEtatCles({ now: h.now, redis: { set, mget }, journal: vi.fn() });
    await etat.motif(1); // erreur : le disjoncteur s'ouvre
    expect(mget).toHaveBeenCalledTimes(1);
    h.avancer(59_000);
    await etat.motif(1);
    await etat.marquer(1, "epuisee");
    await etat.instantane?.();
    expect(mget).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
    expect(await etat.motif(1)).toBe("epuisee"); // repli mémoire
    h.avancer(2_000);
    await etat.motif(2);
    expect(mget).toHaveBeenCalledTimes(2);
  });
  it("un `set` Redis qui ne répond pas « OK » (stub de build : null) est une panne : mémoire de repli", async () => {
    const journal = vi.fn();
    const etat = creerEtatCles({
      redis: { set: async () => null, mget: async () => [null, null] },
      journal,
    });
    await etat.marquer(1, "epuisee");
    expect(await etat.motif(1)).toBe("epuisee");
    expect(JSON.stringify(journal.mock.calls)).toMatch(/Redis indisponible/);
  });
  it("aucune clé API dans les clés ni les valeurs Redis", async () => {
    const redis = creerFauxRedis();
    const etat = creerEtatCles({ redis });
    await etat.marquer(1, "epuisee");
    await etat.marquer(2, "invalide");
    const vues = JSON.stringify([...redis.ttls.keys(), redis.lectures]);
    for (const k of [K1, K2, K3]) expect(vues).not.toContain(k);
  });
});

describe("appelerAvecRotationCles", () => {
  const options = (
    etat: EtatCles = creerEtatCles({ redis: creerFauxRedis() }),
    journal = vi.fn(),
    surMarque?: (e: { index: number; motif: string }) => Promise<unknown> | void,
  ) => ({
    ...(surMarque ? { surMarque } : {}),
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
    const etat = creerEtatCles({ redis: creerFauxRedis() });
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

  it("401 : bascule, clé 1 marquée INVALIDE 1 h (pas épuisée), alerte critique demandée", async () => {
    const redis = creerFauxRedis();
    const etat = creerEtatCles({ redis });
    const surMarque = vi.fn();
    const appel = vi.fn(async (cle: string) => {
      if (cle === K1) throw brute(401, "invalid x-api-key, see billing settings");
      return "ok";
    });
    await expect(appelerAvecRotationCles(appel, options(etat, vi.fn(), surMarque))).resolves.toBe(
      "ok",
    );
    expect(appel.mock.calls.map((c) => c[0])).toEqual([K1, K2]);
    expect(redis.ttls.get("anthropic:cle:1:invalide")).toBe(3600);
    expect(redis.ttls.has("anthropic:cle:1:epuisee")).toBe(false);
    expect(surMarque).toHaveBeenCalledWith({ index: 1, motif: "invalide" });
  });

  it("403 (même avec le texte de crédit) : bascule, marque INVALIDE", async () => {
    const redis = creerFauxRedis();
    const appel = vi.fn(async (cle: string) => {
      if (cle === K1) throw brute(403, TEXTE_CREDIT);
      return "ok";
    });
    await appelerAvecRotationCles(appel, options(creerEtatCles({ redis })));
    expect(appel.mock.calls.map((c) => c[0])).toEqual([K1, K2]);
    expect(redis.ttls.has("anthropic:cle:1:invalide")).toBe(true);
  });

  it("ProviderError auth_failed portant status 401 (forme rendue par mapAnthropicError) : bascule", async () => {
    const e = Object.assign(new ProviderError("auth", "auth_failed", "anthropic", false), {
      status: 401,
    });
    const appel = vi.fn(async (cle: string) => {
      if (cle === K1) throw e;
      return "ok";
    });
    await appelerAvecRotationCles(appel, options());
    expect(appel).toHaveBeenCalledTimes(2);
  });

  it("auth_failed SANS statut (« fournisseur désactivé », clé absente) : aucune bascule", async () => {
    await ne_bascule_pas(new ProviderError("désactivé", "auth_failed", "anthropic", false));
  });

  it("401 reçu EN COURS de flux : aucune bascule", async () => {
    await ne_bascule_pas(
      Object.assign(new ProviderError("a", "auth_failed", "anthropic", false), {
        status: 401,
        enFlux: true,
      }),
    );
  });

  it("refus de facturation : alerte « épuisée » demandée avec l'index seul, marque 6 h", async () => {
    const redis = creerFauxRedis();
    const surMarque = vi.fn();
    const appel = vi.fn(async (cle: string) => {
      if (cle === K1) throw brute(400, TEXTE_CREDIT);
      return "ok";
    });
    await appelerAvecRotationCles(appel, options(creerEtatCles({ redis }), vi.fn(), surMarque));
    expect(surMarque).toHaveBeenCalledTimes(1);
    expect(surMarque).toHaveBeenCalledWith({ index: 1, motif: "epuisee" });
    expect(redis.ttls.get("anthropic:cle:1:epuisee")).toBe(6 * 3600);
  });

  it("une alerte qui échoue ne casse pas la génération", async () => {
    const appel = vi.fn(async (cle: string) => {
      if (cle === K1) throw brute(402, "x");
      return "ok";
    });
    const surMarque = vi.fn(async () => {
      throw new Error("telegram en panne");
    });
    await expect(
      appelerAvecRotationCles(appel, options(undefined, vi.fn(), surMarque)),
    ).resolves.toBe("ok");
  });

  it("une alerte qui ne répond jamais n'attend pas : la clé suivante est appelée sans délai", async () => {
    vi.useFakeTimers();
    try {
      const appel = vi.fn(async (cle: string) => {
        if (cle === K1) throw brute(402, "x");
        return "ok";
      });
      const surMarque = vi.fn(() => new Promise<never>(() => {}));
      const resultat = appelerAvecRotationCles(appel, options(undefined, vi.fn(), surMarque));
      // Aucun avancement d'horloge : seules les microtâches tournent.
      await vi.advanceTimersByTimeAsync(0);
      await expect(resultat).resolves.toBe("ok");
      expect(surMarque).toHaveBeenCalledTimes(1);
      expect(appel.mock.calls.map((c) => c[0])).toEqual([K1, K2]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("une alerte qui lève de façon synchrone ne casse pas non plus la génération", async () => {
    const appel = vi.fn(async (cle: string) => {
      if (cle === K1) throw brute(402, "x");
      return "ok";
    });
    const surMarque = vi.fn(() => {
      throw new Error("alerte cassée");
    });
    await expect(
      appelerAvecRotationCles(appel, options(undefined, vi.fn(), surMarque)),
    ).resolves.toBe("ok");
  });

  it("état partagé : le worker ne rejoue pas une clé que l'app a déjà marquée", async () => {
    const redis = creerFauxRedis();
    const app = creerEtatCles({ redis });
    const worker = creerEtatCles({ redis });
    await appelerAvecRotationCles(async (cle: string) => {
      if (cle === K1) throw brute(402, "x");
      return "ok";
    }, options(app));
    const appelWorker = vi.fn(async (_cle: string) => "ok");
    await appelerAvecRotationCles(appelWorker, options(worker));
    expect(appelWorker.mock.calls.map((c) => c[0])).toEqual([K2]);
  });

  it("toutes les clés refusées en 401 : auth_failed, statut conservé, toutesEpuisees true", async () => {
    const appel = vi.fn(async (_cle: string) => {
      throw brute(401, "invalid x-api-key");
    });
    const err = await appelerAvecRotationCles(appel, options()).catch((x) => x);
    expect(err.code).toBe("auth_failed");
    expect(err.status).toBe(401);
    expect(err.toutesEpuisees).toBe(true);
    expect(err.motifIndisponibilite).toBe("authentification");
    expect(appel).toHaveBeenCalledTimes(3);
  });

  it("mélange crédit + 401 : quota_exhausted, toutesEpuisees true, motif « mixte »", async () => {
    const appel = vi.fn(async (cle: string) => {
      throw cle === K2 ? brute(401, "invalid x-api-key") : brute(402, "x");
    });
    const err = await appelerAvecRotationCles(appel, options()).catch((x) => x);
    expect(err.code).toBe("quota_exhausted");
    expect(err.toutesEpuisees).toBe(true);
    expect(err.motifIndisponibilite).toBe("mixte");
  });

  it("Redis en panne : la rotation fonctionne quand même (mémoire locale)", async () => {
    const redis = creerFauxRedis();
    redis.panne = true;
    const etat = creerEtatCles({ redis, journal: vi.fn() });
    const premier = vi.fn(async (cle: string) => {
      if (cle === K1) throw brute(402, "x");
      return "ok";
    });
    await appelerAvecRotationCles(premier, options(etat));
    const second = vi.fn(async (_cle: string) => "ok");
    await appelerAvecRotationCles(second, options(etat));
    expect(second.mock.calls.map((c) => c[0])).toEqual([K2]);
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
    expect(err.toutesEpuisees).toBe(true);
    expect(err.motifIndisponibilite).toBe("credit");
    const cles = appel.mock.calls.map((c) => c[0]);
    expect(cles).toEqual([K1, K2, K3]);
    expect(new Set(cles).size).toBe(3);
  });

  it("état déjà tout épuisé : aucun appel, quota_exhausted", async () => {
    const etat = creerEtatCles({ redis: creerFauxRedis() });
    for (const k of [K1, K2, K3]) await etat.marquer(INDEX[k]!, "epuisee");
    const appel = vi.fn(async (_cle: string) => "ok");
    const err = await appelerAvecRotationCles(appel, options(etat)).catch((x) => x);
    expect(err.code).toBe("quota_exhausted");
    expect(err.toutesEpuisees).toBe(true);
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
    await appelerAvecRotationCles(
      appel,
      options(creerEtatCles({ redis: creerFauxRedis() }), journal),
    ).catch(() => {});
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
    expect(sortie).toContain("6 h");
  });
});
