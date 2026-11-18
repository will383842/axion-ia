/**
 * Tour France IA : droit d'accès (art. 15) et d'effacement (art. 17) sur les demandes (PR-2a).
 *
 * Nom, e-mail et téléphone d'une demande sont chiffrés à IV aléatoire : on ne les retrouve JAMAIS
 * par `where: { email }`, seulement par `emailHash` (l'empreinte écrite à la création). C'est le
 * défaut que ce dépôt a payé quatre fois (voir `features/podcast-request/rgpd.ts`) : sans
 * empreinte, un effacement toucherait zéro ligne en répondant « succès ».
 *
 * 🔑 Ici, l'effacement VIDE la ligne, il ne la SUPPRIME PAS (ordre du propriétaire : aucune
 * suppression de données de personnes). Sur chaque ligne de la personne :
 *   · nom, e-mail, téléphone → « [effacé] » (chiffré) ; empreintes d'e-mail et d'IP → nulles ;
 *   · les trois clés de comptage (des HMAC, donc des données pseudonymisées) → une valeur opaque
 *     PROPRE À LA LIGNE (`efface:<id>:p`, `:d`, `:t`) : plus aucun lien avec l'adresse, le domaine
 *     ou le numéro, même pour qui détiendrait la clé du serveur ; une clé déjà nulle reste nulle ;
 *   · la ville tapée en texte libre → « [effacé] » ; la clé de ville d'une ville hors référentiel
 *     (le texte tapé, normalisé) → `?effacee` ; la ville d'une ville du référentiel est gardée ;
 *   · la provenance (`depuis`), les repères de campagne (`utm_*`) et la liste des fiches proches
 *     (qui peut porter le nom d'un particulier) → nuls ;
 *   · statut → `effacee_rgpd` (il ne change plus ensuite) ;
 *   · `compte` est GARDÉ : le compteur d'une ville ne recule pas parce qu'une personne a exercé son
 *     droit (décision D3 du plan) ;
 *   · le lien vers une fiche prospect est gardé : la fiche suit l'effacement des fiches
 *     (`eraseClientsForEmail`, appelé par la même route).
 * Restent donc, sans aucune donnée de la personne : la date, la ville du référentiel, le statut et
 * le drapeau « compte ».
 */

import { Prisma } from "../../../prisma/generated/client";

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { chiffrerChamp, lireChamp } from "./chiffrement";

/** Ce qui remplace nom, e-mail, téléphone et ville tapée après un effacement. */
export const VALEUR_EFFACEE = "[effacé]";

/** La clé de ville d'une ville hors référentiel après un effacement (le texte tapé est retiré). */
export const VILLE_CLE_EFFACEE = "?effacee";

export interface DemandeTourExportee {
  readonly nom: string;
  readonly email: string;
  readonly telephone: string;
  readonly ville: string;
  readonly statut: string;
  readonly depuis: string | null;
  readonly creeLe: Date;
}

/**
 * Les demandes de la personne, déchiffrées, pour l'export art. 15. `[]` si l'adresse est vide.
 * Ne lève JAMAIS à cause d'une valeur illisible : l'export d'une personne ne doit pas planter
 * (la valeur illisible est rendue « illisible »).
 */
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
    nom: lireChamp("nom", l.nom),
    email: lireChamp("email", l.email),
    telephone: lireChamp("telephone", l.telephone),
    ville: l.villeSaisie,
    statut: l.statut,
    depuis: l.depuis,
    creeLe: l.creeLe,
  }));
}

export interface EffacementDemandesTour {
  /** Le nombre de demandes vidées (le nom historique est gardé pour la route d'effacement). */
  readonly anonymisees: number;
}

/**
 * Vide les demandes de la personne (art. 17). Voir l'en-tête : rien n'est supprimé. Idempotent et
 * reprenable : une ligne vidée n'a plus d'empreinte d'e-mail, donc n'est plus retrouvée ; si une
 * ligne échoue, les lignes restantes sont reprises à l'appel suivant.
 */
export async function anonymiserDemandesTour(email: string): Promise<EffacementDemandesTour> {
  const empreinte = hashEmailForLookup(email);
  if (empreinte === null) return { anonymisees: 0 };
  const lignes = await prisma.tourDemande.findMany({
    where: { emailHash: empreinte },
    select: {
      id: true,
      villeNom: true,
      cleComptagePersonne: true,
      cleComptageDomaine: true,
      cleComptageTelephone: true,
    },
  });
  for (const l of lignes) {
    await prisma.tourDemande.update({
      where: { id: l.id },
      data: {
        nom: chiffrerChamp("nom", VALEUR_EFFACEE),
        email: chiffrerChamp("email", VALEUR_EFFACEE),
        telephone: chiffrerChamp("telephone", VALEUR_EFFACEE),
        emailHash: null,
        ipHash: null,
        villeSaisie: VALEUR_EFFACEE,
        ...(l.villeNom === null ? { villeCle: VILLE_CLE_EFFACEE } : {}),
        ...(l.cleComptagePersonne !== null ? { cleComptagePersonne: `efface:${l.id}:p` } : {}),
        ...(l.cleComptageDomaine !== null ? { cleComptageDomaine: `efface:${l.id}:d` } : {}),
        ...(l.cleComptageTelephone !== null ? { cleComptageTelephone: `efface:${l.id}:t` } : {}),
        depuis: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        fichesProches: Prisma.DbNull,
        statut: "effacee_rgpd",
        statutChangeLe: new Date(),
      },
    });
  }
  return { anonymisees: lignes.length };
}
