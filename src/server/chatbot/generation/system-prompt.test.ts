/**
 * T-07 — Assemblage du prompt système.
 */

import { describe, it, expect } from "vitest";
import {
  assembleSystemPrompt,
  defaultSystemRules,
} from "@/server/chatbot/generation/system-prompt";
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
    expect(p).toMatch(/Diagnostic IA gratuit de 45 minutes, sans engagement/);
    // La durée est un fait fourni : la règle anti-invention reste présente.
    expect(p).toMatch(/anti-invention/);
    expect(p).toMatch(/\{\{price:/);
    // Aucun prix en chiffres dans les règles.
    expect(p).not.toMatch(/\d\s?€/);
  });
});

describe("relecture directeur", () => {
  it("l'anti-invention nomme l'exception des règles et du rendez-vous de 45 minutes", () => {
    const p = defaultRules();
    expect(p).toMatch(/ni dans le CONTEXTE ci-dessous ni dans ces règles/);
    expect(p).toMatch(/exception[^\n]*45 minutes/i);
  });

  it("la Journée IA est décrite uniquement à partir du CONTEXTE", () => {
    expect(defaultRules()).toMatch(/uniquement à partir du CONTEXTE/);
    expect(defaultRules()).toMatch(/citez? seulement son nom|cite seulement son nom/);
  });

  it("le message principal n'est pas répété à chaque réponse", () => {
    expect(defaultRules()).toMatch(/qui vous êtes|qui tu es|ce que vous faites/);
    expect(defaultRules()).toMatch(/pas à chaque réponse/);
  });

  it("un prompt versionné actif reçoit toujours le bloc fixe (PME, vouvoiement, 45 minutes)", () => {
    const p = assembleSystemPrompt({ tenant, promptOverride: "Tu es un bot. Tutoie le visiteur." });
    expect(p).toContain("Tu es un bot.");
    expect(p).toMatch(/TPE et PME/);
    expect(p).toMatch(/VOUVOY/i);
    expect(p).toMatch(/Diagnostic IA gratuit de 45 minutes, sans engagement/);
  });

  it("interdit les mots de la doctrine dans les réponses, avec ou sans prompt versionné", () => {
    for (const p of [defaultRules(), assembleSystemPrompt({ tenant, promptOverride: "x" })]) {
      expect(p).toContain("N'écrivez jamais : garanti, sans risque, Qualiopi, CPF, certifié.");
    }
  });

  it("sans prompt versionné, le bloc fixe n'est pas dupliqué", () => {
    const p = assembleSystemPrompt({ tenant });
    expect(p.split("RÈGLES FIXES").length - 1).toBe(0);
  });
});

function defaultRules(): string {
  return defaultSystemRules(tenant);
}
