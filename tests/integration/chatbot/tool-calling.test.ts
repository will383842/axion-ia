// MVP2 tool-calling (T-12/T-13) — prouve que les tools d'enrichissement sont
// RÉELLEMENT invoqués en conversation via la route SSE : qualifier_prospect met
// à jour prospect_profile, chercher_ressource renvoie un article PUBLIÉ réel.
// Réel OpenAI (gpt-4o-mini) — quelques centimes. Skip si pas de clé / flag off.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { driveMessage } from "./drive-conversation";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/server/chatbot/tenant";
import { generateAnswerWithTools } from "@/server/chatbot/generation/tool-calling";
import { verifyOutput } from "@/server/chatbot/security/output-guard";

const run = !!process.env.OPENAI_API_KEY && process.env.CHATBOT_TOOL_CALLING === "true";
const d = run ? describe : describe.skip;

d("MVP2 tool-calling (route SSE réelle, OpenAI)", () => {
  beforeAll(async () => {
    // Vide la cache sémantique : sinon une réponse cachée (run précédent)
    // court-circuite la génération → le tool-calling n'a pas lieu.
    const t = await getDefaultTenant();
    await prisma.$executeRaw`DELETE FROM "chat_semantic_cache" WHERE "tenant_id" = ${t!.id}::uuid`;
  });

  it("T-13 qualifier_prospect : profil révélé → prospect_profile mis à jour en DB", async () => {
    const session = randomUUID();
    const r = await driveMessage(
      "Je dirige une PME industrielle de 80 personnes. En quoi consiste un audit IA pour une structure comme la mienne ?",
      { sessionUuid: session },
    );
    expect(r.status).toBe(200);
    expect(r.events.some((e) => e.type === "error")).toBe(false);

    const convo = await prisma.chatConversation.findUnique({
      where: { sessionUuid: session },
      select: { prospectProfile: true },
    });
    const profile = (convo?.prospectProfile ?? null) as Record<string, unknown> | null;
    // Le LLM doit avoir appelé qualifier_prospect avec au moins le type de structure.
    expect(profile).not.toBeNull();
    expect(profile?.type_structure).toBe("pme");
    console.log(`[tool-calling] prospect_profile = ${JSON.stringify(profile)}`);
  });

  describe("T-13 chercher_ressource (cas client publié réel)", () => {
    let caseStudyId: string;
    const slug = `audit-ia-industrie-test-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      const cs = await prisma.caseStudy.create({
        data: {
          sector: "industrie",
          companySizeRange: "50-100",
          modulesUsed: ["audit"],
          resultsQuantified: { gainTemps: "30%" },
          status: "published",
          publishedAt: new Date(),
          translations: {
            create: {
              locale: "fr",
              title: "Cas client : projet IA générative réussi en PME",
              slug,
              problem: "Une PME cherchait à exploiter l'IA générative.",
              solution: "Axion-IA a déployé un assistant IA générative sur mesure.",
            },
          },
        },
        select: { id: true },
      });
      caseStudyId = cs.id;
    });

    afterAll(async () => {
      await prisma.caseStudyTranslation.deleteMany({ where: { caseStudyId } });
      await prisma.caseStudy.delete({ where: { id: caseStudyId } });
    });

    it("chercher_ressource câblé : cas client publié réel remonté (jamais inventé)", async () => {
      // Câblage tool-calling RÉEL (OpenAI function-calling → registry → DB). Note :
      // au niveau route, `chercher_ressource` n'est atteint que sur intent
      // `explication` (le classifieur déterministe par mots-clés route une demande
      // de ressource pure vers hors_sujet) — limitation notée en RESTE-A-FAIRE.
      // On prouve ici la brique tool-calling elle-même (déterministe et fiable).
      const t = await getDefaultTenant();
      const convo = await prisma.chatConversation.create({
        data: { tenantId: t!.id, sessionUuid: randomUUID() },
        select: { id: true },
      });
      // On force chercher_ressource au 1er tour (déterministe) : la décision LLM
      // d'appel est probabiliste, mais le CÂBLAGE (loop → registry.dispatch → DB →
      // ressource → réponse) est ce qu'on prouve. (qualifier_prospect prouve par
      // ailleurs l'appel AUTO de bout en bout via la route complète.)
      const r = await generateAnswerWithTools({
        systemPrompt: "Tu es l'assistant d'Axion-IA. Réponds en français, sobrement.",
        userPrompt:
          "Avez-vous publié un cas client concret sur l'IA générative ? Donnez-moi le lien exact.",
        tier: "haiku",
        tenantId: t!.id,
        conversationId: convo.id,
        forceToolFirstRound: "chercher_ressource",
      });
      console.log(
        `[tool-calling] tools=${JSON.stringify(r.toolsInvoked)} resource=${JSON.stringify(r.resource)}`,
      );
      // chercher_ressource réellement invoqué et a remonté le cas client seedé.
      expect(r.toolsInvoked).toContain("chercher_ressource");
      expect(r.resource?.url).toBe(`/fr/cas-concrets/${slug}`);
      expect(r.resource?.type).toBe("cas_client");
      // Avec l'URL ressource (DB-vérifiée) autorisée, l'output-guard ne flague
      // aucune URL inventée (c'est ce que fait l'orchestrateur).
      expect(
        verifyOutput(r.text, { extraKnownUrls: [r.resource!.url] }).violations.filter(
          (v) => v.type === "url",
        ),
      ).toEqual([]);
    });
  });
});
