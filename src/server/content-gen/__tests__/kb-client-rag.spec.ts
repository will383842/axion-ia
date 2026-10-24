/**
 * Lot L6 (audit blog/RAG 2026-10-24) — kb-client : requête sans préfixe, fiches
 * dépréciées exclues, seuil de pertinence, extraits du corps, mode réellement utilisé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const searchKnowledgeMock = vi.fn();
const searchKnowledgeVectorMock = vi.fn();
const generateEmbeddingMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/knowledge/search-fts", () => ({
  searchKnowledge: (...a: unknown[]) => searchKnowledgeMock(...a),
}));
vi.mock("@/lib/knowledge/search-vector", () => ({
  searchKnowledgeVector: (...a: unknown[]) => searchKnowledgeVectorMock(...a),
}));
vi.mock("@/lib/knowledge/embeddings", () => ({
  generateEmbedding: (...a: unknown[]) => generateEmbeddingMock(...a),
}));
vi.mock("@/content/pricing-tokens", () => ({
  resolvePriceTokens: (t: string) => t,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { knowledgeTranslation: { findMany: (...a: unknown[]) => findManyMock(...a) } },
}));

import {
  assemblerExtrait,
  choisirPassages,
  EXTRAIT_MAX_CARACTERES,
  nettoyerRequete,
  retrieve,
  retrieveAvecMode,
  SEUIL_SIMILARITE_VECTEUR,
} from "../kb-client";

function hit(id: string, rank: number) {
  return {
    entryId: `e-${id}`,
    translationId: `t-${id}`,
    type: "faq",
    slug: `slug-${id}`,
    title: `Titre ${id}`,
    excerpt: `Résumé ${id}`,
    locale: "fr",
    rank,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  searchKnowledgeMock.mockResolvedValue({ hits: [hit("1", 0.4)], total: 1 });
  searchKnowledgeVectorMock.mockResolvedValue({ hits: [], total: 0 });
  generateEmbeddingMock.mockResolvedValue({
    embedding: [0.1, 0.2],
    modelVersion: "2026-06",
  });
  findManyMock.mockResolvedValue([]);
});

describe("nettoyerRequete", () => {
  it("retire le préfixe Axion-IA", () => {
    expect(nettoyerRequete("Axion-IA audit IA PME restauration")).toBe("audit IA PME restauration");
    expect(nettoyerRequete("axion ia : formation équipe")).toBe("formation équipe");
  });

  it("garde la requête si elle ne contient que le préfixe, et ne coupe pas un autre mot", () => {
    expect(nettoyerRequete("Axion-IA")).toBe("Axion-IA");
    expect(nettoyerRequete("Axion-IAxyz sujet")).toBe("Axion-IAxyz sujet");
  });
});

describe("retrieve — fiches dépréciées et requête", () => {
  it("n'envoie au FTS ni le préfixe ni les fiches dépréciées", async () => {
    await retrieve({ query: "Axion-IA audit IA PME", locale: "fr" });
    const params = searchKnowledgeMock.mock.calls[0]?.[0] as { query: string; statuts: string[] };
    expect(params.query).toBe("audit IA PME");
    expect(params.statuts).toEqual(["published"]);
    expect(params.statuts).not.toContain("deprecated");
  });

  it("n'envoie au vectoriel ni le préfixe ni les fiches dépréciées, et demande un vecteur de requête", async () => {
    await retrieve({ query: "Axion-IA audit IA PME", locale: "fr", mode: "vector" });
    expect(generateEmbeddingMock).toHaveBeenCalledWith("audit IA PME", "public", "query");
    const params = searchKnowledgeVectorMock.mock.calls[0]?.[0] as { statuts: string[] };
    expect(params.statuts).toEqual(["published"]);
  });
});

describe("retrieve — seuil de pertinence", () => {
  it("écarte un passage FTS de rang nul", async () => {
    searchKnowledgeMock.mockResolvedValue({ hits: [hit("1", 0), hit("2", 0.2)], total: 2 });
    const chunks = await retrieve({ query: "sujet", locale: "fr" });
    expect(chunks.map((c) => c.translationId)).toEqual(["t-2"]);
  });

  it("écarte un passage vectoriel sous 0,35 et garde celui au seuil", async () => {
    searchKnowledgeVectorMock.mockResolvedValue({
      hits: [hit("1", 0.9), hit("2", SEUIL_SIMILARITE_VECTEUR), hit("3", 0.34)],
      total: 3,
    });
    const chunks = await retrieve({ query: "sujet", locale: "fr", mode: "vector" });
    expect(chunks.map((c) => c.translationId)).toEqual(["t-1", "t-2"]);
  });
});

describe("retrieveAvecMode — mode réellement utilisé", () => {
  it("fts demandé = fts utilisé", async () => {
    const r = await retrieveAvecMode({ query: "sujet", locale: "fr" });
    expect(r.modeDemande).toBe("fts");
    expect(r.modeUtilise).toBe("fts");
    expect(r.chunks[0]?.modeUtilise).toBe("fts");
  });

  it("vector demandé sans vecteurs = repli tracé", async () => {
    generateEmbeddingMock.mockResolvedValue({ embedding: [0.1], modelVersion: "2026-06-stub" });
    const r = await retrieveAvecMode({ query: "sujet", locale: "fr", mode: "vector" });
    expect(r.modeDemande).toBe("vector");
    expect(r.modeUtilise).toBe("fts_repli");
    expect(r.chunks[0]?.modeUtilise).toBe("fts_repli");
  });

  it("hybrid avec des vecteurs = hybrid", async () => {
    searchKnowledgeVectorMock.mockResolvedValue({ hits: [hit("2", 0.8)], total: 1 });
    const r = await retrieveAvecMode({ query: "sujet", locale: "fr", mode: "hybrid" });
    expect(r.modeUtilise).toBe("hybrid");
    expect(r.chunks.map((c) => c.translationId).sort()).toEqual(["t-1", "t-2"]);
  });

  it("hybrid sans vecteurs = repli tracé", async () => {
    const r = await retrieveAvecMode({ query: "sujet", locale: "fr", mode: "hybrid" });
    expect(r.modeUtilise).toBe("fts_repli");
  });
});

describe("extraits du corps", () => {
  const corps = [
    "Introduction courte sans intérêt pour la question posée ici.",
    "Un audit de maturité IA permet à une PME de repérer ses tâches répétitives à automatiser.",
    "Le calendrier des vacances scolaires n'a rien à voir avec le sujet de la fiche.",
    "Pour une PME, l'audit commence par un entretien avec le dirigeant et les équipes.",
  ].join("\n");

  it("choisirPassages prend les paragraphes proches de la requête, dans l'ordre du texte", () => {
    const p = choisirPassages(corps, "audit PME automatiser");
    expect(p).toHaveLength(2);
    expect(p[0]).toContain("maturité IA");
    expect(p[1]).toContain("entretien");
  });

  it("choisirPassages prend le premier paragraphe sans recouvrement, et rien si le corps est vide", () => {
    expect(choisirPassages(corps, "zzzz")).toEqual([
      "Introduction courte sans intérêt pour la question posée ici.",
    ]);
    expect(choisirPassages("", "audit")).toEqual([]);
    expect(choisirPassages("court\n\nbref", "audit")).toEqual([]);
  });

  it("choisirPassages ne dépasse jamais 3 passages", () => {
    const beaucoup = Array.from(
      { length: 6 },
      (_, i) => `Paragraphe ${i} sur l'audit de la PME, assez long pour être retenu.`,
    ).join("\n");
    expect(choisirPassages(beaucoup, "audit PME").length).toBeLessThanOrEqual(3);
  });

  it("assemblerExtrait plafonne à 600 caractères", () => {
    const long = "x".repeat(900);
    const e = assemblerExtrait("Résumé", [long]);
    expect(e).not.toBeNull();
    expect(e!.length).toBeLessThanOrEqual(EXTRAIT_MAX_CARACTERES);
    expect(e!.startsWith("Résumé")).toBe(true);
  });

  it("retrieve ajoute les passages du corps au résumé", async () => {
    findManyMock.mockResolvedValue([{ id: "t-1", bodyText: corps }]);
    const chunks = await retrieve({ query: "Axion-IA audit PME automatiser", locale: "fr" });
    expect(chunks[0]?.excerpt).toContain("Résumé 1");
    expect(chunks[0]?.excerpt).toContain("maturité IA");
    expect((chunks[0]?.excerpt ?? "").length).toBeLessThanOrEqual(EXTRAIT_MAX_CARACTERES);
  });

  it("retrieve garde le résumé d'origine si la lecture du corps échoue", async () => {
    findManyMock.mockRejectedValue(new Error("base indisponible"));
    const chunks = await retrieve({ query: "audit", locale: "fr" });
    expect(chunks[0]?.excerpt).toBe("Résumé 1");
  });
});
