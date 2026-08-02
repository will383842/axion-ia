// Prévisionnel financier — couche de lecture (read-only, appelée depuis le RSC).
//
// Lit sessions + factures sur une FENÊTRE de `nbMois` mois à partir de janvier
// `anneeDebut`, puis délègue tout le calcul à la logique pure `agregerParMois`.
//
// Requête FENÊTRÉE : on ne lit jamais toute la table. Deux critères de fenêtre :
//   - sessions : `dateDebut` dans la fenêtre (rattache CA planifié/réalisé/reste) ;
//   - factures : `echeanceAt` dans la fenêtre (encaissements/impayés) OU rattachée
//     à une session de la fenêtre (indispensable au reste-à-facturer : savoir si
//     une session réalisée est déjà facturée, même si l'échéance sort de la vue).
//
// Build-safety (ADR 0026) : au build, `prisma` est un Proxy stub qui renvoie [].
// De plus tout est enveloppé dans un try/catch → [] en cas d'erreur DB.

import { prisma } from "@/lib/prisma";
import {
  agregerParMois,
  type FacturePrevisionnel,
  type LignePrevisionnel,
  type SessionPrevisionnel,
  type SessionStatutPrev,
} from "./calcul";

/** Plafonds de lecture (garde-fous : jamais de findMany non borné). */
const MAX_SESSIONS = 5000;
const MAX_FACTURES = 5000;

/**
 * Bornes UTC de la fenêtre [janvier `anneeDebut` … +`nbMois`], élargies d'un jour
 * de chaque côté pour absorber les bords de fuseau (une session du 1er à 00h30
 * Paris est stockée le mois précédent en UTC).
 */
function fenetreBounds(anneeDebut: number, nbMois: number): { from: Date; to: Date } {
  const from = new Date(Date.UTC(anneeDebut, 0, 1));
  from.setUTCDate(from.getUTCDate() - 1);
  // `Date.UTC(annee, nbMois, 1)` = 1er jour du mois suivant la fenêtre (JS
  // normalise un index de mois ≥ 12 en année suivante).
  const to = new Date(Date.UTC(anneeDebut, nbMois, 1));
  to.setUTCDate(to.getUTCDate() + 1);
  return { from, to };
}

/**
 * Prévisionnel financier agrégé par mois sur la fenêtre demandée.
 *
 * @param anneeDebut Année de départ (la fenêtre commence à janvier).
 * @param nbMois     Nombre de mois couverts (ex. 12 = année pleine).
 * @param now        Référence temporelle pour juger les impayés (injectée).
 *
 * Renvoie les lignes NON vides trouvées, triées par mois. La page complète les
 * mois manquants de la fenêtre avec des lignes à zéro (elle seule connaît la
 * liste des mois à afficher). Stub-safe : [] au build ou en cas d'erreur.
 */
export async function getPrevisionnel(
  anneeDebut: number,
  nbMois: number,
  now: Date,
): Promise<LignePrevisionnel[]> {
  const { from, to } = fenetreBounds(anneeDebut, nbMois);

  try {
    const sessions = await prisma.trainingSession.findMany({
      where: { dateDebut: { gte: from, lt: to } },
      select: { id: true, dateDebut: true, statut: true, montantHtCents: true },
      orderBy: { dateDebut: "asc" },
      take: MAX_SESSIONS,
    });

    const sessionIds = sessions.map((s) => s.id);

    // Factures : échéance dans la fenêtre OU rattachées aux sessions de la fenêtre
    // (pour le reste-à-facturer). Le second terme n'est ajouté que si des sessions
    // existent — `{ in: [] }` matcherait 0 ligne, autant l'omettre.
    const factures = await prisma.factureFormation.findMany({
      where: {
        OR: [
          { echeanceAt: { gte: from, lt: to } },
          ...(sessionIds.length > 0 ? [{ sessionId: { in: sessionIds } }] : []),
        ],
      },
      select: { sessionId: true, statut: true, montantHtCents: true, echeanceAt: true },
      take: MAX_FACTURES,
    });

    const sessionsPrev: SessionPrevisionnel[] = sessions.map((s) => ({
      id: s.id,
      dateDebut: s.dateDebut,
      statut: s.statut as SessionStatutPrev,
      montantHtCents: s.montantHtCents,
    }));
    // 🔴 Plus de `as FactureStatutPrev` sur le statut de facture : le type miroir
    // couvre désormais les six valeurs de l'enum Prisma, l'affectation est donc
    // vérifiée par le compilateur. C'est le cast qui avait laissé passer le
    // défaut — `partiellement_payee` et `en_retard` entraient à l'exécution dans
    // un type qui ne les déclarait pas, et le calcul les jetait en silence.
    // Ne PAS le réintroduire : il rendrait de nouveau l'erreur invisible.
    const facturesPrev: FacturePrevisionnel[] = factures.map((f) => ({
      sessionId: f.sessionId,
      statut: f.statut,
      montantHtCents: f.montantHtCents,
      echeanceAt: f.echeanceAt,
    }));

    return agregerParMois(sessionsPrev, facturesPrev, now);
  } catch {
    return [];
  }
}
