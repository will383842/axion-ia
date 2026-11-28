/**
 * B05 : intention déclarée et libre (§ 7.1). « Une intention = une page. »
 * Le registre est lu par l'appelant et injecté : ici, aucune E/S.
 * Non évalué si la source manque ou si l'état est inconnu (échec fermé, § 3 règle 2).
 */

import type { ContenuPorte, ContextePorte, ResultatBrut } from "../types";

export function evaluerB05(_c: ContenuPorte, x: ContextePorte): ResultatBrut {
  const src = x.intention;
  if (!src) {
    return {
      statut: "non_evalue",
      raison: "Registre des intentions non branché : aucune intention fournie.",
      preuves: [],
    };
  }
  if (src.etat === "indisponible") {
    return {
      statut: "non_evalue",
      raison: `Registre des intentions indisponible : ${src.raison}`,
      preuves: [],
    };
  }
  const i = src.valeur;
  if (i === null) {
    return {
      statut: "echec",
      raison: "Intention absente du registre : aucune intention déclarée pour ce contenu.",
      preuves: [],
    };
  }
  const page = i.pageProprietaire ? [`page propriétaire : ${i.pageProprietaire}`] : [];
  switch (i.etat) {
    case "libre":
      return { statut: "ok", raison: null, preuves: [i.requeteNormalisee] };
    case "reservee":
      if (i.reserveePourCeContenu) {
        return {
          statut: "ok",
          raison: null,
          preuves: [i.requeteNormalisee, "réservée pour ce contenu"],
        };
      }
      return {
        statut: "echec",
        raison: `Intention « ${i.requeteNormalisee} » déjà réservée par un autre contenu en cours.`,
        preuves: page,
      };
    case "couverte":
      if (x.miseAJourDeLaPageProprietaire === true) {
        return {
          statut: "ok",
          raison: null,
          preuves: [i.requeteNormalisee, "mise à jour de la page propriétaire", ...page],
        };
      }
      return {
        statut: "echec",
        raison: `Intention « ${i.requeteNormalisee} » déjà couverte par une page publiée : mise à jour de cette page, ou fusion.`,
        preuves: page,
      };
    case "a_fusionner":
      return {
        statut: "echec",
        raison: `Intention « ${i.requeteNormalisee} » en cours de fusion : plan de fusion à décider avant d'écrire.`,
        preuves: page,
      };
    default:
      return {
        statut: "non_evalue",
        raison: `État d'intention inconnu (« ${i.etat} »).`,
        preuves: [i.requeteNormalisee],
      };
  }
}
