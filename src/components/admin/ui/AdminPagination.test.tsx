import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminPagination } from "./AdminPagination";

describe("AdminPagination", () => {
  it("returns null when totalPages <= 1", () => {
    const { container } = render(<AdminPagination page={1} totalPages={1} baseHref="/list" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Précédent + Page N sur M + Suivant", () => {
    render(<AdminPagination page={2} totalPages={5} baseHref="/list" />);
    expect(screen.getByRole("link", { name: /Précédent/ })).toBeDefined();
    expect(screen.getByRole("link", { name: /Suivant/ })).toBeDefined();
    const status = screen.getByText(/Page/);
    expect(status.textContent).toContain("2");
    expect(status.textContent).toContain("5");
  });

  it("preserves additional searchParams", () => {
    render(
      <AdminPagination
        page={1}
        totalPages={3}
        baseHref="/list"
        preservedParams={{ status: "open", sort: "asc" }}
      />,
    );
    const next = screen.getByRole("link", { name: /Suivant/ });
    const href = next.getAttribute("href") ?? "";
    expect(href).toContain("status=open");
    expect(href).toContain("sort=asc");
    expect(href).toContain("page=2");
  });

  it("disables Précédent on first page (pointer-events-none)", () => {
    render(<AdminPagination page={1} totalPages={3} baseHref="/list" />);
    const prev = screen.getByRole("link", { name: /Précédent/ });
    expect(prev.className).toContain("pointer-events-none");
    expect(prev.getAttribute("aria-disabled")).toBe("true");
  });

  it("disables Suivant on last page", () => {
    render(<AdminPagination page={3} totalPages={3} baseHref="/list" />);
    const next = screen.getByRole("link", { name: /Suivant/ });
    expect(next.className).toContain("pointer-events-none");
  });
});
