/**
 * Traces de présence au moment de CLÔTURER une session — mesure partagée.
 *
 * ## Pourquoi ce module existe
 *
 * La même mesure vivait en DEUX exemplaires : `actions/qualiopi/sessions.ts`
 * (clôture manuelle) et `queue/workers/qualiopi-formation-crons-worker.ts`
 * (clôture automatique J+24 h). Les deux portaient le commentaire « les deux
 * DOIVENT rester alignées, sinon clôture automatique et clôture manuelle
 * divergent » — c'est-à-dire l'aveu qu'une duplication tenait par la vigilance.
 *
 * 🔑 Une valeur dupliquée avec la meilleure intention ne signale jamais qu'elle
 * a divergé. Elles ne peuvent plus, désormais : il n'y a qu'une mesure.
 *
 * ## Ce que la mesure dit, et ce qu'elle ne dit pas
 *
 * Elle compte les inscriptions ACTIVES (hors `abandon` et `exclu` : renoncer
 * n'est pas une absence de preuve, c'est une sortie du dispositif) et, parmi
 * elles, celles qui ne portent AUCUNE trace de présence.
 *
 * ⚠️ `not: null` et NON `> 0`, délibérément — le durcissement en `> 0` a été
 * tenté puis RETIRÉ dans ce dépôt : `emargementSigneAt` n'est posé que par la
 * grille présentielle, jamais par l'import distanciel ni par la correction
 * manuelle. Une session 100 % distancielle où personne ne se connecte devenait
 * DÉFINITIVEMENT non clôturable. *Un verrou sans porte de sortie est pire que
 * le trou qu'il ferme.*
 */

import { prisma } from "@/lib/prisma";

/** Inscriptions sorties du dispositif : leur absence de trace est normale. */
const STATUTS_SORTIS = ["abandon", "exclu"] as const;

export interface TraceClotureSession {
  /** Inscriptions actives (hors abandon/exclu). */
  readonly totalActifs: number;
  /** Parmi elles, celles sans aucune trace de présence. */
  readonly sansTrace: number;
}

/**
 * Mesure l'état des traces de présence d'une session.
 *
 * Fail-soft assumé par les appelants : en cas d'erreur de lecture, ils ne
 * bloquent pas la transition — une panne de base ne doit pas empêcher de
 * clôturer une session réellement tenue.
 */
/**
 * 🔴 CE QUI COMPTE COMME UNE TRACE DE PRÉSENCE — la définition, à un seul endroit.
 *
 * ## Pourquoi elle est sortie d'ici
 *
 * Ce module savait, et le disait dans son en-tête : *« `emargementSigneAt` n'est
 * posé que par la grille présentielle, jamais par l'import distanciel »*. Il en
 * tirait la bonne conséquence — une trace, c'est une signature **ou** un taux de
 * présence calculé.
 *
 * Les règles d'alerte, elles, portaient leur propre version du prédicat, réduite
 * à `emargementSigneAt`. Sur une session 100 % distancielle parfaitement menée —
 * relevé de connexion importé, taux calculé, fichier archivé avec son empreinte —
 * elles levaient donc :
 *
 *   · `emargement_manquant`, **critique, une par stagiaire**, après la clôture ;
 *   · `emargement_aucune_signature`, **critique**, tant que les jetons vivent.
 *
 * Chaque alerte critique part par e-mail. Une modalité entière du catalogue
 * produisait ainsi une salve de fausses alertes à chaque session bien tenue — et
 * *une alerte qui crie à tort cesse d'être lue*, y compris quand elle a raison.
 *
 * 🔑 C'est le même motif que `pieceAdmissibleAuDossier` et `estMembreDeSession` :
 * un prédicat recopié diverge, et c'est toujours la copie la plus permissive ou
 * la plus étroite qui sert. Ici la copie était plus ÉTROITE — elle ne laissait
 * pas passer trop de monde, elle accusait trop de monde.
 *
 * ⚠️ `tauxPresencePct: { not: null }` et non `> 0`, délibérément — un taux à 0 %
 * EST une trace : le relevé existe et dit que personne ne s'est connecté. Le
 * durcissement en `> 0` a déjà été tenté puis retiré dans ce module (cf. en-tête).
 */
export function porteUneTraceDePresence(): {
  OR: [{ emargementSigneAt: { not: null } }, { tauxPresencePct: { not: null } }];
} {
  return { OR: [{ emargementSigneAt: { not: null } }, { tauxPresencePct: { not: null } }] };
}

/**
 * L'inverse exact : aucune trace, d'aucune sorte.
 *
 * ⚠️ Les deux champs étant nullables, `emargementSigneAt: null` ET
 * `tauxPresencePct: null` est la négation stricte de `porteUneTraceDePresence`.
 * Elle est écrite ici, sous les yeux de sa jumelle, pour qu'aucune des deux ne
 * puisse bouger sans qu'on voie l'autre.
 */
export function sansAucuneTraceDePresence(): {
  emargementSigneAt: null;
  tauxPresencePct: null;
} {
  return { emargementSigneAt: null, tauxPresencePct: null };
}

export async function mesurerTraceCloture(sessionId: string): Promise<TraceClotureSession> {
  const actifs = { sessionId, statut: { notIn: [...STATUTS_SORTIS] } };

  const [totalActifs, avecTrace] = await Promise.all([
    prisma.enrollment.count({ where: actifs }),
    prisma.enrollment.count({ where: { ...actifs, ...porteUneTraceDePresence() } }),
  ]);

  return { totalActifs, sansTrace: totalActifs - avecTrace };
}

/**
 * La clôture doit-elle être REFUSÉE ?
 *
 * Uniquement quand il y a des inscrits actifs et que **pas un seul** ne porte de
 * trace : la session n'a alors rien qui prouve qu'elle a eu lieu.
 *
 * 🔴 On ne refuse PAS sur une absence partielle, et c'est un choix. Le
 * durcissement « tous les inscrits doivent avoir une trace » a été tenté puis
 * retiré ici même : il rendait des sessions définitivement non clôturables, sans
 * porte de sortie, et alimentait une alerte critique non résorbable.
 *
 * Le durcissement reste souhaitable, mais il suppose deux préalables qui ne sont
 * pas remplis : que **tous** les chemins de saisie de présence posent une trace,
 * et qu'un administrateur dispose d'une **clôture explicite motivée**. C'est un
 * lot dédié, pas un correctif.
 *
 * En attendant, le trou réel n'est pas l'absence de blocage — c'est que la
 * situation partielle était **silencieuse**. Elle ne l'est plus :
 * `traceClotureIncomplete` la rend visible.
 */
export function clotureSansAucuneTrace(trace: TraceClotureSession): boolean {
  return trace.totalActifs > 0 && trace.sansTrace === trace.totalActifs;
}

/**
 * La session est clôturable, mais des inscrits actifs n'ont aucune trace.
 *
 * C'est le cas que `CONF-01` décrit : « une seule inscription touchée suffit
 * pour douze ». La session part en « réalisée », et onze personnes se voient
 * potentiellement délivrer une attestation sans qu'aucune preuve de présence
 * n'existe à leur nom.
 */
export function traceClotureIncomplete(trace: TraceClotureSession): boolean {
  return trace.sansTrace > 0 && trace.sansTrace < trace.totalActifs;
}
