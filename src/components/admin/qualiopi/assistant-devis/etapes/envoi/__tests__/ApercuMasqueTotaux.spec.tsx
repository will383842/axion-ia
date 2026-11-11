import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApercuDevis, type VueApercuDevis } from "../ApercuDevis";

const BASE: VueApercuDevis = {
  numero: "AXI-DEV-2026-0001",
  clientNom: "Client Test",
  validiteLibelle: "8 décembre 2026",
  objectif: null,
  lignes: [],
  totalHtCents: 0,
  tvaCents: 0,
  totalTtcCents: 0,
  phases: [],
  formules: [],
  servicesExterieurs: [],
  mentionTva: null,
  versionCgv: "v",
};
const formule = (cle: "A" | "B") => ({
  cle,
  titre: "Titre",
  lignes: [{ libelle: "Mise en place hors taxes", montantHtCents: 100000 }],
  totalTvaCents: 20000,
  totalTtcCents: 120000,
});

describe("ApercuDevis : totaux globaux", () => {
  it("deux formules : aucun bloc « Total hors taxes / TVA / Total TTC » à 0,00 €", () => {
    render(<ApercuDevis vue={{ ...BASE, formules: [formule("A"), formule("B")] }} urlPdf="/p" />);
    expect(screen.queryByText("Total hors taxes")).toBeNull();
    expect(screen.queryByText("Total TTC")).toBeNull();
    expect(screen.getAllByText("Mise en place TTC")).toHaveLength(2);
  });

  it("une formule : les totaux globaux restent affichés", () => {
    render(
      <ApercuDevis
        vue={{
          ...BASE,
          lignes: [{ libelle: "L", totalHtCents: 100000 }],
          totalHtCents: 100000,
          tvaCents: 20000,
          totalTtcCents: 120000,
          formules: [formule("A")],
        }}
        urlPdf="/p"
      />,
    );
    expect(screen.getByText("Total hors taxes")).toBeTruthy();
    expect(screen.getByText("Total TTC")).toBeTruthy();
  });
});
