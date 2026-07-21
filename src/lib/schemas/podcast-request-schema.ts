// Schéma de validation du formulaire public de demande de tournage podcast
// (`/podcast`). Décision Will 2026-07-21.
//
// Règles clés :
// - Formulaire de PRISE DE CONTACT, pas un questionnaire : 7 champs, tous courts
//   sauf `activity` (quelques mots libres, borné à 800 caractères).
// - `city` + `postalCode` sont OBLIGATOIRES : Axion-IA se déplace dans les locaux
//   du client, la faisabilité dépend directement de la localisation.
// - `phone` obligatoire (rappel dirigeant) — format volontairement permissif
//   (indicatifs internationaux, espaces, points, tirets, parenthèses).

import { z } from "zod";

export const PODCAST_ACTIVITY_MIN = 20;
export const PODCAST_ACTIVITY_MAX = 800;

/** Téléphone permissif : 8 à 20 caractères, chiffres + séparateurs usuels. */
const PHONE_RE = /^\+?[0-9][0-9\s.\-()]{6,19}$/;

/** Code postal FR (5 chiffres) ou international court (BE/CH/LU/MC…). */
const POSTAL_CODE_RE = /^[0-9A-Za-z][0-9A-Za-z\s-]{2,9}$/;

export const podcastRequestSchema = z.object({
  /** Raison sociale — sert de titre de la demande en console admin. */
  companyName: z.string().trim().min(2).max(200),
  /** Nom du dirigeant (prénom + nom, saisie libre). Chiffré au repos. */
  leaderName: z.string().trim().min(2).max(120),
  /** Email de contact. Chiffré au repos, jamais publié. */
  email: z.string().trim().email().max(180),
  /** Téléphone de rappel. Chiffré au repos. */
  phone: z.string().trim().min(8).max(30).regex(PHONE_RE, { message: "téléphone invalide" }),
  /** Ville du tournage (on se déplace). */
  city: z.string().trim().min(2).max(120),
  /** Code postal du tournage (on se déplace). */
  postalCode: z
    .string()
    .trim()
    .min(3)
    .max(10)
    .regex(POSTAL_CODE_RE, { message: "code postal invalide" }),
  /** Quelques mots sur l'activité de l'entreprise. */
  activity: z.string().trim().min(PODCAST_ACTIVITY_MIN).max(PODCAST_ACTIVITY_MAX),
});

export type PodcastRequestInput = z.infer<typeof podcastRequestSchema>;
