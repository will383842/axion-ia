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
 * Retire des prestations de SESSION les affectations d'indépendants que le
 * relevé mensuel n'a pas revendiquées. Coachings et audits : inchangés (hors
 * paiement par mission).
 */
export function filtrerPrestationsApresBascule<P extends PrestationAvecAffectations>(
  prestations: ReadonlyArray<P>,
  e: {
    readonly dateBascule: string | null;
    readonly statutParTrainer: ReadonlyMap<string, string>;
    readonly revendiqueesMensuel: ReadonlySet<string>;
  },
): P[] {
  if (e.dateBascule === null) return [...prestations];
  return prestations.map((p) => {
    if (p.sessionId === null) return p;
    const sessionId = p.sessionId;
    const affectations = p.affectations.filter(
      (a) =>
        e.statutParTrainer.get(a.trainerId) !== "sous_traitant" ||
        e.revendiqueesMensuel.has(cleRevendication(a.trainerId, sessionId)),
    );
    return affectations.length === p.affectations.length ? p : { ...p, affectations };
  });
}
