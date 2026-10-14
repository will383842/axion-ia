// Banc @formateurs, équipe ARGENT — ce que tous les scénarios d'argent partagent.

import { expect } from "@playwright/test";

import { prisma } from "./base";
import { jouerUne } from "./argent-execution";
import { semerInterrupteurs, type ValeurInterrupteur } from "./interrupteurs";
import { jobEnFile } from "./argent-puits";
import { URL_PUITS } from "./puits-smtp";

/** Le worker tourne à part : on lui laisse le temps de prendre le job. */
export const ATTENTE = { timeout: 60_000, intervals: [500, 1_000, 2_000] };

/** Hors du job du banc (ni file ni puits) : rien à mesurer. Dans le job : faute de câblage. */
export const HORS_BANC = !URL_PUITS && process.env["BANC_FORMATEURS"] !== "1";

/** Bascule commune aux scénarios 2037 (un 1er du mois). */
export const BASCULE_2037 = "2037-10-01";

/** L'interrupteur de la date de bascule, au format de `interrupteurs.ts`. */
export function bascule(date: string | null): Record<string, ValeurInterrupteur> {
  return { "formateurs.passage_paiement": { date } };
}

/**
 * `formateurs.textes_valides` allumé et chaque texte nommé validé comme après « Valider »
 * sur l'écran des textes : `textes_valides.<gabarit>[#variante]` = `{ valide, empreinte }`,
 * l'empreinte étant celle du texte ACTUEL (sans elle, le texte est « à revalider » et
 * l'envoi refuse). Rend la remise à l'état d'avant.
 */
export async function semerTextesValides(
  cles: readonly string[],
  autres: Record<string, ValeurInterrupteur> = {},
): Promise<() => Promise<void>> {
  const empreintes = await jouerUne<Record<string, string | null>>({
    etape: "empreintes-textes",
    cles,
  });
  const lignes: Record<string, ValeurInterrupteur> = {
    "formateurs.textes_valides": { actif: true },
    ...autres,
  };
  for (const c of cles) {
    const e = empreintes[c];
    if (!e) throw new Error(`texte « ${c} » : aucune empreinte attendue (écran des textes)`);
    lignes[`textes_valides.${c}`] = { valide: true, empreinte: e };
  }
  return semerInterrupteurs(lignes);
}

/**
 * Les ENVOIS d'un gabarit pour une adresse : une entrée par `jobId` distinct (la plus
 * ancienne ligne). Défaut V1-C-11 : un même envoi peut laisser DEUX lignes au journal
 * (une « sent » écrite par le worker, une « pending » écrite par l'enfilage) ; compter
 * des lignes ferait dépendre le constat de cette course.
 */
export async function envoisDistincts(filtre: { destinataire: string; gabarit?: string }) {
  const lignes = await prisma.emailLog.findMany({
    where: {
      recipient: filtre.destinataire,
      ...(filtre.gabarit ? { template: filtre.gabarit } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, jobId: true, template: true, status: true, createdAt: true },
  });
  const vus = new Set<string>();
  return lignes.filter((l) => {
    const cle = l.jobId ?? l.id;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

/** Attend que `n` envois distincts de ce gabarit soient enfilés pour cette adresse. */
export async function attendreEnvois(destinataire: string, gabarit: string, n: number) {
  await expect
    .poll(async () => (await envoisDistincts({ destinataire, gabarit })).length, ATTENTE)
    .toBe(n);
  return envoisDistincts({ destinataire, gabarit });
}

/**
 * Recale la date d'une ligne du journal des envois sur l'HORLOGE PILOTÉE.
 *
 * `enqueueEmail` date sa ligne à l'heure réelle (il ne reçoit pas d'instant), et
 * certaines gardes relisent cette date pour espacer les envois (F34 : 23 h). Le banc
 * joue des journées en 2037 : sans recalage, l'écart serait de onze ans et la garde
 * ne serait pas éprouvée. Seule la colonne `created_at` des lignes de cet envoi est
 * touchée, et seulement pour la placer à l'instant où le passage l'a écrit.
 */
export async function recalerJournal(jobId: string, instant: Date): Promise<void> {
  const { count } = await prisma.emailLog.updateMany({
    where: { jobId },
    data: { createdAt: instant },
  });
  // Toutes les lignes du même envoi (V1-C-11 : il peut y en avoir deux).
  if (count < 1) throw new Error(`recalage : aucune ligne pour ${jobId}`);
}

/**
 * Le dernier e-mail de ce gabarit enfilé pour cette adresse : son job en file (valeurs
 * réelles) et son RENDU (le texte que le worker enverrait). Voir `jobEnFile` : on ne
 * dépend pas du bridage du worker.
 */
export async function dernierEnvoiRendu(destinataire: string, gabarit: string) {
  const ligne = await prisma.emailLog.findFirstOrThrow({
    where: { recipient: destinataire, template: gabarit },
    orderBy: { createdAt: "desc" },
    select: { jobId: true },
  });
  const job = await jobEnFile(ligne.jobId!);
  if (job === null) throw new Error(`job ${ligne.jobId} introuvable en file`);
  const rendu = await jouerUne<{ sujet: string; texte: string }>({
    etape: "apercu",
    gabarit,
    destinataire,
    payload: job.payload,
  });
  return { job, ...rendu };
}
