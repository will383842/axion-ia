/**
 * 🔴 QUAND RÉCLAMER UNE SIGNATURE MANQUANTE — module PUR.
 *
 * ## Le défaut
 *
 * La règle attendait **sept jours** après la dernière modification de la pièce,
 * quelle que soit la session. Le seuil était absolu et **aveugle à la date de
 * début**.
 *
 * Conséquence : une convention signée d'un seul côté pour une session qui
 * commence **dans trois jours** n'alertait pas — elle aurait alerté quatre
 * jours *après* le démarrage. Or la convention doit être conclue **avant**
 * l'entrée en formation (L.6353-1) : passé le premier jour, l'alerte ne sert
 * plus à prévenir, elle constate.
 *
 * Le seuil utile est donc le **plus proche des deux** : sept jours d'attente,
 * ou l'approche de la session.
 *
 * ## Pourquoi les deux, et pas seulement la session
 *
 * ⚠️ Toutes les pièces ne portent pas de session — un devis, une convention de
 * sous-traitance, une lettre de mission peuvent n'en avoir aucune. Ne garder
 * que le critère « avant la session » ferait **disparaître** ces pièces de la
 * surveillance : elles attendraient indéfiniment sans que rien ne le dise.
 * C'est le défaut inverse, et il est pire — il est silencieux.
 */

const MS_JOUR = 24 * 60 * 60 * 1000;

/** Attente absolue au-delà de laquelle une signature manquante se réclame. */
export const ATTENTE_JOURS = 7;

/**
 * Marge avant le début d'une session en deçà de laquelle on réclame la
 * signature **sans attendre** les sept jours.
 *
 * 5 jours : c'est la fenêtre de convocation. En deçà, les stagiaires sont déjà
 * prévenus et la pièce contractuelle doit exister.
 */
export const MARGE_AVANT_SESSION_JOURS = 5;

export type MotifReclamation = "attente" | "session_imminente" | "session_commencee";

export interface VerdictSignature {
  readonly reclamer: boolean;
  readonly motif: MotifReclamation | null;
}

/**
 * Faut-il réclamer la signature de cette pièce, et pourquoi ?
 *
 * @param dateDebut — début de la session rattachée, ou `null` si la pièce n'en
 *   a aucune (devis, sous-traitance…).
 */
export function verdictSignature(args: {
  readonly modifieeLe: Date;
  readonly dateDebut: Date | null;
  readonly maintenant: Date;
}): VerdictSignature {
  const { modifieeLe, dateDebut, maintenant } = args;

  // La session a commencé : la pièce aurait dû être conclue avant. C'est le cas
  // le plus grave, et il prime — annoncer « imminente » sur une session
  // démarrée ferait croire qu'il reste du temps.
  if (dateDebut !== null && dateDebut.getTime() <= maintenant.getTime()) {
    return { reclamer: true, motif: "session_commencee" };
  }

  if (
    dateDebut !== null &&
    dateDebut.getTime() - maintenant.getTime() <= MARGE_AVANT_SESSION_JOURS * MS_JOUR
  ) {
    return { reclamer: true, motif: "session_imminente" };
  }

  if (maintenant.getTime() - modifieeLe.getTime() >= ATTENTE_JOURS * MS_JOUR) {
    return { reclamer: true, motif: "attente" };
  }

  return { reclamer: false, motif: null };
}

/**
 * Le titre de l'alerte, qui DIT pourquoi elle sort maintenant.
 *
 * 🔴 Le titre était figé — « Pièce signée d'un seul côté depuis +7 jours » —
 * y compris quand la vraie raison était l'imminence de la session. Un titre
 * qui donne le mauvais motif fait chercher au mauvais endroit : on regarde
 * depuis quand la pièce dort, au lieu de regarder quand la session commence.
 */
export function titreReclamation(args: {
  readonly motif: MotifReclamation;
  readonly partielle: boolean;
}): string {
  const quoi = args.partielle ? "Pièce signée d'un seul côté" : "Pièce sans aucune signature";
  switch (args.motif) {
    case "session_commencee":
      return `${quoi} — la session a DÉJÀ commencé`;
    case "session_imminente":
      return `${quoi} — la session commence sous ${MARGE_AVANT_SESSION_JOURS} jours`;
    case "attente":
      return `${quoi} depuis +${ATTENTE_JOURS} jours`;
  }
}
