import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/fiche/actions-relance-devis", () => ({
  preparerRelanceDevisAction: vi.fn(),
}));

import { CartesDevis } from "../CartesPieces";

const DEVIS = [
  {
    id: "d1",
    numero: "AXI-DEV-2026-001",
    statut: "envoye",
    montantTotalHtCents: 10000,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    documentGenereId: "p1",
  },
  {
    id: "d2",
    numero: "AXI-DEV-2026-002",
    statut: "envoye",
    montantTotalHtCents: 10000,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    documentGenereId: "p2",
  },
];

describe("CartesDevis — À contresigner", () => {
  it("pastille seulement sur le devis dont la pièce est à contresigner", () => {
    const h = renderToStaticMarkup(
      <CartesDevis
        devis={DEVIS}
        qBase="/fr/a/qualiopi"
        statuts={{}}
        piecesAContresigner={new Set(["p1"])}
      />,
    );
    expect(h.match(/À contresigner/g)).toHaveLength(1);
  });
  it("sans l'ensemble : aucune pastille (écran d'avant)", () => {
    const h = renderToStaticMarkup(<CartesDevis devis={DEVIS} qBase="/q" statuts={{}} />);
    expect(h).not.toContain("À contresigner");
  });
});
