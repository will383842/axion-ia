/**
 * Qui peut tenir l'enregistreur — décision A2 de Will (28/09) : « seuls Will
 * et les administrateurs lisent les comptes rendus, transcriptions et phrases
 * exactes ». Le titulaire d'un jeton d'appareil est REVÉRIFIÉ contre cette
 * liste à chaque appel de l'extension : retirer le rôle coupe l'appareil.
 *
 * ⚠️ INTERFACE LOCALE À LA PR 5. La liste de référence est
 * `ROLES_DOSSIER_ECHANGES` de `src/features/dossier-client/acces.ts`, livrée
 * par la PR 3 (#1212), pas encore fusionnée quand cette PR a été écrite. Les
 * deux listes sont identiques ; au rebase sur une `main` qui contient la PR 3,
 * ce module devient un simple ré-export (`export { ROLES_DOSSIER_ECHANGES as
 * ROLES_ENREGISTREUR }`), pour qu'il n'y ait plus qu'une liste.
 *
 * Module PUR : lu par les routes, la page de la console et le worker.
 */

/** A2 : super-administrateur et administrateurs, personne d'autre. */
export const ROLES_ENREGISTREUR = ["super_admin", "admin"] as const;

/** Ce rôle peut-il créer un jeton d'appareil et enregistrer ? */
export function roleAutoriseEnregistreur(role: string | null | undefined): boolean {
  return (ROLES_ENREGISTREUR as ReadonlyArray<string>).includes(role ?? "");
}
