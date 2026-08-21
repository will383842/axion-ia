// Console éditoriale — la médiathèque (§3, critères 2 et 3 du lot 2).
//
// > « L'arbre d'un épisode affiche extraits, shorts et variantes sur trois
// >   niveaux. »
//
// Server Component : un arbre est une donnée, pas une interaction. Le déplier
// est un `<details>` natif — pas un état React, donc pas de JavaScript.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { urlPublique } from "@/server/editorial/stockage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const NATURES = ["source", "derive", "variante_plateforme", "autonome"] as const;

export default async function MediathequePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;
  const nature = NATURES.includes(sp.nature as (typeof NATURES)[number]) ? sp.nature : undefined;
  const statut = sp.statut;

  const assets = await prisma.edAsset.findMany({
    where: {
      ...(nature ? { nature: nature as never } : {}),
      ...(statut ? { statut: statut as never } : {}),
    },
    select: {
      id: true,
      libelle: true,
      type: true,
      nature: true,
      statut: true,
      cheminObjet: true,
      cheminVignette: true,
      dureeSec: true,
      largeurPx: true,
      hauteurPx: true,
      parentId: true,
      _count: { select: { enfants: true, publications: true } },
    },
    orderBy: [{ nature: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  // Les racines d'abord : ce sont elles qui portent un arbre.
  const racines = assets.filter((a) => a.parentId === null);

  function lien(patch: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ nature, statut, ...patch })) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `${base}/mediatheque?${qs}` : `${base}/mediatheque`;
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Médiathèque"
        description={`${assets.length} asset${assets.length > 1 ? "s" : ""}${
          racines.length > 0 ? ` · ${racines.length} sans parent` : ""
        }.`}
      />

      <AdminCard>
        <nav
          aria-label="Filtrer par nature"
          className="mb-[var(--space-admin-4)] flex flex-wrap gap-1"
        >
          <Link
            href={lien({ nature: undefined })}
            aria-current={!nature ? "true" : undefined}
            className={
              !nature
                ? "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-accent)] px-3 py-1.5 text-[length:var(--text-admin-sm)] font-semibold text-white"
                : "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-hover)]"
            }
          >
            Tous
          </Link>
          {NATURES.map((n) => (
            <Link
              key={n}
              href={lien({ nature: n })}
              aria-current={n === nature ? "true" : undefined}
              className={
                n === nature
                  ? "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-accent)] px-3 py-1.5 text-[length:var(--text-admin-sm)] font-semibold text-white"
                  : "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-hover)]"
              }
            >
              {n.replace("_", " ")}
            </Link>
          ))}
        </nav>

        {assets.length === 0 ? (
          <AdminEmptyState
            title="La médiathèque est vide"
            description="Déposez un fichier depuis la fiche d'une publication : l'asset se crée, se lie, et sa vignette se génère en une action."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((a) => (
              <li
                key={a.id}
                className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
              >
                <Link href={`${base}/mediatheque/${a.id}`} className="block hover:underline">
                  <div className="flex items-center gap-2">
                    {a.cheminVignette ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={urlPublique(a.cheminVignette)}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-[var(--radius-admin-sm)] object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-surface-hover)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                      >
                        {a.type.slice(0, 3)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.libelle}</span>
                      <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {a.nature.replace("_", " ")}
                        {a._count.enfants > 0 && ` · ${a._count.enfants} dérivé(s)`}
                        {a._count.publications > 0 && ` · ${a._count.publications} publication(s)`}
                      </span>
                    </span>
                  </div>
                </Link>
                <div className="mt-2 flex flex-wrap gap-1">
                  <AdminBadge tone="neutral">{a.type}</AdminBadge>
                  <AdminBadge tone={a.statut === "pret" ? "success" : "warning"}>
                    {a.statut}
                  </AdminBadge>
                  {a.largeurPx && a.hauteurPx && (
                    <AdminBadge tone="neutral">
                      {a.largeurPx}×{a.hauteurPx}
                    </AdminBadge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
