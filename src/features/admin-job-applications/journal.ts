import "server-only";

/**
 * LE JOURNAL D'UNE CANDIDATURE — la porte d'écriture, et la seule.
 *
 * ## Le défaut que ce module ferme
 *
 * Écrire à un candidat imposait de sortir sur une boîte mail, et il ne restait
 * aucune trace côté produit de ce qui avait été dit, quand, ni par qui. Le seul
 * espace de mémoire était `internalNotes` : une zone de texte unique, **écrasée
 * à chaque enregistrement**. Un post-it, pas un journal.
 *
 * ## Pourquoi une porte UNIQUE, et pas un `prisma.create` à chaque appelant
 *
 * Trois invariants n'existent que s'ils sont écrits à un seul endroit :
 *
 *  1. **L'auteur est instantané ET référencé.** `authorName` n'est pas
 *     dérivable de `authorId` : le compte peut être supprimé, la clé étrangère
 *     passe alors à `NULL`, et le journal doit continuer de dire qui a agi.
 *     Un appelant qui oublierait le nom produirait une ligne anonyme, et on ne
 *     s'en apercevrait que le jour où elle compterait.
 *
 *  2. **La date du FAIT n'est pas celle de la saisie.** Un appel passé lundi et
 *     consigné mardi se lit à lundi. `occurredAt` est donc un paramètre, avec
 *     « maintenant » pour défaut — jamais une valeur imposée.
 *
 *  3. **Le résumé est borné à 300 caractères.** La colonne l'impose ; sans
 *     troncature ici, un corps d'e-mail collé dans le résumé ferait échouer
 *     l'écriture au fond de la pile, sur une erreur Postgres que l'appelant
 *     traduirait mal.
 *
 * ## Ajout seul
 *
 * 🔴 Ce module n'expose ni mise à jour ni suppression, et ce n'est pas un oubli.
 * Un journal qu'on peut réécrire ne prouve rien — or c'est exactement ce qu'on
 * lui demande : dire qui a écrit quoi à un candidat, et quand. Les seules
 * disparitions légitimes sont les cascades d'effacement (droit à l'oubli, purge
 * de rétention), qui relèvent de Postgres et pas d'une action.
 *
 * `le-journal-est-en-ajout-seul.spec.ts` refuse toute réintroduction.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, JobApplicationEventType } from "../../../prisma/generated/client";

/** Longueur maximale du résumé — dérivée de la colonne, jamais recopiée à la main. */
export const RESUME_MAX = 300;

export interface EvenementCandidature {
  readonly applicationId: string;
  readonly type: JobApplicationEventType;
  /** Compte admin à l'origine du geste. `null` pour un fait automatique. */
  readonly authorId: string | null;
  /**
   * Nom lisible de l'auteur, figé au moment du geste.
   *
   * Pour un fait automatique, on nomme le MÉCANISME (« Envoi automatique »,
   * « Passe de rétention ») plutôt que de laisser vide : une ligne sans auteur
   * se lit comme une ligne dont on a perdu l'auteur.
   */
  readonly authorName: string;
  /** Quand le fait a eu lieu. Défaut : maintenant. */
  readonly occurredAt?: Date;
  readonly summary: string;
  readonly body?: string | null;
  readonly replyId?: string | null;
  readonly interviewId?: string | null;
  readonly meta?: Prisma.InputJsonValue | undefined;
}

/**
 * Client Prisma acceptable — le singleton, ou le client d'une transaction.
 *
 * 🔑 C'est ce qui permet à un changement de statut d'être ATOMIQUE avec sa
 * trace. Sans ce paramètre, une écriture de journal hors transaction pourrait
 * réussir pendant que le changement qu'elle décrit échoue : le journal
 * affirmerait un fait qui n'a pas eu lieu, ce qui est pire que pas de journal.
 */
type ClientPrisma = Pick<typeof prisma, "jobApplicationEvent" | "jobApplication">;

/**
 * Consigne un événement. **L'unique écriture du journal.**
 *
 * Ne rattrape aucune erreur : une trace qu'on n'a pas pu écrire doit faire
 * échouer le geste qu'elle décrit, pas le laisser passer en silence. C'est
 * l'inverse exact du choix fait pour la journalisation d'ACCÈS
 * (`getApplicationDetailAction`), où un journal indisponible ne doit pas priver
 * le recruteur du dossier — parce que là-bas la trace accompagne une lecture,
 * ici elle atteste une écriture.
 */
export async function consignerEvenement(
  evenement: EvenementCandidature,
  client: ClientPrisma = prisma,
): Promise<string> {
  const resume = evenement.summary.trim();
  if (resume.length === 0) {
    throw new Error("journal: un événement sans résumé ne se relit pas");
  }

  const survenuLe = evenement.occurredAt ?? new Date();

  const ligne = await client.jobApplicationEvent.create({
    data: {
      applicationId: evenement.applicationId,
      type: evenement.type,
      authorId: evenement.authorId,
      authorName: evenement.authorName,
      occurredAt: survenuLe,
      // Troncature ICI, au plus près de la contrainte de colonne. Le caractère
      // de continuation dit que le texte est coupé — un résumé coupé net se lit
      // comme un résumé complet.
      summary: resume.length > RESUME_MAX ? `${resume.slice(0, RESUME_MAX - 1)}…` : resume,
      body: evenement.body ?? null,
      replyId: evenement.replyId ?? null,
      interviewId: evenement.interviewId ?? null,
      ...(evenement.meta === undefined ? {} : { meta: evenement.meta }),
    },
    select: { id: true },
  });

  // ── LA DATE DE DERNIÈRE ACTIVITÉ EST DÉNORMALISÉE ICI, ET NULLE PART AILLEURS
  //
  // 🔑 C'est la raison d'être de la « porte unique » d'écriture du journal :
  // parce que tout fait passe par cette fonction, `lastActivityAt` ne peut pas
  // dériver. Si chaque action la posait elle-même, il suffirait d'un appelant
  // qui l'oublie pour qu'un dossier vivant apparaisse dans l'écran des dossiers
  // oubliés — et cet écran, une fois faux, ne serait plus jamais regardé.
  //
  // ⚠️ On écrit `occurredAt`, PAS `new Date()` : consigner aujourd'hui un appel
  // passé la semaine dernière ne rend pas le dossier actif aujourd'hui.
  // `updateMany` plutôt que `update` : une candidature supprimée entre-temps ne
  // doit pas faire échouer l'écriture de sa propre trace.
  await client.jobApplication.updateMany({
    where: {
      id: evenement.applicationId,
      OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: survenuLe } }],
    },
    data: { lastActivityAt: survenuLe },
  });

  return ligne.id;
}

/**
 * Résumé d'un changement de statut, écrit une fois pour toutes.
 *
 * 🔑 La formule vit ici et pas dans l'action : deux appelants qui la
 * rédigeraient chacun produiraient deux libellés pour le même fait, et la frise
 * deviendrait illisible au premier changement de vocabulaire.
 */
export function resumeChangementStatut(
  ancien: string,
  nouveau: string,
  libelle: (statut: string) => string,
): string {
  return `Statut : ${libelle(ancien)} → ${libelle(nouveau)}`;
}
