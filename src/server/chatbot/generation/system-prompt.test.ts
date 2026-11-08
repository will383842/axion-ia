/**
 * T-07 — Assemblage du prompt système.
 */

import { describe, it, expect } from "vitest";
import { assembleSystemPrompt, defaultSystemRules } from "@/server/chatbot/generation/system-prompt";
import { DEFAULT_TENANT_SETTINGS } from "@/server/chatbot/constants";
import type { ResolvedTenant } from "@/server/chatbot/tenant";
import type { RetrievedChunk } from "@/server/chatbot/retrieval/hybrid-search";

const tenant: ResolvedTenant = {
  id: "t1",
  cle: "axion-ia",
  nom: "Axion-IA",
  domaine: null,
  actif: true,
  settings: DEFAULT_TENANT_SETTINGS,
};

describe("T-07 assembleSystemPrompt", () => {
  it("inclut les règles cœur (FR, anti-invention, token prix, AI Act)", () => {
    const p = assembleSystemPrompt({ tenant });
    expect(p).toMatch(/français/i);
    expect(p).toMatch(/\{\{price:/);
    expect(p).toMatch(/AI Act/i);
    expect(p).toMatch(/jamais.*invent|invent/i);
  });

  it("injecte les chunks comme seule source autorisée", () => {
    const chunks: RetrievedChunk[] = [
      {
        id: "c1",
        sourceType: "faq",
        sourceRef: "slug-x",
        categorie: "faq",
        contenu: "Texte de contexte unique.",
        contexte: null,
        score: 1,
      },
    ];
    const p = assembleSystemPrompt({ tenant, chunks });
    expect(p).toContain("Texte de contexte unique.");
    expect(p).toContain("faq:slug-x");
  });

  it("hérite de la brand-voice (persona Axion-IA / mots bannis)", () => {
    const p = assembleSystemPrompt({ tenant });
    expect(p).toMatch(/Axion-IA/);
    expect(p.toLowerCase()).toContain("bannis");
  });

  it("borne le nombre de cartes au réglage tenant", () => {
    const p = assembleSystemPrompt({ tenant });
    expect(p).toContain(String(DEFAULT_TENANT_SETTINGS.maxOfferCards));
  });

  it("cible les PME, sans ETI ni étiquette TPE/PME, et impose le vouvoiement", () => {
    const p = defaultRules();
    expect(p).not.toMatch(/\bETI\b/);
    expect(p).not.toMatch(/grands? groupes/i);
    expect(p).not.toContain("TPE/PME");
    expect(p).toMatch(/TPE et (aux )?PME/);
    expect(p).toMatch(/vouvoie/i);
  });

  it("porte le message principal, la Journée IA et le rendez-vous gratuit de 45 minutes", () => {
    const p = defaultRules();
    expect(p).toContain(
      "Le partenaire IA de bout en bout des PME : on chiffre, on forme, on met en place.",
    );
    expect(p).toContain("La Journée IA");
    expect(p).toMatch(/rendez-vous gratuit de 45 minutes/);
    // La durée est un fait fourni : la règle anti-invention reste présente.
    expect(p).toMatch(/anti-invention/);
    expect(p).toMatch(/\{\{price:/);
    // Aucun prix en chiffres dans les règles.
    expect(p).not.toMatch(/\d\s?€/);
  });
});

function defaultRules(): string {
  return defaultSystemRules(tenant);
}
