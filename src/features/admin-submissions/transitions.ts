// Les CINQ transitions d'état d'une fiche de la console, en un seul endroit.
//
// ── Pourquoi ce module existe ─────────────────────────────────────────────
// L'archivage vivait dans `reply-actions.ts`, le marquage « traité » dans
// `actions.ts`, et chacun écrivait sa propre combinaison de colonnes. Deux
// chemins qui décrivent le même état finissent toujours par diverger : ce
// dépôt en a déjà payé le prix plusieurs fois, assez pour en faire une règle.
//
// 🔴 CE QUI A MOTIVÉ LE REGROUPEMENT, ET QUI N'EST PAS THÉORIQUE
// « Archiver » posait `status: archived` + `needsAttention: false` mais
// n'annulait PAS les relances en attente. Une personne archivée continuait
// donc de recevoir « ton dossier t'attend » à J+2 et J+7 — des jobs retardés
// qui dorment dans Redis et que rien ne réveillait pour les retirer. Archiver
// quelqu'un et continuer à le relancer est le genre d'incohérence qu'on ne
// voit jamais depuis la console : elle se voit dans sa boîte à lui.
//
// ── La table, et rien d'autre ─────────────────────────────────────────────
// Tout ce qui distingue les cinq transitions tient dans `EFFETS`. Ajouter une
// sixième se fait LÀ, et nulle part ailleurs. C'est le même parti pris que
// `PASSAGES` dans `rappels-appel.ts`, qui a prouvé sa valeur : le jour où un
// second public est arrivé, il a suffi d'ajouter trois lignes.

import "server-only";

import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { adminPath } from "@/lib/admin-path";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";
import { annulerRelancesLeadApporteur } from "@/features/commercial-application/relances-lead-apporteur";

/** Les six gestes qu'un admin pose sur une fiche. */
export type Transition =
  "traite" | "archiver" | "desarchiver" | "sans-suite" | "remettre" | "repondu-ailleurs";

interface Effet {
  /** Les colonnes écrites. `undefined` = on ne touche pas. */
  readonly donnees: {
    readonly status?: "processed" | "archived" | "in_progress";
    readonly archivedAt?: Date | null;
    readonly needsAttention?: boolean;
  };
  /**
   * Retirer les relances encore en file pour cette personne.
   *
   * 🔑 Vrai pour « archiver » ET « sans suite », qui disent tous deux que
   * l'échange est terminé. Faux pour « traité », qui range sans clore : une
   * personne traitée peut très bien devoir être relancée.
   */
  readonly annuleLesRelances: boolean;
  /** Le motif inscrit au journal des envois, lisible par un humain. */
  readonly motifAnnulation?: string;
  /** L'action consignée au journal d'activité, quand elle mérite une trace. */
  readonly journal?: string;
  /** Une marque posée dans `details`, pour les états que le schéma ne porte pas. */
  readonly marqueDetails?: "sansSuiteAt" | "reponduHorsCircuitAt";
  /**
   * Les marques RETIRÉES de `details`.
   *
   * 🔑 Une transition qui ROUVRE doit défaire ce que la fermeture a posé, sinon
   * elle réussit sans rien changer. C'est le défaut exact que cette entrée
   * répare : « Remettre à traiter » laissait `sansSuiteAt` en place, la pastille
   * continuait d'annoncer « Sans suite », et le bouton se reproposait — sur une
   * fiche que l'écran venait de déclarer rouverte.
   */
  readonly retireDetails?: readonly "sansSuiteAt"[];
}

/**
 * 🔑 LA TABLE QUI PORTE TOUTE LA DIFFÉRENCE. Rien d'autre dans ce fichier ne
 * dépend de la transition demandée.
 */
