// Form schemas — schemas restants après unification (2026-05-24).
//
// Les schemas contact/audit/auditRequest/implementation/quoteRequest et
// intervention ont été consolidés dans `unified-contact-schema.ts`. Voir
// _AUDIT/FORMS-UNIFICATION-2026-05-24/.
//
// Schemas restants :
//   - newsletterSchema : NewsletterForm + double opt-in (RFC 8058)
//   - bookingSchema : BookingForm (acte transactionnel /reserver)
//   - option48hSchema : option calendrier 48h (Booking V1)

import { z } from "zod";

import { interventionSlugSchema } from "@/lib/intervention-type";

// Shared field validators
const email = z.string().email("Email invalide.");
const required = z.string().min(2, "Champ requis.");

// Newsletter (single-step)
export const newsletterSchema = z.object({
  email,
  consent: z.literal(true, { errorMap: () => ({ message: "Consentement requis." }) }),
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;

// Booking (intervention) — Sprint 15 fix Fork 2 C2-2 : ajout interventionType
// + participantsCount (lus brut hors safeParse auparavant — risque NaN).
export const bookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  contact: required,
  email,
  phone: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Consentement requis." }) }),
  interventionType: interventionSlugSchema,
  participantsCount: z.coerce.number().int().min(1, "Au moins 1 participant.").max(500),
});
export type BookingInput = z.infer<typeof bookingSchema>;

// Option 48h — Sprint 15 fix Fork 2 C3-2 : avant, validation manuelle a la
// main, aucun consent RGPD obligatoire. Ce schema couvre les 8 champs Prisma
// BookingOption + le consent affichage secteur (RGPD art. 6 + 7).
export const option48hSchema = z.object({
  slotId: z.string().uuid(),
  companyName: z.string().min(2, "Nom societe requis."),
  companySector: z.string().min(2, "Secteur requis."),
  participantsCount: z.coerce.number().int().min(1).max(500),
  interventionType: interventionSlugSchema,
  contactName: required,
  contactEmail: email,
  contactPhone: z.string().min(6, "Telephone requis."),
  /** Consentement RGPD affichage secteur sur calendrier public. */
  consentDisplay: z
    .union([z.literal(true), z.literal(false)])
    .or(z.string().transform((v) => v === "true" || v === "on")),
  /** Consentement traitement donnees (CGU). */
  consent: z.literal(true, {
    errorMap: () => ({ message: "Consentement requis." }),
  }),
});
export type Option48hInput = z.infer<typeof option48hSchema>;
