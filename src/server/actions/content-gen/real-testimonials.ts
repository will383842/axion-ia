/**
 * Real Testimonials (Sprint v7 Phase 15).
 *
 * Distinction stratégique entre testimonials "réels" (validés humain + source
 * vérifiable + consentement RGPD) et testimonials "génériques" (légalement
 * acceptables mais sans source identifiée).
 *
 * Le modèle Prisma `Testimonial` (existant V1) stocke les deux indistinctement.
 * Phase 15 introduit le concept `isRealTestimonial` via :
 *   - tag dans `displayPages` JSON : `{ isReal: true, source: "https://...", consentDate: "..." }`
 *   - Helper `markAsRealTestimonial(id, source, consentDate)` pour flagger
 *   - Helper `getRealTestimonialsOnly()` pour filtrage page Press hub
 *
 * V1 sans witness DB dédié : on garde le storage minimaliste via metadata
 * JSON sur le model existant pour ne pas multiplier les migrations Prisma.
 * Migration vers col dédié si besoin émerge en Phase 16+.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWriteRateLimited } from "./_auth";

const RealTestimonialMetadataSchema = z
  .object({
    isReal: z.literal(true),
    source: z.string().url().max(500),
    consentDate: z.string().datetime(),
    verifiedBy: z.string().min(2).max(120).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export type RealTestimonialMetadata = z.infer<typeof RealTestimonialMetadataSchema>;

/**
 * Flagge un testimonial comme "réel" en injectant les metadata RGPD dans
 * `displayPages.realMeta`. Idempotent — réécrit si déjà marqué.
 */
export async function markAsRealTestimonial(
  testimonialId: string,
  meta: Omit<RealTestimonialMetadata, "isReal">,
): Promise<void> {
  const session = await requireAdminWriteRateLimited(`markAsRealTestimonial:${testimonialId}`, {
    limit: 30,
  });
  const parsed = RealTestimonialMetadataSchema.parse({ ...meta, isReal: true });

  try {
    const existing = await prisma.testimonial.findUnique({ where: { id: testimonialId } });
    if (!existing) throw new Error("testimonial_not_found");

    const prevDisplay =
      typeof existing.displayPages === "object" && existing.displayPages !== null
        ? (existing.displayPages as Record<string, unknown>)
        : {};

    await prisma.testimonial.update({
      where: { id: testimonialId },
      data: {
        displayPages: {
          ...prevDisplay,
          realMeta: parsed,
        },
      },
    });
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/testimonials`);
    revalidatePath("/fr/presse");
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "markAsRealTestimonial" },
      extra: { adminUserId: session.userId, testimonialId },
    });
    throw e;
  }
}

/**
 * Filtre côté serveur : retourne uniquement les testimonials marqués `isReal`.
 * Utilisé par la page publique `/presse` (Press hub) + admin filtres.
 *
 * Build-time stub-aware (DATABASE_URL=stub.invalid → [] sans call DB).
 */
export async function getRealTestimonialsOnly(): Promise<
  ReadonlyArray<{
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly role: string | null;
    readonly company: string | null;
    readonly shortQuoteFr: string;
    readonly photoUrl: string | null;
    readonly realMeta: RealTestimonialMetadata;
  }>
> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];

  const rows = await prisma.testimonial.findMany({
    where: { status: "published" },
    orderBy: { displayOrder: "asc" },
  });

  const reals: ReadonlyArray<{
    id: string;
    firstName: string;
    lastName: string;
    role: string | null;
    company: string | null;
    shortQuoteFr: string;
    photoUrl: string | null;
    realMeta: RealTestimonialMetadata;
  }> = rows
    .map((row) => {
      const display =
        typeof row.displayPages === "object" && row.displayPages !== null
          ? (row.displayPages as Record<string, unknown>)
          : {};
      const realMeta = display["realMeta"] as RealTestimonialMetadata | undefined;
      if (!realMeta?.isReal) return null;
      return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        company: row.company,
        shortQuoteFr: row.shortQuoteFr,
        photoUrl: row.photoUrl,
        realMeta,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return reals;
}
