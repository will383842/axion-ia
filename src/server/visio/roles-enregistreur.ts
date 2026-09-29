/**
 * Qui peut tenir l'enregistreur — décision A2 de Will (28/09) : « seuls Will
 * et les administrateurs lisent les comptes rendus, transcriptions et phrases
 * exactes ». Le titulaire d'un jeton d'appareil est REVÉRIFIÉ contre cette
 * liste à chaque appel de l'extension : retirer le rôle coupe l'appareil.
 *
 * ⚠️ La liste de référence est `ROLES_DOSSIER_ECHANGES`
 * (`src/features/dossier-client/acces.ts`, PR 3). Elle n'est pas ré-exportée
 * d'ici parce que ce module-là tire `@/auth` et `next/navigation`, et que
 * celui-ci est lu par des modules destinés au worker (`jeton.ts`,
 * `balayage-enregistreur.ts`). Les deux listes sont donc écrites deux fois, et
 * `__tests__/les-roles-de-l-enregistreur-sont-ceux-du-dossier.spec.ts` rougit
 * dès qu'elles divergent.
 *
 * Module PUR : lu par les routes, la console et le worker.
 */

/** A2 : super-administrateur et administrateurs, personne d'autre. */
export const ROLES_ENREGISTREUR = ["super_admin", "admin"] as const;

/** Ce rôle peut-il créer un jeton d'appareil et enregistrer ? */
export function roleAutoriseEnregistreur(role: string | null | undefined): boolean {
  return (ROLES_ENREGISTREUR as ReadonlyArray<string>).includes(role ?? "");
}
