/**
 * Admin — fiches collaborateurs (pages publiques de l'équipe) : liste, filtres, interrupteur carte.
 * Réservé aux administrateurs. Server Component, force-dynamic, noindex.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { PointCarteSwitch } from "@/components/admin/collaborateurs/PointCarteSwitch";
import { gardePageCollaborateurs } from "@/server/equipe-garde-page";
import { prisma } from "@/lib/prisma";
import {
  TEAM_CATEGORIES,
  TEAM_STATUSES,
  estCategorieEquipe,
  estStatutEquipe,
  evaluerIndexabilite,
} from "@/lib/equipe/donnees";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Collaborateurs | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ categorie?: string; statut?: string }>;
}

const LIBELLE_STATUT: Record<string, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  publie: "Publié",
  retire: "Retiré",
};

export default async function CollaborateursPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePageCollaborateurs(`/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const sp = await searchParams;
  const categorie = estCategorieEquipe(sp.categorie) ? sp.categorie : undefined;
  const statut = estStatutEquipe(sp.statut) ? sp.statut : undefined;
  const base = `/${locale}/${adminPrefix}/collaborateurs`;

  let membres: Awaited<ReturnType<typeof lire>> | null = null;
  let aValider = 0;
  try {
    membres = await lire(categorie, statut);
    aValider = await prisma.teamMember.count({ where: { status: "a_valider" } });
  } catch {
    membres = null; // table absente (migration en attente) : dit plus bas.
  }

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Collaborateurs"
        description="Fiches publiques de l'équipe. Une fiche ne se publie qu'avec l'accord de la personne."
        actions={<AdminButton href={`${base}/nouveau`}>Nouvelle fiche</AdminButton>}
      />
      <p className="mb-4">
        À valider : <strong>{aValider}</strong>
      </p>
      <form method="get" className="mb-4 flex flex-wrap gap-3">
        <select name="categorie" defaultValue={categorie ?? ""} aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {TEAM_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.pluriel}
            </option>
          ))}
        </select>
        <select name="statut" defaultValue={statut ?? ""} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {TEAM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LIBELLE_STATUT[s]}
            </option>
          ))}
        </select>
        <AdminButton type="submit" variant="secondary">
          Filtrer
        </AdminButton>
      </form>
      {membres === null ? (
        <p>Indisponible (migration en attente ?).</p>
      ) : membres.length === 0 ? (
        <p>Aucune fiche pour ces filtres.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Prénom</th>
              <th>Catégorie</th>
              <th>Lieu</th>
              <th>Statut</th>
              <th>Indexation</th>
              <th>Carte</th>
              <th>Publiée le</th>
            </tr>
          </thead>
          <tbody>
            {membres.map((m) => {
              const idx = evaluerIndexabilite({
                ...m,
                photoConsentAt: m.photoConsentAt,
              });
              return (
                <tr key={m.id}>
                  <td>
                    <Link className="underline" href={`${base}/${m.id}`}>
                      {m.firstName}
                    </Link>
                  </td>
                  <td>
                    {TEAM_CATEGORIES.find((c) => c.slug === m.category)?.singulier ?? m.category}
                  </td>
                  <td>{m.locationLabel ?? "—"}</td>
                  <td>
                    <AdminBadge tone={m.status === "publie" ? "success" : "neutral"}>
                      {LIBELLE_STATUT[m.status] ?? m.status}
                    </AdminBadge>
                  </td>
                  <td>
                    <span title={idx.manque.join(" ; ")}>
                      <AdminBadge tone={idx.indexable ? "success" : "warning"}>
                        {idx.indexable ? "Indexable" : "noindex"}
                      </AdminBadge>
                    </span>
                  </td>
                  <td>
                    <PointCarteSwitch
                      id={m.id}
                      actif={m.showOnMap}
                      possible={m.latitude !== null}
                      version={m.updatedAt.toISOString()}
                    />
                  </td>
                  <td>{m.publishedAt ? m.publishedAt.toISOString().slice(0, 10) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AdminPageShell>
  );
}

function lire(categorie: string | undefined, statut: string | undefined) {
  return prisma.teamMember.findMany({
    where: { ...(categorie ? { category: categorie } : {}), ...(statut ? { status: statut } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      firstName: true,
      category: true,
      status: true,
      locationLabel: true,
      showOnMap: true,
      latitude: true,
      publishedAt: true,
      updatedAt: true,
      questionnaireVersion: true,
      photoKind: true,
      photoConsentAt: true,
      photoUrl256: true,
      bioMd: true,
      skills: true,
      languages: true,
      categoryAnswers: true,
      linkedinUrl: true,
      linkedinConsentAt: true,
      websiteUrl: true,
    },
  });
}
