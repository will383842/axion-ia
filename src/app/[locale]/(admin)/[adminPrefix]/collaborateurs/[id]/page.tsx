/** Admin — modifier une fiche collaborateur, publier ou dépublier, lire le journal. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { CollaborateurForm } from "@/components/admin/collaborateurs/CollaborateurForm";
import { ficheInitiale } from "@/components/admin/collaborateurs/fiche-initiale";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
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
  const login = `/${locale}/${adminPrefix}/login`;
  const acces = await gardeLectureEchanges(
    login,
    () => "Les fiches collaborateurs sont réservées aux administrateurs.",
  );
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
  const initial = ficheInitiale(m);
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
