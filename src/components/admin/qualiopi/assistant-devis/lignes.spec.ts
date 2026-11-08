/**
 * Port sur `lignes.ts` des 10 cas de `__tests__/DevisForm.spec.tsx` (offre du catalogue →
 * intitulé + prix, références envoyées, total nul), plus la saisie de libellé.
 */
import { describe, expect, it } from "vitest";

import { ligneVide } from "./etat";
import {
  appliquerOffre,
  controlerTotalLignes,
  noteDeLOffre,
  saisirLibelle,
  referencesOffre,
  type OffreCatalogue,
} from "./lignes";

const OFFRES: OffreCatalogue[] = [
  {
    tierId: null,
    code: "AXI-OFF-205",
    titreFr: "IA pour les RH",
    prixHtCents: 190000,
    noteDevisFr: "2 à 15 participants — prix par GROUPE, laisser Qté = 1.",
  },
  {
    tierId: null,
    code: "AXI-OFF-115",
    titreFr: "Séminaire IA",
    prixHtCents: null,
    noteDevisFr: "Aucun prix ferme dérivable — saisissez le PU HT à la main.",
  },
  {
    tierId: "intervention-dirigeants",
    code: "AXI-OFF-006",
    titreFr: "Dirigeants",
    prixHtCents: 139000,
    noteDevisFr: "1 dirigeant (1-to-1) — frais de déplacement EN SUS.",
  },
];

const vide = () => ligneVide("l1");

describe("offre du catalogue → libellé + prix", () => {
  it("renseigne le libellé ET le prix (en euros) sur une ligne vierge", () => {
    const { ligne } = appliquerOffre(vide(), OFFRES, "AXI-OFF-205");
    expect(ligne.libelle).toBe("IA pour les RH");
    expect(ligne.prixEur).toBe("1900");
    expect(ligne.designationDepuisOffre).toBe(true);
  });

  it("garde les centimes : 139 050 centimes → « 1390,50 »", () => {
    const o = [{ ...OFFRES[0]!, prixHtCents: 139050 }];
    expect(appliquerOffre(vide(), o, "AXI-OFF-205").ligne.prixEur).toBe("1390,50");
  });

  it("ne remplace jamais un libellé saisi à la main", () => {
    const saisi = saisirLibelle(vide(), "Formation sur mesure client X");
    const { ligne } = appliquerOffre(saisi, OFFRES, "AXI-OFF-205");
    expect(ligne.libelle).toBe("Formation sur mesure client X");
    expect(ligne.designationDepuisOffre).toBe(false);
  });

  it("remplace le libellé hérité de l'offre PRÉCÉDENTE", () => {
    const a = appliquerOffre(vide(), OFFRES, "AXI-OFF-205").ligne;
    const { ligne } = appliquerOffre(a, OFFRES, "AXI-OFF-006");
    expect(ligne.libelle).toBe("Dirigeants");
    expect(ligne.prixEur).toBe("1390");
  });

  it("offre sans prix ferme : ne recolle pas 0 sur un chiffrage existant, et le signale", () => {
    const chiffree = { ...vide(), prixEur: "2500" };
    const r = appliquerOffre(chiffree, OFFRES, "AXI-OFF-115");
    expect(r.ligne.prixEur).toBe("2500");
    expect(r.sansPrixFerme).toBe(true);
    expect(appliquerOffre(vide(), OFFRES, "AXI-OFF-205").sansPrixFerme).toBe(false);
  });

  it("la note vient de l'offre, jamais d'une phrase en dur", () => {
    expect(noteDeLOffre(OFFRES, "AXI-OFF-006")).toMatch(/1 dirigeant/);
    expect(noteDeLOffre(OFFRES, "AXI-OFF-205")).toMatch(/prix par GROUPE/);
    expect(noteDeLOffre(OFFRES, "")).toBeNull();
  });
});

describe("références envoyées au serveur", () => {
  it("catalogue V2 : offreCode seul, jamais offreTierId", () => {
    const { ligne } = appliquerOffre(vide(), OFFRES, "AXI-OFF-205");
    const refs = referencesOffre(ligne, OFFRES);
    expect(refs).toEqual({ offreCode: "AXI-OFF-205" });
    expect(refs).not.toHaveProperty("offreTierId");
  });

  it("offre ancienne : les DEUX références", () => {
    const { ligne } = appliquerOffre(vide(), OFFRES, "AXI-OFF-006");
    expect(referencesOffre(ligne, OFFRES)).toEqual({
      offreCode: "AXI-OFF-006",
      offreTierId: "intervention-dirigeants",
    });
  });

  it("« Aucune » relâche les références sans effacer le chiffrage", () => {
    const a = appliquerOffre(vide(), OFFRES, "AXI-OFF-205").ligne;
    const { ligne } = appliquerOffre(a, OFFRES, "");
    expect(ligne.prixEur).toBe("1900");
    expect(ligne.offreCode).toBe("");
    expect(referencesOffre(ligne, OFFRES)).toEqual({});
  });

  it("la ligne porte le tier de l'offre ancienne, et le perd quand on change d'offre ou la retire", () => {
    const a = appliquerOffre(vide(), OFFRES, "AXI-OFF-006").ligne;
    expect(a.offreTierId).toBe("intervention-dirigeants");
    expect(appliquerOffre(a, OFFRES, "AXI-OFF-205").ligne).not.toHaveProperty("offreTierId");
    expect(appliquerOffre(a, OFFRES, "").ligne).not.toHaveProperty("offreTierId");
  });

  it("aucun taux de TVA n'est porté par les références", () => {
    const { ligne } = appliquerOffre(vide(), OFFRES, "AXI-OFF-006");
    expect(JSON.stringify(referencesOffre(ligne, OFFRES))).not.toMatch(/tva/i);
  });
});

describe("total des lignes", () => {
  it("refuse un total nul", () => {
    const l = { ...appliquerOffre(vide(), OFFRES, "AXI-OFF-115").ligne, libelle: "Séminaire" };
    expect(controlerTotalLignes([l])).toMatch(/total.*nul/i);
  });

  it("accepte un total positif, même avec une ligne offerte à 0", () => {
    const a = { ...vide(), libelle: "A", prixEur: "10" };
    const b = { ...vide(), id: "l2", libelle: "B", prixEur: "0" };
    expect(controlerTotalLignes([a, b])).toBeNull();
  });
});
