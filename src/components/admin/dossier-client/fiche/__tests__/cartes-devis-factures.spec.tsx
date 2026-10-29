import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CartesDevis, CartesFactures } from "../CartesPieces";
import { TuilesArgent } from "../TuilesArgent";

const plat = (h: string): string => h.replace(/\u00a0/g, " ");

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
    expect(plat(h)).toContain("1 200 € (TTC non renseigné) restent à encaisser");
    expect(plat(h)).not.toContain("1 200 € HT restent");
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
  it("0 € : « 0 € HT » et « Encours dû : rien »", () => {
    const h = plat(
      renderToStaticMarkup(
        <TuilesArgent
          encoursDuCents={0}
          factures={[]}
          devis={[]}
          devisPlafonnes={false}
          factureHorsConsoleLe={null}
        />,
      ),
    );
    expect(h).toContain("0 € HT");
    expect(h).toContain("Encours dû : rien");
  });
  it("plus de 10 factures : les tuiles comptent toutes les factures", () => {
    const toutes = Array.from({ length: 11 }, (_, i) => ({
      ...partielle,
      id: `f${i}`,
      numero: `F-${i}`,
      statut: "emise",
      payments: [],
      echeanceAt: new Date(`2026-1${i < 9 ? 1 : 2}-${String(10 + i).padStart(2, "0")}T10:00:00Z`),
    }));
    const h = plat(
      renderToStaticMarkup(
        <TuilesArgent
          encoursDuCents={11 * 144000}
          factures={toutes}
          devis={[]}
          devisPlafonnes={false}
          factureHorsConsoleLe={null}
        />,
      ),
    );
    expect(h).toContain("13 200 € HT");
  });
  it("carte d'avoir : montant négatif conservé et étiqueté Avoir", () => {
    const h = plat(
      renderToStaticMarkup(
        <CartesFactures
          qBase="/q"
          statuts={{ emise: { label: "Émise", tone: "info" as const } }}
          factures={[
            {
              ...partielle,
              id: "a1",
              numero: "AV-1",
              statut: "emise",
              avoirDeId: "f1",
              montantHtCents: -50000,
              montantTtcCents: -60000,
              payments: [],
            },
          ]}
        />,
      ),
    );
    expect(h).toContain("Avoir");
    expect(h).toContain("-500 € HT");
    expect(h).toContain("-600 € TTC");
    expect(h).not.toContain("Envoyer un rappel");
  });
  it("encours négatif : « Trop-perçu » et non un montant négatif", () => {
    const h = plat(
      renderToStaticMarkup(
        <TuilesArgent
          encoursDuCents={-12000}
          factures={[]}
          devis={[]}
          devisPlafonnes={false}
          factureHorsConsoleLe={null}
        />,
      ),
    );
    expect(h).toContain("Trop-perçu : 120 € TTC");
    expect(h).toContain("Encours dû : rien");
    expect(h).not.toContain("-120");
  });
  it("rappel présent sur une facture en retard non payée, absent sur une payée", () => {
    const enRetard = plat(
      renderToStaticMarkup(
        <CartesFactures
          qBase="/q"
          statuts={statuts}
          factures={[{ ...partielle, statut: "en_retard", payments: [] }]}
        />,
      ),
    );
    expect(enRetard).toContain("Envoyer un rappel");
    const payee = plat(
      renderToStaticMarkup(
        <CartesFactures
          qBase="/q"
          statuts={statuts}
          factures={[
            {
              ...partielle,
              statut: "payee",
              payments: [{ amountCents: 144000, status: "succeeded" }],
            },
          ]}
        />,
      ),
    );
    expect(payee).not.toContain("Envoyer un rappel");
  });
  it("échéance dépassée : « en retard depuis le », et seulement si un reste est dû", () => {
    const passee = new Date("2025-01-10T10:00:00Z");
    const h = plat(
      renderToStaticMarkup(
        <TuilesArgent
          encoursDuCents={144000}
          factures={[{ ...partielle, statut: "en_retard", payments: [], echeanceAt: passee }]}
          devis={[]}
          devisPlafonnes={false}
          factureHorsConsoleLe={null}
        />,
      ),
    );
    expect(h).toContain("en retard depuis le 10 janv. 2025");
    const soldee = plat(
      renderToStaticMarkup(
        <TuilesArgent
          encoursDuCents={144000}
          factures={[
            {
              ...partielle,
              statut: "emise",
              payments: [{ amountCents: 144000, status: "succeeded" }],
              echeanceAt: passee,
            },
          ]}
          devis={[]}
          devisPlafonnes={false}
          factureHorsConsoleLe={null}
        />,
      ),
    );
    expect(soldee).not.toContain("en retard depuis");
    expect(soldee).not.toContain("à payer avant");
  });
  it("facture partielle sans TTC : montants sans étiquette trompeuse, tuile « dont N facture sans TTC »", () => {
    const f = { ...partielle, montantTtcCents: null };
    const cartes = plat(
      renderToStaticMarkup(<CartesFactures qBase="/q" statuts={statuts} factures={[f]} />),
    );
    expect(cartes).toContain("(TTC non renseigné)");
    expect(cartes).not.toMatch(/480 € HT (reçus|restent)/);
    const tuiles = plat(
      renderToStaticMarkup(
        <TuilesArgent
          encoursDuCents={48000}
          factures={[f]}
          devis={[]}
          devisPlafonnes={false}
          factureHorsConsoleLe={null}
        />,
      ),
    );
    expect(tuiles).toContain("TVA incluse sauf sur 1 facture sans TTC");
    expect(tuiles).toContain("480 € (TTC non renseigné)");
    expect(tuiles).not.toContain("480 € TTC");
    expect(tuiles).not.toContain("TVA incluse, ");
  });
  it("carte en retard : « en retard depuis le », y compris à 23 h 30 à Paris", () => {
    vi.useFakeTimers();
    try {
      // 23 h 30 à Paris le 15 oct. 2026 = 21 h 30 UTC : l'échéance du 15 est encore à venir ce jour-là.
      vi.setSystemTime(new Date("2026-10-15T21:30:00Z"));
      const echeance = new Date("2026-10-15T09:00:00Z");
      const f = { ...partielle, statut: "emise", payments: [], echeanceAt: echeance };
      const memeJour = plat(
        renderToStaticMarkup(<CartesFactures qBase="/q" statuts={statuts} factures={[f]} />),
      );
      expect(memeJour).toContain("avant le 15 oct.");
      // 00 h 30 à Paris le 16 : la date est passée.
      vi.setSystemTime(new Date("2026-10-15T22:30:00Z"));
      const lendemain = plat(
        renderToStaticMarkup(<CartesFactures qBase="/q" statuts={statuts} factures={[f]} />),
      );
      expect(lendemain).toContain("en retard depuis le 15 oct.");
      expect(lendemain).not.toContain("encaisser avant le");
    } finally {
      vi.useRealTimers();
    }
  });
  it("facture A due + facture B en trop-perçu : l'encours nul ou négatif dit ce qui reste dû", () => {
    const a = {
      ...partielle,
      id: "a",
      statut: "emise",
      payments: [{ amountCents: 134000, status: "succeeded" }],
    };
    const b = {
      ...partielle,
      id: "b",
      statut: "emise",
      payments: [{ amountCents: 164000, status: "succeeded" }],
    };
    const h = plat(
      renderToStaticMarkup(
        <TuilesArgent
          encoursDuCents={-10000}
          factures={[a, b]}
          devis={[]}
          devisPlafonnes={false}
          factureHorsConsoleLe={null}
        />,
      ),
    );
    expect(h).toContain("Trop-perçu : 100 € TTC");
    expect(h).toContain("dont 100 € TTC encore dus sur 1 facture");
  });
});
