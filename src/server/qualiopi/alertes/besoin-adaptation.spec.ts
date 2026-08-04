/**
 * Alerte « besoin d'adaptation déclaré » — le texte, et le piège structurel.
 *
 * Deux choses se jouent ici, et aucune n'est visible à la lecture du code
 * appelant :
 *
 * 1. le message part en base et n'y est plus jamais corrigé — s'il porte une
 *    donnée de santé, elle y reste ;
 * 2. l'alerte naît d'un GESTE (le bénéficiaire déclare), pas d'un balayage.
 *    L'évaluateur quotidien n'émet jamais ce code. Si l'entrée du catalogue
 *    passait `resolutionAuto: true`, le premier `synchroniserAlertes` venu
 *    résoudrait l'alerte — avant même que quiconque l'ait lue. Le défaut serait
 *    invisible : l'alerte apparaîtrait, puis disparaîtrait toute seule.
 */
import { describe, it, expect } from "vitest";

import { construireAlerteBesoinAdaptation } from "./besoin-adaptation";
import { ALERTE_CATALOGUE } from "./catalogue";

describe("le texte de l'alerte", () => {
  it("nomme la personne et dit où lire", () => {
    const { titre, message } = construireAlerteBesoinAdaptation({
      prenom: "Simone",
      nom: "Blanc",
    });
    expect(titre).toContain("adaptation");
    expect(message).toContain("Simone Blanc");
    expect(message).toContain("fiche stagiaire");
  });

  it("🔴 ne peut PAS porter le besoin — la fonction ne le reçoit même pas", () => {
    // La garde n'est pas « on fait attention » : le besoin est hors de portée
    // de la signature. Ce cas fige ce contrat.
    const args = construireAlerteBesoinAdaptation.length;
    expect(args).toBe(1);
    const { message } = construireAlerteBesoinAdaptation({ prenom: "Simone", nom: "Blanc" });
    expect(message).toContain("chiffré");
  });

  it("supporte un nom vide sans laisser d'espace orphelin", () => {
    const { message } = construireAlerteBesoinAdaptation({ prenom: "Simone", nom: "" });
    expect(message.startsWith("Simone a déclaré")).toBe(true);
  });
});

describe("l'entrée du catalogue", () => {
  const entree = ALERTE_CATALOGUE["besoin_adaptation_declare"];

  it("existe — sans elle l'alerte serait figée à vie en base", () => {
    // `synchroniserAlertes` ne connaît que les codes du catalogue : une alerte
    // dont le code en est absent ne peut plus jamais être résolue en masse.
    expect(entree).toBeDefined();
  });

  it("🔴 n'est PAS en résolution automatique", () => {
    expect(entree?.resolutionAuto).toBe(false);
  });

  it("est d'un niveau que /qualiopi/a-traiter affiche vraiment", () => {
    // Cette page ne rend que `critique` et `important` ; `info` n'y paraît pas.
    expect(["critique", "important"]).toContain(entree?.niveau);
  });
});
