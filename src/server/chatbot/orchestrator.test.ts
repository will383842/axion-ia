/**
 * T-07 — Orchestrateur conversationnel.
 *
 * Les intentions déterministes (recherche/rdv/hors-sujet) ne touchent ni DB ni
 * LLM (catalogue en mémoire). L'explication utilise un LLM + retrieve mockés.
 * Couvre : cartes prix+url · confirmation avant lien · raccourci · recadrage ·
 * RAG groundé · output-guard bloque une sortie inventée.
 */

import { describe, it, expect, vi } from "vitest";
import { handleTurn } from "@/server/chatbot/orchestrator";
import { DEFAULT_TENANT_SETTINGS } from "@/server/chatbot/constants";
import type { ResolvedTenant } from "@/server/chatbot/tenant";
import type { RetrievedChunk } from "@/server/chatbot/retrieval/hybrid-search";

// Cache sémantique no-op (testé séparément) → les cas explication retombent en
// cache-miss et exercent le chemin retrieval+LLM comme avant.
vi.mock("@/server/chatbot/semantic-cache/cache", () => ({
  lookupSemanticCache: vi.fn(async () => null),
  writeSemanticCache: vi.fn(async () => {}),
}));

const tenant: ResolvedTenant = {
  id: "11111111-1111-1111-1111-111111111111",
  cle: "axion-ia",
  nom: "Axion-IA",
  domaine: null,
  actif: true,
  settings: DEFAULT_TENANT_SETTINGS,
};

const noopRetrieve = vi.fn(async () => [] as RetrievedChunk[]);

describe("T-07 recherche d'offre (déterministe, sans LLM)", () => {
  it("« formations entre 2000 et 3000 € » → cartes avec prix SSOT + urlFR, confirmation demandée", async () => {
    const r = await handleTurn(
      "vous avez des formations entre 2000 et 3000 € ?",
      { tenant },
      { retrieve: noopRetrieve },
    );
    expect(r.intent).toBe("recherche_offre");
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.cards.every((c) => c.urlFR.startsWith("/fr"))).toBe(true);
    expect(r.cards.every((c) => /€|Sur devis/.test(c.prix))).toBe(true);
    // D-CONFIRM : pas de raccourci → on annonce et on demande avant d'envoyer.
    expect(r.sendLinks).toBe(false);
    expect(r.linkFlow.linkState).toBe("proposed");
    expect(r.text).toMatch(/liens/i);
    expect(r.guard.ok).toBe(true);
  });

  it("raccourci « envoie direct » → liens envoyés immédiatement", async () => {
    const r = await handleTurn(
      "envoie direct les formations autour de 2650 €",
      { tenant },
      { retrieve: noopRetrieve },
    );
    expect(r.sendLinks).toBe(true);
    expect(r.linkFlow.linkState).toBe("sent");
  });

  it("confirmation après annonce → renvoie les liens des offres proposées", async () => {
    const r = await handleTurn(
      "oui montrez-moi",
      {
        tenant,
        previousSlots: { vertical: "formation", prixMin: 2000, prixMax: 3000 },
        linkFlow: { linkState: "proposed", proposedOfferIds: ["intervention-essentielle"] },
      },
      { retrieve: noopRetrieve },
    );
    expect(r.sendLinks).toBe(true);
    expect(r.cards.length).toBeGreaterThan(0);
  });
});

describe("T-07 intentions simples", () => {
  it("rdv → lien /fr/appel", async () => {
    const r = await handleTurn(
      "je veux prendre rendez-vous",
      { tenant },
      { retrieve: noopRetrieve },
    );
    expect(r.intent).toBe("rdv");
    expect(r.rdvUrl).toBe("/fr/appel");
  });

  it("hors-sujet → recadrage, pas de carte", async () => {
    const r = await handleTurn(
      "vous faites de la comptabilité ?",
      { tenant },
      { retrieve: noopRetrieve },
    );
    expect(r.intent).toBe("hors_sujet");
    expect(r.cards).toEqual([]);
    expect(r.text).toMatch(/Axion-IA/);
  });
});

