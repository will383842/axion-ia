/**
 * Lectures de la page « Enregistreur » (PR 5). Aucune donnée de rendez-vous :
 * les appareils, le drapeau, le témoin de clé.
 */

import { prisma } from "@/lib/prisma";
import { BATTEMENT_TEMOIN, lireTemoinCle, type EtatTemoin } from "@/server/visio/temoin-cle";
import { lireDrapeauEnregistrement, type LectureDrapeau } from "@/server/visio/drapeau";
import { joursAvantExpiration, seuilAlerteJeton } from "@/server/visio/jeton";
import { SILENCE_APPAREIL_MS } from "@/server/visio/battement-appareil";

export interface AppareilAffiche {
  readonly id: string;
  readonly nom: string;
  readonly creeLe: Date;
  readonly expireLe: Date;
  readonly joursRestants: number;
  /** 14 ou 3 si un seuil d'alerte est franchi, sinon `null`. */
  readonly seuil: 14 | 3 | null;
  readonly revoqueLe: Date | null;
  readonly dernierBattementLe: Date | null;
  readonly silencieux: boolean;
  readonly versionExtension: string | null;
}

export interface EtatEnregistreur {
  readonly drapeau: LectureDrapeau;
  readonly temoinSite: EtatTemoin | "absent";
  readonly temoinWorkerOkLe: Date | null;
  readonly drapeauVuParWorker: string | null;
  readonly appareils: ReadonlyArray<AppareilAffiche>;
}

export async function lireEtatEnregistreur(
  maintenant: Date = new Date(),
): Promise<EtatEnregistreur> {
  const [temoinSite, battement, appareils] = await Promise.all([
    lireTemoinCle(prisma),
    prisma.battementCircuit.findUnique({ where: { nom: BATTEMENT_TEMOIN } }),
    prisma.appareilEnregistrement.findMany({
      orderBy: { creeLe: "desc" },
      take: 20,
      select: {
        id: true,
        nom: true,
        creeLe: true,
        expireLe: true,
        revoqueLe: true,
        dernierBattementLe: true,
        versionExtension: true,
      },
    }),
  ]);
  return {
    drapeau: lireDrapeauEnregistrement(process.env, maintenant),
    temoinSite,
    temoinWorkerOkLe: battement?.temoinCleOkLe ?? null,
    drapeauVuParWorker: battement?.drapeauVuParWorker ?? null,
    appareils: appareils.map((a) => ({
      ...a,
      joursRestants: joursAvantExpiration(a.expireLe, maintenant),
      seuil: seuilAlerteJeton(a, maintenant),
      silencieux:
        a.revoqueLe === null &&
        (a.dernierBattementLe === null ||
          maintenant.getTime() - a.dernierBattementLe.getTime() > SILENCE_APPAREIL_MS),
    })),
  };
}
