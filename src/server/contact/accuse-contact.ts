/**
 * Accusé de réception du formulaire de contact — la charge utile, et l'envoi
 * DIFFÉRÉ quand la demande annonce des pièces jointes (2026-10-15).
 *
 * Sans pièce jointe, rien ne change : l'action envoie l'accusé tout de suite.
 *
 * Avec pièces jointes, les fichiers partent du navigateur vers R2 APRÈS la
 * demande : l'accusé, qui dit « N pièces bien reçues », attend donc qu'elles
 * soient contrôlées. Deux chemins le déclenchent, et un seul suffit :
 *   - la fin de l'envoi, par le navigateur (`finaliserPiecesJointesAction`) ;
 *   - le nettoyage horaire, si la personne a fermé l'onglet en route
 *     (`nettoyerPiecesJointesContact`).
 * La clé d'idempotence (`accuse-contact-<id>`) garantit qu'il ne part qu'une fois.
 *
 * Le gabarit est celui que l'action a choisi (`emailTemplateFor`), rangé dans
 * `details.accuseDiffere` à l'écriture de la demande : le différé ne re-décide
 * rien. Les données viennent de la demande en base (déchiffrées ici), jamais
 * du navigateur — sinon n'importe qui ferait partir notre accusé vers
 * n'importe quelle adresse.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { ENTITE_MESSAGE, GABARITS_ACCUSE_MESSAGE } from "@/lib/contact/accuse-attendu";
import { enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";

/** Clé de `Submission.details` qui porte le gabarit d'un accusé différé. */
export const CLE_ACCUSE_DIFFERE = "accuseDiffere";

export interface DonneesAccuseContact {
  readonly nom: string;
  readonly submissionId: string;
  readonly companyName?: string | null | undefined;
  readonly type: string;
  readonly subType?: string | null | undefined;
  readonly size?: string | null | undefined;
  readonly industry?: string | null | undefined;
  readonly piecesJointesRecues?: number | undefined;
}

/** La charge utile de l'accusé — UNE forme, pour l'envoi immédiat et le différé. */
export function payloadAccuseContact(d: DonneesAccuseContact): Record<string, unknown> {
  return {
    contactName: d.nom,
    submissionId: d.submissionId,
    // `quote-request-received` s'en sert dans sa phrase d'accroche. Sans
    // lui, le gabarit affichait « votre demande de devis pour undefined ».
    ...(d.companyName ? { companyName: d.companyName } : {}),
    type: d.type,
    subType: d.subType ?? undefined,
    // Champs hérités utilisés par les templates existants (audit-confirmed,
    // implementation-confirmed, contact-confirmed) — non bloquant si absent.
    size: d.size ?? undefined,
    industry: d.industry ?? undefined,
    auditType: d.subType ?? undefined,
    // « N pièce(s) jointe(s) bien reçue(s) » dans l'accusé (2026-10-15).
    ...(d.piecesJointesRecues && d.piecesJointesRecues > 0
      ? { piecesJointesRecues: d.piecesJointesRecues }
      : {}),
  };
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Envoie l'accusé différé d'une demande, avec le nombre de pièces REÇUES.
 * Rend `false` (et n'envoie rien) si la demande n'attendait pas d'accusé
 * différé, est à la corbeille, ou n'a plus d'adresse lisible.
 */
export async function envoyerAccuseDiffere(submissionId: string): Promise<boolean> {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      contactName: true,
      contactEmail: true,
      locale: true,
      companyName: true,
      sector: true,
      employeesCount: true,
      details: true,
      deletedAt: true,
    },
  });
  if (!sub || sub.deletedAt) return false;
  const details =
    sub.details && typeof sub.details === "object" && !Array.isArray(sub.details)
      ? (sub.details as Record<string, unknown>)
      : {};
  const gabarit = texte(details[CLE_ACCUSE_DIFFERE]);
  if (!gabarit || !(GABARITS_ACCUSE_MESSAGE as readonly string[]).includes(gabarit)) return false;

  const email = decryptPii(sub.contactEmail);
  if (!isDecryptedEmailUsable(email)) return false;

  const recues = await prisma.submissionAttachment.count({
    where: { submissionId, statut: { in: ["recue", "quarantaine"] } },
  });
  const type = texte(details["unifiedType"]) ?? "autre";
  const res = await enqueueEmail(
    gabarit as EmailJobName,
    email,
    sub.locale === "en" ? "en" : "fr",
    payloadAccuseContact({
      nom: decryptPii(sub.contactName) ?? "",
      submissionId,
      companyName: sub.companyName && sub.companyName !== "—" ? sub.companyName : null,
      type,
      subType: texte(details["subType"]),
      size: sub.employeesCount,
      industry: sub.sector,
      piecesJointesRecues: recues,
    }),
    {
      entityType: ENTITE_MESSAGE,
      entityId: submissionId,
      // Idempotence : la fin d'envoi ET le nettoyage peuvent l'appeler.
      jobId: `accuse-contact-${submissionId}`,
    },
  );
  return res.enqueued;
}
