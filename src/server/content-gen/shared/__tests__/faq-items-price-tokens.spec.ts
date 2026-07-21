/**
 * Régression AUDIT 2026-07-21 — tokens `{{price:…}}` en clair dans la FAQ.
 *
 * Le corps d'article était déjà résolu au rendu, mais la FAQ vient d'un champ
 * séparé (`Article.faqJson`) qui ne passait par aucun résolveur. 25 articles
 * publiés affichaient donc `{{price:audit-strategique-pme|range}}` en clair,
 * dans le HTML visible ET dans le JSON-LD `FAQPage` envoyé à Google.
 *
 * Ces tests verrouillent la résolution, et surtout le fait qu'un token NON
 * résolu ne doit jamais faire disparaître silencieusement une FAQ.
 */

import { describe, expect, it } from "vitest";
import { parseFaqItems } from "../faq-items";

const LONG = (s: string) => s.padEnd(70, " .");

describe("parseFaqItems — résolution des tokens de prix", () => {
  it("résout un token de prix dans la réponse", () => {
    const items = parseFaqItems([
      {
        question: "Quels sont les tarifs pour un audit IA ?",
        answer: "Ils commencent à {{price:audit-strategique-pme|range}}.",
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]!.answer).not.toContain("{{price:");
    // On n'assert pas le montant exact : il vient du SSOT tarifaire et peut
    // légitimement changer. Ce qui compte est qu'un prix soit rendu.
    expect(items[0]!.answer).toMatch(/€/);
  });

  it("résout aussi dans la question", () => {
    const items = parseFaqItems([
      {
        question: "Pourquoi {{price:audit-flash|flat}} pour un audit flash ?",
        answer: "Parce que le format est court et cadré.",
      },
    ]);

    expect(items[0]!.question).not.toContain("{{price:");
  });

  it("tolère la forme courte { q, a }", () => {
    const items = parseFaqItems([
      { q: "Combien coûte un audit ?", a: "À partir de {{price:audit-flash|flat}}." },
    ]);

    expect(items[0]!.answer).not.toContain("{{price:");
  });

  it("un token INCONNU ne fait pas disparaître la FAQ en mode lenient", () => {
    // Le résolveur laisse les id inconnus en l'état. Le rendu doit malgré tout
    // servir la FAQ : mieux vaut un token visible qu'une FAQ amputée sans trace.
    const items = parseFaqItems([
      {
        question: "Question avec un id inexistant ?",
        answer: "Tarif {{price:ce-tier-nexiste-pas|flat}}.",
      },
    ]);

    expect(items).toHaveLength(1);
  });

  it("mode strict : la résolution précède le filtre anti-placeholder", () => {
    // `FAQ_PLACEHOLDER_RE` rejette `{{` / `}}`. Si la résolution passait APRÈS,
    // une FAQ parfaitement valide serait supprimée par le gate publish au seul
    // motif qu'elle contient un token tarifaire légitime.
    const items = parseFaqItems(
      [
        {
          question: LONG("Quels sont les tarifs pratiqués pour un audit IA en PME ?"),
          // Volontairement long : la résolution PUIS le recollage de prose
          // raccourcissent la chaîne, et `validateFaqItem` exige ≥ 60 caractères.
          // Une réponse trop courte ferait échouer le test pour une raison sans
          // rapport avec ce qu'il vérifie.
          answer: LONG(
            "Un audit standard pour une PME commence à {{price:audit-strategique-pme|range}}, selon la taille de la structure et le nombre de cas d'usage retenus.",
          ),
        },
      ],
      { strict: true },
    );

    expect(items).toHaveLength(1);
    expect(items[0]!.answer).not.toContain("{{price:");
  });

  it("ne casse pas les FAQ sans token", () => {
    const items = parseFaqItems([
      { question: "Combien de temps dure un audit ?", answer: "Cinq jours ouvrés en moyenne." },
    ]);

    expect(items).toEqual([
      { question: "Combien de temps dure un audit ?", answer: "Cinq jours ouvrés en moyenne." },
    ]);
  });
});
