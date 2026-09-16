/**
 * PRÉSENCE d'une précision de besoin d'adaptation, jamais son contenu.
 *
 * 🔴 Relecture de la PR 1090. Depuis le 2026-08-20, `portail.ts` retire le
 * détail du JSON des réponses et le chiffre dans `Trainee.handicapDetailsChiffre`
 * (donnée de santé, RGPD art. 9 : lecture réservée au super-administrateur,
 * journalisée). Lire le détail dans les réponses rendait donc « Non renseigné »
 * — une absence fausse sur la pièce remise à l'auditrice.
 *
 * Ce module dit seulement QUI porte une précision. La colonne n'est jamais
 * chargée : la présence se lit par un filtre en base, et seul l'identifiant
 * revient.
 *
 * 🔑 Seul l'écran de la fiche session (console, réservée à l'administration) lit
 * cette fonction. Les pièces du dossier d'audit ne l'appellent PAS : elles ne
 * révèlent pas l'existence d'un détail de santé (minimisation). La requête est
 * bornée aux stagiaires désignés : elle ne parcourt jamais le registre.
 *
 * ## Pourquoi PRÉSENCE et non « chiffrée » — corrigé le 2026-09-16
 *
 * Ce module s'appelait `stagiairesAvecPrecisionChiffree` et une première version
 * de ce correctif a durci son filtre pour exiger le préfixe de chiffrement, au
 * motif que le nom devait dire vrai.
 *
 * C'était la mauvaise moitié du problème. La mention affichée par l'appelant est
 * `MENTION_PRECISION_FICHE_STAGIAIRE` : « une précision **peut figurer** sur la
 * fiche du stagiaire ». Elle parle de PRÉSENCE, jamais de protection. Exiger le
 * chiffrement faisait donc **disparaître la mention** pour une précision en
 * clair — le seul cas où l'on veut vraiment être prévenu. Le nom avait été
 * honoré ; le besoin de l'appelant, cassé.
 *
 * Le nom est donc aligné sur ce que l'appelant demande, et l'anomalie —
 * « présente mais NON chiffrée » — est signalée séparément, au lieu d'être
 * silencieusement transformée en absence.
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { PREFIX_V1 } from "@/lib/pii-crypto";

export async function stagiairesAvecPrecision(traineeIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(traineeIds)];
  if (ids.length === 0) return new Set();

  const lignes = await prisma.trainee.findMany({
    where: { id: { in: ids }, handicapDetailsChiffre: { not: null } },
    select: { id: true },
  });

  // 🔴 L'anomalie est SIGNALÉE, pas absorbée. Une précision présente mais non
  // chiffrée ne doit ni disparaître de l'écran, ni passer inaperçue : elle
  // signifie qu'une donnée de santé a été écrite hors des chemins gardés.
  // Requête bornée aux mêmes identifiants, et seul l'identifiant revient.
  try {
    const nonChiffrees = await prisma.trainee.findMany({
      where: {
        id: { in: ids },
        handicapDetailsChiffre: { not: null },
        NOT: { handicapDetailsChiffre: { startsWith: PREFIX_V1 } },
      },
      select: { id: true },
    });
    if (nonChiffrees.length > 0) {
      Sentry.captureMessage("détail de santé présent mais NON chiffré en base", {
        level: "error",
        tags: { service: "stagiairesAvecPrecision" },
        extra: { nombre: nonChiffrees.length, traineeIds: nonChiffrees.map((t) => t.id) },
      });
    }
  } catch (err) {
    // La détection d'anomalie ne doit jamais faire tomber l'écran.
    Sentry.captureException(err, { tags: { service: "stagiairesAvecPrecision" } });
  }

  return new Set(lignes.map((t) => t.id));
}
