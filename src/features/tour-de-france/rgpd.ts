/**
 * Tour France IA : droit d'accès (art. 15) et d'effacement (art. 17) sur les demandes (PR-2a).
 *
 * Nom, e-mail et téléphone d'une demande sont chiffrés à IV aléatoire : on ne les retrouve JAMAIS
 * par `where: { email }`, seulement par `emailHash` (l'empreinte écrite à la création). C'est le
 * défaut que ce dépôt a payé quatre fois (voir `features/podcast-request/rgpd.ts`) : sans
 * empreinte, un effacement toucherait zéro ligne en répondant « succès ».
 *
 * 🔑 Ici, l'effacement ANONYMISE, il ne SUPPRIME PAS (ordre du propriétaire : aucune suppression de
 * données de personnes) :
 *   · nom, e-mail, téléphone → « [effacé] » (chiffré) ; empreintes d'e-mail, de téléphone et d'IP → nulles ;
 *   · statut → `effacee_rgpd` (il ne change plus ensuite) ;
 *   · les clés de comptage sont GARDÉES : le compteur d'une ville ne recule pas parce qu'une
 *     personne a exercé son droit (décision D3 du plan). La clé personne contient l'empreinte
 *     (HMAC à clé secrète) de l'adresse : une donnée pseudonymisée, qui ne permet pas de retrouver
 *     la personne sans la clé du serveur ;
 *   · le lien vers une fiche prospect est gardé : la fiche suit l'effacement des fiches
 *     (`eraseClientsForEmail`, appelé par la même route).
 */

import { decryptPii, encryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";

/** Ce qui remplace nom, e-mail et téléphone après un effacement. */
export const VALEUR_EFFACEE = "[effacé]";

export interface DemandeTourExportee {
  readonly nom: string;
  readonly email: string;
  readonly telephone: string;
  readonly ville: string;
  readonly statut: string;
  readonly depuis: string | null;
  readonly creeLe: Date;
}

/** Les demandes de la personne, déchiffrées, pour l'export art. 15. `[]` si l'adresse est vide. */
export async function exporterDemandesTour(email: string): Promise<DemandeTourExportee[]> {
  const empreinte = hashEmailForLookup(email);
  if (empreinte === null) return [];
  const lignes = await prisma.tourDemande.findMany({
    where: { emailHash: empreinte },
    orderBy: { creeLe: "desc" },
    select: {
      nom: true,
      email: true,
      telephone: true,
      villeSaisie: true,
      statut: true,
      depuis: true,
      creeLe: true,
    },
  });
  return lignes.map((l) => ({
    nom: decryptPii(l.nom),
    email: decryptPii(l.email),
    telephone: decryptPii(l.telephone),
    ville: l.villeSaisie,
    statut: l.statut,
    depuis: l.depuis,
    creeLe: l.creeLe,
  }));
}

export interface EffacementDemandesTour {
  readonly anonymisees: number;
}

/** Anonymise les demandes de la personne (art. 17). Voir l'en-tête : rien n'est supprimé. */
export async function anonymiserDemandesTour(email: string): Promise<EffacementDemandesTour> {
  const empreinte = hashEmailForLookup(email);
  if (empreinte === null) return { anonymisees: 0 };
  const { count } = await prisma.tourDemande.updateMany({
    where: { emailHash: empreinte },
    data: {
      nom: encryptPii(VALEUR_EFFACEE),
      email: encryptPii(VALEUR_EFFACEE),
      telephone: encryptPii(VALEUR_EFFACEE),
      emailHash: null,
      telephoneFin: null,
      ipHash: null,
      statut: "effacee_rgpd",
      statutChangeLe: new Date(),
    },
  });
  return { anonymisees: count };
}
