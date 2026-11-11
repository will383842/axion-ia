/**
 * Scanner de fausse présence locale : 10 phrases fautives, 10 phrases saines.
 * Outil de lecture seule (scripts/villes/scan-fausse-presence.ts).
 */
import { describe, expect, it } from "vitest";

import { scannerTexte, versCsv } from "../../../scripts/villes/scan-fausse-presence";

const detecter = (phrase: string) => scannerTexte(`  "${phrase}",`, "x.ts");

const FAUTIVES: Array<[string, string]> = [
  ["Nos consultants interviennent depuis Lyon.", "depuis <Ville>"],
  ["Nos consultants sont basés à Nantes.", "nos consultants sont/viennent"],
  ["Notre équipe, basée à Rennes, vous accompagne.", "base(e)(s) à <Ville>"],
  ["Nos consultants viennent de Bordeaux.", "nos consultants sont/viennent"],
  ["Notre agence est à 15 minutes de la gare.", "notre agence/bureau/antenne"],
  ["Nous sommes à 10 min de votre entreprise.", "à N min de"],
  ["Votre ville est proche de nous.", "proche de nous"],
  ["Williams se déplace dans vos locaux en métro ligne 4.", "Williams se déplace"],
  ["Sur place à Lille en 20 min, sans frais.", "sur place à <Ville> en N min"],
  ["Notre base est à Toulouse.", "notre base"],
];

const SAINES: string[] = [
  "Nous intervenons partout en France, sur place ou à distance.",
  "Nous intervenons partout en France, sur place ou à distance, selon votre besoin.",
  "Formation en présentiel dans vos locaux ou à distance.",
  "Depuis 2023, plus de 400 dirigeants ont suivi la Journée IA.",
  "La ville est desservie par le tramway ; la gare est à quelques minutes du centre.",
  "Une journée de formation à 1 490 € HT.",
  "Le ratio d'artisans de la ville est supérieur à la moyenne nationale.",
  "Nous nous adaptons à votre calendrier, sur place ou à distance.",
  "Les bases de l'IA générative à maîtriser en une journée.",
  "Ce prix s'applique partout en France, sans frais de déplacement.",
];

describe("scan-fausse-presence", () => {
  it.each(FAUTIVES)("détecte la phrase fautive : %s", (phrase, motif) => {
    const d = detecter(phrase);
    expect(d.length).toBeGreaterThan(0);
    expect(d.some((x) => x.motif === motif && x.verdict === "FAUTIF")).toBe(true);
  });

  it.each(SAINES)("laisse passer la phrase saine : %s", (phrase) => {
    expect(detecter(phrase)).toEqual([]);
  });

  it("renvoie fichier, ligne et un CSV à 5 colonnes", () => {
    const d = scannerTexte("a\nNotre base est à Toulouse.\n", "toulouse.ts");
    expect(d[0]).toMatchObject({ fichier: "toulouse.ts", ligne: 2 });
    const lignes = versCsv(d).trim().split("\n");
    expect(lignes[0]).toBe("fichier;ligne;motif;extrait;verdict");
    expect(lignes[1]?.split(";")).toHaveLength(5);
  });

  it("classe « à deux pas » et « en métro » en A_VERIFIER", () => {
    expect(detecter("La gare est à deux pas.")[0]?.verdict).toBe("A_VERIFIER");
    expect(detecter("Accessible en métro.")[0]?.verdict).toBe("A_VERIFIER");
  });
});

describe("scan-fausse-presence : trous comblés (relecture RO1)", () => {
  it.each<[string, string]>([
    ["Nos consultants sont à 10 min du centre.", "à N min de"],
    ["Nous sommes à 15 minutes d’Annecy.", "à N min de"],
    ["Nos consultants se déplacent sur site, à 1 h 30 de Paris.", "à N min de"],
    ["Nos équipes, basées à Lyon, vous reçoivent.", "base(e)(s) à <Ville>"],
  ])("détecte : %s", (phrase, motif) => {
    expect(detecter(phrase).some((x) => x.motif === motif && x.verdict === "FAUTIF")).toBe(true);
  });
  it("une distance sans « nous » reste A_VERIFIER", () => {
    expect(detecter("Peypin est à 12 min d’Aubagne.")[0]?.verdict).toBe("A_VERIFIER");
  });
});
