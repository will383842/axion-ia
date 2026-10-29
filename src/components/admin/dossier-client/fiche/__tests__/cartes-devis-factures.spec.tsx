import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/crm/clients", async () => {
  const reste = (f: {
    montantTtcCents: number | null;
    montantHtCents: number;
    payments: { amountCents: number; status: string }[];
    avoirs: { montantTtcCents: number | null; montantHtCents: number; statut: string }[];
  }) =>
    (f.montantTtcCents ?? f.montantHtCents) +
    f.avoirs
      .filter((a) => a.statut !== "annulee")
      .reduce((s, a) => s + (a.montantTtcCents ?? a.montantHtCents), 0) -
    f.payments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amountCents, 0);
  return { resteDuNetCents: reste };
});

import { CartesDevis, CartesFactures } from "../CartesPieces";
import { TuilesArgent } from "../TuilesArgent";

const statuts = { emise: { label: "Émise", tone: "info" as const } };
const partielle = {
  id: "f1",
  numero: "F-1",
  statut: "partiellement_payee",
  avoirDeId: null,
  montantHtCents: 120000,
  montantTtcCents: 144000,
  emiseAt: new Date("2026-10-01T10:00:00Z"),
  createdAt: new Date("2026-10-01T10:00:00Z"),
  echeanceAt: new Date("2026-11-05T10:00:00Z"),
  payments: [{ amountCents: 72000, status: "succeeded" }],
  avoirs: [],
};

describe("cartes devis et factures", () => {
  it("chaque montant a HT et son TTC", () => {
    const h = renderToStaticMarkup(
      <CartesDevis
        qBase="/fr/a/qualiopi"
        statuts={statuts}
        devis={[
          {
            id: "d1",
            numero: "D-1",
            statut: "envoye",
            montantTotalHtCents: 100000,
            createdAt: new Date(),
          },
        ]}
      />,
    );
    expect(h).toContain("1 000 € HT");
    expect(h).toContain("1 200 € TTC");
  });
  it("la facture partielle dit reçu + reste, et « Envoyer un rappel » est un lien vers la facture", () => {
    const h = renderToStaticMarkup(
      <CartesFactures qBase="/fr/a/qualiopi" statuts={statuts} factures={[partielle]} />,
    );
    expect(h).toContain("Payée en partie");
    expect(h).toContain("720 € TTC reçus");
    expect(h).toContain("720 € TTC");
    expect(h).toContain("restent à encaisser avant le");
    expect(h).toMatch(
      /<a [^>]*href="\/fr\/a\/qualiopi\/facturation\/f1"[^>]*>[\s\S]*Envoyer un rappel/,
    );
    expect(h).not.toContain("<button");
    expect(h).not.toContain("<form");
  });
  it("TTC NULL : le dit au lieu d'écrire TTC", () => {
    const h = renderToStaticMarkup(
      <CartesFactures
        qBase="/q"
        statuts={statuts}
        factures={[{ ...partielle, statut: "emise", montantTtcCents: null, payments: [] }]}
      />,
    );
    expect(h).toContain("TTC non renseigné");
    expect(h).toContain("1 200 € HT restent à encaisser");
  });
  it("les tuiles disent HT / TTC et l'encours reste TTC étiqueté", () => {
    const h = renderToStaticMarkup(
      <TuilesArgent
        encoursDuCents={72000}
        factures={[partielle]}
        devis={[{ statut: "envoye", montantTotalHtCents: 50000 }]}
        devisPlafonnes={false}
        factureHorsConsoleLe={null}
      />,
    );
    expect(h).toContain("Déjà facturé");
    expect(h).toContain("1 200 € HT");
    expect(h).toContain("720 € TTC");
    expect(h).toContain("à payer avant le");
    expect(h).toContain("500 € HT");
  });
});
