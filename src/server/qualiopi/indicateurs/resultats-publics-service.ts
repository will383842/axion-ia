/**
 * Lecture en base des résultats PUBLICS d'une formation (encadré « Nos
 * résultats » de la fiche catalogue). Doctrine, prédicats et rattachement :
 * voir `./resultats-publics` (module pur).
 */

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import {
  aDesResultatsSurSaFichePublique,
  construireResultatsPublics,
  type ResultatsPublicsFormation,
} from "./resultats-publics";

// ─────────────────────────────────────────────────────────────────────────────
// Lecture en base
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résultats publiables de la formation dont le slug est `slugFr`, ou `null`.
 * Ne lève jamais : la fiche publique ne doit pas tomber pour un encadré.
 */
export async function getResultatsPublicsFormation(
  slugFr: string,
  maintenant: Date = new Date(),
): Promise<ResultatsPublicsFormation | null> {
  // Contrat build ADR 0026 — aucune requête au build.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;

  try {
    const formation = await prisma.formation.findUnique({
      where: { slug: slugFr },
      select: { id: true, indicateursPubliesAt: true },
    });
    if (!formation || formation.indicateursPubliesAt === null) return null;

    const sessionRealisee = { formationId: formation.id, statut: "realisee" as const };

    const sessions = await prisma.trainingSession.findMany({
      where: sessionRealisee,
      select: { dateDebut: true, dateFin: true },
    });
    if (sessions.length === 0) return null;

    const [inscriptions, questionnaires, seuilPresencePct] = await Promise.all([
      prisma.enrollment.findMany({
        where: { ...inscriptionsActives(), session: sessionRealisee },
        select: { tauxPresencePct: true },
      }),
      prisma.questionnaire.findMany({
        where: {
          type: "satisfaction_chaud",
          reponduAt: { not: null },
          noteGlobale: { not: null },
          enrollment: { session: sessionRealisee },
        },
        select: { noteGlobale: true },
      }),
      getQualiopiConfig("seuil_presence_pct"),
    ]);

    return construireResultatsPublics({
      indicateursPubliesAt: formation.indicateursPubliesAt,
      sessions,
      inscriptions,
      notes: questionnaires
        .map((q) => q.noteGlobale)
        .filter((n): n is number => typeof n === "number"),
      seuilPresencePct: Number(seuilPresencePct),
      calculeLe: maintenant,
    });
  } catch {
    return null;
  }
}

/**
 * Slugs des formations dont les résultats s'affichent RÉELLEMENT sur leur
 * fiche publique — pour le Mode auditeur (indicateur 2). Même règle que
 * l'encadré (`aDesResultatsSurSaFichePublique` → `resultatsDiffusables`) :
 * une date de publication posée sur une formation sans session réalisée ne
 * diffuse rien, et ne doit pas être présentée comme une diffusion.
 *
 * Lève en cas d'erreur base, comme les autres lectures du moteur de
 * conformité : un « aucun résultat diffusé » fabriqué par une panne serait
 * une fausse preuve dans l'autre sens.
 */
export async function listerFormationsAResultatsDiffuses(): Promise<string[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return [];
  const formations = await prisma.formation.findMany({
    where: { indicateursPubliesAt: { not: null } },
    select: {
      slug: true,
      indicateursPubliesAt: true,
      sessions: {
        where: { statut: "realisee" },
        select: { _count: { select: { enrollments: { where: inscriptionsActives() } } } },
      },
    },
  });
  return (Array.isArray(formations) ? formations : [])
    .filter((f) => aDesResultatsSurSaFichePublique(f))
    .map((f) => f.slug);
}
