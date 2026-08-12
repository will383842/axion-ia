/**
 * Chargement des balises de tunnel pour la console.
 *
 * Séparé de l'agrégation (`aggregate.ts`, pure et testée) et du rendu : ce
 * fichier ne fait que borner la lecture base.
 */

import { prisma } from "@/lib/prisma";
import { agregerTunnels, type LigneTunnel, type SyntheseTunnels } from "./aggregate";

/** Fenêtres proposées dans l'entête de la page. */
export const FENETRES = [
  { jours: 7, libelle: "7 jours" },
  { jours: 30, libelle: "30 jours" },
  { jours: 90, libelle: "90 jours" },
] as const;

export const FENETRE_PAR_DEFAUT = 30;

/**
 * Plafond de lignes lues.
 *
 * 🔴 Un plafond atteint fausse TOUS les taux : les sessions tronquées perdent
 * leurs événements de fin, ce qui simule un effondrement de la conversion. La
 * synthèse porte donc `tronquee`, et la page le dit à l'écran — jamais de
 * troncature muette (le même piège que les exports plafonnés en silence).
 */
const PLAFOND_LIGNES = 100_000;

export type ChargementTunnels = {
  synthese: SyntheseTunnels;
  depuis: Date;
  jours: number;
  lignes: number;
  tronquee: boolean;
};

/** Normalise le paramètre de fenêtre reçu de l'URL. */
export function lireFenetre(brut: string | undefined): number {
  const n = Number(brut);
  const connue = FENETRES.find((f) => f.jours === n);
  return connue ? connue.jours : FENETRE_PAR_DEFAUT;
}

export async function chargerTunnels(jours: number): Promise<ChargementTunnels> {
  const depuis = new Date();
  depuis.setUTCDate(depuis.getUTCDate() - jours);

  const lignes = await prisma.funnelEvent.findMany({
    where: { createdAt: { gte: depuis } },
    select: {
      funnel: true,
      event: true,
      sessionId: true,
      step: true,
      stepIndex: true,
      deviceType: true,
      utmSource: true,
      utmCampaign: true,
      gainBucket: true,
      sector: true,
      createdAt: true,
    },
    // Ordre chronologique : `aggregate` retient la PREMIÈRE valeur non vide
    // d'attribution par session. À l'envers, une session serait attribuée à sa
    // dernière balise, où le cookie a pu expirer.
    orderBy: { createdAt: "asc" },
    take: PLAFOND_LIGNES,
  });

  return {
    synthese: agregerTunnels(lignes as LigneTunnel[]),
    depuis,
    jours,
    lignes: lignes.length,
    tronquee: lignes.length >= PLAFOND_LIGNES,
  };
}
