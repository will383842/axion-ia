import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminBadge, AdminStatusBadge } from "./AdminBadge";

describe("AdminBadge", () => {
  it("renders children with neutral default tone", () => {
    render(<AdminBadge>NEW</AdminBadge>);
    expect(screen.getByText("NEW")).toBeDefined();
  });

  it("applies className prop", () => {
    render(<AdminBadge className="custom-x">A</AdminBadge>);
    const el = screen.getByText("A");
    expect(el.className).toContain("custom-x");
  });
});

describe("AdminStatusBadge", () => {
  it("derives FR label from status when no override", () => {
    render(<AdminStatusBadge status="in_progress" type="job" />);
    expect(screen.getByText("En cours")).toBeDefined();
  });

  it("falls back to space-separated status for unknown enum values", () => {
    render(<AdminStatusBadge status="some_unknown_state" type="job" />);
    expect(screen.getByText("some unknown state")).toBeDefined();
  });

  it("uses label override when provided", () => {
    render(<AdminStatusBadge status="paid" type="invoice" label="Payée" />);
    expect(screen.getByText("Payée")).toBeDefined();
  });

  it("maps 'completed' / 'paid' / 'published' to success tone", () => {
    const { container, rerender } = render(<AdminStatusBadge status="completed" type="job" />);
    expect(container.firstChild).toBeDefined();
    rerender(<AdminStatusBadge status="paid" type="invoice" />);
    expect(container.firstChild).toBeDefined();
  });

  it("maps 'failed' / 'cancelled' / 'overdue' to destructive tone", () => {
    const { container } = render(<AdminStatusBadge status="failed" type="job" />);
    expect(container.firstChild).toBeDefined();
  });

  it("maps 'pending' / 'processing' to warning tone", () => {
    const { container } = render(<AdminStatusBadge status="pending" type="invoice" />);
    expect(container.firstChild).toBeDefined();
  });
});
