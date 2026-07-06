// Schéma de validation du formulaire public de dépôt d'avis (/avis/deposer).
//
// Règles clés :
// - `comment` min 120 caractères → garantit des fiches `/avis/[slug]` NON thin
//   (chaque avis publié a un contenu substantiel, éligible à l'indexation).
// - `lastName` sert UNIQUEMENT à dériver l'initiale publique ; le nom complet
//   n'est jamais persisté (minimisation RGPD).
// - `rating` coercé entier 1..5 (contrainte DB CHECK en défense supplémentaire).

import { z } from "zod";
import { isServiceLine } from "@/lib/reviews/service-lines";

const optStr = (max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(max).optional());

export const REVIEW_COMMENT_MIN = 120;
export const REVIEW_COMMENT_MAX = 1500;

export const reviewSubmissionSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  /** Nom complet — utilisé seulement pour dériver l'initiale, jamais persisté. */
  lastName: z.string().trim().min(1).max(80),
  /** Email — jamais public ; chiffré au repos (vérification + accusé + contact RGPD). */
  email: z.string().trim().email().max(180),
  companyName: optStr(200),
  /** Secteur client — slug ClientSectorSlug ou libellé libre (normalisé côté serveur). */
  clientSector: optStr(80),
  city: optStr(120),
  /** Service Axion-IA concerné (valeur d'enum ServiceSector) — optionnel. */
  serviceLine: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z
      .string()
      .refine((v) => isServiceLine(v), { message: "service inconnu" })
      .optional(),
  ),
  rating: z.coerce.number().int().min(1).max(5),
  title: optStr(160),
  comment: z.string().trim().min(REVIEW_COMMENT_MIN).max(REVIEW_COMMENT_MAX),
  /** "portrait" (par défaut) ou "logo" — décrit la photo optionnelle. */
  photoKind: z.preprocess(
    (v) => (v === "logo" ? "logo" : "portrait"),
    z.enum(["portrait", "logo"]),
  ),
});

export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;

/** Dérive l'initiale publique du nom de famille (ex. "Dupont" → "D."). */
export function deriveLastInitial(lastName: string): string {
  const first = lastName.trim().charAt(0).toUpperCase();
  return first ? `${first}.` : "";
}
