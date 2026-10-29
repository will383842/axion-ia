/**
 * Contexte de la fiche client, construit UNE fois par la page et passé à chaque emplacement
 * (lot 0, socle). Aucune donnée du dossier n'y figure : chaque emplacement lit la sienne,
 * et seulement si `voitEchanges` (régime A2).
 */

import { cache } from "react";
import type { RoleAdmin } from "@/server/auth/habilitations";
import { getClient360 } from "@/server/qualiopi/crm/clients";

/**
 * Lecture du client 360 mise en cache PAR REQUÊTE (React `cache`) : la page et les emplacements
 * (B1…) la partagent, la requête lourde n'est faite qu'une fois par affichage.
 */
export const lireClient360Cache = cache((id: string) => getClient360(id));

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
