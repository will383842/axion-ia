/**
 * Chantier QNC, L03 — le DÉCLENCHEMENT automatique « dès la demande » : appelé
 * à la création d'une session. Ne lève JAMAIS (une session créée n'échoue pas
 * parce qu'un questionnaire n'est pas parti) et, éteint, ne fait qu'UNE lecture
 * (l'interrupteur) — la file d'e-mails n'est même pas importée.
 */

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

import { LOT_RECUEIL } from "./constantes";
import { lancerRecueil } from "./lancement";

export async function declencherRecueilALaCreation(
  sessionId: string,
  auteurId: string | null,
): Promise<void> {
  try {
    if ((await lireInterrupteurQualiopi(LOT_RECUEIL)) === "eteint") return;
    const { envoyerEmailRecueil } = await import("./envoi-email");
    const r = await lancerRecueil(prisma, { sessionId, auteurId }, envoyerEmailRecueil);
    if (r.etat === "refuse") {
      // Pas une panne : le dossier n'est pas prêt (projet, adresse). L'écran de la
      // session le dit et le geste manuel reste ouvert.
      console.warn(`[recueil] session ${sessionId} : ${r.message}`);
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { module: "qualiopi-recueil", etape: "creation" } });
  }
}