describe("T-07 explication (RAG + LLM mockés)", () => {
  const chunks: RetrievedChunk[] = [
    {
      id: "c1",
      sourceType: "faq",
      sourceRef: "c-est-quoi-audit",
      categorie: "faq",
      contenu: "Un audit sur place dure une journée.",
      contexte: "FAQ",
      score: 1,
    },
  ];

  it("répond depuis le contexte + cite les sources (guard ok)", async () => {
    const r = await handleTurn(
      "c'est quoi un audit ?",
      { tenant },
      {
        retrieve: vi.fn(async () => chunks),
        generateAnswer: vi.fn(async () => ({
          text: "Un audit sur place est une journée d'analyse de votre entreprise.",
          model: "claude-haiku-4-5",
          costUsd: 0,
          tokensInput: 1,
          tokensOutput: 1,
        })),
      },
    );
    expect(r.intent).toBe("explication");
    expect(r.text).toMatch(/audit/i);
    expect(r.sources).toEqual([{ sourceType: "faq", sourceRef: "c-est-quoi-audit" }]);
    expect(r.guard.ok).toBe(true);
    // Observabilité : modèle + coût LLM propagés (persistés sur chat_messages).
    expect(r.model).toBe("claude-haiku-4-5");
    expect(r.costUsd).toBe(0);
  });

  it("output-guard bloque une réponse qui invente un prix → escalade + repli RDV", async () => {
    const r = await handleTurn(
      "c'est quoi un audit ?",
      { tenant },
      {
        retrieve: vi.fn(async () => chunks),
        generateAnswer: vi.fn(async () => ({
          text: "Un audit coûte 9 999 € HT.", // prix inventé (absent de pricing.ts)
          model: "x",
          costUsd: 0,
          tokensInput: 1,
          tokensOutput: 1,
        })),
      },
    );
    expect(r.guard.ok).toBe(false);
    expect(r.escalate).toBe(true);
    expect(r.text).not.toContain("9 999");
    expect(r.rdvUrl).toBe("/fr/appel");
  });

  it("aucun chunk pertinent → escalade (jamais d'invention)", async () => {
    const r = await handleTurn(
      "explique-moi ta méthode secrète",
      { tenant },
      { retrieve: noopRetrieve },
    );
    expect(r.escalate).toBe(true);
    expect(r.rdvUrl).toBe("/fr/appel");
  });

  it("T-11 : confiance trop faible → escalade SANS appel LLM", async () => {
    const weak = vi.fn(async () => [{ ...chunks[0]!, score: 0.0005 }]);
    const llm = vi.fn();
    const r = await handleTurn(
      "c'est quoi un audit ?",
      { tenant },
      { retrieve: weak, generateAnswer: llm },
    );
    expect(r.escalate).toBe(true);
    expect(llm).not.toHaveBeenCalled(); // pas de génération sous le seuil
  });

  it("T-16 : panne LLM (throw) → mode dégradé, JAMAIS d'erreur brute, RDV + escalade", async () => {
    const r = await handleTurn(
      "c'est quoi un audit ?",
      { tenant },
      {
        retrieve: vi.fn(async () => chunks),
        generateAnswer: vi.fn(async () => {
          throw new Error("Anthropic 503 Service Unavailable");
        }),
      },
    );
    expect(r.intent).toBe("explication");
    expect(r.escalate).toBe(true);
    expect(r.rdvUrl).toBe("/fr/appel");
    // Message orienté humain, aucune fuite de l'erreur technique.
    expect(r.text).not.toMatch(/503|Anthropic|Error/i);
    expect(r.text).toMatch(/échange|technique|attendre/i);
    expect(r.guard.ok).toBe(true);
  });

  it("T-28 : forte affluence (token-bucket vide) → backpressure SANS appel LLM", async () => {
    const llm = vi.fn();
    const r = await handleTurn(
      "c'est quoi un audit ?",
      { tenant },
      {
        retrieve: vi.fn(async () => chunks),
        generateAnswer: llm,
        acquireLlmSlot: () => false, // bucket vide
      },
    );
    expect(llm).not.toHaveBeenCalled(); // pas d'appel LLM sous backpressure
    expect(r.escalate).toBe(true);
    expect(r.rdvUrl).toBe("/fr/appel");
    expect(r.text).toMatch(/afflux|attendre/i);
    expect(r.text).not.toMatch(/429|rate/i); // jamais de 429 brut
  });

  it("T-30 : mode éco (cap coût atteint) → pas d'appel LLM, RDV + escalade", async () => {
    const llm = vi.fn();
    const r = await handleTurn(
      "c'est quoi un audit ?",
      { tenant, ecoMode: true },
      { retrieve: vi.fn(async () => chunks), generateAnswer: llm },
    );
    expect(llm).not.toHaveBeenCalled(); // mode éco = 0 appel LLM
    expect(r.escalate).toBe(true);
    expect(r.rdvUrl).toBe("/fr/appel");
  });
});
