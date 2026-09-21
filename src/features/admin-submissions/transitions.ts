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
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";
import { annulerRelancesLeadApporteur } from "@/features/commercial-application/relances-lead-apporteur";

/** Les cinq gestes qu'un admin pose sur une fiche. */
export type Transition = "traite" | "archiver" | "desarchiver" | "sans-suite" | "remettre";

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
  readonly marqueDetails?: "sansSuiteAt";
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
  desarchiver: {
    donnees: { status: "in_progress", archivedAt: null },
    annuleLesRelances: false,
  },
  // Remettre à traiter : la fiche redevient visible dans « à traiter ».
  remettre: {
    donnees: { status: "in_progress", needsAttention: true },
    annuleLesRelances: false,
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

  let ligne: { id: string; contactEmail: string | null; deletedAt: Date | null } | null = null;
  try {
    ligne = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, contactEmail: true, deletedAt: true },
    });
  } catch {
    return { ok: false, relancesRetirees: 0, erreur: "db" };
  }

  if (!ligne) return { ok: false, relancesRetirees: 0, erreur: "introuvable" };
  // 🔴 Une fiche effacée (art. 17) ne se transite plus. La rouvrir ou
  // l'archiver reviendrait à la faire vivre après une demande d'effacement.
  if (ligne.deletedAt) return { ok: false, relancesRetirees: 0, erreur: "effacee" };

  // `new Date(0)` dans la table n'est qu'un marqueur de PRÉSENCE : l'instant
  // réel se pose ici, à l'écriture. Une date figée dans un objet de module
  // serait celle du démarrage du serveur — le genre de faux qui ne lève pas.
  const maintenant = new Date();
  const donnees: Record<string, unknown> = { ...effet.donnees };
  if (effet.donnees.archivedAt instanceof Date) donnees.archivedAt = maintenant;

  try {
    await prisma.$transaction(async (tx) => {
      if (effet.marqueDetails) {
        const actuel = await tx.submission.findUnique({
          where: { id: submissionId },
          select: { details: true },
        });
        const details =
          actuel?.details && typeof actuel.details === "object" && !Array.isArray(actuel.details)
            ? (actuel.details as Record<string, unknown>)
            : {};
        donnees.details = { ...details, [effet.marqueDetails]: maintenant.toISOString() };
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
  if (effet.annuleLesRelances) {
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
