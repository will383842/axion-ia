/**
 * V3-3 — Base unique du chatbot : lecteur KnowledgeEntry derrière
 * `CHATBOT_KB_UNIFIED` (éteint par défaut), repli sur `chat_kb_chunks`,
 * essai à blanc sans écriture.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/chatbot/embeddings", () => ({ embedChatbotText: vi.fn() }));

import {
  chercherDansKnowledgeEntry,
  contenuDeFiche,
  creerRechercheChatbot,
  estKbUnifieeActive,
  KE_CONTENU_MAX,
  montantsHorsJourneeIa,
  type KnowledgeEntryRow,
} from "@/server/chatbot/retrieval/knowledge-entry-search";
import type { RetrievedChunk } from "@/server/chatbot/retrieval/hybrid-search";

const CHUNKS: RetrievedChunk[] = [
  {
    id: "c1",
    sourceType: "faq",
    sourceRef: "prix-journee-ia",
    categorie: "faq",
    contenu: "La Journée IA coûte 1 490 € HT.",
    contexte: null,
    score: 0.03,
  },
];

const FICHE: RetrievedChunk = {
  id: "ke:journee-ia",
  sourceType: "knowledge_entry",
  sourceRef: "journee-ia",
  categorie: "guide",
  contenu: "Journée IA",
  contexte: null,
  score: 1 / 61,
};

describe("interrupteur CHATBOT_KB_UNIFIED", () => {
  it("éteint par défaut : absent, vide, « 1 », « TRUE » ne l'allument pas", () => {
    expect(estKbUnifieeActive({})).toBe(false);
    for (const v of ["", "1", "TRUE", "yes", "false"]) {
      expect(estKbUnifieeActive({ CHATBOT_KB_UNIFIED: v })).toBe(false);
    }
    expect(estKbUnifieeActive({ CHATBOT_KB_UNIFIED: "true" })).toBe(true);
  });

  it("éteint : délègue à hybridSearch avec les MÊMES arguments et rend le MÊME objet", async () => {
    const hybrid = vi.fn().mockResolvedValue(CHUNKS);
    const ke = vi.fn();
    const recherche = creerRechercheChatbot({ env: {}, hybrid, knowledgeEntry: ke });
    const opts = { topK: 7 };
    const r = await recherche("tenant-1", "Combien coûte la Journée IA ?", opts);
    expect(r).toBe(CHUNKS);
    expect(hybrid).toHaveBeenCalledTimes(1);
    expect(hybrid).toHaveBeenCalledWith("tenant-1", "Combien coûte la Journée IA ?", opts);
    expect(ke).not.toHaveBeenCalled();
  });

  it("éteint : sérialisation identique octet pour octet à l'appel direct", async () => {
    const hybrid = vi.fn().mockResolvedValue(CHUNKS);
    const recherche = creerRechercheChatbot({ env: { CHATBOT_KB_UNIFIED: "0" }, hybrid });
    const direct = JSON.stringify(await hybrid("t", "q", {}));
    expect(JSON.stringify(await recherche("t", "q", {}))).toBe(direct);
  });

  it("allumé : fusionne (RRF) fiches et chat_kb_chunks — les faits vérifiés restent", async () => {
    const hybrid = vi.fn().mockResolvedValue(CHUNKS);
    const ke = vi.fn().mockResolvedValue([FICHE]);
    const recherche = creerRechercheChatbot({
      env: { CHATBOT_KB_UNIFIED: "true" },
      hybrid,
      knowledgeEntry: ke,
    });
    const r = await recherche("t", "Journée IA", { topK: 5 });
    expect(ke).toHaveBeenCalledWith("Journée IA", { topK: 5 });
    expect(hybrid).toHaveBeenCalledWith("t", "Journée IA", { topK: 5 });
    expect(r.map((c) => c.id).sort()).toEqual(["c1", "ke:journee-ia"]);
    expect(r.every((c) => c.score > 0 && c.score <= 1 / 61)).toBe(true);
  });

  it("allumé : repli sur chat_kb_chunks si aucune fiche", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const hybrid = vi.fn().mockResolvedValue(CHUNKS);
    const recherche = creerRechercheChatbot({
      env: { CHATBOT_KB_UNIFIED: "true" },
      hybrid,
      knowledgeEntry: vi.fn().mockResolvedValue([]),
    });
    expect(await recherche("t", "q", {})).toBe(CHUNKS);
    warn.mockRestore();
  });

  it("allumé : repli sur chat_kb_chunks si la lecture des fiches échoue", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const hybrid = vi.fn().mockResolvedValue(CHUNKS);
    const recherche = creerRechercheChatbot({
      env: { CHATBOT_KB_UNIFIED: "true" },
      hybrid,
      knowledgeEntry: vi.fn().mockRejectedValue(new Error("relation absente")),
    });
    expect(await recherche("t", "q", {})).toBe(CHUNKS);
    expect(hybrid).toHaveBeenCalledWith("t", "q", {});
    warn.mockRestore();
  });

  it("allumé : lecture des fiches trop lente → repli sur la recherche actuelle, aucune exception", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const hybrid = vi.fn().mockResolvedValue(CHUNKS);
    const recherche = creerRechercheChatbot({
      env: { CHATBOT_KB_UNIFIED: "true" },
      hybrid,
      delaiFichesMs: 20,
      knowledgeEntry: vi.fn(() => new Promise<RetrievedChunk[]>(() => {})),
    });
    await expect(recherche("t", "q", {})).resolves.toBe(CHUNKS);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("allumé : fiches et recherche actuelle partent en parallèle", async () => {
    const ordre: string[] = [];
    const hybrid = vi.fn(async () => {
      ordre.push("hybrid");
      return CHUNKS;
    });
    const ke = vi.fn(async () => {
      ordre.push("ke");
      return [FICHE];
    });
    const recherche = creerRechercheChatbot({
      env: { CHATBOT_KB_UNIFIED: "true" },
      hybrid,
      knowledgeEntry: ke,
    });
    await recherche("t", "q", {});
    expect(ordre.sort()).toEqual(["hybrid", "ke"]);
  });

  it("allumé : une fiche dont le sourceRef est déjà dans les chunks est ignorée (doublon)", async () => {
    const doublon: RetrievedChunk = { ...FICHE, id: "ke:x", sourceRef: CHUNKS[0]!.sourceRef };
    const recherche = creerRechercheChatbot({
      env: { CHATBOT_KB_UNIFIED: "true" },
      hybrid: vi.fn().mockResolvedValue(CHUNKS),
      knowledgeEntry: vi.fn().mockResolvedValue([doublon]),
    });
    expect(await recherche("t", "q", {})).toBe(CHUNKS);
  });

  it("allumé : un chunk `slug#3` écarte la fiche `slug` (sourceRef de chunk découpé)", async () => {
    const chunkDecoupe: RetrievedChunk = { ...CHUNKS[0]!, sourceRef: "journee-ia#3" };
    const fiche: RetrievedChunk = { ...FICHE, id: "ke:j", sourceRef: "journee-ia" };
    const recherche = creerRechercheChatbot({
      env: { CHATBOT_KB_UNIFIED: "true" },
      hybrid: vi.fn().mockResolvedValue([chunkDecoupe]),
      knowledgeEntry: vi.fn().mockResolvedValue([fiche]),
    });
    const r = await recherche("t", "q", {});
    expect(r.map((c) => c.sourceRef)).toEqual(["journee-ia#3"]);
  });

  it("allumé : la recherche actuelle en erreur reste une erreur", async () => {
    const recherche = creerRechercheChatbot({
      env: { CHATBOT_KB_UNIFIED: "true" },
      hybrid: vi.fn().mockRejectedValue(new Error("db")),
      knowledgeEntry: vi.fn().mockResolvedValue([FICHE]),
    });
    await expect(recherche("t", "q", {})).rejects.toThrow("db");
  });
});

describe("chercherDansKnowledgeEntry", () => {
  const ROW: KnowledgeEntryRow = {
    slug: "journee-ia",
    type: "guide",
    title: "La Journée IA",
    excerpt: "Une journée dans votre entreprise.",
    body_text: "Prix ferme : 1 490 € HT.",
  };

  it("mappe les fiches en passages, score RRF décroissant (échelle du seuil T-11)", async () => {
    const query = vi.fn().mockResolvedValue([ROW, { ...ROW, slug: "ai-act" }]);
    const r = await chercherDansKnowledgeEntry("Journée IA", { topK: 4, query });
    expect(query).toHaveBeenCalledWith("Journée IA", 4);
    expect(r.map((c) => c.sourceRef)).toEqual(["journee-ia", "ai-act"]);
    expect(r[0]).toMatchObject({ sourceType: "knowledge_entry", categorie: "guide" });
    expect(r[0]!.score).toBeCloseTo(1 / 61);
    expect(r[0]!.score).toBeGreaterThan(r[1]!.score);
    expect(r[0]!.contenu).toContain("1 490 € HT");
  });

  it("écarte une fiche qui cite un autre montant que 1 490 €", async () => {
    const query = vi
      .fn()
      .mockResolvedValue([
        ROW,
        { ...ROW, slug: "audit", body_text: "Audit à partir de 2 900 € HT." },
      ]);
    const r = await chercherDansKnowledgeEntry("prix", { query });
    expect(r.map((c) => c.sourceRef)).toEqual(["journee-ia"]);
  });

  it("question vide : aucune requête", async () => {
    const query = vi.fn();
    expect(await chercherDansKnowledgeEntry("   ", { query })).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it("borne la longueur du passage", () => {
    const long = contenuDeFiche({ ...ROW, body_text: "a".repeat(10_000) });
    expect(long.length).toBeLessThanOrEqual(KE_CONTENU_MAX + 1);
  });

  it("la requête SQL ne lit que des fiches publiques publiées, en lecture seule", () => {
    const src = readFileSync("src/server/chatbot/retrieval/knowledge-entry-search.ts", "utf8");
    for (const garde of [
      "ke.deleted_at IS NULL",
      "'published'::\"KbStatus\"",
      "'public'::\"KbAudience\"",
      "'public'::\"KbConfidentiality\"",
      "ke.expires_at IS NULL OR ke.expires_at > NOW()",
    ]) {
      expect(src).toContain(garde);
    }
    expect(src).not.toMatch(
      /\$executeRaw|\b(INSERT|UPDATE|DELETE)\b|\.(create|update|upsert|delete)\w*\(/,
    );
  });

  it("repère tout montant autre que 1 490 €", () => {
    expect(montantsHorsJourneeIa("La Journée IA : 1 490 € HT.")).toEqual([]);
    expect(montantsHorsJourneeIa("Audit à 2 900 € et 1490 euros")).toEqual(["2 900 €"]);
  });
});
