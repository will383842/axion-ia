/**
 * Qualiopi — Formation Engine T4 : ré-exports types Prisma.
 *
 * Règle : jamais de duplication des types Prisma.
 * Import depuis `prisma/generated/client` (output custom), PAS `@prisma/client`.
 */

export type {
  GrilleQualiteConfig,
  CacheIa,
  FileValidation,
  FormationGenerationJob,
  EtapeGeneration,
  FileValidationStatut,
} from "../../../../prisma/generated/client";
