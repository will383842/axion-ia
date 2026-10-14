// Banc @formateurs, équipe ARGENT — ce que tous les scénarios d'argent partagent.

import { expect } from "@playwright/test";

import { prisma } from "./base";
import { jouerUne } from "./argent-execution";
import { semerInterrupteurs, type ValeurInterrupteur } from "./interrupteurs";
import { lireJournalEnvois } from "./journal-envois";
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

/** Attend que le journal des envois porte `n` lignes de ce gabarit pour cette adresse. */
export async function attendreEnvois(destinataire: string, gabarit: string, n: number) {
  await expect
    .poll(async () => (await lireJournalEnvois({ destinataire, gabarit })).length, ATTENTE)
    .toBe(n);
  return lireJournalEnvois({ destinataire, gabarit });
}

/**
 * Recale la date d'une ligne du journal des envois sur l'HORLOGE PILOTÉE.
 *
 * `enqueueEmail` date sa ligne à l'heure réelle (il ne reçoit pas d'instant), et
 * certaines gardes relisent cette date pour espacer les envois (F34 : 23 h). Le banc
 * joue des journées en 2037 : sans recalage, l'écart serait de onze ans et la garde
 * ne serait pas éprouvée. Seule la colonne `created_at` de la ligne nommée est
 * touchée, et seulement pour la placer à l'instant où le passage l'a écrite.
 */
export async function recalerJournal(jobId: string, instant: Date): Promise<void> {
  const { count } = await prisma.emailLog.updateMany({
    where: { jobId },
    data: { createdAt: instant },
  });
  if (count !== 1) throw new Error(`recalage : ${count} ligne(s) pour ${jobId}`);
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
