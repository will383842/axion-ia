/**
 * Envoi du CODE DE SIGNATURE (F17) — lot S6b, fin du socle de signature.
 *
 * Le mécanisme (émission, vérification, 10 minutes, 5 essais) est celui de S6a
 * (`documents/signature/code-signature.ts`) ; ce module le remet au formateur par e-mail,
 * par l'adaptateur d'envoi des formateurs : texte validé exigé, jamais garé en corbeille
 * (un code qui attend une relecture expire), aucune priorité (il passe avant les relances).
 *
 * 🔴 L'APPELANT NE DONNE QUE LA PIÈCE. Le destinataire n'est jamais reçu : il est relu sur
 * la fiche du formateur rattachée à la pièce (contrat-cadre d'un indépendant, sans
 * organisme). L'appelant public (page de signature) doit avoir vérifié son jeton (non
 * expiré, non révoqué, partie non encore signataire) AVANT d'appeler ce module.
 *
 * Règles :
 *   · rien n'est émis si le texte F17 n'est pas validé ;
 *   · « Code non reçu ? Renvoyer » : pas avant 2 minutes après le précédent, 3 codes par
 *     heure au plus pour la pièce, 5 par heure au plus pour un même formateur ;
 *   · deux demandes simultanées : seule celle dont le code est resté VIVANT l'envoie ;
 *   · le code en clair ne va QUE dans l'e-mail (la copie conservée le masque).
 */

import { prisma } from "@/lib/prisma";
import {
  CODE_VALIDITE_MS,
  emettreCodeSignature,
} from "@/server/qualiopi/documents/signature/code-signature";

import { envoyer, texteValide } from "./envois";

export const DELAI_RENVOI_MS = 2 * 60 * 1000;
export const CODES_PAR_HEURE_MAX = 3;
export const CODES_PAR_HEURE_PAR_FORMATEUR_MAX = 5;

type Raison =
  "texte-non-valide" | "piece-hors-circuit" | "trop-tot" | "trop-de-codes" | "envoi-impossible";

export type ResultatCodeSignature =
  { readonly ok: true } | { readonly ok: false; readonly raison: Raison; readonly message: string };

const MESSAGES: Readonly<Record<Raison, string>> = {
  "texte-non-valide": "L'envoi du code n'est pas encore ouvert. Réessayez plus tard.",
  "piece-hors-circuit": "Cette pièce ne se signe pas avec un code.",
  "trop-tot":
    "Un code vient de vous être envoyé. Patientez deux minutes avant d'en demander un autre.",
  "trop-de-codes":
    "Plusieurs codes ont déjà été demandés en une heure. Réessayez un peu plus tard.",
  "envoi-impossible": "Le code n'a pas pu vous être envoyé. Réessayez dans un instant.",
};

const refus = (raison: Raison): ResultatCodeSignature => ({
  ok: false,
  raison,
  message: MESSAGES[raison],
});

/** « 10 minutes » : la durée réelle du code, jamais une durée écrite à la main. */
export function libelleDuree(ms: number = CODE_VALIDITE_MS): string {
  const minutes = Math.round(ms / 60_000);
  return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

export async function envoyerCodeSignature(input: {
  readonly documentGenereId: string;
  readonly maintenant: Date;
}): Promise<ResultatCodeSignature> {
  const partie = "sous_traitant" as const;
  if (!(await texteValide("formateur-code-signature"))) return refus("texte-non-valide");

  // La pièce, relue : un contrat-cadre d'indépendant, sans organisme, avec sa fiche.
  const piece = await prisma.documentGenere.findUnique({
    where: { id: input.documentGenereId },
    select: { type: true, sousTraitantId: true, trainerId: true },
  });
  if (
    piece === null ||
    piece.type !== "contrat_sous_traitance" ||
    piece.sousTraitantId !== null ||
    piece.trainerId === null
  ) {
    return refus("piece-hors-circuit");
  }
  const trainerId = piece.trainerId;
  const formateur = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { statut: true, prenom: true, email: true },
  });
  const destinataire = formateur?.email?.trim() ?? "";
  if (!formateur || formateur.statut !== "sous_traitant" || destinataire === "") {
    return refus("piece-hors-circuit");
  }

  const depuisUneHeure = new Date(input.maintenant.getTime() - 60 * 60 * 1000);
  const recents = await prisma.documentSignatureCode.findMany({
    where: { documentGenereId: input.documentGenereId, partie, createdAt: { gt: depuisUneHeure } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const dernier = recents[0]?.createdAt;
  if (dernier && input.maintenant.getTime() - dernier.getTime() < DELAI_RENVOI_MS) {
    return refus("trop-tot");
  }
  if (recents.length >= CODES_PAR_HEURE_MAX) return refus("trop-de-codes");

  // Plafond par FORMATEUR, toutes pièces confondues : une boîte n'est jamais inondée.
  const piecesDuFormateur = await prisma.documentGenere.findMany({
    where: { trainerId },
    select: { id: true },
  });
  const parFormateur = await prisma.documentSignatureCode.count({
    where: {
      documentGenereId: { in: piecesDuFormateur.map((p) => p.id) },
      createdAt: { gt: depuisUneHeure },
    },
  });
  if (parFormateur >= CODES_PAR_HEURE_PAR_FORMATEUR_MAX) return refus("trop-de-codes");

  let emis: { code: string; expiresAt: Date };
  try {
    emis = await emettreCodeSignature({
      documentGenereId: input.documentGenereId,
      partie,
      maintenant: input.maintenant,
    });
  } catch {
    return refus("envoi-impossible");
  }

  // Deux demandes simultanées passent toutes deux les contrôles ci-dessus : chaque
  // émission invalide la précédente, donc seule la demande dont le code est resté VIVANT
  // l'envoie — un seul e-mail, avec le seul code valable.
  const vivant = await prisma.documentSignatureCode.findFirst({
    where: { documentGenereId: input.documentGenereId, partie, utiliseAt: null, invalideAt: null },
    orderBy: { createdAt: "desc" },
    select: { expiresAt: true },
  });
  if (!vivant || vivant.expiresAt.getTime() !== emis.expiresAt.getTime()) {
    return refus("trop-tot");
  }

  const r = await envoyer({
    gabarit: "formateur-code-signature",
    destinataire,
    entityType: "Trainer",
    entityId: trainerId,
    // Aucune clé d'idempotence : chaque demande émet un code NEUF. Aucune priorité.
    // Jamais en corbeille : un code qui attend une relecture expire avant d'arriver.
    sansValidation: true,
    payload: {
      ...(formateur.prenom ? { prenom: formateur.prenom } : {}),
      valeurs: { code: emis.code, durée: libelleDuree() },
    },
  });
  return r === "envoye" ? { ok: true } : refus("envoi-impossible");
}
