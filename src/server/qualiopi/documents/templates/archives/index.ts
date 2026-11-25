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

import type { TypeGabaritFormation, TypeGabaritSignable } from "../gabarit-versions";
import { ConventionPdf as ConventionPdfV2 } from "./convention.v2";
import { ConventionTripartitePdf as ConventionTripartitePdfV2 } from "./convention-tripartite.v2";
import { ConventionPdf as ConventionPdfV3 } from "./convention.v3";
import { ConventionTripartitePdf as ConventionTripartitePdfV3 } from "./convention-tripartite.v3";
import { ConventionPdf as ConventionPdfV4 } from "./convention.v4";
import { ConventionPdf as ConventionPdfV5 } from "./convention.v5";
import { DevisPdf as DevisPdfV1 } from "./devis.v1";
import { DevisPdf as DevisPdfV2 } from "./devis.v2";
import { DevisPdf as DevisPdfV3 } from "./devis.v3";
import { DevisPdf as DevisPdfV4 } from "./devis.v4";
import { DevisPdf as DevisPdfV5 } from "./devis.v5";
import { ConventionTripartitePdf as ConventionTripartitePdfV4 } from "./convention-tripartite.v4";
import { ConventionTripartitePdf as ConventionTripartitePdfV5 } from "./convention-tripartite.v5";
import { ContratFormationPdf as ContratFormationPdfV1 } from "./contrat-formation.v1";
import { ContratFormationPdf as ContratFormationPdfV2 } from "./contrat-formation.v2";
import { ConventionPdf as ConventionPdfV6 } from "./convention.v6";
import { ConventionPdf as ConventionPdfV7 } from "./convention.v7";
import { ConventionPdf as ConventionPdfV8 } from "./convention.v8";
import { ConventionTripartitePdf as ConventionTripartitePdfV7 } from "./convention-tripartite.v7";
import { ConventionTripartitePdf as ConventionTripartitePdfV6 } from "./convention-tripartite.v6";
import { ReleveConnexionPdf as ReleveConnexionPdfV1 } from "./releve-connexion.v1";
import { ProgrammeFormationPdf as ProgrammeFormationPdfV1 } from "./programme-formation.v1";
import { ConvocationPdf as ConvocationPdfV1 } from "./convocation.v1";
import { AttestationPdf as AttestationPdfV1 } from "./attestation.v1";
import { AttestationPartiellePdf as AttestationPartiellePdfV1 } from "./attestation-partielle.v1";
import { CertificatRealisationPdf as CertificatRealisationPdfV1 } from "./certificat-realisation.v1";
import { FacturePdf as FacturePdfV1 } from "./facture.v1";

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
    5: { fichier: "convention.v5.tsx", Composant: ConventionPdfV5 as unknown as ComposantPiece },
    6: { fichier: "convention.v6.tsx", Composant: ConventionPdfV6 as unknown as ComposantPiece },
    7: { fichier: "convention.v7.tsx", Composant: ConventionPdfV7 as unknown as ComposantPiece },
    8: { fichier: "convention.v8.tsx", Composant: ConventionPdfV8 as unknown as ComposantPiece },
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
    5: {
      fichier: "convention-tripartite.v5.tsx",
      Composant: ConventionTripartitePdfV5 as unknown as ComposantPiece,
    },
    6: {
      fichier: "convention-tripartite.v6.tsx",
      Composant: ConventionTripartitePdfV6 as unknown as ComposantPiece,
    },
    7: {
      fichier: "convention-tripartite.v7.tsx",
      Composant: ConventionTripartitePdfV7 as unknown as ComposantPiece,
    },
  },
  devis: {
    1: { fichier: "devis.v1.tsx", Composant: DevisPdfV1 as unknown as ComposantPiece },
    2: { fichier: "devis.v2.tsx", Composant: DevisPdfV2 as unknown as ComposantPiece },
    3: { fichier: "devis.v3.tsx", Composant: DevisPdfV3 as unknown as ComposantPiece },
    4: { fichier: "devis.v4.tsx", Composant: DevisPdfV4 as unknown as ComposantPiece },
    5: { fichier: "devis.v5.tsx", Composant: DevisPdfV5 as unknown as ComposantPiece },
  },
  contrat_formation: {
    1: {
      fichier: "contrat-formation.v1.tsx",
      Composant: ContratFormationPdfV1 as unknown as ComposantPiece,
    },
    2: {
      fichier: "contrat-formation.v2.tsx",
      Composant: ContratFormationPdfV2 as unknown as ComposantPiece,
    },
  },
  releve_connexion: {
    1: {
      fichier: "releve-connexion.v1.tsx",
      Composant: ReleveConnexionPdfV1 as unknown as ComposantPiece,
    },
  },
  facture: {
    1: { fichier: "facture.v1.tsx", Composant: FacturePdfV1 as unknown as ComposantPiece },
  },
};

/** Composant archivé d'une version donnée, ou `null` s'il n'a pas été conservé. */
export function gabaritArchive(type: TypeGabaritSignable, version: number): ComposantPiece | null {
  return GABARITS_ARCHIVES[type]?.[version]?.Composant ?? null;
}

/**
 * Pièces de formation NON signables (programme, convocation, attestations, certificat) :
 * leur v1 est conservée ici pour re-rendre à l'identique une pièce émise avant le passage à la
 * charte 2027. Même règle que ci-dessus : une archive ne se modifie jamais.
 */
export const GABARITS_ARCHIVES_FORMATION: Readonly<
  Record<TypeGabaritFormation, Readonly<Record<number, GabaritArchive>>>
> = {
  programme: {
    1: {
      fichier: "programme-formation.v1.tsx",
      Composant: ProgrammeFormationPdfV1 as unknown as ComposantPiece,
    },
  },
  convocation: {
    1: { fichier: "convocation.v1.tsx", Composant: ConvocationPdfV1 as unknown as ComposantPiece },
  },
  attestation: {
    1: { fichier: "attestation.v1.tsx", Composant: AttestationPdfV1 as unknown as ComposantPiece },
  },
  attestation_partielle: {
    1: {
      fichier: "attestation-partielle.v1.tsx",
      Composant: AttestationPartiellePdfV1 as unknown as ComposantPiece,
    },
  },
  certificat: {
    1: {
      fichier: "certificat-realisation.v1.tsx",
      Composant: CertificatRealisationPdfV1 as unknown as ComposantPiece,
    },
  },
};

/** Composant archivé d'une pièce de formation non signable, ou `null` s'il n'a pas été conservé. */
export function gabaritArchiveFormation(
  type: TypeGabaritFormation,
  version: number,
): ComposantPiece | null {
  return GABARITS_ARCHIVES_FORMATION[type][version]?.Composant ?? null;
}
