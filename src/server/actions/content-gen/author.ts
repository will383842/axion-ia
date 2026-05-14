/**
 * Content Generator — CRUD AuthorProfile (admin /author/manon).
 *
 * § 12.1bis master prompt + § 9.8 doctrine v2.1 (Option A : IA disclosed, zéro
 * réseau social pour Manon). 1 row par défaut `slug="manon"` seed Sprint 1.
 *
 * V1 : Will édite nom, jobTitle, bio markdown, photoAlt, disclaimer. Le format
 * JSON-LD Person est reconstruit à chaque save par `buildPersonManonJsonLd()`
 * qui lit cette table (cf. `src/lib/seo-content-gen-factories.ts`).
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./_auth";

export interface AuthorRow {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly jobTitle: string;
  readonly bioMd: string;
  readonly photoUrl80: string;
  readonly photoUrl256: string;
  readonly photoUrl1024: string;
  readonly photoAlt: string | null;
  readonly aiGenerated: boolean;
  readonly linkedinUrl: string | null;
  readonly twitterHandle: string | null;
  readonly alumniOf: string | null;
  readonly awards: ReadonlyArray<string>;
  readonly knowsAbout: ReadonlyArray<string>;
  readonly isPersona: boolean;
  readonly personaDisclaimer: string | null;
  readonly isActive: boolean;
  readonly updatedAt: Date;
}

export async function getAuthor(slug: string): Promise<AuthorRow | null> {
  const r = await prisma.authorProfile.findUnique({ where: { slug } });
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    jobTitle: r.jobTitle,
    bioMd: r.bioMd,
    photoUrl80: r.photoUrl80,
    photoUrl256: r.photoUrl256,
    photoUrl1024: r.photoUrl1024,
    photoAlt: r.photoAlt,
    aiGenerated: r.aiGenerated,
    linkedinUrl: r.linkedinUrl,
    twitterHandle: r.twitterHandle,
    alumniOf: r.alumniOf,
    awards: r.awards,
    knowsAbout: r.knowsAbout,
    isPersona: r.isPersona,
    personaDisclaimer: r.personaDisclaimer,
    isActive: r.isActive,
    updatedAt: r.updatedAt,
  };
}

export interface UpdateAuthorInput {
  readonly slug: string;
  readonly displayName: string;
  readonly jobTitle: string;
  readonly bioMd: string;
  readonly photoAlt?: string;
  readonly aiGenerated: boolean;
  readonly linkedinUrl?: string;
  readonly knowsAbout?: ReadonlyArray<string>;
  readonly isPersona: boolean;
  readonly personaDisclaimer?: string;
}

export async function updateAuthor(input: UpdateAuthorInput): Promise<void> {
  await requireAdmin();
  if (input.displayName.length < 2 || input.displayName.length > 80)
    throw new Error("display_name_length");
  if (input.jobTitle.length < 2 || input.jobTitle.length > 120) throw new Error("job_title_length");
  if (input.bioMd.length > 20_000) throw new Error("bio_too_long");
  if (input.slug === "manon" && input.isPersona && !input.personaDisclaimer) {
    throw new Error("persona_disclaimer_required");
  }
  await prisma.authorProfile.update({
    where: { slug: input.slug },
    data: {
      displayName: input.displayName,
      jobTitle: input.jobTitle,
      bioMd: input.bioMd,
      photoAlt: input.photoAlt ?? null,
      aiGenerated: input.aiGenerated,
      linkedinUrl: input.linkedinUrl?.trim() || null,
      knowsAbout: input.knowsAbout ? [...input.knowsAbout] : [],
      isPersona: input.isPersona,
      personaDisclaimer: input.personaDisclaimer?.trim() || null,
    },
  });
  const adminBase = `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/author/${input.slug}`;
  revalidatePath(adminBase);
  revalidatePath(`/fr/equipe/${input.slug}`);
}
