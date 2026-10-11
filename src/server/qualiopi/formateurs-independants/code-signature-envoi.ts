/**
 * Envoi du CODE DE SIGNATURE (F17) — lot S6b, fin du socle de signature.
 *
 * Le mécanisme (émission, vérification, 10 minutes, 5 essais) est celui de S6a
 * (`documents/signature/code-signature.ts`) ; ce module le remet au formateur par e-mail,
 * par l'adaptateur d'envoi des formateurs (texte validé exigé, aucune priorité : un code
 * part avant les relances).
 *
 * Règles :
 *   · rien n'est émis si le texte F17 n'est pas validé (un code émis mais jamais reçu
 *     ne servirait à rien) ;
 *   · « Code non reçu ? Renvoyer » : pas avant 2 minutes après le précédent, et 3 codes
 *     par heure au plus pour une même pièce et une même partie ;
 *   · le code en clair ne va QUE dans l'e-mail : jamais journalisé, jamais rendu.
 */

import { prisma } from "@/lib/prisma";
import type { PartieSignataire } from "@/server/qualiopi/documents/signature/document-signature-hash";
import {
  CODE_VALIDITE_MS,
  emettreCodeSignature,
} from "@/server/qualiopi/documents/signature/code-signature";

import { envoyer, texteValide } from "./envois";

export const DELAI_RENVOI_MS = 2 * 60 * 1000;
export const CODES_PAR_HEURE_MAX = 3;

export type ResultatCodeSignature =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly raison: "texte-non-valide" | "trop-tot" | "trop-de-codes" | "envoi-impossible";
      readonly message: string;
    };

const MESSAGES = {
  "texte-non-valide": "L'envoi du code n'est pas encore ouvert. Réessayez plus tard.",
  "trop-tot":
    "Un code vient de vous être envoyé. Patientez deux minutes avant d'en demander un autre.",
  "trop-de-codes": "Vous avez demandé trois codes en une heure. Réessayez un peu plus tard.",
  "envoi-impossible": "Le code n'a pas pu vous être envoyé. Réessayez dans un instant.",
} as const;

const refus = (raison: keyof typeof MESSAGES): ResultatCodeSignature => ({
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
  readonly partie: PartieSignataire;
  readonly trainerId: string;
  readonly destinataire: string;
  readonly prenom?: string | null;
  readonly maintenant: Date;
}): Promise<ResultatCodeSignature> {
  if (!(await texteValide("formateur-code-signature"))) return refus("texte-non-valide");

  const depuisUneHeure = new Date(input.maintenant.getTime() - 60 * 60 * 1000);
  const recents = await prisma.documentSignatureCode.findMany({
    where: {
      documentGenereId: input.documentGenereId,
      partie: input.partie,
      createdAt: { gt: depuisUneHeure },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const dernier = recents[0]?.createdAt;
  if (dernier && input.maintenant.getTime() - dernier.getTime() < DELAI_RENVOI_MS) {
    return refus("trop-tot");
  }
  if (recents.length >= CODES_PAR_HEURE_MAX) return refus("trop-de-codes");

  let code: string;
  try {
    ({ code } = await emettreCodeSignature({
      documentGenereId: input.documentGenereId,
      partie: input.partie,
      maintenant: input.maintenant,
    }));
  } catch {
    return refus("envoi-impossible");
  }

  const r = await envoyer({
    gabarit: "formateur-code-signature",
    destinataire: input.destinataire,
    entityType: "Trainer",
    entityId: input.trainerId,
    // Aucune clé d'idempotence : chaque demande émet un code NEUF (le précédent est
    // invalidé), et c'est lui qui doit partir. Aucune priorité : passe avant les relances.
    payload: {
      ...(input.prenom ? { prenom: input.prenom } : {}),
      valeurs: { code, durée: libelleDuree() },
    },
  });
  return r === "envoye" || r === "en-validation" ? { ok: true } : refus("envoi-impossible");
}
