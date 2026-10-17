/**
 * 🔴 CHANTIER QNC, LOT L13 — NOTE en ajout seul sur une pièce générée.
 *
 * Le cas : un dossier de session clos porte des pièces qu'on ne doit plus
 * toucher (ADR 0060), mais dont l'auditeur doit connaître le sort — pièces
 * vierges (n° 034, 040, 041, 042), pièces établies hors délai, pièces
 * rectificatives du 16/10, pièce à ne pas envoyer. La note s'écrit À CÔTÉ de
 * la pièce : `documents_generes` n'est jamais lue pour être modifiée ici.
 *
 * - date posée par le serveur (`activity_logs.created_at`), affichée à
 *   l'heure de Paris ; aucune date ne vient du navigateur ;
 * - auteur réel : l'identifiant de la session ET le nom lu en base au moment
 *   de la note (figé dans la ligne) — jamais un nom saisi ;
 * - sans trace, pas de note (`exiger`) : la note EST la trace ;
 * - classée « ouverte » au registre du verrou : elle reste possible sur un
 *   dossier clos, puisqu'elle ne le modifie pas.
 *
 * Interrupteur `qualiopi.documents_organisme.actif` : `essai` → seulement les
 * pièces d'une session du banc d'essai ; `actif` → toutes ; éteint → refus.
 */

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { donneesJournalQualiopi, requireAdminWrite } from "./_guards";
import { estActifPour } from "@/server/qualiopi/socle/interrupteurs";
import { etatDocumentsOrganisme } from "@/server/qualiopi/documents-organisme/documents-organisme";
import {
  ACTION_NOTE_PIECE,
  validerNote,
} from "@/server/qualiopi/documents-organisme/documents-organisme-pur";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultatNotePiece =
  { ok: true; note: { id: string; le: string; auteurNom: string } } | { ok: false; error: string };

export async function ajouterNotePieceAction(raw: {
  documentId: string;
  mention: string;
  texte: string;
}): Promise<ResultatNotePiece> {
  const session = await requireAdminWrite();

  if (typeof raw?.documentId !== "string" || !UUID.test(raw.documentId)) {
    return { ok: false, error: "Pièce invalide." };
  }
  const valide = validerNote({ mention: raw.mention, texte: raw.texte });
  if (!valide.ok) return valide;

  const piece = await prisma.documentGenere.findUnique({
    where: { id: raw.documentId },
    select: {
      id: true,
      numero: true,
      sessionId: true,
      session: { select: { estTestInterne: true } },
    },
  });
  if (!piece) return { ok: false, error: "Pièce introuvable." };

  const etat = await etatDocumentsOrganisme();
  if (!estActifPour(etat, piece.session)) {
    return { ok: false, error: "Les notes sur pièce ne sont pas ouvertes pour ce dossier." };
  }

  const auteur = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });
  if (!auteur?.name?.trim()) {
    return { ok: false, error: "Auteur introuvable : la note n'a pas été enregistrée." };
  }

  const data = await donneesJournalQualiopi({
    action: ACTION_NOTE_PIECE,
    targetType: "DocumentGenere",
    targetId: piece.id,
    changes: {
      mention: valide.mention,
      texte: valide.texte,
      auteurNom: auteur.name.trim(),
      documentNumero: piece.numero,
      sessionId: piece.sessionId,
    },
    session,
  });
  // Écriture directe, NON tolérante : une note qui n'est pas écrite n'existe pas.
  const ligne = await prisma.activityLog.create({ data, select: { id: true, createdAt: true } });

  if (piece.sessionId) {
    revalidatePath(adminPath("fr", `qualiopi/sessions/${piece.sessionId}`));
  }
  return {
    ok: true,
    note: { id: ligne.id, le: ligne.createdAt.toISOString(), auteurNom: auteur.name.trim() },
  };
}
