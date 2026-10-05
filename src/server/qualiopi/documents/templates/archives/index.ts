/**
 * Registre des gabarits ARCHIVÉS — une version déjà utilisée par une pièce
 * signée reste rendable après l'évolution du gabarit.
 *
 * ## Pourquoi (2026-09-30)
 *
 * Jusqu'ici, `exemplaire-signe.ts` ne savait rendre qu'avec le gabarit COURANT
 * et refusait (`gabarit_modifie`) toute pièce signée sous une version
 * antérieure. Ce refus était honnête, mais il plaçait chaque correction de
 * texte devant un faux choix : ne pas corriger une citation fausse, ou rendre
 * impossible la reproduction des pièces déjà signées (dont la convention
 * `AXI-DOC-2026-039` de la session `AXI-SESS-2026-001`).
 *
 * ➡️ Quand le texte d'un gabarit signable change, sa version courante est
 * copiée ICI, telle quelle, avant la retouche. L'exemplaire signé est rendu par
 * le composant de la version portée par la pièce.
 *
 * ## ⚠️ RÈGLE
 *
 *  · une version archivée ne se modifie JAMAIS — son texte est verrouillé par
 *    `gabarit-empreinte.spec.ts` (table `EMPREINTES_ARCHIVES`) ;
 *  · on n'archive que des versions ANTÉRIEURES à la version courante ;
 *  · une version ni courante ni archivée reste refusée (`gabarit_modifie`) :
 *    on ne reconstitue jamais un texte qu'on n'a pas conservé.
 *
 * Les versions antérieures à celles listées ici (convention v1, tripartite v1,
 * sous-traitance v1, contrat de travail v1) n'ont pas été conservées au moment
 * de leur remplacement : elles restent refusées, comme avant.
 */

import type React from "react";

import type { TypeGabaritSignable } from "../gabarit-versions";
import { ConventionPdf as ConventionPdfV2 } from "./convention.v2";
import { ConventionTripartitePdf as ConventionTripartitePdfV2 } from "./convention-tripartite.v2";
import { ConventionPdf as ConventionPdfV3 } from "./convention.v3";
import { ConventionTripartitePdf as ConventionTripartitePdfV3 } from "./convention-tripartite.v3";
import { ConventionPdf as ConventionPdfV4 } from "./convention.v4";
import { ConventionTripartitePdf as ConventionTripartitePdfV4 } from "./convention-tripartite.v4";
import { ContratFormationPdf as ContratFormationPdfV1 } from "./contrat-formation.v1";
import { ReleveConnexionPdf as ReleveConnexionPdfV1 } from "./releve-connexion.v1";

export type ComposantPiece = React.ComponentType<{ data: never; identite?: never }>;

export interface GabaritArchive {
  /** Fichier source, relatif à `templates/archives/`. */
  readonly fichier: string;
  readonly Composant: ComposantPiece;
}

export const GABARITS_ARCHIVES: Readonly<
  Partial<Record<TypeGabaritSignable, Readonly<Record<number, GabaritArchive>>>>
> = {
  convention: {
    2: { fichier: "convention.v2.tsx", Composant: ConventionPdfV2 as unknown as ComposantPiece },
    3: { fichier: "convention.v3.tsx", Composant: ConventionPdfV3 as unknown as ComposantPiece },
    4: { fichier: "convention.v4.tsx", Composant: ConventionPdfV4 as unknown as ComposantPiece },
  },
  convention_tripartite: {
    2: {
      fichier: "convention-tripartite.v2.tsx",
      Composant: ConventionTripartitePdfV2 as unknown as ComposantPiece,
    },
    3: {
      fichier: "convention-tripartite.v3.tsx",
      Composant: ConventionTripartitePdfV3 as unknown as ComposantPiece,
    },
    4: {
      fichier: "convention-tripartite.v4.tsx",
      Composant: ConventionTripartitePdfV4 as unknown as ComposantPiece,
    },
  },
  contrat_formation: {
    1: {
      fichier: "contrat-formation.v1.tsx",
      Composant: ContratFormationPdfV1 as unknown as ComposantPiece,
    },
  },
  releve_connexion: {
    1: {
      fichier: "releve-connexion.v1.tsx",
      Composant: ReleveConnexionPdfV1 as unknown as ComposantPiece,
    },
  },
};

/** Composant archivé d'une version donnée, ou `null` s'il n'a pas été conservé. */
export function gabaritArchive(type: TypeGabaritSignable, version: number): ComposantPiece | null {
  return GABARITS_ARCHIVES[type]?.[version]?.Composant ?? null;
}
