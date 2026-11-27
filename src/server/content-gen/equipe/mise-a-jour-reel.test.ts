import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));

import { phrasesAVerifier, cleQuotaMaj } from "./mise-a-jour-reel";
import { sansBalises } from "./mise-a-jour";

describe("phrasesAVerifier", () => {
  const html =
    "<h2>Titre 2026 du jour</h2><p>Une phrase sans chiffre ici.</p><p>Le coût baisse de 12 % en moyenne.</p><ul><li>Gain de 30 minutes par semaine</li></ul>";
  it("ne garde que les phrases chiffrées, hors titres", () => {
    expect(phrasesAVerifier(html)).toEqual([
      "Le coût baisse de 12 % en moyenne.",
      "Gain de 30 minutes par semaine",
    ]);
  });
  it("chaque phrase se retrouve telle quelle dans le texte brut", () => {
    for (const p of phrasesAVerifier(html)) expect(sansBalises(html)).toContain(p);
  });
  it("plafonne à 25", () => {
    const beaucoup = Array.from(
      { length: 40 },
      (_, i) => `<p>La phrase numéro ${i} dépasse vingt caractères.</p>`,
    ).join("");
    expect(phrasesAVerifier(beaucoup)).toHaveLength(25);
  });
  it("clé de quota par jour", () => {
    expect(cleQuotaMaj(new Date("2026-11-27T10:00:00Z"))).toBe("equipe-maj:quota:2026-11-27");
  });
});

describe("job porteur de la mise à jour réelle", () => {
  const carte = {} as never;
  const contexte = {
    maintenant: new Date("2026-11-27T10:00:00Z"),
    articleId: "art-1",
    titre: "Titre",
    motCle: "audit ia",
    carte,
    urlDe: async () => undefined,
  };

  it("n'utilise plus l'identifiant `maj-<id>` et crée UN porteur, au premier appel payant", async () => {
    vi.resetModules();
    const generer = vi.fn(async () => ({
      output: '["<h2>T</h2><p>Texte.</p>"]',
      costUsd: 0.01,
    }));
    vi.doMock("../providers/blog-claude", () => ({ genererTexteBlogClaude: generer }));
    vi.doMock("../config-store", () => ({
      readContentGenConfigDirect: async (_cle: string, defaut: unknown) => defaut,
    }));
    const { dependancesReelles, PLAFOND_PORTEUR_MAJ_USD } = await import("./mise-a-jour-reel");
    const creer = vi.fn(async () => ({ jobId: "porteur-9", contentType: "blog_from_keywords" }));

    const deps = await dependancesReelles(contexte, creer);
    expect(creer).not.toHaveBeenCalled(); // paresseux : le gardien peut écarter la mise à jour

    await deps.reecrire({
      sections: [{ html: "<h2>T</h2><p>Ancien.</p>" }] as never,
      aRetirer: [],
      raisons: [],
    } as never);
    await deps.reecrire({
      sections: [{ html: "<h2>T</h2><p>Ancien.</p>" }] as never,
      aRetirer: [],
      raisons: [],
    } as never);

    expect(creer).toHaveBeenCalledTimes(1);
    expect(creer).toHaveBeenCalledWith({
      origine: "equipe_maj",
      plafondJobUsd: PLAFOND_PORTEUR_MAJ_USD,
    });
    const requete = (generer.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(requete["jobId"]).toBe("porteur-9");
    expect(requete["jobId"]).not.toBe("maj-art-1");
    expect(requete["contentType"]).toBe("blog_from_keywords");
    vi.doUnmock("../providers/blog-claude");
    vi.doUnmock("../config-store");
  });

  it("création du porteur refusée : l'appel payant est refusé, rien n'est envoyé", async () => {
    vi.resetModules();
    const generer = vi.fn();
    vi.doMock("../providers/blog-claude", () => ({ genererTexteBlogClaude: generer }));
    vi.doMock("../config-store", () => ({
      readContentGenConfigDirect: async (_cle: string, defaut: unknown) => defaut,
    }));
    const { dependancesReelles } = await import("./mise-a-jour-reel");
    const creer = vi.fn(async () => {
      throw new Error("refus");
    });
    const deps = await dependancesReelles(contexte, creer);
    await expect(
      deps.reecrire({ sections: [{ html: "<h2>T</h2>" }], aRetirer: [], raisons: [] } as never),
    ).rejects.toThrow("refus");
    expect(generer).not.toHaveBeenCalled();
    vi.doUnmock("../providers/blog-claude");
    vi.doUnmock("../config-store");
  });
});
