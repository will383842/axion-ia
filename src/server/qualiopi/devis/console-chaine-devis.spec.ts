import { describe, expect, it } from "vitest";

import {
  aideAdresseDevis,
  etatHorodatageDevis,
  urlPdfDevisEmis,
  urlPiece,
} from "./console-chaine-devis";

describe("urlPdfDevisEmis", () => {
  it("brouillon : aucun lien (l'aperçu existe déjà)", () => {
    expect(urlPdfDevisEmis({ statut: "brouillon", documentGenereId: "d1" })).toBeNull();
  });
  it("émis sans pièce : aucun lien", () => {
    expect(urlPdfDevisEmis({ statut: "envoye", documentGenereId: null })).toBeNull();
  });
  it.each(["envoye", "accepte", "refuse", "expire", "transforme_convention"])(
    "%s avec pièce : route de téléchargement existante",
    (statut) => {
      expect(urlPdfDevisEmis({ statut, documentGenereId: "d1" })).toBe(
        "/api/qualiopi/documents/d1",
      );
    },
  );
});

describe("etatHorodatageDevis", () => {
  const NOW = new Date("2026-11-20T12:00:00Z");
  it("aucune ligne : non configuré", () => {
    expect(etatHorodatageDevis([], NOW)).toEqual({
      genre: "non_configure",
      libelle: "Horodatage : non configuré",
    });
  });
  it("tous obtenus : date du dernier jeton obtenu", () => {
    const e = etatHorodatageDevis(
      [{ statut: "obtenu", horodateAt: new Date("2026-11-19T10:00:00Z"), creeAt: NOW }],
      NOW,
    );
    expect(e.genre).toBe("obtenu");
    expect(e.libelle).toMatch(/^Horodatage : obtenu le 19\/11\/2026/);
  });
  it("une ligne en attente prime : en attente depuis la plus ancienne", () => {
    const e = etatHorodatageDevis(
      [
        { statut: "obtenu", horodateAt: NOW, creeAt: NOW },
        { statut: "en_attente", horodateAt: null, creeAt: new Date("2026-11-18T08:00:00Z") },
      ],
      NOW,
    );
    expect(e.genre).toBe("attente");
    expect(e.libelle).toMatch(/^Horodatage : en attente depuis le 18\/11\/2026/);
  });
});

describe("aideAdresseDevis", () => {
  it("adresse présente : rien", () => {
    expect(
      aideAdresseDevis({ classique: true, adresse: "a@b.fr", statut: "brouillon" }),
    ).toBeNull();
  });
  it("devis classique sans adresse : renvoie à « Remis en main propre »", () => {
    const a = aideAdresseDevis({ classique: true, adresse: null, statut: "brouillon" });
    expect(a?.texte).toMatch(/Remis en main propre/);
  });
  it("devis à formules sans adresse : phrase exacte + lien fiche", () => {
    const a = aideAdresseDevis({ classique: false, adresse: "  ", statut: "brouillon" });
    expect(a).toEqual({
      texte: "Un devis à formules se signe en ligne : ajoutez l'adresse e-mail du client.",
      lienFiche: true,
    });
  });
  it("devis déjà parti : rien", () => {
    expect(aideAdresseDevis({ classique: false, adresse: null, statut: "accepte" })).toBeNull();
  });
});

describe("urlPiece", () => {
  it("route de téléchargement existante", () => {
    expect(urlPiece("p1")).toBe("/api/qualiopi/documents/p1");
  });
});
