/**
 * Relevé mensuel des apporteurs : LECTURE cloisonnée de l'espace apporteur (lot 6).
 *
 * Seuls les relevés ENVOYÉS sont visibles : un relevé préparé, écarté ou en cours d'envoi n'a pas
 * été remis, l'apporteur ne le voit pas. Chaque requête porte `apporteurId` (jamais déduit de
 * l'adresse). Colonnes énumérées : ni contenu, ni empreinte, ni coordonnées. Table absente (P2021) :
 * liste vide, la page reste lisible. Sans `server-only` (testé en pur).
 */
import { prisma } from "@/lib/prisma";

/** `REL-AAAA-MM-NNNN` avec rectificatif `-Rk` éventuel : 40 caractères au plus. */
export const NUMERO_RELEVE = /^REL-\d{4}-(?:0[1-9]|1[0-2])-\d{4}(?:-R\d{1,2})?$/;
export const NUMERO_RELEVE_MAX = 40;

export interface ReleveDeLEspace {
  numero: string;
  periode: string;
  rang: number;
  envoyeAt: Date | null;
}

function tableAbsente(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "P2021";
}

export async function relevesDeLEspace(apporteurId: string): Promise<ReleveDeLEspace[]> {
  try {
    return await prisma.releveMensuelApporteur.findMany({
      where: { apporteurId, statut: "envoye", pdfR2Key: { not: null } },
      orderBy: [{ periode: "desc" }, { rang: "desc" }],
      take: 36,
      select: { numero: true, periode: true, rang: true, envoyeAt: true },
    });
  } catch (err) {
    if (tableAbsente(err)) return [];
    throw err;
  }
}

/** La clé R2 du PDF d'un relevé ENVOYÉ de CET apporteur, sinon `null` (autre apporteur, inconnu, non envoyé). */
export async function cleDuReleveDeLApporteur(
  apporteurId: string,
  numero: string,
): Promise<{ numero: string; r2Key: string } | null> {
  if (numero.length > NUMERO_RELEVE_MAX || !NUMERO_RELEVE.test(numero)) return null;
  try {
    const l = await prisma.releveMensuelApporteur.findFirst({
      where: { apporteurId, numero, statut: "envoye", pdfR2Key: { not: null } },
      select: { numero: true, pdfR2Key: true },
    });
    // Garde en profondeur : la clé stockée doit être sous le dossier de CET apporteur.
    if (!l?.pdfR2Key || !l.pdfR2Key.startsWith(`apporteurs/releves/${apporteurId}/`)) return null;
    return { numero: l.numero, r2Key: l.pdfR2Key };
  } catch (err) {
    if (tableAbsente(err)) return null;
    throw err;
  }
}
