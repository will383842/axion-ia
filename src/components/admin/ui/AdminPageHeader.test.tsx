import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminPageHeader } from "./AdminPageHeader";

describe("AdminPageHeader", () => {
  it("renders title", () => {
    render(<AdminPageHeader title="Mes réservations" />);
    expect(screen.getByRole("heading", { level: 1, name: "Mes réservations" })).toBeDefined();
  });

  it("renders description when provided", () => {
    render(<AdminPageHeader title="X" description="Description longue ici" />);
    expect(screen.getByText("Description longue ici")).toBeDefined();
  });

  it("renders breadcrumbs slot", () => {
    render(<AdminPageHeader title="X" breadcrumbs={<nav data-testid="bc">crumbs</nav>} />);
    expect(screen.getByTestId("bc")).toBeDefined();
  });

  it("renders actions slot", () => {
    render(<AdminPageHeader title="X" actions={<button type="button">Nouveau</button>} />);
    expect(screen.getByRole("button", { name: "Nouveau" })).toBeDefined();
  });

  it("renders meta slot", () => {
    render(<AdminPageHeader title="X" meta={<span data-testid="meta">badge</span>} />);
    expect(screen.getByTestId("meta")).toBeDefined();
  });
});
