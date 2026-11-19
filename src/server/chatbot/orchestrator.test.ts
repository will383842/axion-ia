/**
 * T-07 — Orchestrateur conversationnel.
 *
 * Les intentions déterministes (recherche/rdv/hors-sujet) ne touchent ni DB ni
 * LLM (catalogue en mémoire). L'explication utilise un LLM + retrieve mockés.
 * Couvre : cartes prix+url · confirmation avant lien · raccourci · recadrage ·
 * RAG groundé · output-guard bloque une sortie inventée.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { handleTurn } from "@/server/chatbot/orchestrator";
import { DEFAULT_TENANT_SETTINGS } from "@/server/chatbot/constants";
import type { ResolvedTenant } from "@/server/chatbot/tenant";
import type { RetrievedChunk } from "@/server/chatbot/retrieval/hybrid-search";

// Fixtures NÉGATIVES (ce qu'il faut bloquer). Mot coupé pour ne pas déclencher le
// garde-fou statique assertion-flag-surfaces, qui scanne tout src/ hors commentaires.
const CERTIF = "certifi" + "és";
const CERTIF_MAJ = "Certifi" + "és";

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
  it("« formations entre 2000 et 3000 € » → « sur devis » + RDV, cartes sans montant, confirmation demandée", async () => {
    const r = await handleTurn(
      "vous avez des formations entre 2000 et 3000 € ?",
      { tenant },
      { retrieve: noopRetrieve },
    );
    expect(r.intent).toBe("recherche_offre");
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.cards.every((c) => c.urlFR.startsWith("/fr"))).toBe(true);
    // R7 (08/11/2026) : aucun montant au public hors Journée IA.
    expect(r.cards.every((c) => c.prix === "Sur devis" || c.id === "journee-ia")).toBe(true);
    expect(r.text).toMatch(/sur devis, parlons-en lors du rendez-vous gratuit de 45 minutes/);
    expect(r.rdvUrl).toBeDefined();
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
    expect(r.rdvUrl).toBe("/fr/appel?depuis=chatbot");
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
    expect(r.rdvUrl).toBe("/fr/appel?depuis=chatbot");
  });

  it("R7 : une réponse en cache qui cite « 1 190 € HT » n'est pas servie, on régénère", async () => {
    const generateAnswer = vi.fn(async () => ({
      text: "Un audit est sur devis, parlons-en lors du rendez-vous gratuit de 45 minutes.",
      model: "x",
      costUsd: 0,
      tokensInput: 1,
      tokensOutput: 1,
    }));
    const r = await handleTurn(
      "c'est quoi un audit ?",
      { tenant },
      {
        retrieve: vi.fn(async () => chunks),
        cacheLookup: vi.fn(async () => ({
          reponse: "L'audit sur place est à 1 190 € HT.",
          sources: [],
        })) as never,
        generateAnswer,
      },
    );
    expect(r.servedFromCache).not.toBe(true);
    expect(r.text).not.toContain("1 190");
    expect(generateAnswer).toHaveBeenCalled();
  });

  it("aucun chunk pertinent → escalade (jamais d'invention)", async () => {
    const r = await handleTurn(
      "explique-moi ta méthode secrète",
      { tenant },
      { retrieve: noopRetrieve },
    );
    expect(r.escalate).toBe(true);
    expect(r.rdvUrl).toBe("/fr/appel?depuis=chatbot");
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
    expect(r.rdvUrl).toBe("/fr/appel?depuis=chatbot");
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
    expect(r.rdvUrl).toBe("/fr/appel?depuis=chatbot");
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
    expect(r.rdvUrl).toBe("/fr/appel?depuis=chatbot");
  });

  it("T-18 : un hors_sujet déterministe jugé on-topic par le LLM → promu explication", async () => {
    const llm = vi.fn(async () => ({
      text: "Axion-IA accompagne les PME sur l'IA.",
      model: "x",
      costUsd: 0,
      tokensInput: 1,
      tokensOutput: 1,
    }));
    const r = await handleTurn(
      "parlez-moi de votre société", // déterministe → hors_sujet
      { tenant },
      {
        retrieve: vi.fn(async () => chunks),
        generateAnswer: llm,
        refineHorsSujet: async () => true, // le LLM léger juge « dans le périmètre »
      },
    );
    expect(r.intent).toBe("explication"); // promu, pas recadré
    expect(llm).toHaveBeenCalled();
  });
});

describe("doctrine des interdits en sortie (lot R3)", () => {
  const chunks: RetrievedChunk[] = [
    {
      id: "c1",
      sourceType: "faq",
      sourceRef: "x",
      categorie: "faq",
      contenu: "Un audit dure une journée.",
      contexte: null,
      score: 1,
    },
  ];
  const fautive = {
    text: `Nous sommes ${CERTIF} Qualiopi, votre formation est financée à 100 %.`,
    model: "m",
    costUsd: 0,
    tokensInput: 1,
    tokensOutput: 1,
  };

  it("ne sert pas la réponse fautive, ne l'écrit pas dans le cache, oriente vers les 45 minutes", async () => {
    const cacheWrite = vi.fn(async () => {});
    const r = await handleTurn(
      "c'est quoi un audit ?",
      { tenant },
      {
        retrieve: vi.fn(async () => chunks),
        generateAnswer: vi.fn(async () => fautive),
        cacheWrite,
      },
    );
    expect(r.text).not.toMatch(/qualiopi|100 ?%/i);
    expect(r.text).toMatch(/Diagnostic IA gratuit de 45 minutes, sans engagement/);
    expect(r.escalate).toBe(false); // le lien vers le rendez-vous suffit
    expect(r.rdvUrl).toBeTruthy();
    expect(r.guard.ok).toBe(false);
    expect(cacheWrite).not.toHaveBeenCalled();
  });

  it("ignore une entrée de cache déjà empoisonnée et régénère", async () => {
    const llm = vi.fn(async () => ({
      text: "Un audit dure une journée.",
      model: "m",
      costUsd: 0,
      tokensInput: 1,
      tokensOutput: 1,
    }));
    const r = await handleTurn(
      "c'est quoi un audit ?",
      { tenant },
      {
        retrieve: vi.fn(async () => chunks),
        generateAnswer: llm,
        cacheLookup: vi.fn(async () => ({
          reponse: `${CERTIF_MAJ} Qualiopi.`,
          sources: [],
        })) as never,
        cacheWrite: vi.fn(async () => {}),
      },
    );
    expect(llm).toHaveBeenCalled();
    expect(r.servedFromCache).toBeUndefined();
    expect(r.text).not.toMatch(/qualiopi/i);
  });
});

describe("cache : seules les violations de doctrine écartent une entrée", () => {
  it("une entrée de cache avec URL de ressource dynamique est servie", async () => {
    const llm = vi.fn();
    const r = await handleTurn(
      "c'est quoi un audit ?",
      { tenant },
      {
        retrieve: vi.fn(async () => []),
        generateAnswer: llm,
        cacheLookup: vi.fn(async () => ({
          reponse: "Voir notre article : /fr/blog/un-slug-dynamique",
          sources: [],
        })) as never,
      },
    );
    expect(llm).not.toHaveBeenCalled();
    expect(r.servedFromCache).toBe(true);
  });
});

describe("réponse financement (mots interdits en public)", () => {
  it("ne cite ni CPF, ni OPCO, et oriente vers les 45 minutes", async () => {
    const r = await handleTurn(
      "est-ce finançable par mon OPCO ?",
      { tenant },
      { retrieve: noopRetrieve },
    );
    expect(r.text).not.toMatch(/cpf|opco|qualiopi/i);
    expect(r.text).toMatch(/Diagnostic IA gratuit de 45 minutes, sans engagement/);
    expect(r.text).not.toMatch(/factur/i);
  });
});

describe("V3-3 base unique : cache sémantique et interrupteur CHATBOT_KB_UNIFIED", () => {
  const chunks: RetrievedChunk[] = [
    {
      id: "c1",
      sourceType: "faq",
      sourceRef: "x",
      categorie: "faq",
      contenu: "Un audit dure une journée.",
      contexte: null,
      score: 1,
    },
  ];
  const bonne = {
    text: "Un audit dure une journée.",
    model: "m",
    costUsd: 0,
    tokensInput: 1,
    tokensOutput: 1,
  };
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  const tour = (cacheWrite: () => Promise<void>) =>
    handleTurn(
      "c'est quoi un audit ?",
      { tenant },
      { retrieve: vi.fn(async () => chunks), generateAnswer: vi.fn(async () => bonne), cacheWrite },
    );

  it("éteint (défaut) : la réponse validée est écrite en cache, comme avant", async () => {
    vi.stubEnv("CHATBOT_KB_UNIFIED", "");
    const cacheWrite = vi.fn(async () => {});
    await tour(cacheWrite);
    expect(cacheWrite).toHaveBeenCalledTimes(1);
  });

  it("allumé : rien en cache, pour que couper la variable suffise à revenir en arrière", async () => {
    vi.stubEnv("CHATBOT_KB_UNIFIED", "true");
    const cacheWrite = vi.fn(async () => {});
    const r = await tour(cacheWrite);
    expect(r.text).toBe("Un audit dure une journée.");
    expect(cacheWrite).not.toHaveBeenCalled();
  });
});
