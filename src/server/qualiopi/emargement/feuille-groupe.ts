/**
 * Qualiopi T13 — Feuille d'émargement d'un GROUPE, pour l'écran formateur.
 *
 * L'inverse de `portail-queries.ts` : là, un stagiaire voyait ses propres
 * demi-journées ; ici, un formateur voit une demi-journée pour tout son groupe.
 * C'est le geste réel en salle — on est le 10 juin à midi, on fait signer les
 * douze présents, puis on passe à l'après-midi.
 *
 * ⚠️ POLITIQUE DE CHAMPS — reprise de l'étape B, non négociable : jamais
 * d'e-mail de stagiaire, jamais de détail handicap, jamais de consentement. Le
 * formateur a besoin d'un nom pour reconnaître qui est devant lui, rien de plus.
 *
 * Stub-safe : retourne `null` au build SSG.
 */

import { prisma } from "@/lib/prisma";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import { demiJourneeCommencee } from "./creneaux-signables";

export interface LigneGroupe {
  creneauId: string;
  enrollmentId: string;
  stagiaireNom: string;
  /** Statut de l'inscription — un abandon reste visible, c'est le contexte de séance. */
  statut: string;
  etat: "signable" | "deja_signe" | "pas_encore_commence";
}

export interface DemiJourneeGroupe {
  cle: string;
  date: string;
  demiJournee: DemiJourneeLabel;
  jourLisible: string;
  demiJourneeLisible: string;
  horaires: string;
  formateurNom: string;
  commencee: boolean;
  lignes: LigneGroupe[];
}

const LIBELLE_DEMI: Record<DemiJourneeLabel, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  journee: "Journée",
};

function jourLisible(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Toutes les demi-journées d'une session, chacune avec l'état de son groupe.
 *
 * Une demi-journée dont la journée n'est pas déclarée est ÉCARTÉE : sans
 * horaires réels, la signature serait refusée par le service, et l'afficher
 * laisserait le formateur croire à une panne.
 */
export async function lireFeuilleGroupe(
  sessionId: string,
  maintenant: Date,
): Promise<DemiJourneeGroupe[] | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      formateurPrincipal: { select: { nom: true, prenom: true } },
      jours: {
        select: {
          date: true,
          heureDebut: true,
          heureFin: true,
          trainer: { select: { nom: true, prenom: true } },
        },
        orderBy: { date: "asc" },
      },
      enrollments: {
        // Un stagiaire EFFACÉ (droit à l'effacement) disparaît ; un abandon
        // reste, parce qu'il fait partie du contexte de la séance.
        where: { trainee: { deletedAt: null } },
        select: {
          id: true,
          statut: true,
          trainee: { select: { nom: true, prenom: true } },
          presences: {
            select: {
              id: true,
              date: true,
              demiJournee: true,
              emargementSignatures: { where: { revokedAt: null }, select: { id: true }, take: 1 },
            },
          },
        },
        orderBy: { trainee: { nom: "asc" } },
      },
    },
  });

  if (session === null) return null;

  const parJour = new Map(session.jours.map((j) => [parisDateISO(j.date), j] as const));

  // Regroupement par (date, demi-journée) : c'est le grain auquel on travaille
  // en salle, pas le grain « un stagiaire, toutes ses dates ».
  const groupes = new Map<string, DemiJourneeGroupe>();

  for (const inscription of session.enrollments) {
    for (const creneau of inscription.presences) {
      const iso = parisDateISO(creneau.date);
      const jour = parJour.get(iso);
      if (jour === undefined) continue;

      const dj = creneau.demiJournee as DemiJourneeLabel;
      const cle = `${iso}|${dj}`;

      let groupe = groupes.get(cle);
      if (groupe === undefined) {
        const formateur = jour.trainer ?? session.formateurPrincipal;
        groupe = {
          cle,
          date: iso,
          demiJournee: dj,
          jourLisible: jourLisible(iso),
          demiJourneeLisible: LIBELLE_DEMI[dj],
          horaires: `${jour.heureDebut}–${jour.heureFin}`,
          formateurNom: formateur === null ? "" : `${formateur.prenom} ${formateur.nom}`.trim(),
          commencee: demiJourneeCommencee(
            {
              date: iso,
              demiJournee: dj,
              jourHeureDebut: jour.heureDebut,
              jourHeureFin: jour.heureFin,
            },
            maintenant,
          ),
          lignes: [],
        };
        groupes.set(cle, groupe);
      }

      const dejaSigne = creneau.emargementSignatures.length > 0;
      groupe.lignes.push({
        creneauId: creneau.id,
        enrollmentId: inscription.id,
        stagiaireNom: `${inscription.trainee.prenom} ${inscription.trainee.nom}`.trim(),
        statut: inscription.statut,
        etat: dejaSigne ? "deja_signe" : groupe.commencee ? "signable" : "pas_encore_commence",
      });
    }
  }

  return [...groupes.values()].sort((a, b) => a.cle.localeCompare(b.cle));
}
