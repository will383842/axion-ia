/**
 * `FaqAccordion` : liens facultatifs sous une réponse, et ancre `id` sur chaque question.
 * Les liens ne font pas partie du texte de la réponse : le `FAQPage` JSON-LD n'émet que `answer`.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { FaqAccordion } from "../FaqAccordion";

const ITEMS = [
  {
    id: "faq-un",
    question: "Première ?",
    answer: "Réponse un.",
    liens: [{ href: "/fr/formations", label: "Nos formations IA" }],
  },
  { id: "faq-deux", question: "Seconde ?", answer: "Réponse deux." },
] as const;

describe("FaqAccordion — liens sous la réponse", () => {
  it("rend les liens de l'item qui en a, et seulement ceux-là", () => {
    const { container } = render(<FaqAccordion items={ITEMS} emitJsonLd={false} />);
    const liens = Array.from(container.querySelectorAll("a"));
    expect(liens).toHaveLength(1);
    expect(liens[0]?.getAttribute("href")).toBe("/fr/formations");
    expect(liens[0]?.textContent).toBe("Nos formations IA");
    // Le lien est dans la première question, pas dans la seconde.
    expect(container.querySelectorAll("details")[0]?.contains(liens[0] as Node)).toBe(true);
  });

  it("sans `ancres`, aucun `id` sur les <details> (le HTML existant ne change pas)", () => {
    const { container } = render(<FaqAccordion items={ITEMS} emitJsonLd={false} />);
    for (const d of container.querySelectorAll("details")) expect(d.hasAttribute("id")).toBe(false);
  });

  it("avec `ancres`, pose l'identifiant de chaque question sur son <details>", () => {
    const { container } = render(<FaqAccordion items={ITEMS} emitJsonLd={false} ancres />);
    expect(Array.from(container.querySelectorAll("details")).map((d) => d.id)).toEqual([
      "faq-un",
      "faq-deux",
    ]);
  });

  it("n'ajoute pas les liens au texte du FAQPage JSON-LD", () => {
    const { container } = render(<FaqAccordion items={ITEMS} />);
    const script = container.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
    const faq = JSON.parse(script?.textContent ?? "{}") as {
      mainEntity: { acceptedAnswer: { text: string } }[];
    };
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual([
      "Réponse un.",
      "Réponse deux.",
    ]);
    expect(script?.textContent).not.toContain("formations");
  });
});
