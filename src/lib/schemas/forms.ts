import { z } from "zod";

import { interventionSlugSchema } from "@/lib/intervention-type";

// Shared field validators
const email = z.string().email("Email invalide.");
const required = z.string().min(2, "Champ requis.");

// Contact (single-step)
export const contactSchema = z.object({
  name: required,
  email,
  company: z.string().optional(),
  message: z.string().min(20, "Au moins 20 caractères."),
  consent: z.literal(true, { errorMap: () => ({ message: "Consentement requis." }) }),
});
export type ContactInput = z.infer<typeof contactSchema>;

// Newsletter (single-step)
export const newsletterSchema = z.object({
  email,
  consent: z.literal(true, { errorMap: () => ({ message: "Consentement requis." }) }),
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;

// Audit — 5 steps
export const auditStep1Schema = z.object({
  size: z.enum(["tpe", "pme", "mid", "enterprise"], {
    errorMap: () => ({ message: "Taille requise." }),
  }),
});
export const auditStep2Schema = z.object({
  modality: z.enum(["remote", "onsite"]),
});
export const auditStep3Schema = z.object({
  industry: z.string().min(2),
  goals: z.string().min(20),
});
export const auditStep4Schema = z.object({
  contact: required,
  email,
  phone: z.string().optional(),
  /** Sprint 15 fix Fork 2 C4-2 : raison sociale separee du contact name. */
  companyName: z.string().optional(),
});
export const auditStep5Schema = z.object({
  consent: z.literal(true, { errorMap: () => ({ message: "Consentement requis." }) }),
});
export const auditSchema = auditStep1Schema
  .merge(auditStep2Schema)
  .merge(auditStep3Schema)
  .merge(auditStep4Schema)
  .merge(auditStep5Schema);
export type AuditInput = z.infer<typeof auditSchema>;

// Audit request — 6 steps (richer form for /audit/demande, 2026-05-07).
// Capture le type d'audit, la taille + secteur, la modalité + lieu, le
// périmètre + maturité IA, le contact et le consentement.
export const auditRequestStep1Schema = z.object({
  // Sprint 14.10.8 (Will 2026-05-12) — rename "process" → "cible" (aligné
  // sur pricing.ts AUDIT_TIERS id "audit-cible"). Pas de migration DB
  // (auditType n'est pas un enum Postgres, stocké en string).
  auditType: z.enum(["flash", "cible", "strategique-pme", "strategique-eti"], {
    errorMap: () => ({ message: "Niveau d'audit requis." }),
  }),
});
export const auditRequestStep2Schema = z.object({
  size: z.enum(["tpe", "pme", "mid", "enterprise"], {
    errorMap: () => ({ message: "Taille requise." }),
  }),
  industry: z.string().min(2, "Secteur requis."),
  companyName: z.string().optional(),
});
export const auditRequestStep3Schema = z.object({
  modality: z.enum(["remote", "onsite"], {
    errorMap: () => ({ message: "Modalité requise." }),
  }),
  city: z.string().min(2, "Ville requise."),
  country: z.string().min(2, "Pays requis."),
});
export const auditRequestStep4Schema = z.object({
  scope: z.enum(["global", "single-area"], {
    errorMap: () => ({ message: "Périmètre requis." }),
  }),
  scopeDetail: z.string().min(20, "Au moins 20 caractères pour décrire le périmètre."),
  maturity: z.enum(["zero", "starting", "mature"], {
    errorMap: () => ({ message: "Maturité requise." }),
  }),
  goals: z.string().min(20, "Au moins 20 caractères."),
  /** Outils utilisés — multi-select avec liste prédéfinie + free text.
      Optionnel : aide à contextualiser le devis sans bloquer la conversion. */
  tools: z.array(z.string()).optional(),
  toolsOther: z.string().optional(),
});
export const auditRequestStep5Schema = z.object({
  contact: required,
  email,
  phone: z.string().optional(),
  role: z.string().optional(),
});
export const auditRequestStep6Schema = z.object({
  consent: z.literal(true, { errorMap: () => ({ message: "Consentement requis." }) }),
});
export const auditRequestSchema = auditRequestStep1Schema
  .merge(auditRequestStep2Schema)
  .merge(auditRequestStep3Schema)
  .merge(auditRequestStep4Schema)
  .merge(auditRequestStep5Schema)
  .merge(auditRequestStep6Schema);
export type AuditRequestInput = z.infer<typeof auditRequestSchema>;

// Implementation — 4 steps (Sprint 17 finalize)
export const implementationStep1Schema = z.object({
  type: z.enum([
    "chatbot",
    "processus",
    "structuration",
    "crm-erp",
    "documents",
    "agents",
    "integrations",
    "no-code",
    "ia-custom",
  ]),
});
export const implementationStep2Schema = z.object({
  budget: z.enum(["lt-5k", "5-15k", "15-50k", "gt-50k"]),
});
export const implementationStep3Schema = z.object({
  description: z.string().min(40),
});
export const implementationStep4Schema = z.object({
  contact: required,
  email,
  consent: z.literal(true),
});
export const implementationSchema = implementationStep1Schema
  .merge(implementationStep2Schema)
  .merge(implementationStep3Schema)
  .merge(implementationStep4Schema);

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
export type ImplementationInput = z.infer<typeof implementationSchema>;

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

// ============================================================
// Sprint X.5bis — Parcours B (demande devis qualifiée)
// ============================================================

/**
 * Form qualifié 10 champs. AUCUN slot calendrier réservé (D45).
 * Submission.type='quote_request', status='new' → pipeline qualifying → negotiating
 * → converted | lost.
 * Cf. 04-PLAN-EXECUTION Sprint X.5bis.
 */
export const quoteRequestSchema = z.object({
  // -- Entreprise
  companyName: z.string().min(2, "Raison sociale requise.").max(255),
  companySize: z.enum(["tpe", "pme", "eti", "grande_entreprise"], {
    errorMap: () => ({ message: "Taille INSEE requise." }),
  }),
  companySector: z.string().min(2, "Secteur requis.").max(100),
  // -- Contact
  contactName: required,
  contactEmail: email,
  contactPhone: z.string().min(6, "Téléphone requis.").max(30),
  // -- Format souhaité (slug interventions-taxonomy.ts, optionnel pour parcours B
  // typique où le client demande une variante sur-mesure pas catalogue).
  interventionSlug: z.string().max(80).optional(),
  // -- Contexte business (validation min 200 chars - éviter spam et qualifier)
  contextBusiness: z
    .string()
    .min(200, "Décrivez votre contexte (au moins 200 caractères).")
    .max(5000, "5 000 caractères maximum."),
  // -- Budget pressenti (optionnel)
  budgetIndicative: z.string().max(80).optional(),
  // -- Timing en semaines
  timingWeeks: z
    .union([z.literal("0-4"), z.literal("4-8"), z.literal("8-12"), z.literal("12+")])
    .optional(),
  // -- Lieu
  city: z.string().min(2, "Ville requise.").max(120),
  willingToTravel: z.coerce.boolean().optional(),
  // -- Effectif estimé
  participantsEstimate: z.coerce.number().int().min(1).max(5000).optional(),
  // -- Consentements
  consentTerms: z.literal(true, { errorMap: () => ({ message: "Acceptation CGV requise." }) }),
  consentGdpr: z.literal(true, { errorMap: () => ({ message: "Consentement RGPD requis." }) }),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
