import "server-only";

// Fiche candidat — les réponses REÇUES par e-mail, pour l'affichage (lot L3,
// 2026-10-07).
//
// Le relevé (`reponses-entrantes-candidature.ts`) les enregistre ; ce module
// les relit pour le bloc « Réponses reçues par e-mail » de la fiche. Lues par
// PERSONNE (empreinte d'adresse) dans le monde « emploi » SEULEMENT : une
// réponse rattachée à une autre candidature de la même personne se voit aussi
// ici ; une réponse rattachée à sa fiche apporteur (autre table) jamais.
//
// 🔴 Refuse par défaut : l'extrait porte les mots de la personne. Même prédicat
// que l'ouverture du dossier.

import { prisma } from "@/lib/prisma";
import { decryptPii, PII_DECRYPT_PLACEHOLDER } from "@/lib/pii-crypto";
import { lienZoho } from "@/lib/commercial-application/reponse-entrante";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";

export interface ReponseRecueCandidat {
  readonly id: string;
  readonly recueLe: Date;
  readonly objet: string;
  /** Extrait déchiffré ; `null` s'il n'y en a pas ou s'il est illisible. */
  readonly extrait: string | null;
  readonly automatique: boolean;
  readonly lienZoho: string;
}

/**
 * Au plus vingt, de la plus récente à la plus ancienne. Rend `[]` à un rôle
 * qui n'ouvre pas les dossiers. Lève si la base ne répond pas.
 */
export async function lireReponsesRecuesCandidat(
  applicationId: string,
  acteur: { role: string | null | undefined },
): Promise<ReponseRecueCandidat[]> {
  if (!peutOuvrirDossierCandidat(acteur.role)) return [];
  const dossier = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: { emailHash: true },
  });
  const empreinte = dossier?.emailHash ?? null;
  const lignes = await prisma.jobApplicationInboundReply.findMany({
    where: empreinte
      ? { OR: [{ applicationId }, { fromEmailHash: empreinte }] }
      : { applicationId },
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
