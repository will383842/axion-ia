// Tour France IA : le compteur des villes (PR-2b). Composant SERVEUR, aucun JavaScript client.
//
// Il lit les demandes comptées par ville (`lireCompteursPublics`) et n'affiche RIEN tant qu'aucune
// ville n'a atteint le seuil d'affichage : un compteur à « 1 » ou « 2 » découragerait les suivantes.
// Au build, la base est un stub (`stub.invalid`) : la lecture rend `[]`, la page part sans compteur
// et la revalidation (5 minutes) le fait apparaître.
//
// Seules les villes du référentiel s'affichent (`lignesCompteur` écarte celles sans nom), plafonnées
// au nombre de demandes qui ouvre une ville.

import { lignesCompteur, type LigneCompteur } from "@/features/tour-de-france/comptage";
import { lireCompteursPublics } from "@/features/tour-de-france/lectures";

export async function CompteurVilles() {
  let lignes: LigneCompteur[] = [];
  try {
    lignes = lignesCompteur(await lireCompteursPublics());
  } catch {
    lignes = [];
  }
  if (lignes.length === 0) return null;
  return (
    <ul
      className="text-fg mt-5 grid gap-1.5 text-base font-semibold sm:text-lg"
      data-tdf-compteur=""
    >
      {lignes.map((l) => (
        <li key={l.ville}>{l.texte}</li>
      ))}
    </ul>
  );
}
