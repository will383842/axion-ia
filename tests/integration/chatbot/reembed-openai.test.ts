// MIGRATION ré-embedding OpenAI (à la demande) — re-embedde TOUS les chat_kb_chunks
// du tenant avec le provider chatbot courant (OpenAI text-embedding-3-small@1024),
// car les 595 chunks existants étaient en espace Voyage (clé désormais invalide).
// Idempotent (relançable). Skip propre si OPENAI_API_KEY absente.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/server/chatbot/tenant";
import { embedChatbotText, CHATBOT_EMBEDDING_DIMENSION } from "@/server/chatbot/embeddings";

const run = process.env.OPENAI_API_KEY && process.env.CHATBOT_EMBEDDINGS_PROVIDER === "openai";
const d = run ? describe : describe.skip;

d("Migration : ré-embedding OpenAI des chunks chatbot", () => {
  it("re-embedde tous les chunks en 1024-dim OpenAI", async () => {
    const t = await getDefaultTenant();
    const tenantId = t!.id;
    const rows = await prisma.$queryRaw<Array<{ id: string; contenu: string }>>`
      SELECT id, contenu FROM "chat_kb_chunks" WHERE "tenant_id" = ${tenantId}::uuid AND "actif" = true
    `;
    expect(rows.length).toBeGreaterThan(100);

    let done = 0;
    // Séquentiel doux (rate-limit OpenAI large pour embeddings ; ~595 appels).
    for (const r of rows) {
      const { embedding, dimensionality } = await embedChatbotText(r.contenu);
      expect(dimensionality).toBe(CHATBOT_EMBEDDING_DIMENSION);
      const literal = `[${embedding.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE "chat_kb_chunks" SET "embedding" = ${literal}::vector, "updated_at" = now()
        WHERE "id" = ${r.id}::uuid
      `;
      done++;
    }
    expect(done).toBe(rows.length);
    // Vérif : tous les chunks ont toujours un embedding non-null.
    const withEmb = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::int AS n FROM "chat_kb_chunks"
      WHERE "tenant_id" = ${tenantId}::uuid AND "actif" = true AND "embedding" IS NOT NULL
    `;
    expect(Number(withEmb[0]!.n)).toBe(rows.length);
    console.log(
      `[ré-embedding OpenAI] ${done} chunks ré-embeddés en ${CHATBOT_EMBEDDING_DIMENSION}-dim`,
    );
  }, 600_000);
});
