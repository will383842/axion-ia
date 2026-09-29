// Fiche apporteur — les réponses REÇUES par e-mail, pour l'affichage (2026-09-27).
//
// Le relevé (`reponses-entrantes-apporteur.ts`) les enregistre ; ce module les
// relit pour le bloc « Réponses reçues par e-mail » de la fiche. Lues par
// PERSONNE (empreinte d'adresse) : la réponse est rattachée à la fiche
// invitée, qui n'est pas forcément celle qu'on ouvre.

import { prisma } from "@/lib/prisma";
import { decryptPii, PII_DECRYPT_PLACEHOLDER } from "@/lib/pii-crypto";
import { lienZoho } from "@/lib/commercial-application/reponse-entrante";

export interface ReponseRecue {
  readonly id: string;
  readonly recueLe: Date;
  readonly objet: string;
  /** Extrait déchiffré ; `null` s'il n'y en a pas ou s'il est illisible. */
  readonly extrait: string | null;
  readonly automatique: boolean;
  readonly lienZoho: string;
}

/** Au plus vingt, de la plus récente à la plus ancienne. Lève si la base ne répond pas. */
export async function lireReponsesRecues(submissionId: string): Promise<ReponseRecue[]> {
  const ligne = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { contactEmailHash: true },
  });
  const empreinte = ligne?.contactEmailHash ?? null;
  const lignes = await prisma.submissionInboundReply.findMany({
    where: empreinte ? { OR: [{ submissionId }, { fromEmailHash: empreinte }] } : { submissionId },
    orderBy: { receivedAt: "desc" },
    take: 20,
    select: {
      id: true,
      receivedAt: true,
      subject: true,
      excerpt: true,
      auto: true,
      zohoMessageId: true,
    },
  });
  const dc = process.env["ZOHO_MAIL_DC"]?.trim().toLowerCase() || "eu";
  return lignes.map((l) => {
    let extrait: string | null = null;
    try {
      extrait = l.excerpt ? decryptPii(l.excerpt) : null;
      if (extrait === PII_DECRYPT_PLACEHOLDER) extrait = null;
    } catch {
      extrait = null;
    }
    return {
      id: l.id,
      recueLe: l.receivedAt,
      objet: l.subject,
      extrait,
      automatique: l.auto,
      lienZoho: lienZoho(dc, l.zohoMessageId),
    };
  });
}
