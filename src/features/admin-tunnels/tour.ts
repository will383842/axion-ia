/**
 * Chargement du tableau « Tunnel Tour de France IA » (2026-10-26).
 *
 * Séparé de l'agrégation (`tour-entonnoir.ts`, pure et testée) : ce fichier ne
 * fait que LIRE, par deux lectures isolées. Chacune a son propre `try` : une
 * lecture en échec rend « non mesuré » pour ses marches, jamais un zéro — et
 * jamais une page en erreur.
 *
 * Les rendez-vous passent par la lecture groupée du bilan commun
 * (`lireBilanRendezVous`) : le Tour se compte exactement comme les autres types.
 * L'appelant a déjà passé `gardeLectureAppels`. Au build (`stub.invalid`), les
 * deux lectures rendent des listes vides.
 */

import { prisma } from "@/lib/prisma";
import { lireBilanRendezVous } from "@/features/admin-rendezvous/bilan-rendez-vous-queries";
import type { BilanType } from "@/features/admin-rendezvous/bilan-rendez-vous";
import { construireTableauTour, type LigneBaliseTour, type TableauTour } from "./tour-entonnoir";

/** Le nom d'étape posé par `ArriveeReservationMesure` sur la page de réservation. */
export const EVENEMENT_ARRIVEE_TOUR = "Call Booking Viewed";

const PLAFOND_BALISES = 50_000;

export interface ChargementTour {
  readonly tableau: TableauTour;
  readonly jours: number;
  /** Plafond de lecture atteint : les arrivées sont un plancher, et l'écran le dit. */
  readonly tronquee: boolean;
}

export async function chargerTableauTour(
  jours: number,
  maintenant: Date = new Date(),
): Promise<ChargementTour> {
  const depuis = new Date(maintenant.getTime() - jours * 86_400_000);

  let balises: LigneBaliseTour[] | null = null;
  try {
    balises = await prisma.funnelEvent.findMany({
      where: {
        funnel: "tour",
        event: EVENEMENT_ARRIVEE_TOUR,
        createdAt: { gte: depuis, lte: maintenant },
      },
      select: { sessionId: true, placement: true },
      take: PLAFOND_BALISES,
    });
  } catch {
    balises = null;
  }

  let bilanTour: BilanType | undefined | null = null;
  try {
    const bilan = await lireBilanRendezVous(jours, maintenant);
    bilanTour = bilan.types.find((t) => t.type === "tour_de_france_ia");
  } catch {
    bilanTour = null;
  }

  return {
    tableau: construireTableauTour(balises, bilanTour),
    jours,
    tronquee: (balises?.length ?? 0) >= PLAFOND_BALISES,
  };
}
