/**
 * Lot 1ter §6 — la convention nomme les stagiaires.
 *
 * Défaut vérifié sur pièce réelle : `AXI-DOC-2026-032` porte « Effectif prévu :
 * 1 stagiaire » et ne nomme personne, alors que Simone Blanc y est inscrite.
 * La même personne doit se retrouver sur l'émargement, l'évaluation et
 * l'attestation — sans nom à la convention, la chaîne de preuve démarre dans le
 * flou.
 */

import { describe, expect, it } from "vitest";
import { ecartEffectif, mentionStagiaires, type StagiaireNommable } from "./stagiaires-nommes";

const inscrit = (patch: Partial<StagiaireNommable> = {}): StagiaireNommable => ({
  nom: "Blanc",
  prenom: "Simone",
  statut: "planifiee",
  ...patch,
});

describe("🔴 la convention NOMME les inscrits", () => {
  it("le cas AXI-DOC-2026-032 : une inscrite, elle est nommée", () => {
    const m = mentionStagiaires([inscrit()]);
    expect(m.nommes).toEqual(["BLANC Simone"]);
    expect(m.aDesigner).toBeNull();
    expect(m.effectifNomme).toBe(1);
  });

  it("le nom en capitales, le prénom non — comme sur l'émargement", () => {
    // Les deux pièces doivent se rapprocher À L'ŒIL, pas seulement à la lecture
    // attentive : c'est ce rapprochement que l'auditeur vient faire.
    expect(mentionStagiaires([inscrit({ nom: "de La Tour", prenom: "jean" })]).nommes).toEqual([
      "DE LA TOUR jean",
    ]);
  });

  it("la fonction est portée quand elle est connue", () => {
    expect(mentionStagiaires([inscrit({ fonction: "Responsable qualité" })]).nommes).toEqual([
      "BLANC Simone (Responsable qualité)",
    ]);
  });

  it("une fonction vide n'ajoute pas de parenthèses vides", () => {
    expect(mentionStagiaires([inscrit({ fonction: "   " })]).nommes).toEqual(["BLANC Simone"]);
    expect(mentionStagiaires([inscrit({ fonction: null })]).nommes).toEqual(["BLANC Simone"]);
  });

  it("l'ordre est ALPHABÉTIQUE, pas celui de la base", () => {
    // 🔴 Deux régénérations de la même pièce doivent produire le même texte,
    // sinon comparer deux exemplaires devient impossible — et c'est ce qu'on
    // fait quand on vérifie qu'une copie est conforme à l'original scellé.
    const m = mentionStagiaires([
      inscrit({ nom: "Zola", prenom: "Émile" }),
      inscrit({ nom: "Blanc", prenom: "Simone" }),
      inscrit({ nom: "Aron", prenom: "Paul" }),
    ]);
    expect(m.nommes).toEqual(["ARON Paul", "BLANC Simone", "ZOLA Émile"]);
  });
});

describe("🔴 sans inscrit, la pièce le DIT — elle ne se tait pas", () => {
  it("aucune inscription : la phrase « à désigner » remplace la liste", () => {
    // Une convention muette sur ce point se lit comme une convention sans
    // stagiaire, ce qui n'existe pas : le silence y est une affirmation fausse.
    const m = mentionStagiaires([]);
    expect(m.nommes).toEqual([]);
    expect(m.aDesigner).toContain("à désigner par le client");
    expect(m.aDesigner).toContain("avant le démarrage");
  });

  it("`aDesigner` n'est JAMAIS une chaîne vide", () => {
    // 🔴 Une chaîne vide se rend comme un blanc, et un blanc se lit comme
    // « il n'y avait rien à dire ». Le `null` force l'appelant à choisir.
    const avec = mentionStagiaires([inscrit()]);
    expect(avec.aDesigner).toBeNull();
    expect(mentionStagiaires([]).aDesigner).not.toBe("");
  });

  it("que des inscriptions annulées = aucun nom, et on le dit", () => {
    // Nommer quelqu'un qui ne viendra pas ferait diverger la convention de
    // l'émargement — exactement l'écart qu'un auditeur relève.
    const m = mentionStagiaires([
      inscrit({ statut: "annulee" }),
      inscrit({ nom: "Roe", prenom: "John", statut: "desistee" }),
    ]);
    expect(m.nommes).toEqual([]);
    expect(m.aDesigner).not.toBeNull();
  });

  it("les annulées sont écartées, les actives gardées", () => {
    const m = mentionStagiaires([
      inscrit({ nom: "Aron", prenom: "Paul", statut: "presente" }),
      inscrit({ nom: "Zola", prenom: "Émile", statut: "annulee" }),
    ]);
    expect(m.nommes).toEqual(["ARON Paul"]);
  });
});

describe("🔴 l'écart entre l'effectif PRÉVU et les inscrits est dit", () => {
  it("prévision et inscrits concordent : rien à signaler", () => {
    expect(ecartEffectif({ prevu: 2, nomme: 2 })).toBeNull();
  });

  it("moins d'inscrits que prévu : l'écart est nommé, pas caché", () => {
    // 🔴 `nbParticipantsPrevus` est une PRÉVISION saisie à la création ; le
    // nombre d'inscrits est un FAIT. La pièce affichait la prévision en
    // l'appelant « effectif ». Le taire laisserait l'auditeur découvrir seul
    // que « 3 stagiaires » n'en nomme que 2.
    const m = ecartEffectif({ prevu: 3, nomme: 2 })!;
    expect(m).toContain("Effectif prévu : 3");
    expect(m).toContain("2 stagiaires");
    expect(m).toContain("annexé avant le démarrage");
  });

  it("plus d'inscrits que prévu : un AVENANT est requis", () => {
    // Le prix convenu repose sur l'effectif prévu. Le dépasser sans avenant,
    // c'est exécuter autre chose que ce qui a été signé.
    const m = ecartEffectif({ prevu: 1, nomme: 3 })!;
    expect(m).toContain("dépassé");
    expect(m).toContain("avenant");
  });

  it("aucun inscrit : pas de mention d'écart — la phrase « à désigner » suffit", () => {
    // Deux phrases disant la même chose sur la même pièce est du bruit, et le
    // bruit sur une pièce contractuelle se lit comme une contradiction.
    expect(ecartEffectif({ prevu: 3, nomme: 0 })).toBeNull();
  });

  it("un seul inscrit : le singulier est respecté", () => {
    const m = ecartEffectif({ prevu: 2, nomme: 1 })!;
    expect(m).toContain("1 stagiaire nominativement désigné à ce jour");
    expect(m).not.toContain("stagiaires");
  });
});
