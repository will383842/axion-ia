import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminEmptyState } from "./AdminEmptyState";

describe("AdminEmptyState", () => {
  it("renders title in h2", () => {
    render(<AdminEmptyState title="Aucune réservation" />);
    expect(screen.getByRole("heading", { level: 2, name: "Aucune réservation" })).toBeDefined();
  });

  it("renders description", () => {
    render(<AdminEmptyState title="X" description="Pas encore de data" />);
    expect(screen.getByText("Pas encore de data")).toBeDefined();
  });

  it("renders primary and secondary actions", () => {
    render(
      <AdminEmptyState
        title="X"
        primaryAction={<button type="button">Créer</button>}
        secondaryAction={<button type="button">Docs</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Créer" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Docs" })).toBeDefined();
  });

  it("renders icon slot when provided", () => {
    render(<AdminEmptyState title="X" icon={<svg data-testid="icon" aria-hidden="true" />} />);
    expect(screen.getByTestId("icon")).toBeDefined();
  });

  it("sets role=status + aria-live=polite", () => {
    render(<AdminEmptyState title="X" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });
});
