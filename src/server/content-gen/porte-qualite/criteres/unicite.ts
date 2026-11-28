/**
 * B06 : unicité sémantique (§ 7.2). Le cosinus maximal du brouillon contre tout contenu
 * publié OU en file doit rester sous `cosinusBloque`. Entre `cosinusAlerte` et `cosinusBloque` :
 * le critère passe, avec une alerte « fusion à étudier » dans les preuves.
 * Pas de source = non évalué (§ 3, règle 2) ; un cosinus illisible ne passe jamais.
 */

import type { ReglagesPorte } from "../reglages";
import type { ContenuPorte, ContextePorte, ResultatBrut } from "../types";

const fmt = (n: number) => n.toFixed(3).replace(".", ",");

export function evaluerB06(_c: ContenuPorte, x: ContextePorte, r: ReglagesPorte): ResultatBrut {
  const src = x.voisinsSemantiques;
  if (!src) {
    return {
      statut: "non_evalue",
      raison: "Comparaison sémantique non branchée : aucun voisin fourni.",
      preuves: [],
    };
  }
  if (src.etat === "indisponible") {
    return {
      statut: "non_evalue",
      raison: `Comparaison sémantique indisponible : ${src.raison}`,
      preuves: [],
    };
  }
  const illisibles = src.valeur.filter(
    (v) =>
      typeof v.cosinus !== "number" ||
      !Number.isFinite(v.cosinus) ||
      v.cosinus < -1 ||
      v.cosinus > 1,
  );
  if (illisibles.length > 0) {
    return {
      statut: "non_evalue",
      raison: "Cosinus illisible pour au moins un voisin : la comparaison n'est pas fiable.",
      preuves: illisibles.map((v) => `${v.type} ${v.id}`),
    };
  }
  if (src.valeur.length === 0) return { statut: "ok", raison: null, preuves: [] };
  const tries = [...src.valeur].sort((a, b) => b.cosinus - a.cosinus);
  const premier = tries[0]!;
  const ligne = (v: (typeof tries)[number]) =>
    `${v.type} ${v.url ?? v.id} (${v.etat === "en_file" ? "en file" : "publié"}) : ${fmt(v.cosinus)}`;
  if (premier.cosinus >= r.cosinusBloque) {
    return {
      statut: "echec",
      raison: `Trop proche d'un contenu existant (cosinus ${fmt(premier.cosinus)}, seuil ${fmt(r.cosinusBloque)}) : fusion, mise à jour ou abandon.`,
      preuves: tries
        .filter((v) => v.cosinus >= r.cosinusBloque)
        .slice(0, 5)
        .map(ligne),
    };
  }
  if (premier.cosinus >= r.cosinusAlerte) {
    return {
      statut: "ok",
      raison: null,
      preuves: [
        `Alerte « fusion à étudier » (seuil ${fmt(r.cosinusAlerte)}) :`,
        ...tries
          .filter((v) => v.cosinus >= r.cosinusAlerte)
          .slice(0, 5)
          .map(ligne),
      ],
    };
  }
  return { statut: "ok", raison: null, preuves: [ligne(premier)] };
}
