/**
 * Contexte de la fiche client, construit UNE fois par la page et passé à chaque emplacement
 * (lot 0, socle). Aucune donnée du dossier n'y figure : chaque emplacement lit la sienne,
 * et seulement si `voitEchanges` (régime A2).
 */

import type { RoleAdmin } from "@/server/auth/habilitations";

export interface ContexteFiche {
  readonly clientId: string;
  readonly locale: "fr" | "en";
  readonly adminPrefix: string;
  /** `/<locale>/<adminPrefix>/qualiopi` */
  readonly qBase: string;
  /** `/<locale>/<adminPrefix>/qualiopi/clients/<id>` */
  readonly ficheHref: string;
  readonly role: RoleAdmin;
  readonly peutEcrire: boolean;
  readonly voitEchanges: boolean;
  readonly maintenant: Date;
  readonly sp: Readonly<Record<string, string | undefined>>;
  readonly erreur: string | null;
  readonly message: string | null;
}
