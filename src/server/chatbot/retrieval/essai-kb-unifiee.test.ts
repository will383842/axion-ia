/**
 * V3-3 — Essai à blanc de la base unique du chatbot : 30 questions types,
 * rapport, aucune écriture.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/chatbot/embeddings", () => ({ embedChatbotText: vi.fn() }));

import {
  executerEssaiKbUnifiee,
  montantsHorsJourneeIa,
  QUESTIONS_ESSAI,
  rapportMarkdown,
} from "@/server/chatbot/retrieval/essai-kb-unifiee";
import type { RetrievedChunk } from "@/server/chatbot/retrieval/hybrid-search";
import { decisionDemarrage } from "../../../../scripts/chatbot-kb-unifier-essai";

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

describe("essai à blanc", () => {
  it("30 questions types couvrant Journée IA, prix, RDV 45 min, garantie, AI Act", () => {
    expect(QUESTIONS_ESSAI).toHaveLength(30);
    const tout = QUESTIONS_ESSAI.join(" ");
    for (const motif of [/Journée IA/, /prix|coûte/, /45 minutes/, /garantie/i, /AI Act/]) {
      expect(tout).toMatch(motif);
    }
  });

  it("n'appelle que les deux recherches et produit un rapport", async () => {
    const hybrid = vi.fn().mockResolvedValue(CHUNKS);
    const ke = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("x"));
    const res = await executerEssaiKbUnifiee({
      tenantId: "t",
      hybrid,
      knowledgeEntry: ke,
      questions: ["a", "b"],
    });
    expect(res).toHaveLength(2);
    expect(res[1]!.fiches.erreur).toBe("x");
    expect(res[0]!.fichesRetenues).toBe(0);
    const md = rapportMarkdown(res, "2026-11-11");
    expect(md).toContain("Lecture seule");
    expect(md).toContain("repli automatique");
  });

  it("signale tout montant autre que 1 490 €", () => {
    expect(montantsHorsJourneeIa("La Journée IA : 1 490 € HT.")).toEqual([]);
    expect(montantsHorsJourneeIa("Audit à 2 900 € et 1490 euros")).toEqual(["2 900 €"]);
  });

  it("le script d'essai n'émet aucune écriture (seul le SET lecture seule)", () => {
    const src = readFileSync("scripts/chatbot-kb-unifier-essai.ts", "utf8");
    const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const executes = [...sansCommentaires.matchAll(/\$executeRaw\w*\(([^)]*)\)/g)].map((m) => m[1]);
    expect(executes).toEqual(['"SET SESSION default_transaction_read_only = on"']);
    expect(sansCommentaires).toContain("SHOW default_transaction_read_only");
    expect(sansCommentaires).toContain("pgbouncer");
    expect(sansCommentaires).not.toMatch(/\.(create|update|upsert|delete)\w*\(|\$transaction/);
    expect(sansCommentaires).toContain("connection_limit");
    expect(sansCommentaires).not.toContain("CHATBOT_KB_UNIFIED");
  });

  it("garde-fou : refuse production et hôte inconnu, sauf --autoriser-prod", () => {
    const src = readFileSync("scripts/chatbot-kb-unifier-essai.ts", "utf8");
    const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(sansCommentaires).toContain("decisionDemarrage(process.env, process.argv)");
    expect(sansCommentaires).toContain("--autoriser-prod");
    expect(sansCommentaires).toContain("cibleAutorisee");
    // Le garde-fou précède toute lecture de DATABASE_URL et tout import de Prisma.
    expect(sansCommentaires.indexOf("decisionDemarrage(process.env")).toBeLessThan(
      sansCommentaires.indexOf("process.env.DATABASE_URL = "),
    );
  });

  it("decisionDemarrage : locale/préprod acceptées, production et hôte inconnu refusés", () => {
    const loc = "postgresql://u:p@localhost:5432/axion";
    expect(decisionDemarrage({ DATABASE_URL: loc, NODE_ENV: "development" }, []).ok).toBe(true);
    expect(
      decisionDemarrage({ DATABASE_URL: "postgresql://u:p@db.preprod.example:5432/x" }, []).ok,
    ).toBe(true);
    const prodEnv = decisionDemarrage({ DATABASE_URL: loc, NODE_ENV: "production" }, []);
    expect(prodEnv.ok).toBe(false);
    if (!prodEnv.ok) expect(prodEnv.message).toContain("--autoriser-prod");
    const inconnu = decisionDemarrage(
      { DATABASE_URL: "postgresql://u:p@db.exemple.com:5432/x" },
      [],
    );
    expect(inconnu.ok).toBe(false);
    expect(decisionDemarrage({}, []).ok).toBe(false);
    expect(
      decisionDemarrage(
        { DATABASE_URL: "postgresql://u:p@db.exemple.com:5432/x", NODE_ENV: "production" },
        ["--autoriser-prod"],
      ).ok,
    ).toBe(true);
  });

  it("le rapport précise le sens de « escalade » et l'origine de « Fiches retenues »", () => {
    const md = rapportMarkdown([], "2026-11-11");
    expect(md).toContain("« escalade » veut dire « aucun résultat »");
    expect(md).toContain("service externe de reclassement");
    expect(md).toContain("confiance normalisée de 0,5 (> 0,35)");
    expect(md).toContain("30 appels d'embedding OpenAI");
    expect(md).toContain("sans le filtre des doublons");
  });
});
