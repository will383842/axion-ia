// Tout ce qui suit une publication ou un retrait (W3.7) : cache, edge, IndexNow.
import { describe, expect, it, vi } from "vitest";
import { apresPublication, urlsAImpacter } from "@/server/videos/apres-publication";

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
      ]),
    );
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
});
