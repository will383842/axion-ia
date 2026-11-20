import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/actions/qualiopi/facturation-hub", () => ({
  envoyerRelanceAction: vi.fn(),
  traiterRelanceAction: vi.fn(),
}));

import { RelancesATraiter } from "../RelancesATraiter";

afterEach(cleanup);

describe("RelancesATraiter : lien « Ouvrir le devis »", () => {
  it("présent pour une relance de devis, vers la fiche du devis", () => {
    render(
      <RelancesATraiter
        relances={[
          {
            id: "r1",
            libelle: "AXI-DEV-1",
            palier: "j3",
            suggestion: null,
            envoiDirect: false,
            devisHref: "/fr/adm/qualiopi/devis/d1",
          },
        ]}
      />,
    );
    const lien = screen.getByRole("link", { name: "Ouvrir le devis" });
    expect(lien.getAttribute("href")).toBe("/fr/adm/qualiopi/devis/d1");
  });

  it("absent pour une relance de facture", () => {
    render(
      <RelancesATraiter
        relances={[
          { id: "r2", libelle: "FAC-1", palier: "j15", suggestion: null, envoiDirect: true },
        ]}
      />,
    );
    expect(screen.queryByRole("link", { name: "Ouvrir le devis" })).toBeNull();
  });
});
