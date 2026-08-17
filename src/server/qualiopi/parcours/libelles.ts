/**
 * Lot 1 — les libellés d'état, en toutes lettres. Module PUR.
 *
 * 🔴 Pourquoi un module, et pas un `switch` dans chaque écran.
 *
 * Le plan pose une règle non négociable : **l'état s'écrit en toutes lettres,
 * la couleur n'est qu'un renfort** (WCAG 1.4.1). Une pastille verte ou rouge ne
 * dit rien à qui ne perçoit pas la couleur, ni à qui imprime la page pour
 * l'auditeur.
 *
 * Recopier ces mots dans chaque surface — le hub, la liste, « À traiter », les
 * alertes — les ferait diverger : le jour où l'un dit « en retard » et l'autre
 * « hors délai » pour le même état, l'écran cesse d'être une source. C'est le
 * même raisonnement que `HABILITATIONS` et que `partiesRequisesPour`.
 */

import type { EtatEtape } from "./etat-echeance";

/** Libellé court, pour une colonne ou une pastille. */
export const LIBELLE_ETAT_DOSSIER: Readonly<Record<EtatEtape, string>> = {
  fait: "À jour",
  a_faire: "En cours",
  rattrapable: "À rattraper",
  hors_delai: "Hors délai",
  sans_objet: "Sans objet",
  // 🔴 « À vérifier » et non « Inconnu » : le mot doit dire ce qu'il y a à
  // FAIRE. « Inconnu » décrit l'outil ; « à vérifier » décrit la personne.
  indetermine: "À vérifier",
};

/**
 * Le ton d'affichage — jamais porteur d'information à lui seul.
 *
 * ⚠️ Il double le libellé, il ne le remplace pas. Tout écran qui n'afficherait
 * que cette valeur retomberait dans « l'information par la seule couleur ».
 */
export const TON_ETAT_DOSSIER: Readonly<
  Record<EtatEtape, "ok" | "attention" | "alerte" | "neutre">
> = {
  fait: "ok",
  a_faire: "neutre",
  rattrapable: "attention",
  hors_delai: "alerte",
  sans_objet: "neutre",
  indetermine: "attention",
};
