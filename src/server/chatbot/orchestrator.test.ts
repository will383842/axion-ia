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
    const r = await handleTurn("je veux prendre rendez-vous", { tenant }, { retrieve: noopRetrieve });
    expect(r.intent).toBe("rdv");
    expect(r.rdvUrl).toBe("/fr/appel");
  });

  it("hors-sujet → recadrage, pas de carte", async () => {
    const r = await handleTurn("vous faites de la comptabilité ?", { tenant }, { retrieve: noopRetrieve });
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
    const r = await handleTurn("explique-moi ta méthode secrète", { tenant }, { retrieve: noopRetrieve });
    expect(r.escalate).toBe(true);
    expect(r.rdvUrl).toBe("/fr/appel");
  });
});
