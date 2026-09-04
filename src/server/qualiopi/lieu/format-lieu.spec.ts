/**
 * Tests — format-lieu.ts (P0 cockpit : lieu de déroulement).
 *
 * Le lieu alimente la fiche session, le calendrier et les documents légaux
 * (convention L.6353-1 / convocation, Qualiopi off.9). Une prestation legacy
 * sans lieu doit renvoyer `null` — jamais une chaîne vide ou mal ponctuée.
 */

import { describe, it, expect } from "vitest";
import { formatLieu, isLieuRenseigne } from "./format-lieu";

describe("isLieuRenseigne", () => {
  it("faux si aucun champ", () => {
    expect(isLieuRenseigne({})).toBe(false);
  });

  it("faux si les champs ne sont que des chaînes vides / espaces", () => {
    expect(isLieuRenseigne({ lieuAdresse: "   ", lieuVille: "", lieuSalle: "\t" })).toBe(false);
  });

  it("vrai dès qu'un champ est renseigné", () => {
    expect(isLieuRenseigne({ lieuType: "nos_locaux" })).toBe(true);
    expect(isLieuRenseigne({ lieuVille: "Grenoble" })).toBe(true);
    expect(isLieuRenseigne({ lieuVisioUrl: "https://meet.google.com/abc" })).toBe(true);
  });
});

describe("formatLieu", () => {
  it("null quand rien n'est renseigné", () => {
    expect(formatLieu({})).toBeNull();
    expect(formatLieu({ lieuAdresse: "  ", lieuVille: "" })).toBeNull();
  });

  it("rend une adresse complète sur site avec la salle", () => {
    expect(
      formatLieu({
        lieuType: "sur_site",
        lieuAdresse: "11 Av. Paul Verlaine",
        lieuCodePostal: "38100",
        lieuVille: "Grenoble",
        lieuSalle: "B2",
      }),
    ).toBe("Sur site — 11 Av. Paul Verlaine, 38100 Grenoble · Salle B2");
  });

  it("rend le type seul quand rien d'autre n'est renseigné", () => {
    expect(formatLieu({ lieuType: "nos_locaux" })).toBe("Nos locaux");
  });

  it("insère l'intitulé entre le type et l'adresse", () => {
    expect(
      formatLieu({ lieuType: "sur_site", lieuIntitule: "Siège du client", lieuVille: "Lyon" }),
    ).toBe("Sur site — Siège du client — Lyon");
  });

  it("distanciel : affiche l'hôte de l'URL de visio", () => {
    expect(
      formatLieu({ lieuType: "distanciel", lieuVisioUrl: "https://meet.google.com/abc-defg" }),
    ).toBe("Distanciel — meet.google.com");
  });

  it("distanciel sans URL valide : le type seul", () => {
    expect(formatLieu({ lieuType: "distanciel" })).toBe("Distanciel");
    expect(formatLieu({ lieuType: "distanciel", lieuVisioUrl: "pas-une-url" })).toBe("Distanciel");
  });

  it("distanciel : ignore l'adresse physique éventuelle", () => {
    expect(formatLieu({ lieuType: "distanciel", lieuVille: "Grenoble", lieuSalle: "B2" })).toBe(
      "Distanciel",
    );
  });

  it("cas limite : salle seule, pas de séparateur orphelin", () => {
    expect(formatLieu({ lieuSalle: "B2" })).toBe("Salle B2");
  });

  it("cas limite : URL de visio seule sans lieuType", () => {
    expect(formatLieu({ lieuVisioUrl: "https://zoom.us/j/123" })).toBe("Distanciel — zoom.us");
  });

  it("cas limite : URL de visio invalide seule → null", () => {
    expect(formatLieu({ lieuVisioUrl: "réunion chez Paul" })).toBeNull();
  });

  it("code postal sans ville, et ville sans code postal", () => {
    expect(formatLieu({ lieuType: "sur_site", lieuCodePostal: "38100" })).toBe("Sur site — 38100");
    expect(formatLieu({ lieuType: "sur_site", lieuVille: "Grenoble" })).toBe("Sur site — Grenoble");
  });

  it("sans lieuType : rend l'adresse seule", () => {
    expect(formatLieu({ lieuAdresse: "11 Av. Paul Verlaine", lieuVille: "Grenoble" })).toBe(
      "11 Av. Paul Verlaine, Grenoble",
    );
  });

  it("trim les valeurs", () => {
    expect(formatLieu({ lieuType: "sur_site", lieuVille: "  Grenoble  " })).toBe(
      "Sur site — Grenoble",
    );
  });

  // ── Hybride (recette 2026-09-03) ─────────────────────────────────────────
  // Une session tenue EN SALLE et retransmise. Le lien était perdu : le lieu
  // n'annonçait que la salle, et les participants à distance n'avaient aucune
  // manière d'entrer.
  it("hybride : rend l'adresse ET l'hôte de visio", () => {
    expect(
      formatLieu({
        lieuType: "sur_site",
        lieuAdresse: "48 boulevard des Belges",
        lieuCodePostal: "69006",
        lieuVille: "Lyon",
        lieuSalle: "Curie",
        lieuVisioUrl: "https://meet.google.com/rec-ette-008",
      }),
    ).toBe("Sur site — 48 boulevard des Belges, 69006 Lyon · Salle Curie · visio meet.google.com");
  });

  it("hybride sans salle : l'hôte s'ajoute quand même", () => {
    expect(
      formatLieu({
        lieuType: "nos_locaux",
        lieuVille: "Grenoble",
        lieuVisioUrl: "https://zoom.us/j/123",
      }),
    ).toBe("Nos locaux — Grenoble · visio zoom.us");
  });

  it("hybride : une URL de visio illisible laisse la ligne intacte", () => {
    expect(
      formatLieu({ lieuType: "sur_site", lieuVille: "Lyon", lieuVisioUrl: "lien à venir" }),
    ).toBe("Sur site — Lyon");
  });
});
