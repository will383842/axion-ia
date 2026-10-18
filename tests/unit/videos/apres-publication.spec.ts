// Tout ce qui suit une publication ou un retrait (W3.7) : cache, edge, IndexNow.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apresPublication,
  urlsAImpacter,
  type VerrouPurgeLarge,
} from "@/server/videos/apres-publication";

const effet = {
  type: "publication",
  slug: "ma-video",
  theme: "audit-ia",
  serieSlug: "ma-serie",
} as const;

function deps(over: Record<string, unknown> = {}) {
  return {
    viderCache: vi.fn(),
    revalidateTag: vi.fn(),
    revalidatePath: vi.fn(),
    revalidateGabarit: vi.fn(),
    purgerEdgeLarge: vi.fn(async () => ({ purgee: true, configure: true })),
    verrouPurgeLarge: {
      prendre: vi.fn(async () => true),
      debut: vi.fn(async () => null),
      ttlMs: vi.fn(async () => 0),
      liberer: vi.fn(async () => undefined),
    },
    purgerEdge: vi.fn(async () => ({
      cheminsRevalides: [],
      urlsPurgees: [],
      edgeConfigure: true,
      urlsEcartees: 0,
    })),
    indexNow: vi.fn(async () => ({ accepted: "https://yandex.com/indexnow", attempts: ["ok"] })),
    cleIndexNow: "cle",
    siteUrl: "https://axion-ia.com",
    alerter: vi.fn(),
    ...over,
  };
}

describe("urlsAImpacter", () => {
  it("page, galerie, thème, série, llms, plan du site", () => {
    expect(urlsAImpacter(effet)).toEqual(
      expect.arrayContaining([
        "/fr/videos/ma-video",
        "/fr/videos",
        "/fr/videos/theme/audit-ia",
        "/fr/videos/serie/ma-serie",
        "/llms.txt",
        "/llms-full.txt",
        "/sitemap-index.xml",
        "/sitemap-videos.xml",
        // Liste publique lue par le proxy pour le 410 : sans sa purge, un retrait tarde ~10 min.
        "/api/interne/videos/retirees",
      ]),
    );
  });
  it("pages hôtes des encarts : pages de service et formations (revalidées ET purgées à l'edge)", () => {
    const u = urlsAImpacter({ ...effet, type: "retrait" });
    for (const hote of [
      "/fr/formations",
      "/fr/un-a-un",
      "/fr/audit",
      "/fr/implementation",
      "/fr/sites-web-augmentes",
    ]) {
      expect(u).toContain(hote);
    }
  });
  it("sans série : pas d'adresse de série", () => {
    expect(urlsAImpacter({ ...effet, serieSlug: null }).some((u) => u.includes("/serie/"))).toBe(
      false,
    );
  });
});