const EFFETS: Readonly<Record<Transition, Effet>> = {
  // Ranger, sans clore. La fiche reste vivante et peut être relancée.
  traite: {
    donnees: { status: "processed", needsAttention: false },
    annuleLesRelances: false,
  },
  // Clore. L'échange est fini : plus aucune relance ne doit partir.
  archiver: {
    donnees: { status: "archived", archivedAt: new Date(0), needsAttention: false },
    annuleLesRelances: true,
    motifAnnulation: "Envoi annulé : la fiche a été archivée.",
  },
  // Clore ET le dire. Même effet qu'archiver, plus une trace explicite.
  //
  // ⚠️ La suppression automatique à 24 mois annoncée dans la politique de
  // confidentialité s'applique par le MÊME chemin que l'archivage
  // (`retention-purge-worker.ts`, `submissionsArchived: 24`). AUCUN nouveau
  // code de purge n'est écrit ici : un second compte à rebours serait une
  // seconde vérité sur la même donnée.
  "sans-suite": {
    donnees: { status: "archived", archivedAt: new Date(0), needsAttention: false },
    annuleLesRelances: true,
    motifAnnulation: "Envoi annulé : la fiche est classée sans suite.",
    journal: "submission.sans_suite",
    marqueDetails: "sansSuiteAt",
  },
  // Rouvrir. On ne ressuscite PAS les relances : elles ont été retirées de la
  // file, et les faire repartir enverrait un « ton dossier t'attend » des
  // semaines après coup.
  //
  // 🔴 `retireDetails` VAUT ICI AUSSI, et son absence était le DÉFAUT JUMEAU de
  // celui de « remettre » — sur le chemin le plus visible des deux. Une fiche
  // classée sans suite est AUSSI archivée : la ligne lui propose donc
  // « Désarchiver » en bouton PRINCIPAL. Sans cette ligne, on la rouvrait, et la
  // pastille continuait d'annoncer « Sans suite » pendant que le menu
  // reproposait « Remettre à traiter » sur une fiche déjà rouverte.
  //
  // 🔑 La règle, et elle vaut au-delà de ce cas : **toute transition qui ROUVRE
  // défait ce que la fermeture a posé**. Corriger un seul des deux chemins
  // laissait le défaut entier, derrière un autre bouton.
  desarchiver: {
    donnees: { status: "in_progress", archivedAt: null },
    annuleLesRelances: false,
    retireDetails: ["sansSuiteAt"],
  },
  // « J'ai répondu ailleurs » — depuis Gmail, au téléphone, de vive voix.
  //
  // 🔴 LE SEUL GESTE QUI NE CHANGE AUCUN STATUT, ET C'EST TOUT SON INTÉRÊT. La
  // fiche reste exactement où elle est ; ce qui doit s'arrêter, ce sont les
  // relances automatiques. Sans lui, répondre depuis Gmail laissait partir
  // « ton dossier t'attend » à J+2 et J+7 — deux messages qui ignorent la
  // conversation en cours, et qui font douter du sérieux de la maison.
  //
  // ⚠️ `needsAttention: false` est délibéré et c'est le SEUL effet : la fiche
  // sort de « à traiter », puisqu'elle l'a été. La marquer « traité » serait
  // décider à la place de Will — une réponse n'est pas toujours une clôture.
  "repondu-ailleurs": {
    donnees: { needsAttention: false },
    annuleLesRelances: true,
    motifAnnulation: "Envoi annulé : une réponse a été faite en dehors de la console.",
    journal: "submission.repondu_ailleurs",
    marqueDetails: "reponduHorsCircuitAt",
  },
  // Remettre à traiter : la fiche redevient visible dans « à traiter ».
  //
  // 🔴 `archivedAt: null` EST INDISPENSABLE, et son absence rendait ce geste
  // MUET. « Classer sans suite » pose `archivedAt` ; la liste par défaut filtre
  // sur `archivedAt: null`. Sans cette remise à zéro, l'écran répondait « La
  // fiche est à traiter » et la fiche restait invisible — dans un état
  // (`in_progress` + `archivedAt` non nul) qu'aucun autre chemin ne produit.
  // Un bouton qui annonce un succès sans rien changer se reclique.
  remettre: {
    donnees: { status: "in_progress", needsAttention: true, archivedAt: null },
    annuleLesRelances: false,
    retireDetails: ["sansSuiteAt"],
  },
};

export interface ResultatTransition {
  readonly ok: boolean;
  /** Relances retirées de la file. `0` est une réponse, pas un échec. */
  readonly relancesRetirees: number;
  readonly erreur?: "introuvable" | "effacee" | "db";
}

/**
 * Applique une transition à une fiche.
 *
 * 🔴 L'ANNULATION DES RELANCES EST FAITE APRÈS L'ÉCRITURE, ET SON ÉCHEC NE
 * DÉFAIT RIEN. Retirer un job de Redis peut échouer (file indisponible) ;
 * refuser l'archivage pour autant laisserait l'admin devant un bouton qui ne
 * marche pas, sur une fiche qu'il veut clore. On archive, on tente le retrait,
 * et on REND le compte — l'appelant décide quoi en dire.
 *
 * L'ordre inverse serait pire : des relances retirées pour une fiche qui,
 * finalement, n'a pas été archivée.
 */
