/**
 * Télécharger un document de projet depuis la console (ADR 0063, D7 et D8).
 *
 * 🔑 L'UN DES DEUX SEULS LECTEURS DES OCTETS (`documentProjetContenu`), avec
 * `page-publique.ts` — garde
 * `tests/unit/ci/les-octets-d-un-document-ne-sortent-que-par-le-telechargement.spec.ts`.
 *
 *   1. métadonnées par le TRIPLET (id, projetId, clientId) : hors triplet, ou un
 *      lien (qui s'ouvre, ne se télécharge pas) → « introuvable » ;
 *   2. infecté → jamais servi ;
 *   3. `non_analyse` → nouvelle analyse sur les octets : `sain` → verdict écrit
 *      puis servi ; `infecte` → verdict écrit, ARCHIVÉ, jamais servi ;
 *      `indisponible` → refus, réessayer ;
 *   4. servi → journal `document_telecharge` (identifiants seulement).
 *
 * Les en-têtes ne dépendent JAMAIS du format : pièce jointe, type neutre.
 *
 * ⚠️ Module NEUTRE : il reçoit son client Prisma et son antivirus.
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import type { VerdictAntivirus } from "@/server/careers/clamav";
import { dispositionPieceJointe } from "./formats";
import type { Triplet } from "./archiver";

export type IssueTelechargement =
  | { readonly issue: "servi"; readonly nom: string; readonly octets: Uint8Array }
  | { readonly issue: "introuvable" }
  | { readonly issue: "infecte" }
  | { readonly issue: "antivirus_indisponible" };

type Db = Pick<PrismaClient, "documentProjet" | "documentProjetContenu" | "projetEvenement">;

/** Les en-têtes du téléchargement (§6.1), identiques pour les onze formats. */
export function entetesTelechargement(nom: string, taille: number): Record<string, string> {
  return {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": dispositionPieceJointe(nom),
    "Content-Length": String(taille),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex",
  };
}

export async function telechargerDocument(
  db: Db,
  t: Triplet,
  analyser: (octets: Uint8Array) => Promise<VerdictAntivirus>,
): Promise<IssueTelechargement> {
  const doc = await db.documentProjet.findFirst({
    where: { id: t.id, projetId: t.projetId, clientId: t.clientId },
    select: { id: true, fichierNom: true, analyseAntivirus: true, archiveLe: true },
  });
  if (doc === null || doc.fichierNom === null || doc.analyseAntivirus === null) {
    return { issue: "introuvable" };
  }
  if (doc.analyseAntivirus === "infecte") return { issue: "infecte" };

  const contenu = await db.documentProjetContenu.findUnique({
    where: { documentId: doc.id },
  });
  if (contenu === null) return { issue: "introuvable" };
  const octets = new Uint8Array(contenu.octets);

  if (doc.analyseAntivirus === "non_analyse") {
    const v = await analyser(octets);
    const maintenant = t.maintenant ?? new Date();
    if (v.issue === "indisponible") return { issue: "antivirus_indisponible" };
    if (v.issue === "infecte") {
      await db.documentProjet.updateMany({
        where: { id: doc.id, analyseAntivirus: "non_analyse" },
        data: {
          analyseAntivirus: "infecte",
          analyseLe: maintenant,
          analyseSignature: v.signature.slice(0, 200),
          // La machine archive, sans auteur (CHECK `archive_coherent`).
          ...(doc.archiveLe === null ? { archiveLe: maintenant, archiveParId: null } : {}),
        },
      });
      return { issue: "infecte" };
    }
    await db.documentProjet.updateMany({
      where: { id: doc.id, analyseAntivirus: "non_analyse" },
      data: { analyseAntivirus: "sain", analyseLe: maintenant },
    });
  }

  try {
    await db.projetEvenement.create({
      data: {
        projetId: t.projetId,
        action: "document_telecharge",
        documentId: doc.id,
        parAdminId: t.parAdminId,
      },
    });
  } catch (err) {
    // Un journal indisponible ne prive pas Will de sa pièce ; la panne se voit au journal serveur.
    console.error("[documents-projet] journal du téléchargement en échec :", err);
  }
  return { issue: "servi", nom: doc.fichierNom, octets };
}
