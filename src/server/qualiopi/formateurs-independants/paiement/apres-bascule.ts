/**
 * Formateurs indépendants — LE RUN MENSUEL APRÈS LA BASCULE (lot L12c), pur.
 *
 * ADR 0066 v2 (e), plan 08 §2.7 règle 1 : une session dont la première journée
 * précède la date de bascule `D` reste ENTIÈREMENT au relevé mensuel ; une
 * session commencée à `D` ou après passe ENTIÈREMENT au paiement par mission.
 * Après `D`, le run mensuel ne traite donc un INDÉPENDANT que pour les sessions
 * que le relevé mensuel a revendiquées (`revendications_paiement`). Les salariés
 * et les dirigeants ne sont jamais concernés.
 *
 * 🔑 SANS DATE DE BASCULE, RIEN NE CHANGE : la fonction rend les prestations
 * telles quelles (le run d'aujourd'hui, octet pour octet).
 */

/** La forme minimale d'une prestation du run (`PrestationACalculer`). */
interface PrestationAvecAffectations {
  readonly sessionId: string | null;
  readonly affectations: ReadonlyArray<{ readonly trainerId: string }>;
}

export function cleRevendication(trainerId: string, sessionId: string): string {
  return `${trainerId}|${sessionId}`;
}

/**
 * Retire des prestations de SESSION les affectations d'indépendants qui
 * appartiennent au PAIEMENT PAR MISSION :
 *   - le couple est revendiqué `par_mission` ; ou
 *   - il n'est revendiqué par personne ET la session a commencé à la bascule ou
 *     après (première journée ≥ `D`).
 * Tout le reste RESTE au relevé mensuel — en particulier une session d'avant la
 * bascule que le rattrapage n'aurait pas encore revendiquée : elle n'est jamais
 * payée par mission, l'écarter ici la ferait payer par personne.
 * Coachings et audits : inchangés (hors paiement par mission).
 */
export function filtrerPrestationsApresBascule<P extends PrestationAvecAffectations>(
  prestations: ReadonlyArray<P>,
  e: {
    readonly dateBascule: string | null;
    readonly statutParTrainer: ReadonlyMap<string, string>;
    /** Revendications existantes, par `cleRevendication`. */
    readonly revendications: ReadonlyMap<string, "releve_mensuel" | "par_mission">;
    /** Première journée de chaque session (jour civil), même calcul que le passage. */
    readonly premiereJourneeParSession: ReadonlyMap<string, string>;
  },
): P[] {
  if (e.dateBascule === null) return [...prestations];
  const d = e.dateBascule;
  return prestations.map((p) => {
    if (p.sessionId === null) return p;
    const sessionId = p.sessionId;
    const premiere = e.premiereJourneeParSession.get(sessionId);
    const affectations = p.affectations.filter((a) => {
      if (e.statutParTrainer.get(a.trainerId) !== "sous_traitant") return true;
      const regime = e.revendications.get(cleRevendication(a.trainerId, sessionId));
      if (regime === "par_mission") return false;
      if (regime === "releve_mensuel") return true;
      // Personne n'a revendiqué : la date de la première journée décide. Inconnue → mensuel.
      return premiere === undefined || premiere < d;
    });
    return affectations.length === p.affectations.length ? p : { ...p, affectations };
  });
}
