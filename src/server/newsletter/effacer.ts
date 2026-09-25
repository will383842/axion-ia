/**
 * EFFACEMENT D'UN ABONNÉ DEPUIS LA CONSOLE (lot L3, 2026-09-24).
 *
 * 🔴 L'ancien bouton « Effacer (RGPD) » supprimait la seule ligne
 * `newsletter_subscribers`. Il laissait derrière lui :
 *   · les demandes du guide (adresse en clair) ;
 *   · les journaux d'e-mail (`email_logs`, adresse en clair) et la corbeille
 *     d'envoi (`email_outbox`, charge utile complète) ;
 *   · la fiche du CRM, qui n'en apprenait rien ;
 * et, s'il n'y avait pas de ligne, il levait une erreur non rattrapée : l'écran
 * tombait au lieu de dire « introuvable ».
 *
 * Il passe désormais par les MÊMES fonctions que l'effacement public
 * (`/api/gdpr-erase`) pour tout ce qui touche la lettre et le guide :
 *   · `eraseNewsletterForEmail`   — l'abonné ET ses demandes du guide ;
 *   · `eraseEmailTracesForEmail`  — journal pseudonymisé (preuve gardée),
 *                                    corbeille supprimée ;
 *   · `propagateGdprToCrm(erase)` — le CRM efface par `person_key` et inscrit
 *                                    l'empreinte en liste de suppression.
 * Les autres tables (demandes de contact, candidatures, podcast…) restent le
 * périmètre de l'effacement complet : ce bouton ne les couvre PAS. Son libellé
 * le dit (« Effacer de la lettre et du guide (RGPD) »), et l'aide affichée
 * sous lui aussi : « N'efface pas les demandes de contact, candidatures ni
 * autres données. Pour une demande d'effacement complète, utilisez la
 * procédure d'effacement complet. »
 *
 * Le motif saisi est gardé au journal : le champ demande « sans adresse
 * e-mail », sans quoi l'effacement laisserait l'adresse dans sa propre trace.
 *
 * Journal : `newsletter.erased`, avec le SHA-256 de l'adresse (jamais
 * l'adresse) — c'est aussi ce que relit la liste de suppression exportée.
 *
 * ⚠️ Module serveur ordinaire, PAS `"use server"`.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { eraseEmailTracesForEmail, eraseNewsletterForEmail } from "@/lib/rgpd-erase";
import { propagateGdprToCrm } from "@/server/crm-sync/gdpr";

export type IssueEffacement =
  | {
      readonly ok: true;
      readonly abonnesSupprimes: number;
      readonly demandesGuideSupprimees: number;
      readonly journauxPseudonymises: number;
      readonly corbeilleSupprimee: number;
      readonly crm: "ok" | "deferred" | "failed";
    }
  | { readonly ok: false; readonly erreur: "introuvable" };

export async function effacerAbonneDepuisConsole(entree: {
  readonly abonneId: string;
  readonly motif: string;
  readonly adminUserId: string;
  readonly ip?: string | null;
}): Promise<IssueEffacement> {
  const abonne = await prisma.newsletterSubscriber.findUnique({
    where: { id: entree.abonneId },
    select: { id: true, email: true },
  });
  if (!abonne) return { ok: false, erreur: "introuvable" };
  const email = abonne.email;

  // CRM d'abord calculé, NON bloquant (même doctrine que la route publique) :
  // l'effacement local a lieu que le second système réponde ou non.
  const crm = await propagateGdprToCrm({
    action: "erase",
    personKey: hashEmailForLookup(email) ?? "",
    email,
  });

  const [lettre, traces] = await Promise.all([
    eraseNewsletterForEmail(email),
    eraseEmailTracesForEmail(email),
  ]);

  await prisma.activityLog.create({
    data: {
      adminUserId: entree.adminUserId,
      action: "newsletter.erased",
      targetType: "newsletter_subscriber",
      targetId: abonne.id,
      changes: {
        reason: entree.motif,
        // SHA-256 de l'adresse normalisée — relu par la liste de suppression.
        emailHash: createHash("sha256").update(email.trim().toLowerCase()).digest("hex"),
        guideDeleted: lettre.guideDeleted,
        logsPseudonymises: traces.logsPseudonymises,
        outboxSupprimes: traces.outboxSupprimes,
        crmStatus: crm.status,
      },
      ipAddress: entree.ip ?? null,
    },
  });

  return {
    ok: true,
    abonnesSupprimes: lettre.deleted,
    demandesGuideSupprimees: lettre.guideDeleted,
    journauxPseudonymises: traces.logsPseudonymises,
    corbeilleSupprimee: traces.outboxSupprimes,
    crm: crm.status,
  };
}
