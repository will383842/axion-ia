import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlocHorodatagesEnRetard } from "../BlocHorodatagesEnRetard";

const LIGNE = {
  id: "h1",
  depuis: new Date("2026-11-18T08:00:00Z"),
  essais: 4,
  numero: "AXI-DEV-2026-001",
  devisId: "d1",
};

describe("BlocHorodatagesEnRetard", () => {
  it("rien en retard : aucun bloc", () => {
    const { container } = render(<BlocHorodatagesEnRetard lignes={[]} base="/fr/a" />);
    expect(container.textContent).toBe("");
  });
  it("lecture impossible : dite, jamais tue", () => {
    render(<BlocHorodatagesEnRetard lignes={null} base="/fr/a" />);
    expect(screen.getByText(/n'ont pas pu être lus/)).toBeTruthy();
  });
  it("une ligne par horodatage en attente depuis plus de 24 h, avec lien vers le devis", () => {
    render(<BlocHorodatagesEnRetard lignes={[LIGNE]} base="/fr/a" />);
    expect(screen.getByText(/AXI-DEV-2026-001/)).toBeTruthy();
    expect(screen.getByText(/en attente depuis le 18\/11\/2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ouvrir le devis/ }).getAttribute("href")).toBe(
      "/fr/a/qualiopi/devis/d1",
    );
  });
});
