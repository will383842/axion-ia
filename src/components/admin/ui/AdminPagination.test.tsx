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

  it("renders « Page N sur M » as a single text node", () => {
    render(<AdminPagination page={2} totalPages={5} baseHref="/list" />);
    const status = screen.getByText("Page 2 sur 5");
    expect(status.childNodes.length).toBe(1);
    expect(status.firstChild?.nodeType).toBe(Node.TEXT_NODE);
  });

  it("disables Précédent on first page: no href, aria-disabled, inert", () => {
    render(<AdminPagination page={1} totalPages={3} baseHref="/list" />);
    const prev = screen.getByRole("link", { name: /Précédent/ });
    expect(prev.hasAttribute("href")).toBe(false);
    expect(prev.tagName).not.toBe("A");
    expect(prev.className).toContain("pointer-events-none");
    expect(prev.getAttribute("aria-disabled")).toBe("true");
    // Suivant reste un vrai lien.
    const next = screen.getByRole("link", { name: /Suivant/ });
    expect(next.tagName).toBe("A");
    expect(next.getAttribute("href")).toContain("page=2");
    expect(next.getAttribute("aria-disabled")).toBeNull();
  });

  it("disables Suivant on last page: no href, aria-disabled", () => {
    render(<AdminPagination page={3} totalPages={3} baseHref="/list" />);
    const next = screen.getByRole("link", { name: /Suivant/ });
    expect(next.hasAttribute("href")).toBe(false);
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(next.className).toContain("pointer-events-none");
    const prev = screen.getByRole("link", { name: /Précédent/ });
    expect(prev.getAttribute("href")).toContain("page=2");
  });

  it('never emits an href="#" placeholder', () => {
    const { container } = render(<AdminPagination page={1} totalPages={1} baseHref="/list" />);
    expect(container.querySelector('a[href="#"]')).toBeNull();
    const first = render(<AdminPagination page={1} totalPages={2} baseHref="/list" />);
    expect(first.container.querySelector('a[href="#"]')).toBeNull();
  });
});
