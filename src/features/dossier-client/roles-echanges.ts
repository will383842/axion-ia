/**
 * La liste A2 et son prédicat, SANS `@/auth` ni `next/navigation` — décision
 * de Will (28/09) : « seuls Will et les administrateurs lisent les comptes
 * rendus, transcriptions et phrases exactes ».
 *
 * Module PUR : lu par la console (via `./acces.ts`, qui le ré-exporte), par
 * les routes de l'extension et par le worker (`src/server/visio/jeton.ts`).
 * C'est la SEULE déclaration de la liste : personne ne la recopie. Garde :
 * `src/server/visio/__tests__/les-roles-de-l-enregistreur-sont-ceux-du-dossier.spec.ts`.
 */

import type { RoleAdmin } from "@/server/auth/habilitations";

/** Décision A2 : Will (super-administrateur) et les administrateurs, personne d'autre. */
export const ROLES_DOSSIER_ECHANGES = [
  "super_admin",
  "admin",
] as const satisfies ReadonlyArray<RoleAdmin>;

/** Ce rôle peut-il lire (et écrire) les échanges du dossier client ? */
export function peutVoirLesEchanges(role: string | null | undefined): boolean {
  return (ROLES_DOSSIER_ECHANGES as ReadonlyArray<string>).includes(role ?? "");
}
