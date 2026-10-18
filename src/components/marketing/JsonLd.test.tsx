import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { JsonLd } from "./JsonLd";

describe("<JsonLd>", () => {
  it("emits a script tag with application/ld+json type", () => {
    const { container } = render(
      <JsonLd
        data={{ "@context": "https://schema.org", "@type": "Organization", name: "Axion-IA" }}
      />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    expect(script?.innerHTML).toContain("Organization");
    expect(script?.innerHTML).toContain("Axion-IA");
  });

  it("does not double-escape JSON entities", () => {
    const { container } = render(<JsonLd data={{ name: "Will & Co" }} />);
    const script = container.querySelector("script");
    // & must NOT be escaped to & by React; we serialize ourselves.
    expect(script?.innerHTML).toContain("Will & Co");
  });

  // V-04 P1 (Sprint Correctif suite 2026-05-22) — strategy + scriptId.
  it("rend un <script> inline avec strategy default (= inline)", () => {
    const { container } = render(<JsonLd data={{ "@type": "WebPage" }} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    // Default inline = pas d'attribut id généré par next/script.
    expect(script).toBeTruthy();
    expect(script?.innerHTML).toContain("WebPage");
  });

  it("accepte strategy=afterInteractive + scriptId sans erreur runtime", () => {
    const { container } = render(
      <JsonLd
        data={{ "@type": "FAQPage" }}
        strategy="afterInteractive"
        scriptId="jsonld-test-faq"
      />,
    );
    // next/script ne rend pas immédiatement le script en JSDOM, mais ne doit pas throw.
    // On valide que le composant rend sans erreur (container peut être vide).
    expect(container).toBeDefined();
  });

  it("n'ouvre jamais de balise : « < » est échappé (une transcription ne ferme pas le script)", () => {
    const piege = "</script><a href=\"https://exemple.test\">cliquez</a>";
    const { container } = render(<JsonLd data={{ transcript: piege }} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(container.querySelector("a")).toBeNull();
    expect(script?.innerHTML).not.toContain("<");
    // Le JSON reste fidèle : une fois relu, le texte d'origine est intact.
    expect(JSON.parse(script?.innerHTML ?? "{}").transcript).toBe(piege);
  });
});
