/** Admin — modifier une fiche collaborateur, publier ou dépublier, lire le journal. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import {
  CollaborateurForm,
  type FicheInitiale,
} from "@/components/admin/collaborateurs/CollaborateurForm";
import { gardePageCollaborateurs } from "@/server/equipe-garde-page";
import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/equipe/console/schemas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Fiche collaborateur | Axion-IA Admin",
  robots: { index: false, follow: false },
};

export default async function CollaborateurPage({
  params,
}: {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePageCollaborateurs(`/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!idSchema.safeParse(id).success) notFound();
  const m = await prisma.teamMember.findUnique({ where: { id } });
  if (!m) notFound();
  const journal = await prisma.teamMemberEvent.findMany({
    where: { memberId: m.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, action: true, actor: true, createdAt: true },
  });
  const initial: FicheInitiale = {
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
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader title={`Fiche : ${m.firstName}`} description={`Statut : ${m.status}`} />
      <CollaborateurForm key={initial.version} initial={initial} />
      <section className="mt-8" aria-label="Journal">
        <h2 className="text-lg font-semibold">Journal</h2>
        <ul className="mt-2 space-y-1">
          {journal.map((e) => (
            <li key={e.id}>
              {e.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {e.action} · {e.actor}
            </li>
          ))}
        </ul>
      </section>
    </AdminPageShell>
  );
}
