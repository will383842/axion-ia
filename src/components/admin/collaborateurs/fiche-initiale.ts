/** Fiche enregistrée → valeurs initiales du formulaire de la console. Pur : aucune lecture de base. */
import type { prisma } from "@/lib/prisma";

import type { FicheInitiale } from "./CollaborateurForm";

export function ficheInitiale(
  m: NonNullable<Awaited<ReturnType<typeof prisma.teamMember.findUnique>>>,
): FicheInitiale {
  return {
    id: m.id,
    version: m.updatedAt.toISOString(),
    status: m.status,
    publishedAt: m.publishedAt !== null,
    category: m.category,
    firstName: m.firstName,
    organizationName: m.organizationName ?? "",
    jobTitle: m.jobTitle,
    headline: m.headline ?? "",
    bioMd: m.bioMd ?? "",
    skills: m.skills.join(", "),
    languages: m.languages.join(", "),
    websiteUrl: m.websiteUrl ?? "",
    linkedinUrl: m.linkedinUrl ?? "",
    citySlug: m.citySlug ?? "",
    departmentCode: m.citySlug ? "" : (m.departmentCode ?? ""),
    locationLabel: m.locationLabel ?? "",
    showOnMap: m.showOnMap,
    slug: m.slug,
    sortOrder: m.sortOrder,
    consentPublication: m.publicationConsentAt !== null,
    consentLinkedin: m.linkedinConsentAt !== null,
    consentNote: "", // jamais pré-remplie : un nouvel accord exige une preuve nouvelle
    photoKind: m.photoKind,
    photoConsent: m.photoConsentAt !== null,
    photoUrl256: m.photoUrl256,
    questionnaireVersion: m.questionnaireVersion,
    categoryAnswers: m.categoryAnswers,
  };
}
