/**
 * Espace formateur collectif — résolution d'appartenance à une session (PUR).
 *
 * Un formateur est rattaché à une `TrainingSession` par DEUX voies concurrentes,
 * qui coexistent dans le schéma :
 *   - `TrainingSession.formateurPrincipalId` (FK scalaire) → rôle « principal » ;
 *   - une ligne `SessionFormateur` (table N-N) → rôle porté par la ligne.
 *
 * L'`assertOwnership` scalaire de l'espace coaching (`coaching.actions.ts`) ne se
 * transpose donc pas : l'appartenance collective est une relation N-N avec rôles.
 * Ce module est la source de vérité unique de cette résolution, testée isolément.
 *
 * Aucun accès DB : entrée = faits déjà lus, sortie = décision.
 */

export type RoleFormateur = "principal" | "co_formateur" | "assistant" | "tuteur_afest";

/** Faits d'appartenance, tels que lus en base pour une (session, formateur). */
export interface FaitsAppartenance {
  /** `formateurPrincipalId` de la session === trainerId courant ? */
  readonly estPrincipalFk: boolean;
  /** Rôle porté par la ligne `SessionFormateur` du formateur, si elle existe. */
  readonly roleSessionFormateur: RoleFormateur | null;
}

export interface ResultatAppartenance {
  readonly estMembre: boolean;
  /** Rôle effectif. `null` si non membre. */
  readonly role: RoleFormateur | null;
  /**
   * Le formateur peut-il CLÔTURER l'émargement de la session ?
   * Décision produit (D4) : seul le PRINCIPAL clôture. Les co-formateurs,
   * assistants et tuteurs consultent et contresignent leurs propres créneaux,
   * mais n'arrêtent pas la feuille pour tout le groupe.
   */
  readonly peutCloturerEmargement: boolean;
}

/**
 * Résout l'appartenance et le rôle effectif.
 *
 * La FK `formateurPrincipalId` PRIME : si le formateur est le principal par la FK,
 * il est « principal » même si une ligne `SessionFormateur` lui donnait un autre
 * rôle (la FK est la source légale du nom sur les documents — cf. le bug corrigé
 * où le nom du formateur était la raison sociale du client).
 */
export function resoudreAppartenance(faits: FaitsAppartenance): ResultatAppartenance {
  if (faits.estPrincipalFk) {
    return { estMembre: true, role: "principal", peutCloturerEmargement: true };
  }
  if (faits.roleSessionFormateur !== null) {
    const role = faits.roleSessionFormateur;
    return {
      estMembre: true,
      role,
      // Un `SessionFormateur` peut aussi porter le rôle `principal` (co-animation
      // où le principal n'est pas encore posé en FK) : on l'autorise à clôturer.
      peutCloturerEmargement: role === "principal",
    };
  }
  return { estMembre: false, role: null, peutCloturerEmargement: false };
}
