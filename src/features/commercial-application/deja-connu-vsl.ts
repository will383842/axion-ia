// Ce que l'adresse a déjà chez nous, pour le tunnel apporteurs avec vidéo
// (2026-10-10 — sorti de `lead-vsl-actions.ts`, qui est un module « use server »).
//
// ── Une personne « DÉJÀ CONNUE » ───────────────────────────────────────────
// Elle a au moins une ligne apporteur vivante (hors corbeille) qui N'EST PAS un
// lead de la page vidéo : ancien formulaire, Indeed, saisie manuelle, dossier,
// fiche archivée. R3 : on ne crée rien, on ne rétrograde rien — mais depuis le
// 2026-10-10 on garde la trace de son retour sur la fiche la plus récente
// (`details.retoursVsl`, `lead-vsl-details.ts`).
//
// 🔒 Le jeton reste OPAQUE. Il désigne la fiche existante exactement comme il
// désigne un lead neuf (même forme, même contenu) : aucun drapeau « connu » n'y
// est écrit — il trahirait dès l'étape 1 qu'une adresse est connue. Le serveur
// le RE-DÉDUIT, à chaque usage, de ce que la base dit de la personne
// (`ligneDejaConnue`). Seul un jeton de SAISIE (étape 1) peut mener au parcours
// « déjà connu » : un lien de reprise d'e-mail n'existe que pour un lead vidéo.
//
// Aucun `server-only` : appelé par les actions, la page merci, le formulaire de
// réservation, et par les tests.

import { prisma } from "@/lib/prisma";
import { SubmissionType } from "../../../prisma/generated/client";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "@/lib/commercial-application/model";
import { lireVsl } from "./lead-vsl-details";
import type { ContenuJeton } from "./jeton-lead";

export interface LigneApporteur {
  id: string;
  details: unknown;
}

/** Les lignes apporteur VIVANTES (hors corbeille) d'une même personne, par empreinte, plus récente d'abord. */
export async function lignesDeLaPersonne(emailKey: string): Promise<LigneApporteur[]> {
  return prisma.submission.findMany({
    where: {
      contactEmailHash: emailKey,
      type: SubmissionType.contact,
      deletedAt: null,
      AND: [{ details: { path: ["subType"], equals: CANDIDATURE_COMMERCIALE_SUBTYPE } }],
    },
    select: { id: true, details: true },
    orderBy: { submittedAt: "desc" },
    take: 20,
  });
}

/** Ce que l'adresse a déjà chez nous : rien, un lead vidéo, ou autre chose (ancien parcours, dossier). */
export type Existant =
  | { genre: "aucun" }
  | { genre: "autre"; id: string }
  | { genre: "lead-vsl"; id: string; suspect: boolean };

export function qualifier(lignes: readonly LigneApporteur[]): Existant {
  if (lignes.length === 0) return { genre: "aucun" };
  const l = lignes[0] as LigneApporteur;
  // R3 : une ligne qui n'est pas un lead vidéo (ancien formulaire, dossier
  // commencé ou complet, saisie manuelle) PRIME — on ne rétrograde jamais. Le
  // retour se trace sur la ligne la PLUS RÉCENTE de la personne.
  if (lignes.some((x) => !lireVsl(x.details))) return { genre: "autre", id: l.id };
  return { genre: "lead-vsl", id: l.id, suspect: lireVsl(l.details)?.suspect === true };
}

/**
 * La fiche désignée par un jeton de SAISIE, si la personne est « déjà connue » ;
 * `null` sinon (lead vidéo ordinaire, jeton de reprise, ligne effacée, base
 * muette). Ne lève jamais.
 */
export async function ligneDejaConnue(
  jeton: Pick<ContenuJeton, "lead" | "genre">,
): Promise<{ id: string } | null> {
  if (jeton.genre !== "saisie") return null;
  try {
    const ligne = await prisma.submission.findFirst({
      where: { id: jeton.lead, deletedAt: null },
      select: { id: true, contactEmailHash: true },
    });
    if (!ligne?.contactEmailHash) return null;
    const existant = qualifier(await lignesDeLaPersonne(ligne.contactEmailHash));
    return existant.genre === "autre" ? { id: ligne.id } : null;
  } catch {
    return null;
  }
}