export async function appliquerTransition(
  submissionId: string,
  transition: Transition,
  adminUserId: string,
): Promise<ResultatTransition> {
  const effet = EFFETS[transition];

  let ligne: {
    id: string;
    contactEmail: string | null;
    deletedAt: Date | null;
    details: unknown;
  } | null = null;
  try {
    ligne = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, contactEmail: true, deletedAt: true, details: true },
    });
  } catch {
    return { ok: false, relancesRetirees: 0, erreur: "db" };
  }

  if (!ligne) return { ok: false, relancesRetirees: 0, erreur: "introuvable" };
  // 🔴 Une fiche à la CORBEILLE ne se transite plus : la rouvrir ou l'archiver
  // reviendrait à la faire vivre après qu'on l'a mise de côté.
  //
  // ⚠️ CE N'EST PAS LA GARDE DE L'ARTICLE 17, et le dire serait faussement
  // rassurant. `eraseSubmissionsForEmail` anonymise la ligne EN PLACE et ne
  // touche jamais à `deletedAt` : une fiche réellement effacée passe ici sans
  // encombre. Ce qui la protège vraiment est plus loin — son adresse devient
  // synthétique, et tout envoi s'arrête dessus.
  if (ligne.deletedAt) return { ok: false, relancesRetirees: 0, erreur: "effacee" };

  // `new Date(0)` dans la table n'est qu'un marqueur de PRÉSENCE : l'instant
  // réel se pose ici, à l'écriture. Une date figée dans un objet de module
  // serait celle du démarrage du serveur — le genre de faux qui ne lève pas.
  const maintenant = new Date();
  const donnees: Record<string, unknown> = { ...effet.donnees };
  if (effet.donnees.archivedAt instanceof Date) donnees.archivedAt = maintenant;

  try {
    await prisma.$transaction(async (tx) => {
      if (effet.marqueDetails || effet.retireDetails) {
        const actuel = await tx.submission.findUnique({
          where: { id: submissionId },
          select: { details: true },
        });
        const details =
          actuel?.details && typeof actuel.details === "object" && !Array.isArray(actuel.details)
            ? { ...(actuel.details as Record<string, unknown>) }
            : {};
        // Retirer AVANT de marquer : une transition ne fait jamais les deux sur
        // la même clé, mais l'ordre inverse effacerait la marque qu'on vient de
        // poser le jour où quelqu'un l'essaierait.
        for (const cle of effet.retireDetails ?? []) delete details[cle];
        if (effet.marqueDetails) details[effet.marqueDetails] = maintenant.toISOString();
        donnees.details = details;
      }
      await tx.submission.update({ where: { id: submissionId }, data: donnees });
      if (effet.journal) {
        await tx.activityLog.create({
          data: {
            adminUserId,
            action: effet.journal,
            targetType: "submission",
            targetId: submissionId,
            // 🔑 Aucune donnée personnelle au journal : l'identifiant suffit à
            // retrouver la fiche, et le journal se lit sans droit d'accès aux
            // coordonnées.
            changes: { transition } as Record<string, string>,
          },
        });
      }
    });
  } catch {
    return { ok: false, relancesRetirees: 0, erreur: "db" };
  }

  let relancesRetirees = 0;
  // 🔴 LE GESTE PORTE SUR UNE FICHE, L'ANNULATION SUR UNE ADRESSE — et c'est
  // toute la raison de cette condition.
  //
  // Les relances sont retrouvées par l'EMPREINTE de l'adresse, jamais par la
  // fiche : une personne en a souvent deux ou trois. Sans ce garde-fou,
  // archiver un simple message /contact de quelqu'un tuerait, EN SILENCE, les
  // rappels « ton dossier t'attend » programmés par sa candidature d'apporteur
  // — et inscrirait au journal des envois « la fiche a été archivée » en
  // parlant d'une fiche qui n'avait rien programmé.
  //
  // 🔑 On ne retire donc les relances que si la fiche qu'on ferme appartient au
  // tunnel apporteur. Entre deux fiches apporteur de la même personne, on les
  // retire : le tunnel raisonne PAR PERSONNE partout ailleurs (« jamais deux
  // invitations » se vérifie ainsi), et l'incohérence serait là.
  if (effet.annuleLesRelances && estApporteur(ligne.details)) {
    const adresse = decryptPii(ligne.contactEmail);
    if (adresse) {
      try {
        relancesRetirees = await annulerRelancesLeadApporteur(adresse, effet.motifAnnulation);
      } catch {
        // La fiche EST archivée. Le dire autrement serait mentir à l'admin.
        relancesRetirees = 0;
      }
    }
  }

  revalidatePath(adminPath("fr", "contacts/messages"));
  revalidatePath(adminPath("fr", "contacts/commercial"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);

  return { ok: true, relancesRetirees };
}
