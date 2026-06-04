/**
 * T-37 — Slot-filling produit + classification d'intention (doc 16 §4/§5a).
 *
 * Couvre : extraction ≥ 95 % sur fixtures variées · « 6 pers sur Claude.ai » →
 * effectif=6/sujet=claude · « et en présentiel ? » garde les slots précédents ·
 * « le moins cher pour une TPE » → tri+audience · classification d'intention.
 */

import { describe, it, expect } from "vitest";
import { extractSlots, SUBJECT_SYNONYMS } from "@/server/chatbot/catalog/slot-filling";

describe("T-37 cas documentés (doc 16 §4)", () => {
  it("« 6 personnes sur Claude.ai » → effectif=6, sujet=claude, recherche_offre", () => {
    const r = extractSlots("On est 6 personnes, je veux une formation sur Claude.ai");
    expect(r.slots.effectif).toBe(6);
    expect(r.slots.sujet).toBe("claude");
    expect(r.intent).toBe("recherche_offre");
  });

  it("« et en présentiel ? » garde les slots précédents (multi-tours)", () => {
    const prev = extractSlots("6 personnes sur Claude.ai").slots;
    const r = extractSlots("et en présentiel ?", prev);
    expect(r.slots.format).toBe("presentiel");
    expect(r.slots.effectif).toBe(6); // conservé
    expect(r.slots.sujet).toBe("claude"); // conservé
  });

  it("« le moins cher pour une TPE » → tri=prix_asc + audience=tpe", () => {
    const r = extractSlots("je cherche le moins cher pour une TPE");
    expect(r.slots.tri).toBe("prix_asc");
    expect(r.slots.audience).toBe("tpe");
  });

  it("« formations entre 1 000 et 2 000 € » → vertical+fourchette", () => {
    const r = extractSlots("vous avez des formations entre 1 000 et 2 000 € ?");
    expect(r.slots.vertical).toBe("formation");
    expect(r.slots.prixMin).toBe(1000);
    expect(r.slots.prixMax).toBe(2000);
  });
});

describe("T-37 classification d'intention", () => {
  const cases: Array<[string, string]> = [
    ["c'est quoi un audit IA ?", "explication"],
    ["je veux prendre rendez-vous", "rdv"],
    ["pouvez-vous me rappeler, voici mon email", "lead"],
    ["quelle différence entre l'essentielle et l'approfondie ?", "comparaison"],
    ["vous faites de la comptabilité ?", "hors_sujet"],
    ["une formation à moins de 1500 €", "recherche_offre"],
  ];
  for (const [msg, intent] of cases) {
    it(`« ${msg} » → ${intent}`, () => {
      expect(extractSlots(msg).intent).toBe(intent);
    });
  }
});

describe("T-37 extraction — précision ≥ 95 % sur fixtures variées", () => {
  // [message, slots attendus (sous-ensemble vérifié)]
  const fixtures: Array<[string, Record<string, unknown>]> = [
    ["formations entre 1000 et 2000€", { prixMin: 1000, prixMax: 2000, vertical: "formation" }],
    ["une formation à moins de 1 500 €", { prixMax: 1500, vertical: "formation" }],
    ["un audit à partir de 5000 euros", { prixMin: 5000, vertical: "audit" }],
    ["budget de 800€", { prixMax: 800 }],
    ["pour 8 personnes", { effectif: 8 }],
    ["former 12 collaborateurs", { effectif: 12 }],
    ["un accompagnement individuel", { effectif: 1, vertical: "un-a-un" }],
    ["formation de 2 jours", { dureeMaxJours: 2, vertical: "formation" }],
    ["un atelier d'une demi-journée", { dureeMaxJours: 0.5, vertical: "formation" }],
    ["une journée sur Claude", { dureeMaxJours: 1, sujet: "claude" }],
    ["en distanciel", { format: "distanciel" }],
    ["sur site", { format: "presentiel" }],
    ["en format hybride", { format: "mixte" }],
    ["le moins cher", { tri: "prix_asc" }],
    ["le plus complet possible", { tri: "prix_desc" }],
    ["pour une PME", { audience: "pme" }],
    ["pour une ETI", { audience: "eti" }],
    ["créer un SaaS avec IA", { vertical: "sites-web" }],
    ["déployer un projet IA", { vertical: "implementation" }],
    [
      "une formation ChatGPT pour 6 personnes",
      { sujet: "chatgpt", effectif: 6, vertical: "formation" },
    ],
  ];

  it("extrait correctement ≥ 95 % des slots attendus", () => {
    let total = 0;
    let ok = 0;
    const failures: string[] = [];
    for (const [msg, expected] of fixtures) {
      const { slots } = extractSlots(msg);
      for (const [k, v] of Object.entries(expected)) {
        total++;
        if ((slots as Record<string, unknown>)[k] === v) ok++;
        else
          failures.push(
            `"${msg}" → ${k}: attendu ${v}, obtenu ${(slots as Record<string, unknown>)[k]}`,
          );
      }
    }
    const rate = ok / total;
    expect(rate, `échecs:\n${failures.join("\n")}`).toBeGreaterThanOrEqual(0.95);
  });
});

describe("T-37 SUBJECT_SYNONYMS", () => {
  it("mappe les variantes Claude vers le sujet canonique", () => {
    expect(SUBJECT_SYNONYMS["claude.ai"]).toBe("claude");
    expect(SUBJECT_SYNONYMS["anthropic"]).toBe("claude");
    expect(extractSlots("on veut du Anthropic Claude").slots.sujet).toBe("claude");
  });
});
