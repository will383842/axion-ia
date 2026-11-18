// Tour France IA : préremplir la visio avec la mini-demande (PR-2b).
//
// Le visiteur qui vient de remplir ses trois champs arrive au formulaire de la visio avec le jeton
// `?j=` (`jeton-demande.ts`, domaine `tour-demande-v1`, DISTINCT de celui de la page vidéo des
// apporteurs). Ce module retrouve la demande, déchiffre ses champs et rend de quoi proposer le nom,
// l'e-mail et la ville comme valeurs par défaut, toutes modifiables. Le téléphone n'est pas
// proposé : il n'est plus demandé à la mini-demande, le visiteur le saisit à la réservation.
//
// Jamais d'exception, jamais d'erreur affichée : un jeton faux, expiré ou d'un autre parcours, une
// demande effacée, une valeur illisible, une base en panne → `null`, et le formulaire reste vide.

import { prisma } from "@/lib/prisma";
import { normaliserLibelle, type QuestionEventType } from "@/server/calendly/questions";
import { VALEUR_ILLISIBLE, lireChamp } from "./chiffrement";
import { lireJetonDemande } from "./jeton-demande";

export interface IdentiteTour {
  readonly nom: string;
  readonly email: string;
  readonly ville: string;
}

/** Une valeur déchiffrée utilisable : ni illisible, ni vide, ni encore chiffrée. */
function utilisable(valeur: string): string {
  const v = valeur.trim();
  return v === "" || v === VALEUR_ILLISIBLE || v.startsWith("enc:") ? "" : v;
}

/**
 * Les trois champs de la demande retrouvés par le jeton, ou `null`. Une demande dont l'effacement
 * a été demandé n'est jamais proposée.
 */
export async function identiteDuJetonTour(valeur: unknown): Promise<IdentiteTour | null> {
  const jeton = lireJetonDemande(valeur);
  if (!jeton) return null;
  try {
    const d = await prisma.tourDemande.findUnique({
      where: { id: jeton.id },
      select: {
        nom: true,
        email: true,
        villeSaisie: true,
        villeNom: true,
        statut: true,
      },
    });
    if (!d || d.statut === "effacee_rgpd") return null;
    const email = utilisable(lireChamp("email", d.email));
    if (email === "") return null;
    return {
      nom: utilisable(lireChamp("nom", d.nom)),
      email,
      ville: utilisable(d.villeNom ?? d.villeSaisie),
    };
  } catch {
    return null;
  }
}

/**
 * Le nom du champ de la question « ville » de la visio du Tour (« Ville de votre entreprise »), ou
 * `null` : même repérage que `villeDesReponses` (un mot ville, localité ou commune dans le libellé),
 * parmi les questions de saisie libre.
 */
export function champVilleDuTour(questions: readonly QuestionEventType[]): string | null {
  const q = questions.find(
    (x) =>
      (x.type === "string" || x.type === "text") &&
      /\b(ville|localite|commune)\b/.test(normaliserLibelle(x.libelle)),
  );
  return q?.champ ?? null;
}
