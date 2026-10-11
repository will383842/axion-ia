/**
 * Formateurs indépendants — LECTURE en console d'une pièce déposée par le
 * formateur (lot L5b, ADR 0066 ; W5 I-5 b, 09-SÉCURITÉ n° 8).
 *
 * La route `qualiopi/formateurs/[id]/pieces/[docId]` ne fait que l'appeler et
 * mettre les en-têtes. Ici, dans cet ordre :
 *   1. le droit `habiliter_formateur` (la pièce RIB : `remunerer_formateur`) ;
 *   2. l'interrupteur `formateurs.dossier_en_ligne` — éteint, la pièce n'existe
 *      pas (comportement d'aujourd'hui) ;
 *   3. la pièce appartient bien à la fiche de l'adresse (IDOR) ;
 *   4. déchiffrement, puis l'empreinte du clair doit être celle du dépôt ;
 *   5. la lecture est JOURNALISÉE avant de servir : journal en panne = rien servi.
 * Tout refus après le droit rend la même réponse neutre (404).
 */

import { createHash } from "node:crypto";

import { dechiffrerOctetsPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { peutEngager } from "@/server/auth/habilitations";
import { journaliser } from "@/server/journal/journaliser";

import { envoiAllume } from "./interrupteurs-envoi";

export const ACTION_LECTURE_PIECE = "qualiopi.trainer_document.lecture";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LecturePiece =
  | {
      readonly ok: true;
      readonly octets: Uint8Array;
      readonly mime: string;
      readonly nom: string;
    }
  | { readonly ok: false; readonly statut: 403 | 404 };

const INTROUVABLE = { ok: false, statut: 404 } as const;

export async function lirePieceDeposee(demande: {
  readonly trainerId: string;
  readonly documentId: string;
  readonly session: { readonly userId: string; readonly role: string | null | undefined };
}): Promise<LecturePiece> {
  const { trainerId, documentId, session } = demande;
  if (!peutEngager(session.role, "habiliter_formateur")) return { ok: false, statut: 403 };
  if (!UUID.test(trainerId) || !UUID.test(documentId)) return INTROUVABLE;
  if (!(await envoiAllume("dossier_en_ligne"))) return INTROUVABLE;

  const doc = await prisma.trainerDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      trainerId: true,
      type: true,
      contenu: { select: { octets: true, sha256: true, mime: true, nomOriginal: true } },
    },
  });
  if (doc === null || doc.trainerId !== trainerId || doc.contenu === null) return INTROUVABLE;
  // Le RIB porte l'IBAN entier : réservé au droit de rémunérer (décision 72, D4).
  if (doc.type === "rib" && !peutEngager(session.role, "remunerer_formateur")) return INTROUVABLE;

  let clair: Buffer;
  try {
    clair = dechiffrerOctetsPii(Buffer.from(doc.contenu.octets));
  } catch {
    return INTROUVABLE;
  }
  if (createHash("sha256").update(clair).digest("hex") !== doc.contenu.sha256) return INTROUVABLE;

  try {
    await journaliser(
      prisma,
      {
        action: ACTION_LECTURE_PIECE,
        targetType: "TrainerDocument",
        targetId: doc.id,
        changes: { type: doc.type },
        session: { userId: session.userId },
      },
      { exiger: true },
    );
  } catch {
    return INTROUVABLE;
  }

  return {
    ok: true,
    octets: new Uint8Array(clair),
    mime: doc.contenu.mime,
    nom: doc.contenu.nomOriginal ?? "piece",
  };
}
