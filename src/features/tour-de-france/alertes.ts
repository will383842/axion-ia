/**
 * Tour France IA : l'alerte Telegram d'une mini-demande (2026-10-29).
 *
 * Deux alertes, dans le salon « Tour » (repli : Clients, Système, général) :
 *   - `TOUR_DEMANDE_RECUE` : une demande vient d'être enregistrée ;
 *   - `TOUR_VILLE_OUVERTE` : sa ville atteint 5 demandes comptées (une seule fois par ville).
 * La visio prise a déjà sa propre alerte (`CLIENT_CALL_BOOKED`) : elle n'est pas doublée ici.
 *
 * 🔴 Aucune donnée personnelle dans le message : la ville du référentiel (ou « ville hors liste »),
 * des nombres, « compte / ne compte pas ». Jamais le nom, l'e-mail, le téléphone, l'IP ni la
 * ville saisie (`villeSaisie`) ; une clé « ? » (hors liste) ne part pas non plus.
 *
 * 🔑 L'envoi part APRÈS la réponse (`after`), et rien ici ne lève jamais : l'action ne change ni
 * sa redirection ni sa durée (anti-oracle). Sans migration : le compte se relit dans la table.
 *
 * ⚠️ Interrupteur `TOUR_TELEGRAM_ENABLED` : ALLUMÉ PAR DÉFAUT, seule la valeur « false » l'éteint
 * (casse et espaces ignorés ; décision de Will ; le reste du dépôt fait l'inverse).
 */

import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";

import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notifications";
import { SEUIL_PAR_VILLE } from "./comptage";
import type { DemandeEnregistree } from "./enregistrer";

/** Vrai sauf si `TOUR_TELEGRAM_ENABLED` vaut « false » (casse et espaces ignorés). */
export function tourTelegramActif(): boolean {
  return (process.env.TOUR_TELEGRAM_ENABLED ?? "").trim().toLowerCase() !== "false";
}

/** Une ville ouverte l'est pour longtemps : pas de seconde alerte pendant 400 jours. */
const DEDUP_VILLE_OUVERTE_SEC = 400 * 24 * 3600;

const VILLE_HORS_LISTE = "ville hors liste (à vérifier)";

/**
 * Envoie les alertes d'une demande. Exportée pour les tests ; ne lève jamais.
 * Le seuil se teste avec `>=` : une ville déjà à 5 qui reçoit une 6e demande comptée ne relance
 * pas, la clé de déduplication de l'ouverture le garantit.
 */
export async function envoyerAlertesDemande(d: DemandeEnregistree): Promise<void> {
  try {
    if (!tourTelegramActif()) return;
    const horsListe = d.villeNom === null;
    const comptees = await prisma.tourDemande.count({
      where: { villeCle: d.villeCle, compte: true, statut: { not: "ecartee" } },
    });
    await notify({
      category: "TOUR_DEMANDE_RECUE",
      payload: {
        ville: d.villeNom ?? VILLE_HORS_LISTE,
        villeCle: horsListe ? null : d.villeCle,
        comptees,
        seuil: SEUIL_PAR_VILLE,
        compte: d.compte,
      },
      dedupKey: `tour-demande:${d.id}`,
      dedupTtlSec: 3600,
    });
    if (d.compte && d.villeNom !== null && comptees >= SEUIL_PAR_VILLE) {
      await notify({
        category: "TOUR_VILLE_OUVERTE",
        payload: {
          ville: d.villeNom,
          villeCle: d.villeCle,
          comptees,
          seuil: SEUIL_PAR_VILLE,
        },
        dedupKey: `tour-ville-ouverte:${d.villeCle}`,
        dedupTtlSec: DEDUP_VILLE_OUVERTE_SEC,
      });
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { module: "tour-demande", etape: "alerte" } });
  }
}

/**
 * Programme l'envoi APRÈS la réponse. Ne lève jamais. Hors d'une requête (`after` refuse), l'envoi
 * part quand même, détaché.
 */
export function programmerAlerteDemande(d: DemandeEnregistree): void {
  try {
    try {
      after(() => envoyerAlertesDemande(d));
    } catch {
      void envoyerAlertesDemande(d);
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { module: "tour-demande", etape: "alerte-programmation" } });
  }
}
