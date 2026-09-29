/**
 * Copie d'un e-mail TEL QU'IL EST PARTI (2026-09-27, décision Will).
 *
 * Appelée par le worker d'envoi APRÈS l'accord du relais et la clôture du
 * journal : on garde l'objet, le HTML et le texte que le worker vient de
 * rendre — pas un re-rendu ultérieur, qui dirait ce que le gabarit est devenu
 * et non ce que la personne a reçu.
 *
 * ## Best-effort, sans exception
 *
 * Aucune fonction de ce module ne lève. L'e-mail est déjà parti quand elle
 * s'exécute : lever ferait rejouer le job par BullMQ, donc RENVOYER l'e-mail.
 * Un échec d'écriture est journalisé en console et remonté à Sentry, puis on
 * continue. C'est aussi ce qui rend la fenêtre app/worker sans danger : le
 * worker peut atterrir avant que la migration ne crée la table.
 *
 * ## Ce qui est écrit
 *
 * · les liens personnels MASQUÉS (`masquerSecretsEmail`) — la console ne doit
 *   pas pouvoir rejouer une signature, un émargement ou une connexion ;
 * · les NOMS des pièces jointes, jamais leur contenu.
 *
 * Durée : 12 mois (purge de rétention). Effacement art. 17 : supprimée
 * (`eraseEmailTracesForEmail`). Export art. 15 : rendue (`api/gdpr-export`).
 */

import { prisma } from "@/lib/prisma";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { EmailLogStatus } from "../../../prisma/generated/client";

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

export interface CopieEnvoi {
  /** Identifiant du job BullMQ — c'est par lui que la ligne du journal se retrouve. */
  jobId: string | undefined;
  subject: string;
  html: string;
  text: string;
  /** Noms des pièces jointes (le binaire n'est jamais copié). */
  attachmentNames?: readonly string[] | undefined;
}

/**
 * Écrit la copie de l'e-mail envoyé, rattachée à sa ligne `email_logs`.
 *
 * @returns `true` si la copie est écrite, `false` sinon (stub, pas de job,
 *   ligne introuvable, échec d'écriture) — jamais d'exception.
 */
export async function enregistrerCopieEnvoi(copie: CopieEnvoi): Promise<boolean> {
  if (estStub()) return false;
  // Sans identifiant de job, rien ne relie l'envoi à SA ligne : deviner par
  // destinataire et gabarit rattacherait la copie au mauvais envoi.
  if (!copie.jobId) return false;
  try {
    const ligne = await prisma.emailLog.findFirst({
      where: { jobId: copie.jobId, status: EmailLogStatus.sent },
      orderBy: { sentAt: "desc" },
      select: { id: true },
    });
    if (!ligne) return false;
    const masque = masquerSecretsEmail({
      subject: copie.subject,
      html: copie.html,
      text: copie.text,
    });
    const donnees = {
      subject: masque.subject.slice(0, 998),
      html: masque.html,
      text: masque.text,
      attachmentNames: [...(copie.attachmentNames ?? [])],
      secretsMasques: masque.masques,
    };
    // `upsert` : un job rejoué dont la ligne serait déjà copiée ne lève pas.
    await prisma.emailLogContent.upsert({
      where: { emailLogId: ligne.id },
      create: { emailLogId: ligne.id, ...donnees },
      update: donnees,
    });
    return true;
  } catch (e) {
    console.error(
      `[copie-envoi] copie non conservée (job ${copie.jobId}) — l'envoi, lui, est parti :`,
      e instanceof Error ? e.message : String(e),
    );
    // P2021 = « la table n'existe pas » : c'est la fenêtre attendue où le
    // worker (bâti en ~3 min) tourne avant que l'app (≈ 50 min) n'ait joué la
    // migration. Un rapport Sentry par e-mail pendant une heure ne dirait rien
    // qu'on ne sache déjà ; la console le dit, Sentry garde les vraies pannes.
    if ((e as { code?: unknown } | null)?.code !== "P2021") {
      captureWorkerError("email", "emails", undefined, e);
    }
    return false;
  }
}
