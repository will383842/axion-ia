/**
 * Classification des échecs de job — garde-fou de la reprise automatique.
 *
 * Les cas sont tirés des `errorMessage` RÉELLEMENT présents en production le
 * 2026-08-15 (relevé par `GROUP BY errorMessage` sur les 1 532 jobs en échec),
 * avec leur volume. C'est ce qui donne sa valeur au test : il vérifie que la
 * reprise relancera bien les ~1 340 échecs d'infrastructure et laissera de côté
 * les ~190 échecs de génération, qui se reproduiraient à l'identique.
 */

import { describe, it, expect } from "vitest";
import { classifyFailure, isAutoRetryable } from "../failure-classifier";

describe("classifyFailure — messages réels de production (2026-08-15)", () => {
  it.each([
    ["OpenAI rate limited", 949],
    ["OpenAI quota épuisé (compte à recharger) : 429 You exceeded your current quota", 241],
    [
      'Anthropic API 400: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}',
      128,
    ],
    ["OpenAI API error undefined: Connection error.", 94],
    ["Circuit breaker open for openai", 55],
  ])("relance %s (%i occurrences en prod)", (message) => {
    expect(classifyFailure(message)).toBe("transient");
  });

  it.each([
    ["blog-from-rss: aucun output valide après quality loop", 9],
    ["blog-article: plan invalide après 2 tentatives", 7],
    ["guide-pilier STEP 1 outline parse failed: SyntaxError: Expected ','", 6],
    ["quality_gate: directAnswer absent ou < 40 mots", 1],
    ["how_to_x_in_y aucun output valide après 3 itérations (cost=$0.0807)", 1],
  ])("ne relance PAS %s (%i occurrences en prod)", (message) => {
    expect(classifyFailure(message)).toBe("permanent");
  });

  it("un message vide reste inconnu (donc non relancé)", () => {
    expect(classifyFailure("")).toBe("unknown");
    expect(classifyFailure(null)).toBe("unknown");
    expect(classifyFailure(undefined)).toBe("unknown");
  });

  it("un message non reconnu n'est jamais relancé par défaut", () => {
    // Choix conservateur : mieux vaut laisser un job de côté que le rejouer en
    // boucle sur une cause qu'on ne comprend pas — chaque tentative coûte.
    expect(classifyFailure("Erreur inattendue XYZ-42")).toBe("unknown");
    expect(isAutoRetryable("Erreur inattendue XYZ-42", 0, 3)).toBe(false);
  });

  it("la cause de génération l'emporte sur le vocabulaire réseau", () => {
    // Un message peut contenir les deux vocabulaires ; la cause dominante est
    // alors bien la génération, pas le réseau.
    expect(classifyFailure("aucun output valide après timeout du juge")).toBe("permanent");
  });
});

describe("isAutoRetryable — budget de tentatives", () => {
  it("relance un échec transitoire tant que le budget n'est pas épuisé", () => {
    expect(isAutoRetryable("OpenAI rate limited", 0, 3)).toBe(true);
    expect(isAutoRetryable("OpenAI rate limited", 2, 3)).toBe(true);
  });

  it("cesse de relancer au-delà du budget, même sur cause transitoire", () => {
    // Sans cette borne, un provider durablement dégradé ferait tourner la
    // reprise en boucle sur les mêmes jobs.
    expect(isAutoRetryable("OpenAI rate limited", 3, 3)).toBe(false);
    expect(isAutoRetryable("OpenAI rate limited", 9, 3)).toBe(false);
  });

  it("ne relance jamais un échec de génération, même au premier essai", () => {
    expect(isAutoRetryable("blog-article: plan invalide après 2 tentatives", 0, 3)).toBe(false);
  });
});
