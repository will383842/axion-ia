/**
 * Qualiopi ind. 30 — l'AUTEUR d'une appréciation, tel que l'export le montre.
 *
 * Il se déduit de la QUALITÉ déclarée, jamais d'un repli d'une qualité sur une
 * autre (même règle que le décompte des auteurs de `conformite-service.ts`) : un
 * avis de formateur qui porte aussi un `traineeId` sort sous le nom du
 * formateur, pas sous celui de la stagiaire. On ne devine jamais.
 *
 * Fonction pure : la raison sociale des clients est résolue par l'appelant.
 */

export const AUTEUR_NON_ETABLI = "Non établi en base";

interface Personne {
  nom: string | null;
  prenom: string | null;
}

export interface AppreciationPourAuteur {
  source: string;
  trainee: Personne | null;
  trainer: Personne | null;
  clientId: string | null;
}

function nomPersonne(p: Personne | null): string {
  if (!p) return "";
  return `${p.prenom ?? ""} ${p.nom ?? ""}`.trim();
}

export function auteurAppreciation(
  a: AppreciationPourAuteur,
  raisonParClient: ReadonlyMap<string, string>,
): string {
  let auteur = "";
  if (a.source === "stagiaire") {
    auteur = nomPersonne(a.trainee);
  } else if (a.source === "formateur") {
    auteur = nomPersonne(a.trainer);
  } else if (a.source === "entreprise") {
    const raison = a.clientId !== null ? (raisonParClient.get(a.clientId) ?? "").trim() : "";
    auteur = raison !== "" ? `Entreprise : ${raison}` : "";
  }
  // financeur : aucune fiche ne l'identifie en base.
  return auteur !== "" ? auteur : AUTEUR_NON_ETABLI;
}
