import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminLoadingState } from "./AdminLoadingState";

describe("AdminLoadingState", () => {
  it("uses role=status + aria-live=polite", () => {
    render(<AdminLoadingState variant="card" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("renders sr-only label by default", () => {
    render(<AdminLoadingState variant="card" />);
    expect(screen.getByText("Chargement en cours")).toBeDefined();
  });

  it("uses custom aria-label when provided", () => {
    render(<AdminLoadingState variant="table" ariaLabel="Chargement table" />);
    expect(screen.getByLabelText("Chargement table")).toBeDefined();
  });

  it("renders all 5 variants without crashing", () => {
    for (const variant of ["table", "card", "stat-grid", "detail-header", "form"] as const) {
      const { unmount } = render(<AdminLoadingState variant={variant} />);
      unmount();
    }
  });
});
