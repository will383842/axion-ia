/**
 * Validation (Zod) des fiches collaborateurs saisies dans la console. Pur : aucun accès base.
 *
 * Le serveur ne fait jamais confiance au navigateur pour le lieu : seul un `citySlug` ou un
 * `departmentCode` est accepté, les coordonnées sont recalculées côté serveur.
 */
import { z } from "zod";

import { TEAM_CATEGORY_SLUGS, estSlugReserve } from "../donnees";

export const SLUG_COLLABORATEUR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Note de preuve exigée quand un accord est saisi depuis la console (vérifiée dans l'action). */
export const NOTE_PREUVE_MIN = 10;

const texteCourt = (max: number) => z.string().trim().max(max);
const optionnel = (max: number) =>
  texteCourt(max)
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v));

/** Aucune balise HTML dans un texte affiché. */
const sansHtml = (v: string) => !/<\s*[a-z/!]/i.test(v);

const urlHttps = (max: number, domaine?: RegExp) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v))
    .refine(
      (v) => {
        if (v === null) return true;
        try {
          const u = new URL(v);
          return u.protocol === "https:" && (domaine ? domaine.test(u.hostname) : true);
        } catch {
          return false;
        }
      },
      { message: domaine ? "Adresse https du bon site attendue" : "Adresse https attendue" },
    );

const liste = (maxItems: number, maxLen: number) =>
  z
    .array(z.string().trim().min(1).max(maxLen).refine(sansHtml, "Pas de HTML"))
    .max(maxItems)
    .default([]);

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(SLUG_COLLABORATEUR, "Minuscules, chiffres et tirets seulement")
  .refine((s) => !estSlugReserve(s), "Ce slug est réservé");

const ficheBaseSchema = z
  .object({
    category: z.enum(TEAM_CATEGORY_SLUGS as unknown as [string, ...string[]]),
    firstName: z.string().trim().min(1).max(80).refine(sansHtml, "Pas de HTML"),
    organizationName: optionnel(160),
    jobTitle: z.string().trim().min(1).max(120).refine(sansHtml, "Pas de HTML"),
    headline: optionnel(200),
    bioMd: optionnel(2000),
    skills: liste(20, 60),
    languages: liste(10, 40),
    websiteUrl: urlHttps(512),
    linkedinUrl: urlHttps(512, /(^|\.)linkedin\.com$/i),
    /** Un lieu : une ville OU un département, jamais les deux, jamais d'adresse. */
    citySlug: optionnel(100),
    departmentCode: optionnel(3),
    showOnMap: z.boolean().default(false),
    /** Vide à la création : le serveur le propose. */
    slug: slugSchema.optional(),
    sortOrder: z.number().int().min(0).max(10000).default(100),
    consentPublication: z.boolean().default(false),
    consentLinkedin: z.boolean().default(false),
    consentNote: optionnel(2000),
  })
  .strict();

export const champsFicheSchema = ficheBaseSchema.superRefine((v, ctx) => {
  for (const cle of ["headline", "bioMd", "organizationName"] as const) {
    const val = v[cle];
    if (val !== null && !sansHtml(val)) {
      ctx.addIssue({ code: "custom", path: [cle], message: "Pas de HTML" });
    }
  }
  if (v.citySlug !== null && v.departmentCode !== null) {
    ctx.addIssue({ code: "custom", path: ["citySlug"], message: "Une ville OU un département" });
  }
  if (v.organizationName !== null && v.category !== "partenaire") {
    ctx.addIssue({
      code: "custom",
      path: ["organizationName"],
      message: "Nom de structure réservé à la catégorie partenaire",
    });
  }
});

export const identiteFicheSchema = ficheBaseSchema.pick({ category: true, firstName: true });

export type ChampsFiche = z.infer<typeof champsFicheSchema>;

export const idSchema = z.string().uuid();

/** Base d'un slug : « prénom-ville » (ou « prénom-département »), sans accents. */
export function baseSlug(parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Candidats dans l'ordre : base, base-catégorie, puis base-2, base-3… */
export function candidatsSlug(base: string, category: string, max = 20): string[] {
  const racine = base === "" ? "collaborateur" : base;
  const out = [racine, `${racine}-${category.replace(/_/g, "-")}`];
  for (let i = 2; out.length < max; i++) out.push(`${racine}-${i}`);
  return out.map((s) => s.slice(0, 120));
}
