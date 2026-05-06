import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { JsonLd } from "./JsonLd";

describe("<JsonLd>", () => {
  it("emits a script tag with application/ld+json type", () => {
    const { container } = render(
      <JsonLd
        data={{ "@context": "https://schema.org", "@type": "Organization", name: "AxionIA" }}
      />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    expect(script?.innerHTML).toContain("Organization");
    expect(script?.innerHTML).toContain("AxionIA");
  });

  it("does not double-escape JSON entities", () => {
    const { container } = render(<JsonLd data={{ name: "Will & Co" }} />);
    const script = container.querySelector("script");
    // & must NOT be escaped to & by React; we serialize ourselves.
    expect(script?.innerHTML).toContain("Will & Co");
  });
});
