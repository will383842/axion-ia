import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnswerCard } from "../AnswerCard";

describe("<AnswerCard>", () => {
  it("renders children inside an <aside role=doc-tip data-aeo=tldr>", () => {
    const { container } = render(<AnswerCard>Une réponse en 60 mots.</AnswerCard>);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute("role")).toBe("doc-tip");
    expect(aside?.getAttribute("data-aeo")).toBe("tldr");
    expect(aside?.className).toContain("tldr-answer");
    expect(aside?.textContent).toContain("Une réponse en 60 mots.");
  });

  it("uses « TL;DR » heading in FR by default", () => {
    render(<AnswerCard>Texte court.</AnswerCard>);
    expect(screen.getByText("TL;DR")).toBeTruthy();
  });

  it("uses « In short » heading when locale=en", () => {
    render(<AnswerCard locale="en">Short text.</AnswerCard>);
    expect(screen.getByText("In short")).toBeTruthy();
  });

  it("renders question line when provided", () => {
    render(
      <AnswerCard question="Combien coûte une intervention Essentielle ?">
        À partir de 490 € HT (TPE).
      </AnswerCard>,
    );
    expect(screen.getByText("Combien coûte une intervention Essentielle ?")).toBeTruthy();
    expect(screen.getByText("Question")).toBeTruthy();
  });

  it("hides question label when question is not provided", () => {
    render(<AnswerCard>Réponse.</AnswerCard>);
    expect(screen.queryByText("Question")).toBeNull();
  });

  it("renders sourceLabel as plain text when no sourceUrl", () => {
    render(<AnswerCard sourceLabel="INSEE 2024">Texte sourcé.</AnswerCard>);
    expect(screen.getByText(/INSEE 2024/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders sourceLabel as a link when sourceUrl is provided", () => {
    render(
      <AnswerCard sourceLabel="INSEE 2024" sourceUrl="https://www.insee.fr/fr/statistiques/x">
        Texte sourcé.
      </AnswerCard>,
    );
    const link = screen.getByRole("link", { name: "INSEE 2024" });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("https://www.insee.fr/fr/statistiques/x");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("matches snapshot (FR, question + source link)", () => {
    const { container } = render(
      <AnswerCard
        question="Quel est le tarif d'une Essentielle ?"
        sourceLabel="Doctrine Axion-IA"
        sourceUrl="https://axion-ia.com/fr/tarifs"
      >
        À partir de <strong>490 € HT</strong> (TPE 1-19 salariés). 790 € (PME) ou 1 190 € (ETI).
        Inclut diagnostic, plan d&apos;action chiffré, accompagnement 30 jours.
      </AnswerCard>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
