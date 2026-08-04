/**
 * Chargement de l'espace stagiaire, mutualisé entre le layout et les pages.
 *
 * ## Pourquoi `cache()`
 *
 * L'espace est désormais découpé en sections (accueil, formations, documents,
 * compte). Le layout a besoin des données pour compter les actions en attente
 * dans la barre latérale ; chaque page en a besoin pour son contenu. Sans
 * mémoïsation, une seule navigation déclencherait DEUX fois la même série de
 * requêtes Prisma et deux déchiffrements de données personnelles.
 *
 * `cache()` de React porte sur la durée d'une seule requête HTTP : rien n'est
 * partagé entre deux utilisateurs, ce qui serait ici une fuite de données.
 *
 * ## Pourquoi un résultat typé plutôt qu'une exception
 *
 * Le refus d'accès doit rester DIFFÉRENCIÉ (absent / expiré / introuvable) : ces
 * trois cas n'appellent pas la même action de la part du bénéficiaire, et le
 * dernier doit continuer à dire « contactez l'organisme de formation ». Une
 * exception uniforme effacerait cette distinction.
 *
 * 🔴 NE PAS transformer le cas `introuvable` en `notFound()` : il attrape aussi
 * les pannes Prisma et les échecs de déchiffrement. Un 404 ferait disparaître le
 * message d'aide au moment précis où il sert, et rendrait une panne d'infra
 * muette pour la supervision.
 */

import { cache } from "react";

import { getPortailToken } from "@/server/qualiopi/portail/cookie";
import {
  verifierToken,
  getEspaceStagiaire,
  type EspaceStagiaire,
} from "@/server/qualiopi/portail/portail-service";

export type RaisonRefus = "absente" | "expiree" | "introuvable";

export type ResultatEspace =
  | { etat: "ok"; espace: EspaceStagiaire }
  | { etat: "refus"; raison: RaisonRefus };

export const chargerEspaceStagiaire = cache(async (): Promise<ResultatEspace> => {
  // Défense en profondeur : `src/proxy.ts` redirige déjà (307) quand le cookie
  // est ABSENT — c'est lui qui produit le non-200 qu'attend un scanner, parce
  // qu'un Server Component qui rend du JSX renvoie toujours 200. Les branches
  // ci-dessous couvrent le cookie PRÉSENT mais invalide, que l'Edge ne sait pas
  // distinguer sans appel Prisma.
  const cookieToken = await getPortailToken();
  if (!cookieToken) return { etat: "refus", raison: "absente" };

  const tokenResult = await verifierToken(cookieToken);
  if (!tokenResult) return { etat: "refus", raison: "expiree" };

  try {
    return { etat: "ok", espace: await getEspaceStagiaire(tokenResult.traineeId) };
  } catch {
    return { etat: "refus", raison: "introuvable" };
  }
});

/** Questionnaires restant à remplir — le compteur de la pastille « À faire ». */
export function questionnairesEnAttente(espace: EspaceStagiaire) {
  return espace.questionnaires.filter((q) => q.reponduAt === null);
}