describe("apresPublication", () => {
  it("vide le cache, invalide l'étiquette « videos » et les chemins, purge l'edge", async () => {
    const d = deps();
    await apresPublication(effet, d);
    expect(d.viderCache).toHaveBeenCalled();
    expect(d.revalidateTag).toHaveBeenCalledWith("videos");
    expect(d.revalidatePath).toHaveBeenCalledWith("/fr/videos/ma-video");
    expect(d.purgerEdge).toHaveBeenCalled();
  });

  it.each(["publication", "retrait"] as const)(
    "%s : les gabarits hôtes d'encarts (villes, blog, fiches formation) sont revalidés",
    async (type) => {
      const d = deps();
      await apresPublication({ ...effet, type }, d);
      const g = d.revalidateGabarit.mock.calls.map((c: unknown[]) => c[0]);
      expect(g).toEqual(
        expect.arrayContaining([
          "/[locale]/implantations/[region]/[ville]",
          "/[locale]/blog/[slug]",
          "/[locale]/formations/[slug]",
        ]),
      );
    },
  );

  it("IndexNow succès → l'URL de la PAGE est notifiée, pas d'alerte", async () => {
    const d = deps();
    const r = await apresPublication(effet, d);
    expect(d.indexNow).toHaveBeenCalledTimes(1);
    expect(d.indexNow.mock.calls[0]).toEqual([
      "axion-ia.com",
      "cle",
      ["https://axion-ia.com/fr/videos/ma-video"],
    ]);
    expect(d.alerter).not.toHaveBeenCalled();
    expect(r.indexnow).toBe("ok");
  });

  it("IndexNow en échec → ALERTE émise, jamais d'exception (la publication reste réussie)", async () => {
    const d = deps({
      indexNow: vi.fn(async () => ({ accepted: null, attempts: ["a → 403", "b → 500"] })),
    });
    const r = await apresPublication(effet, d);
    expect(r.indexnow).toBe("echec");
    expect(d.alerter).toHaveBeenCalledTimes(1);
    expect(String(d.alerter.mock.calls[0]![0])).toMatch(/indexnow/i);
  });

  it("IndexNow qui lève une exception → alerte, pas d'exception", async () => {
    const d = deps({
      indexNow: vi.fn(async () => {
        throw new Error("réseau");
      }),
    });
    await expect(apresPublication(effet, d)).resolves.toMatchObject({ indexnow: "echec" });
    expect(d.alerter).toHaveBeenCalled();
  });

  it("clé IndexNow absente → « non configuré », alerte (pas un silence)", async () => {
    const d = deps({ cleIndexNow: undefined });
    const r = await apresPublication(effet, d);
    expect(r.indexnow).toBe("non_configure");
    expect(d.indexNow).not.toHaveBeenCalled();
    expect(d.alerter).toHaveBeenCalled();
  });

  it("une étape qui échoue n'empêche pas les suivantes", async () => {
    const d = deps({
      revalidateTag: vi.fn(() => {
        throw new Error("hors requête");
      }),
    });
    const r = await apresPublication(effet, d);
    expect(d.purgerEdge).toHaveBeenCalled();
    expect(d.indexNow).toHaveBeenCalled();
    expect(r.erreurs).toContain("revalidateTag");
  });

  it("un RETRAIT fait exactement la même chose (une seule fonction)", async () => {
    const d = deps();
    await apresPublication({ ...effet, type: "retrait" }, d);
    expect(d.viderCache).toHaveBeenCalled();
    expect(d.revalidateTag).toHaveBeenCalledWith("videos");
    expect(d.indexNow).toHaveBeenCalled();
  });

  // Les copies d'edge des 2 157 villes, des articles et des fiches ne se purgent pas par adresse
  // (plafond de 30 URLs) : au RETRAIT seulement (événement rare), purge large.
  it("retrait → la purge d'edge large est appelée, APRÈS la revalidation de l'origine", async () => {
    const ordre: string[] = [];
    const d = deps({
      revalidateGabarit: vi.fn(() => ordre.push("origine")),
      purgerEdgeLarge: vi.fn(async () => {
        ordre.push("edge-large");
        return { purgee: true, configure: true };
      }),
    });
    await apresPublication({ ...effet, type: "retrait" }, d);
    expect(d.purgerEdgeLarge).toHaveBeenCalledTimes(1);
    expect(ordre.lastIndexOf("origine")).toBeLessThan(ordre.indexOf("edge-large"));
  });

  it("publication → la purge d'edge large n'est PAS appelée", async () => {
    const d = deps();
    await apresPublication(effet, d);
    expect(d.purgerEdgeLarge).not.toHaveBeenCalled();
  });

  it("l'échec de la purge large est isolé : IndexNow part quand même, l'étape est signalée", async () => {
    const d = deps({
      purgerEdgeLarge: vi.fn(async () => {
        throw new Error("cloudflare");
      }),
    });
    const r = await apresPublication({ ...effet, type: "retrait" }, d);
    expect(d.indexNow).toHaveBeenCalled();
    expect(r.erreurs).toContain("purgerEdgeLarge");
  });

  // Chemin RÉEL : `purgerToutEdge` ne lève jamais (429, secrets absents → `purgee: false`).
  describe("purge large — vrai chemin (fetch simulé)", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });

    it("Cloudflare répond 429 → erreurs + alerte, IndexNow part quand même", async () => {
      vi.stubEnv("CLOUDFLARE_API_TOKEN", "jeton");
      vi.stubEnv("CLOUDFLARE_ZONE_ID", "zone");
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
      vi.stubGlobal("fetch", fetchMock);
      const d = deps({ purgerEdgeLarge: undefined });
      const r = await apresPublication({ ...effet, type: "retrait" }, d);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(r.erreurs).toContain("purgerEdgeLarge");
      expect(d.alerter).toHaveBeenCalledWith(
        expect.stringContaining("copie d'edge non purgée"),
        expect.objectContaining({ slug: "ma-video", configure: true }),
      );
      expect(d.indexNow).toHaveBeenCalled();
    });

    it("secrets Cloudflare absents → erreurs + alerte (configure: false), aucun appel", async () => {
      vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
      vi.stubEnv("CLOUDFLARE_ZONE_ID", "");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const d = deps({ purgerEdgeLarge: undefined });
      const r = await apresPublication({ ...effet, type: "retrait" }, d);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(r.erreurs).toContain("purgerEdgeLarge");
      expect(d.alerter).toHaveBeenCalledWith(
        expect.stringContaining("copie d'edge non purgée"),
        expect.objectContaining({ slug: "ma-video", configure: false }),
      );
      expect(d.indexNow).toHaveBeenCalled();
    });

    it("succès → ni erreur ni alerte", async () => {
      vi.stubEnv("CLOUDFLARE_API_TOKEN", "jeton");
      vi.stubEnv("CLOUDFLARE_ZONE_ID", "zone");
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("{}", { status: 200 })),
      );
      const d = deps({ purgerEdgeLarge: undefined });
      const r = await apresPublication({ ...effet, type: "retrait" }, d);
      expect(r.erreurs).not.toContain("purgerEdgeLarge");
      expect(d.alerter).not.toHaveBeenCalled();
    });
  });

  // Une purge large par fenêtre de 60 s, MAIS sans perdre un retrait : le verrou porte l'heure de
  // démarrage de la purge ; un retrait B qui trouve le verrou pris attend la fin de la fenêtre
  // puis compare l'heure de son retrait (tB) à celle de la purge qui le tient.
  describe("purge large — fenêtre de 60 s et purge de rattrapage (timers simulés)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function verrouMemoire(): VerrouPurgeLarge {
      let cle: { debut: number; expire: number } | null = null;
      const vivante = () => (cle && cle.expire > Date.now() ? cle : null);
      return {
        prendre: vi.fn(async (debut: number) => {
          if (vivante()) return false;
          cle = { debut, expire: Date.now() + 60_000 };
          return true;
        }),
        debut: vi.fn(async () => vivante()?.debut ?? null),
        ttlMs: vi.fn(async () => (vivante() ? vivante()!.expire - Date.now() : 0)),
        liberer: vi.fn(async (debut: number) => {
          if (cle?.debut === debut) cle = null;
        }),
      };
    }

    it("A à t=0 puis B à t=30 s : la purge de A ne couvre pas B → 2e purge APRÈS la revalidation de B", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
      const verrou = verrouMemoire();
      const ordre: string[] = [];
      const purge = vi.fn(async () => {
        ordre.push(`purge@${Date.now() - Date.parse("2026-10-18T12:00:00Z")}`);
        return { purgee: true, configure: true };
      });
      const dA = deps({ verrouPurgeLarge: verrou, purgerEdgeLarge: purge });
      const dB = deps({
        verrouPurgeLarge: verrou,
        purgerEdgeLarge: purge,
        revalidateGabarit: vi.fn(() => ordre.push("origine-B")),
      });
      await apresPublication({ ...effet, type: "retrait", slug: "a" }, dA);
      expect(purge).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30_000);
      const pB = apresPublication({ ...effet, type: "retrait", slug: "b" }, dB);
      await vi.advanceTimersByTimeAsync(29_000);
      expect(purge).toHaveBeenCalledTimes(1); // B attend encore la fin de la fenêtre
      await vi.advanceTimersByTimeAsync(2_000);
      const rB = await pB;

      expect(purge).toHaveBeenCalledTimes(2);
      expect(ordre.lastIndexOf("origine-B")).toBeLessThan(ordre.lastIndexOf("purge@61000"));
      expect(rB.erreurs).not.toContain("purgerEdgeLarge");
      expect(dB.alerter).not.toHaveBeenCalled();
      expect(dB.indexNow).toHaveBeenCalled();
    });

    it("B arrive pendant la purge de A, démarrée APRÈS la revalidation de B : B est couvert, pas de 2e purge", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
      const verrou = verrouMemoire();
      // Une purge de rattrapage a démarré à t=+5 s ; B a été revalidé à t=+2 s.
      await verrou.prendre(Date.now() + 5_000);
      const purge = vi.fn(async () => ({ purgee: true, configure: true }));
      const d = deps({ verrouPurgeLarge: verrou, purgerEdgeLarge: purge });
      await apresPublication({ ...effet, type: "retrait", slug: "b" }, d);
      expect(purge).not.toHaveBeenCalled();
      expect(d.alerter).not.toHaveBeenCalled();
    });

    it("la purge de A échoue (429) puis B dans la fenêtre : le verrou est libéré, B repurge aussitôt", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      vi.stubEnv("CLOUDFLARE_API_TOKEN", "jeton");
      vi.stubEnv("CLOUDFLARE_ZONE_ID", "zone");
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
        .mockResolvedValueOnce(new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const verrou = verrouMemoire();
      const dA = deps({ verrouPurgeLarge: verrou, purgerEdgeLarge: undefined });
      const dB = deps({ verrouPurgeLarge: verrou, purgerEdgeLarge: undefined });
      const rA = await apresPublication({ ...effet, type: "retrait", slug: "a" }, dA);
      expect(rA.erreurs).toContain("purgerEdgeLarge");
      expect(dA.alerter).toHaveBeenCalled();
      expect(verrou.liberer).toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(10_000);
      const rB = await apresPublication({ ...effet, type: "retrait", slug: "b" }, dB);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(rB.erreurs).not.toContain("purgerEdgeLarge");
      expect(dB.alerter).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });

    it("verrou par défaut (Redis injoignable, repli mémoire) : A puis B à +30 s = 2 purges", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
      vi.doMock("@/lib/redis", () => ({
        redis: {
          set: vi.fn(async () => {
            throw new Error("redis down");
          }),
          get: vi.fn(async () => {
            throw new Error("redis down");
          }),
          pttl: vi.fn(async () => {
            throw new Error("redis down");
          }),
          del: vi.fn(async () => {
            throw new Error("redis down");
          }),
        },
      }));
      vi.resetModules();
      const { apresPublication: ap } = await import("@/server/videos/apres-publication");
      const purge = vi.fn(async () => ({ purgee: true, configure: true }));
      const d = deps({ verrouPurgeLarge: undefined, purgerEdgeLarge: purge });
      await ap({ ...effet, type: "retrait", slug: "a" }, d);
      await vi.advanceTimersByTimeAsync(30_000);
      const pB = ap({ ...effet, type: "retrait", slug: "b" }, d);
      await vi.advanceTimersByTimeAsync(31_000);
      await pB;
      expect(purge).toHaveBeenCalledTimes(2);
    });
  });
});
