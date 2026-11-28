/**
 * Relevé mensuel des apporteurs : REPRISE des envois interrompus (lot 4a, plan § 6.4).
 *
 *  - une ligne `envoi_en_cours` dont `prisAt` a plus de 10 minutes est examinée : si l'e-mail est
 *    déjà parti ou en file sous son `jobId` → `envoye` (envoyeAt = prisAt), sinon → `echec`
 *    « envoi interrompu » (renvoyable par un clic) ;
 *  - un lot sans `finAt` depuis plus de 15 minutes est MORT : marqué `abandonneAt`.
 * N'ENFILE RIEN : elle ne lit que le journal et la file. Sans `server-only` (le worker l'atteint).
 */
import { prisma } from "@/lib/prisma";
import { emailsQueue } from "@/server/queue/queues";

import { dejaEnvoye } from "../commissions";
import { signalerErreurReseau } from "../signaler";

export const DELAI_REPRISE_MS = 10 * 60_000;
export const DELAI_LOT_MORT_MS = 15 * 60_000;

export const jobIdReleveMensuel = (periode: string, rang: number, apporteurId: string): string =>
  `apporteur-releve-mensuel-${periode}-r${rang}-${apporteurId}`;

/** Le job est-il présent dans la file des e-mails (en attente, actif, terminé) et non échoué ? */
export async function fileContientJob(jobId: string): Promise<boolean> {
  try {
    const job = await emailsQueue?.getJob(jobId);
    return !!job && !(await job.isFailed());
  } catch {
    return false;
  }
}

export interface ResultatReprise {
  envoyes: number;
  echecs: number;
}

export async function reprendreEnvoisEnCours(
  maintenant: Date,
  fileA: (jobId: string) => Promise<boolean> = fileContientJob,
): Promise<ResultatReprise> {
  const limite = new Date(maintenant.getTime() - DELAI_REPRISE_MS);
  const lignes = await prisma.releveMensuelApporteur.findMany({
    where: { statut: "envoi_en_cours", prisAt: { lt: limite } },
    select: { id: true, periode: true, rang: true, apporteurId: true, prisAt: true },
    take: 500,
  });
  const r: ResultatReprise = { envoyes: 0, echecs: 0 };
  for (const l of lignes) {
    const jobId = jobIdReleveMensuel(l.periode, l.rang, l.apporteurId);
    try {
      const parti = (await dejaEnvoye(jobId)) || (await fileA(jobId));
      const { count } = await prisma.releveMensuelApporteur.updateMany({
        where: { id: l.id, statut: "envoi_en_cours" },
        data: parti
          ? { statut: "envoye", envoyeAt: l.prisAt ?? maintenant, emailJobId: jobId, erreur: null }
          : { statut: "echec", erreur: "envoi interrompu" },
      });
      if (count === 1) {
        if (parti) r.envoyes += 1;
        else r.echecs += 1;
      }
    } catch (err) {
      signalerErreurReseau("relevé mensuel : reprise", err);
    }
  }
  return r;
}

/** Marque `abandonneAt` les lots vivants depuis plus de 15 minutes (processus tué). */
export async function abandonnerLotsMorts(maintenant: Date): Promise<number> {
  const limite = new Date(maintenant.getTime() - DELAI_LOT_MORT_MS);
  const { count } = await prisma.lotReleveMensuel.updateMany({
    where: { finAt: null, abandonneAt: null, debutAt: { lt: limite } },
    data: { abandonneAt: maintenant },
  });
  return count;
}
