import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteRouteStatusBadge } from "../SiteRouteStatusBadge";

describe("SiteRouteStatusBadge — icône ET mot", () => {
  const statuts = [
    ["live", "En ligne"],
    ["draft", "Brouillon"],
    ["preview", "Aperçu"],
    ["not_found", "404"],
    ["redirect", "301"],
    ["error", "Erreur"],
  ] as const;

  it.each(statuts)("%s affiche une icône et le mot « %s »", (status, mot) => {
    const { container } = render(<SiteRouteStatusBadge status={status} />);
    expect(screen.getByText(mot)).toBeDefined();
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("l'erreur : filet gauche de 3 px, texte noir, jamais de texte rouge", () => {
    const { container } = render(<SiteRouteStatusBadge status="error" />);
    const cls = container.firstElementChild?.className ?? "";
    expect(cls).toContain("border-l-[3px]");
    expect(cls).toContain("--color-admin-destructive-fg");
    expect(cls).not.toMatch(/text-\[color:var\(--color-admin-destructive\)\]/);
  });

  it("le code HTTP s'ajoute au mot sans le remplacer", () => {
    render(<SiteRouteStatusBadge status="live" httpStatus={200} />);
    expect(screen.getByText("En ligne · 200")).toBeDefined();
  });
});
