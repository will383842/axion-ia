/**
 * Qualiopi T13 — Lecture de la feuille d'émargement d'un stagiaire, par jeton.
 *
 * Alimente la page publique. Deux principes :
 *
 * · **Politique de champs stricte.** On ne remonte QUE ce que la page affiche.
 *   Un stagiaire ne doit voir ni les autres inscrits, ni leur employeur, ni quoi
 *   que ce soit de la session au-delà de sa propre feuille — en inter-entreprises
 *   les participants sont des concurrents (oubli O8 du plan).
 * · **Aucune décision ici.** Ce qui est signable est décidé par
 *   `creneaux-signables.ts`, à partir de l'instant courant. Cette lecture ne fait
 *   que rassembler les faits.
 *
 * Stub-safe : retourne `null` au build SSG.
 */

import { prisma } from "@/lib/prisma";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import type { CreneauCandidat } from "./creneaux-signables";

export interface FeuilleStagiaire {
  enrollmentId: string;
  stagiaireNom: string;
  formationIntitule: string;
  organisme: string;
  creneaux: Array<
    CreneauCandidat & {
      /** Libellé lisible, ex. « mercredi 10 juin 2026 ». */
      jourLisible: string;
      demiJourneeLisible: string;
      horaires: string;
      formateurNom: string;
    }
  >;
}

const LIBELLE_DEMI: Record<DemiJourneeLabel, string> = {
  matin: "la matinée",
  apres_midi: "l'après-midi",
  journee: "la journée",
};

function jourLisible(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Feuille d'un inscrit : ses créneaux, avec les horaires RÉELS de chaque journée.
 *
 * Un créneau dont la journée n'est pas déclarée est ÉCARTÉ : sans horaires, il
 * ne serait pas signable de toute façon (le service refuse), et l'afficher
 * laisserait croire au stagiaire qu'il a oublié quelque chose.
 */
export async function lireFeuilleStagiaire(
  enrollmentId: string,
  organisme: string,
): Promise<FeuilleStagiaire | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;

  const inscription = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: {
        select: {
          titreSession: true,
          formateurPrincipal: { select: { nom: true, prenom: true } },
          jours: {
            select: {
              date: true,
              heureDebut: true,
              heureFin: true,
              trainer: { select: { nom: true, prenom: true } },
            },
          },
        },
      },
      presences: {
        select: {
          id: true,
          date: true,
          demiJournee: true,
          emargementSignatures: { where: { revokedAt: null }, select: { id: true }, take: 1 },
        },
        orderBy: [{ date: "asc" }, { demiJournee: "asc" }],
      },
    },
  });

  if (inscription === null) return null;

  const parJour = new Map(inscription.session.jours.map((j) => [parisDateISO(j.date), j] as const));

  const creneaux = inscription.presences.flatMap((c) => {
    const iso = parisDateISO(c.date);
    const jour = parJour.get(iso);
    if (jour === undefined) return [];

    const formateur = jour.trainer ?? inscription.session.formateurPrincipal;
    return [
      {
        id: c.id,
        date: iso,
        demiJournee: c.demiJournee as DemiJourneeLabel,
        jourHeureDebut: jour.heureDebut,
        jourHeureFin: jour.heureFin,
        dejaSigne: c.emargementSignatures.length > 0,
        jourLisible: jourLisible(iso),
        demiJourneeLisible: LIBELLE_DEMI[c.demiJournee as DemiJourneeLabel],
        horaires: `${jour.heureDebut}–${jour.heureFin}`,
        formateurNom: formateur === null ? "" : `${formateur.prenom} ${formateur.nom}`.trim(),
      },
    ];
  });

  return {
    enrollmentId: inscription.id,
    stagiaireNom: `${inscription.trainee.prenom} ${inscription.trainee.nom}`.trim(),
    formationIntitule: inscription.session.titreSession,
    organisme,
    creneaux,
  };
}
