import { z } from "zod";

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

// Booking (intervention)
export const bookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  contact: required,
  email,
  phone: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Consentement requis." }) }),
});
export type BookingInput = z.infer<typeof bookingSchema>;
export type ImplementationInput = z.infer<typeof implementationSchema>;
