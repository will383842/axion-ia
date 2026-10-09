// Réseau d'apporteurs — contrat 2.6 (décision de Will, 09/10/2026) : l'attribution porte sur
// l'ÉTABLISSEMENT déclaré (SIRET). L'apporteur n'est commissionné que sur les commandes de cet
// établissement ; Williams peut, à sa seule discrétion, étendre l'attribution à toute l'entreprise
// (SIREN), sur les établissements qui ne sont pas déjà attribués à un autre (art. 3.1).
//
// Stocké dans `presentation_etablissement`, tolérante à son absence (fenêtre app/worker). Une
// présentation SANS ligne est d'avant la 2.6 : elle couvre toute l'entreprise, comme avant.
//
// ⚠️ Atteint par le WORKER (passage horaire) : aucun `server-only`.

import { prisma } from "@/lib/prisma";
import { luhnValid } from "@/lib/siret";

export interface Etablissement {
  /** SIRET déclaré ; `null` = présentation d'avant la 2.6 (toute l'entreprise). */
  siret: string | null;
  /** Étendue à toute l'entreprise par Williams (art. 3.1). */
  entreprise: boolean;
}

export const AVANT_2_6: Etablissement = { siret: null, entreprise: false };

/** Le SIRET est-il valable (14 chiffres, clé de Luhn) ? Le SIREN est ses 9 premiers chiffres. */
export function siretValide(s: string): boolean {
  return /^\d{14}$/.test(s) && luhnValid(s);
}

/** La présentation couvre-t-elle tous les établissements de l'entreprise ? */
export function couvreToutLEntreprise(e: Etablissement): boolean {
  return e.siret === null || e.entreprise;
}

/**
 * Deux présentations du MÊME SIREN se disputent-elles le même périmètre ? Oui si l'une couvre
 * toute l'entreprise, ou si elles portent le même SIRET. Deux établissements différents : non.
 */
export function memePerimetre(a: Etablissement, b: Etablissement): boolean {
  return couvreToutLEntreprise(a) || couvreToutLEntreprise(b) || a.siret === b.siret;
}

export interface Candidate {
  recueAt: Date;
  etablissement: Etablissement;
}

/**
 * Parmi les présentations qui couvrent une commande à sa date (`couvrantes`, déjà filtrées), celle
 * à qui revient la commande de l'établissement `siretFacture` :
 *   · celle qui porte CE SIRET (la plus ancienne) — un établissement attribué reste à son apporteur
 *     même si un autre a reçu l'extension à toute l'entreprise (art. 3.1) ;
 *   · sinon celle qui couvre toute l'entreprise (étendue, ou d'avant la 2.6), la plus ancienne ;
 *   · facture SANS SIRET et seules des attributions d'établissement : « siret-manquant » — rien
 *     n'est créé, Williams complète le SIRET de la fiche client (décision de Will du 09/10).
 */
export function attributaireDeLaCommande<T extends Candidate>(
  couvrantes: readonly T[],
  siretFacture: string | null,
): { presentation: T } | { siretManquant: true } | null {
  const parAnciennete = [...couvrantes].sort((a, b) => a.recueAt.getTime() - b.recueAt.getTime());
  if (siretFacture) {
    const exacte = parAnciennete.find((p) => p.etablissement.siret === siretFacture);
    if (exacte) return { presentation: exacte };
  }
  const toute = parAnciennete.find((p) => couvreToutLEntreprise(p.etablissement));
  if (toute) return { presentation: toute };
  if (!siretFacture && parAnciennete.length > 0) return { siretManquant: true };
  return null;
}

function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

/** Les établissements des présentations ; une présentation absente de la table : `AVANT_2_6`. */
export async function lireEtablissements(
  ids: readonly string[],
): Promise<Map<string, Etablissement>> {
  const m = new Map<string, Etablissement>(ids.map((id) => [id, AVANT_2_6] as const));
  if (ids.length === 0) return m;
  try {
    const ls = await prisma.presentationEtablissement.findMany({
      where: { presentationId: { in: [...ids] } },
      select: { presentationId: true, siret: true, entreprise: true },
    });
    for (const l of ls) m.set(l.presentationId, { siret: l.siret, entreprise: l.entreprise });
  } catch (err) {
    if (!tableAbsente(err)) throw err;
  }
  return m;
}

/** Écrit le SIRET d'une présentation, DANS la transaction qui la crée (`db`). */
export async function enregistrerEtablissement(
  presentationId: string,
  siret: string,
  db: Pick<typeof prisma, "presentationEtablissement"> = prisma,
): Promise<void> {
  await db.presentationEtablissement.create({ data: { presentationId, siret } });
}

/**
 * Williams étend l'attribution à toute l'entreprise (art. 3.1, à sa seule discrétion). Les
 * établissements déjà attribués à d'autres restent les leurs (`attributaireDeLaCommande`).
 */
export async function etendreALEntreprise(
  presentationId: string,
  acteurId: string | null,
  maintenant: Date = new Date(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  const p = await prisma.presentationEntreprise.findUnique({
    where: { id: presentationId },
    select: { id: true, statut: true },
  });
  if (!p) return { ok: false, message: "Présentation introuvable." };
  if (p.statut !== "reservee" && p.statut !== "confirmee")
    return { ok: false, message: "Seule une attribution en cours peut être étendue." };
  const e = (await lireEtablissements([p.id])).get(p.id) ?? AVANT_2_6;
  if (couvreToutLEntreprise(e))
    return { ok: false, message: "Cette attribution couvre déjà toute l'entreprise." };
  const u = await prisma.presentationEtablissement.updateMany({
    where: { presentationId, entreprise: false },
    data: { entreprise: true, etendueAt: maintenant },
  });
  if (u.count !== 1) return { ok: false, message: "L'attribution a changé : rechargez la page." };
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteurId,
        action: "presentation_entreprise.etendue_a_l_entreprise",
        targetType: "presentation_entreprise",
        targetId: presentationId,
        changes: { siret: e.siret, motif: "Art. 3.1 : extension à toute l'entreprise" },
      },
    });
  } catch {
    // La trace ne fait jamais échouer le geste.
  }
  return { ok: true };
}
