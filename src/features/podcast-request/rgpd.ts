/**
 * Demandes de podcast — droits d'accès (art. 15) et d'effacement (art. 17).
 *
 * ## Le défaut que ce module corrige (`D5-5-04`)
 *
 * Une demande de podcast était **hors de portée des deux droits**, et c'est la
 * **quatrième fois** que ce dépôt produit exactement cette faute :
 *
 *   · `D5-5-01` — `email_logs` : l'adresse en clair survivait à la demande.
 *   · `D5-5-02` — `email_outbox` : l'adresse ET la charge utile du message.
 *   · `D5-5-03` — les candidatures : CV, photo, téléphone.
 *   · `D5-5-04` — celle-ci.
 *
 * La table n'était **ni traitée ni exemptée**. La route art. 17 répondait
 * « Vos données identifiantes ont été effacées ou anonymisées » pendant que le
 * nom du dirigeant, son adresse, son téléphone, sa ville, son code postal et sa
 * description d'activité restaient intacts.
 *
 * 🔑 Et ces personnes-là sont précisément celles qui utiliseront la route
 * publique. Les autres tables non instruites du dépôt concernent des
 * signataires, des factures, des contacts d'affaires — des gens liés par un
 * contrat, pour qui une conservation se plaide. Ici : un membre du public qui a
 * rempli un formulaire pour une prestation gratuite. Aucun contrat, aucune
 * pièce comptable, aucune preuve Qualiopi. Rien à opposer à sa demande.
 *
 * ## L'introuvabilité, qui doublait le défaut
 *
 * `email` est chiffré par `encryptPii` avec un **IV aléatoire** : deux
 * chiffrements de la même adresse donnent deux valeurs différentes, donc
 * `where: { email }` ne correspond jamais. Brancher la table sans corriger cela
 * aurait produit le pire résultat possible — un effacement qui touche zéro
 * ligne **en répondant « succès »**, c'est-à-dire la panne silencieuse que
 * décrit déjà l'en-tête de `src/lib/security/email-hash.ts`.
 *
 * D'où `emailHash` (migration `20260824120000_podcast_request_email_hash`), et
 * le repli borné ci-dessous pour l'historique qui n'en a pas.
 *
 * ## Pourquoi une SUPPRESSION et non une pseudonymisation
 *
 * Ailleurs, on pseudonymise pour garder une preuve : `email_logs` conserve la
 * ligne parce qu'elle atteste d'un envoi Qualiopi. Ici il n'y a rien à
 * attester. Une demande de tournage qui n'a pas abouti ne prouve rien, ne
 * justifie rien, et n'est réclamée par aucune obligation. La ligne part en
 * entier — `internalNotes` et `activity` compris, qui sont de la saisie libre.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";

/**
 * Nombre maximal de demandes déchiffrées lors du repli.
 *
 * ⚠️ Borné par principe. Sans borne, une base qui grossit transformerait chaque
 * demande RGPD en lecture intégrale de la table — et le jour où elle deviendrait
 * trop lente, le droit ne s'exercerait plus. Le plafond est **signalé** à
 * l'appelant plutôt que silencieux : une recherche tronquée qui se présente
 * comme complète est pire qu'une recherche refusée.
 */
export const PLAFOND_BALAYAGE_PODCAST = 5_000;

/** Normalisation identique à celle de l'empreinte, pour comparer le même objet. */
function normaliser(email: string): string {
  return email.trim().toLowerCase();
}

export interface DemandePodcastTrouvee {
  readonly id: string;
  readonly companyName: string;
  readonly city: string;
  readonly activity: string;
  readonly status: string;
  readonly createdAt: Date;
}

/**
 * Retrouve les demandes de podcast d'une personne.
 *
 * Deux chemins, dans cet ordre :
 *   1. l'empreinte, exacte et indexée, pour tout ce qui a été déposé depuis la
 *      correction ;
 *   2. un balayage déchiffrant borné, pour l'historique sans empreinte.
 *
 * Les deux sont fusionnés : une même demande ne peut pas être rendue deux fois.
 */
export async function trouverDemandesPodcast(email: string): Promise<{
  readonly demandes: DemandePodcastTrouvee[];
  /** `true` si le balayage a mordu son plafond — la liste peut être incomplète. */
  readonly tronque: boolean;
}> {
  const cible = normaliser(email);
  const empreinte = hashEmailForLookup(email);
  const parId = new Map<string, DemandePodcastTrouvee>();

  const champs = {
    id: true,
    companyName: true,
    city: true,
    activity: true,
    status: true,
    createdAt: true,
  } as const;

  if (empreinte !== null) {
    const parEmpreinte = await prisma.podcastRequest.findMany({
      where: { emailHash: empreinte },
      select: champs,
    });
    for (const d of parEmpreinte) parId.set(d.id, d);
  }

  // Repli : l'historique déposé avant l'empreinte. On ne lit QUE les lignes
  // sans empreinte — celles qui en ont une ont déjà été traitées ci-dessus, et
  // les relire doublerait le coût sans rien ajouter.
  const sansEmpreinte = await prisma.podcastRequest.findMany({
    where: { emailHash: null },
    select: { ...champs, email: true },
    take: PLAFOND_BALAYAGE_PODCAST + 1,
  });
  const tronque = sansEmpreinte.length > PLAFOND_BALAYAGE_PODCAST;

  for (const d of sansEmpreinte.slice(0, PLAFOND_BALAYAGE_PODCAST)) {
    // `decryptPii` est tolérant : une valeur non chiffrée est rendue telle
    // quelle. Les dépôts antérieurs au chiffrement passent donc aussi.
    if (normaliser(decryptPii(d.email)) !== cible) continue;
    parId.set(d.id, {
      id: d.id,
      companyName: d.companyName,
      city: d.city,
      activity: d.activity,
      status: d.status,
      createdAt: d.createdAt,
    });
  }

  return { demandes: [...parId.values()], tronque };
}

export interface EffacementPodcastResult {
  readonly supprimees: number;
  /** `true` si le repli a mordu son plafond — des lignes anciennes peuvent rester. */
  readonly tronque: boolean;
}

/**
 * Efface les demandes de podcast d'une personne.
 *
 * Suppression franche : rien dans cette table ne justifie une conservation
 * (voir l'en-tête). On réutilise `trouverDemandesPodcast` plutôt que de
 * dupliquer la recherche — un prédicat recopié diverge toujours, et ce dépôt
 * l'a payé quatre fois.
 */
export async function effacerDemandesPodcastPour(email: string): Promise<EffacementPodcastResult> {
  const { demandes, tronque } = await trouverDemandesPodcast(email);
  if (demandes.length === 0) return { supprimees: 0, tronque };

  const { count } = await prisma.podcastRequest.deleteMany({
    where: { id: { in: demandes.map((d) => d.id) } },
  });
  return { supprimees: count, tronque };
}
