import { describe, expect, it } from "vitest";
import {
  compterAContresigner,
  estDevisAContresigner,
  etatListeDevis,
  filtrerDevisParEtat,
  lireFiltreEtatDevis,
} from "./a-contresigner";

const IDS = new Set(["piece-signee-client"]);
const devis = (statut: string, documentGenereId: string | null) => ({ statut, documentGenereId });

describe("estDevisAContresigner", () => {
  it("devis envoyé + pièce signée du client seul = à contresigner", () => {
    expect(estDevisAContresigner(devis("envoye", "piece-signee-client"), IDS)).toBe(true);
  });
  it("devis envoyé dont la pièce n'est pas dans l'ensemble (client+axionia, ou rien) = non", () => {
    expect(estDevisAContresigner(devis("envoye", "piece-autre"), IDS)).toBe(false);
    expect(estDevisAContresigner(devis("envoye", null), IDS)).toBe(false);
  });
  it.each(["brouillon", "refuse", "expire", "accepte", "transforme_convention"])(
    "statut %s = non, même avec une pièce dans l'ensemble",
    (statut) => {
      expect(estDevisAContresigner(devis(statut, "piece-signee-client"), IDS)).toBe(false);
    },
  );
});

describe("etatListeDevis + filtre + compteur : un seul prédicat", () => {
  const liste = [
    { id: "a", ...devis("envoye", "piece-signee-client") },
    { id: "b", ...devis("envoye", "piece-autre") },
    { id: "c", ...devis("envoye", null) },
    { id: "d", ...devis("accepte", "piece-x") },
    { id: "e", ...devis("transforme_convention", null) },
    { id: "f", ...devis("refuse", null) },
    { id: "g", ...devis("expire", null) },
    { id: "h", ...devis("brouillon", null) },
  ];

  it("range chaque devis dans un état", () => {
    expect(liste.map((d) => etatListeDevis(d, IDS))).toEqual([
      "a_contresigner",
      "attente_client",
      "attente_client",
      "accepte",
      "accepte",
      "refuse_expire",
      "refuse_expire",
      "brouillon",
    ]);
  });
  it("le filtre « à contresigner » rend exactement la ligne a", () => {
    expect(filtrerDevisParEtat(liste, "a_contresigner", IDS).map((d) => d.id)).toEqual(["a"]);
  });
  it("le filtre « attente client » exclut les devis à contresigner", () => {
    expect(filtrerDevisParEtat(liste, "attente_client", IDS).map((d) => d.id)).toEqual(["b", "c"]);
  });
  it("accepté / refusé-expiré", () => {
    expect(filtrerDevisParEtat(liste, "accepte", IDS).map((d) => d.id)).toEqual(["d", "e"]);
    expect(filtrerDevisParEtat(liste, "refuse_expire", IDS).map((d) => d.id)).toEqual(["f", "g"]);
  });
  it("sans filtre, tout est rendu", () => {
    expect(filtrerDevisParEtat(liste, null, IDS)).toHaveLength(liste.length);
  });
  it("le compteur = le nombre de lignes du filtre", () => {
    expect(compterAContresigner(liste, IDS)).toBe(
      filtrerDevisParEtat(liste, "a_contresigner", IDS).length,
    );
    expect(compterAContresigner(liste, IDS)).toBe(1);
  });
  it("un paramètre d'URL inconnu = pas de filtre", () => {
    expect(lireFiltreEtatDevis("a_contresigner")).toBe("a_contresigner");
    expect(lireFiltreEtatDevis("n'importe quoi")).toBeNull();
    expect(lireFiltreEtatDevis(undefined)).toBeNull();
  });
});
