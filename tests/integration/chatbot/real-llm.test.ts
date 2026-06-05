// Validation LLM RÉELLE (Voyage embeddings + rerank + Anthropic génération) via
// la vraie route SSE. NE TOURNE QUE si les clés sont présentes (sinon skip propre).
// Budget : quelques centimes (Haiku + Voyage sur 1-3 tours).
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { driveMessage, finalText } from "./drive-conversation";
import { verifyOutput } from "@/server/chatbot/security/output-guard";
import { prisma } from "@/lib/prisma";

// Provider LLM effectif : OpenAI (défaut) requiert OPENAI_API_KEY ; embeddings
// chatbot via OpenAI aussi. On tourne dès que OpenAI est dispo.
const provider = process.env.CHATBOT_LLM_PROVIDER ?? "openai";
const hasKeys =
  (provider === "openai" && !!process.env.OPENAI_API_KEY) ||
  (provider === "anthropic" && !!process.env.ANTHROPIC_API_KEY);
const d = hasKeys ? describe : describe.skip;

d("RAG réel (embeddings + génération) via route SSE", () => {
  it("explication → streaming token réel + citations réelles + coût persisté", async () => {
    const session = randomUUID();
    const r = await driveMessage("c'est quoi exactement un audit IA chez vous ?", {
      sessionUuid: session,
    });
    expect(r.status).toBe(200);
    // Streaming réel : des deltas token-par-token ont été émis.
    expect(r.events.some((e) => e.type === "delta")).toBe(true);
    const txt = finalText(r);
    expect(txt.length).toBeGreaterThan(40);
    // Zéro-hallucination : aucun prix hors SSOT ni URL inconnue dans la réponse.
    expect(verifyOutput(txt).violations).toEqual([]);
    // Citations réelles issues du retrieval (event sources).
    const srcEvt = r.events.find((e) => e.type === "sources");
    expect(srcEvt).toBeTruthy();

    // Coût + modèle réellement persistés sur le message assistant.
    const convo = await prisma.chatConversation.findUnique({
      where: { sessionUuid: session },
      include: {
        messages: { where: { role: "assistant" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    const msg = convo!.messages[0]!;
    expect(msg.modele).toBeTruthy();
    expect(Number(msg.coutEstime ?? 0)).toBeGreaterThan(0);
    // Log lisible pour le rapport.
    console.log(
      `[RAG réel] modèle=${msg.modele} coût=$${Number(msg.coutEstime).toFixed(6)} sources=${(srcEvt as { sources?: unknown[] }).sources?.length ?? 0}`,
    );
    console.log(`[RAG réel] réponse: ${txt.slice(0, 300)}`);
  });
});
