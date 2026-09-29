/**
 * Le REGISTRE des schémas envoyés à OpenAI (ADR 0055).
 *
 * Chaque entrée : le nom du format (tel qu'envoyé), sa version, le schéma Zod
 * et le fichier où son JSON Schema est FIGÉ. Modifier un schéma sans
 * régénérer son fichier (`pnpm exec tsx scripts/visio/figer-schemas.ts`) fait
 * rougir `le-schema-envoye-est-fige.spec.ts` ; le régénérer se voit en revue,
 * et la version doit monter (écrite dans `CompteRendu.schemaVersion`).
 */

import type { ZodType } from "zod";

import { extractionV1 } from "./extraction";
import {
  compteRenduV1,
  consolidationV1,
  ebaucheV1,
  emailSuiviV1,
  lectureReponsesV1,
  questionnaireV1,
  rattachementV1,
} from "./autres";

export interface SchemaVisio {
  readonly nom: string;
  readonly version: number;
  readonly schema: ZodType;
  readonly fichier: string;
}

export const SCHEMAS_VISIO = {
  extraction: {
    nom: "extraction_v1",
    version: 1,
    schema: extractionV1,
    fichier: "extraction.schema.json",
  },
  rattachement: {
    nom: "rattachement_v1",
    version: 1,
    schema: rattachementV1,
    fichier: "rattachement.schema.json",
  },
  consolidation: {
    nom: "consolidation_v1",
    version: 1,
    schema: consolidationV1,
    fichier: "consolidation.schema.json",
  },
  ebauche: { nom: "ebauche_v1", version: 1, schema: ebaucheV1, fichier: "ebauche.schema.json" },
  compteRendu: {
    nom: "compte_rendu_v1",
    version: 1,
    schema: compteRenduV1,
    fichier: "compte-rendu.schema.json",
  },
  questionnaire: {
    nom: "questionnaire_v1",
    version: 1,
    schema: questionnaireV1,
    fichier: "questionnaire.schema.json",
  },
  lectureReponses: {
    nom: "lecture_reponses_v1",
    version: 1,
    schema: lectureReponsesV1,
    fichier: "lecture-reponses.schema.json",
  },
  emailSuivi: {
    nom: "email_suivi_v1",
    version: 1,
    schema: emailSuiviV1,
    fichier: "email-suivi.schema.json",
  },
} as const satisfies Record<string, SchemaVisio>;

/**
 * Version écrite dans `CompteRendu.schemaVersion` : la somme des versions des
 * schémas du circuit du compte rendu (P1 à P5). Monte dès que l'un d'eux monte.
 */
export const VERSION_SCHEMAS_COMPTE_RENDU =
  SCHEMAS_VISIO.extraction.version +
  SCHEMAS_VISIO.rattachement.version +
  SCHEMAS_VISIO.consolidation.version +
  SCHEMAS_VISIO.ebauche.version +
  SCHEMAS_VISIO.compteRendu.version -
  4;
