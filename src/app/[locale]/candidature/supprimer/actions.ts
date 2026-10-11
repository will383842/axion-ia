"use server";

/**
 * L'action qui efface — appelée par le bouton de la page, jamais par un lien.
 *
 * Toute la logique (jeton, quota par IP, ordre fichiers → ligne, refus des
 * personnes recrutées, journal, alerte) vit dans
 * `effacement-par-le-candidat.ts`, où elle est testée. Ici : lire le
 * formulaire, puis rediriger vers la page avec le résultat.
 *
 * Après un effacement, on revient SANS jeton : le geste est accompli, et
 * reposer le jeton dans l'URL de retour l'exposerait dans l'historique.
 */

import { redirect } from "next/navigation";

import { getClientIp } from "@/lib/client-ip";
import { effacerCandidatureParLeCandidat } from "@/server/careers/effacement-par-le-candidat";

// ⚠️ Un fichier « use server » n'exporte que des fonctions : le nom du champ
// est répété dans la page (`name="token"`), et le test le vérifie.
const CHAMP_JETON = "token";

export async function supprimerMaCandidature(fd: FormData): Promise<void> {
  const jeton = String(fd.get(CHAMP_JETON) ?? "");
  const issue = await effacerCandidatureParLeCandidat(jeton, { ip: await getClientIp() });

  switch (issue) {
    case "efface":
    case "deja":
      // Un double clic tombe ici : le dossier est déjà effacé, le résultat
      // attendu est atteint — on le dit sans erreur.
      redirect("/fr/candidature/supprimer?fait=1");
      break;
    case "trop_de_tentatives":
      redirect(`/fr/candidature/supprimer?token=${encodeURIComponent(jeton)}&echec=quota`);
      break;
    case "recrute":
    case "neutre":
      // La page relit le jeton et affiche le message adapté.
      redirect(`/fr/candidature/supprimer?token=${encodeURIComponent(jeton)}`);
      break;
    default:
      issueNonTraitee(issue);
  }
}

function issueNonTraitee(i: never): never {
  throw new Error(`Issue d'effacement non traitee : ${String(i)}`);
}
