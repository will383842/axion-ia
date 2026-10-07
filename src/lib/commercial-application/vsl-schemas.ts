// Schémas de validation du tunnel apporteurs avec vidéo — SERVEUR SEULEMENT
// (2026-10-05).
//
// 🔴 Ne jamais importer ce fichier depuis un composant client : il tire zod. La
// page et le formulaire valident côté navigateur avec de simples fonctions
// (`vsl-apporteur.ts`, sans dépendance).

import { z } from "zod";
import { VSL_REPONSE_IDS } from "./vsl-apporteur";

/** Un téléphone plausible : même règle que le formulaire court. */
const TELEPHONE_RE = /^\+?[\d\s().-]{6,}$/;

/**
 * Contexte posté par le navigateur. Jamais fiable : chaque champ est BORNÉ, le
 * serveur ne l'utilise que pour l'attribution, jamais pour décider.
 */
export const vslContexteSchema = z
  .object({
    /** `location.search` brut à l'arrivée (utm_*, fbclid). */
    query: z.string().max(2000),
    /** Cookie `_fbp` — n'existe que si le visiteur a consenti. */
    fbp: z
      .string()
      .regex(/^fb\.1\.\d{6,20}\.\d{1,25}$/)
      .optional(),
    referrer: z.string().max(300).optional(),
    /** Identifiant de clic Meta, gardé par le navigateur seulement avec consentement. */
    fbclid: z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,255}$/)
      .optional(),
    /** Heure d'ARRIVÉE du clic (ms) : sert à fabriquer un `fbc` correct. */
    fbclidAt: z.number().int().positive().optional(),
    /** Heure d'AFFICHAGE de la page (ms) : base du délai minimal anti-robot. */
    renderedAt: z.number().int().positive(),
  })
  .strict();

export const capturerLeadVslSchema = z
  .object({
    prenom: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(180),
    /** `literal(true)` : une capture sans accord n'existe pas (RGPD art. 4.11). */
    consent: z.literal(true),
    /** Réponse à la bannière (pixel) : décide seule de l'envoi à Meta. */
    consentPub: z.boolean().optional(),
    honeypot: z.string().max(200).optional(),
    ctx: vslContexteSchema,
  })
  .strict();

export const completerLeadVslSchema = z
  .object({
    jeton: z.string().min(10).max(1500),
    telephone: z.string().trim().min(6).max(40).regex(TELEPHONE_RE),
    reponseId: z.string().refine((v) => VSL_REPONSE_IDS.includes(v)),
    consent: z.literal(true),
  })
  .strict();

export type CapturerLeadVslParsed = z.infer<typeof capturerLeadVslSchema>;
export type CompleterLeadVslParsed = z.infer<typeof completerLeadVslSchema>;
