// Retrieval hybride (T-06) contre la vraie DB (595 chunks réels, embeddés Voyage
// lors d'une session antérieure). Sans VOYAGE_API_KEY au runtime actuel :
// - FTS (tsv fr_unaccent) fonctionne réellement (0 clé requise) ;
// - le volet vectoriel utilise un STUB d'embedding (cf. embeddings.ts) → on
//   DOCUMENTE/teste le comportement de dégradation.
import { describe, it, expect, beforeAll } from "vitest";
import { hybridSearch } from "@/server/chatbot/retrieval/hybrid-search";
import { getDefaultTenant } from "@/server/chatbot/tenant";
import { prisma } from "@/lib/prisma";

describe("retrieval hybride T-06 (DB réelle)", () => {
  let tenantId: string;

  beforeAll(async () => {
    const t = await getDefaultTenant();
    expect(t).not.toBeNull();
    tenantId = t!.id;
    const count = await prisma.chatKbChunk.count({ where: { tenantId, actif: true } });
    expect(count).toBeGreaterThan(100); // 595 attendus
  });

  it("FTS trouve des chunks pertinents pour une requête métier (sans clé Voyage)", async () => {
    // Requête réaliste mono-terme : websearch_to_tsquery met les termes en AND,
    // donc une question multi-mots dispersés peut ne rien matcher en FTS seul —
    // c'est la limite attendue du repli sans embeddings (le vecteur Voyage
    // assure le recall sémantique en prod). On valide ici le volet lexical réel.
    const chunks = await hybridSearch(tenantId, "formation", { topK: 8 });
    expect(chunks.length).toBeGreaterThan(0);
    const joined = chunks.map((c) => `${c.contenu} ${c.contexte ?? ""}`.toLowerCase()).join(" ");
    expect(joined).toContain("formation");
  });

  it("isolation tenant : un tenant inexistant ne retourne aucun chunk", async () => {
    const FAKE = "00000000-0000-0000-0000-000000000000";
    const chunks = await hybridSearch(FAKE, "formation", { topK: 8 });
    expect(chunks.length).toBe(0);
  });

  const hasRealEmbeddings =
    !!process.env.OPENAI_API_KEY && process.env.CHATBOT_EMBEDDINGS_PROVIDER === "openai";

  it("charabia : pas de pollution stub-vecteur quand AUCUN provider réel (D-1)", async () => {
    const chunks = await hybridSearch(tenantId, "zzqq xkcd wpfm vbnt gibberish nonsense token", {
      topK: 8,
    });
    expect(Array.isArray(chunks)).toBe(true);
    if (!hasRealEmbeddings && !process.env.VOYAGE_API_KEY) {
      // Sans provider réel, embedChatbotText délègue au STUB → hybrid-search bascule
      // FTS-seul (D-1). FTS ne matche rien → 0 résultat (pas de voisins factices).
      expect(chunks.length).toBe(0);
    }
  });

  it.runIf(hasRealEmbeddings)(
    "recall sémantique réel (OpenAI 1024-dim) : requête NL multi-mots → bon chunk",
    async () => {
      // Le FTS seul (websearch AND) ne matcherait pas ; le vecteur OpenAI assure
      // le recall sémantique.
      const chunks = await hybridSearch(
        tenantId,
        "comment se déroule un audit IA dans mon entreprise",
        { topK: 4 },
      );
      expect(chunks.length).toBeGreaterThan(0);
      const joined = chunks.map((c) => c.contenu.toLowerCase()).join(" ");
      expect(joined).toContain("audit");
    },
  );
});
