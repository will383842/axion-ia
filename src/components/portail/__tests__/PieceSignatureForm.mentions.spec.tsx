/**
 * Lot 3quater — la page de signature cesse d'opposer un mur de droit.
 *
 * Le défaut, relevé par Will sur la pièce réelle qui a servi à signer : une
 * vingtaine de lignes de mentions légales et RGPD, écrasées en UN pavé compact
 * (`mentions.join(" ")`), glissées dans l'étiquette de la case à cocher, juste
 * au-dessus du bouton de signature.
 *
 * Deux conséquences, et la seconde est la pire :
 *   1. un mur de texte avant un engagement se lit comme un obstacle ;
 *   2. la phrase qui compte vraiment — celle qu'on accepte EN COCHANT —
 *      devenait la plus difficile à trouver de l'écran.
 *
 * ## Les deux gardes qui doivent rougir
 *
 * - **aucun texte ne disparaît** : réorganiser une page de consentement ne doit
 *   jamais retirer une mention. Le test compare la liste rendue à la liste
 *   fournie, mention par mention ;
 * - **l'attestation est dans l'étiquette de la case**, pas noyée ailleurs :
 *   c'est elle qu'on coche.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PieceSignatureForm } from "../PieceSignatureForm";

vi.mock("@/components/portail/SignaturePad", () => ({
  SignaturePad: () => <div data-testid="pad" />,
}));

const MENTIONS = [
  "J'ai pris connaissance de la convention de formation n° AXI-DOC-2026-001 et je l'accepte.",
  "Cette signature électronique a la même valeur juridique qu'une signature manuscrite.",
  "Je consens au procédé de signature électronique décrit ci-dessus.",
  "Les données recueillies sont conservées 5 ans.",
];

function monter(mentions: readonly string[] = MENTIONS) {
  return render(
    <PieceSignatureForm
      token="tok"
      numero="AXI-DOC-2026-001"
      dateValiditeLisible={null}
      organismeNom="Axion-IA"
      clientRaisonSociale="Acme"
      signataireNom="Marie Dupont"
      signataireQualite="Gérante"
      pieceLibelle="convention de formation"
      pdfUrl={null}
      mentions={mentions}
      signerAction={vi.fn()}
    />,
  );
}

describe("aucun texte ne disparaît de la page de consentement", () => {
  it("rend TOUTES les mentions fournies", () => {
    monter();
    for (const texte of MENTIONS) {
      expect(screen.getByText(texte)).toBeInTheDocument();
    }
  });

  it("les mentions encadrantes restent VISIBLES, pas repliées derrière un dépli", () => {
    // Décision assumée : masquer une information légalement due sur l'écran
    // même où l'on recueille un consentement est un arbitrage juridique qui ne
    // se prend pas seul. Si un `<details>` apparaît un jour ici, ce test doit
    // rougir pour que la décision soit explicite.
    const { container } = monter();
    expect(container.querySelector("details")).toBeNull();
  });
});

describe("l'attestation est ce qu'on coche", () => {
  it("la première mention est dans l'étiquette de la case", () => {
    monter();
    const caseACocher = screen.getByRole("checkbox");
    const etiquette = caseACocher.closest("label");
    expect(etiquette?.textContent).toContain(MENTIONS[0]);
  });

  it("l'étiquette ne contient PAS les mentions encadrantes — c'était le mur", () => {
    monter();
    const etiquette = screen.getByRole("checkbox").closest("label");
    expect(etiquette?.textContent).not.toContain(MENTIONS[1]);
    expect(etiquette?.textContent).not.toContain(MENTIONS[3]);
  });

  it("le bloc encadrant porte un titre qui dit de quoi il parle", () => {
    monter();
    expect(screen.getByText(/valeur de cette signature et vos droits/i)).toBeInTheDocument();
  });
});

describe("cas limites", () => {
  it("une seule mention : pas de bloc encadrant vide", () => {
    monter([MENTIONS[0]!]);
    expect(screen.queryByText(/valeur de cette signature et vos droits/i)).toBeNull();
    expect(screen.getByRole("checkbox").closest("label")?.textContent).toContain(MENTIONS[0]);
  });

  it("le bouton de signature nomme la pièce", () => {
    monter();
    expect(screen.getByRole("button", { name: /signer convention de formation/i })).toBeTruthy();
  });
});
