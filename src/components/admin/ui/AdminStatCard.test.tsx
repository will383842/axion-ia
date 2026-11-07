import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminStatCard } from "./AdminStatCard";

describe("AdminStatCard — états avec icône ET mot", () => {
  const cas = [
    ["success", "Réussite"],
    ["destructive", "Erreur"],
    ["warning", "Attention"],
    ["info", "Info"],
  ] as const;

  it.each(cas)("le ton %s affiche l'icône et le mot « %s »", (tone, mot) => {
    const { container } = render(<AdminStatCard label="Envois" value={12} tone={tone} />);
    expect(screen.getByText(mot)).toBeDefined();
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("le ton par défaut n'ajoute ni icône d'état ni mot d'état", () => {
    const { container } = render(<AdminStatCard label="Envois" value={12} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("l'erreur : filet gauche de 3 px et mot en texte noir (-fg)", () => {
    const { container } = render(<AdminStatCard label="Envois" value={12} tone="destructive" />);
    expect(container.querySelector(".admin-stat-card")?.className).toContain("border-l-[3px]");
    expect(screen.getByText("Erreur").className).toContain("--color-admin-destructive-fg");
  });

  it("un delta négatif n'est jamais écrit en texte rouge", () => {
    render(<AdminStatCard label="Envois" value={12} delta="-3 %" />);
    expect(screen.getByText("-3 %").className).not.toContain("--color-admin-destructive)");
  });
});
