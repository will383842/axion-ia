// Console éditoriale — la liste des publications (§3).
//
// Server Component, filtres par querystring : zéro JavaScript client, comme
// le calendrier. La recherche est un `<form method="get">` — un formulaire
// HTML natif suffit, et il fonctionne même si le JavaScript ne charge pas.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui";
import { listerPublications } from "@/server/editorial/publication-queries";
import { estFiltreIdentite } from "@/server/editorial/calendrier-pur";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUTS = ["idee", "redige", "valide"] as const;

export default async function PublicationsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale`;
  const identite = estFiltreIdentite(sp.identite);
  const statut = STATUTS.includes(sp.statut as (typeof STATUTS)[number])
    ? (sp.statut as string)
    : undefined;
  const recherche = (sp.q ?? "").trim() || undefined;

  const lignes = await listerPublications({
    identite,
    ...(statut ? { statutRedaction: statut } : {}),
    ...(recherche ? { recherche } : {}),
  });

  function lien(patch: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const courant = { identite, statut, q: recherche, ...patch };
    for (const [k, v] of Object.entries(courant)) {
      if (v && v !== "toutes") p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `${base}/publications?${qs}` : `${base}/publications`;
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Publications"
        description={`${lignes.length} publication${lignes.length > 1 ? "s" : ""}${
          recherche ? ` pour « ${recherche} »` : ""
        }.`}
        actions={
          <AdminButton href={`${base}/calendrier`} variant="ghost" size="sm">
            Voir au calendrier
          </AdminButton>
        }
      />

      <AdminCard>
        {/* Recherche — formulaire GET natif, sans JavaScript. */}
        <form method="get" className="mb-[var(--space-admin-4)] flex flex-wrap gap-2">
          {identite !== "toutes" && <input type="hidden" name="identite" value={identite} />}
          {statut && <input type="hidden" name="statut" value={statut} />}
          <label htmlFor="q" className="sr-only">
            Rechercher dans les publications
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={recherche ?? ""}
            placeholder="Un mot du titre, de l'accroche ou du corps…"
            className="admin-input min-w-0 flex-1"
          />
          <button type="submit" className="admin-button admin-button-sm">
            Rechercher
          </button>
          {recherche && (
            <Link href={lien({ q: undefined })} className="admin-button-ghost admin-button-sm">
              Effacer
            </Link>
          )}
        </form>

        {/* Filtres — des liens, pas d'état client. */}
        <div className="mb-[var(--space-admin-4)] flex flex-wrap items-center gap-4">
          <nav aria-label="Filtrer par identité" className="flex items-center gap-1">
            {(["toutes", "perso", "pro"] as const).map((v) => (
              <Link
                key={v}
                href={lien({ identite: v })}
                aria-current={v === identite ? "true" : undefined}
                className={
                  v === identite
                    ? "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-accent)] px-3 py-1.5 text-[length:var(--text-admin-sm)] font-semibold text-white"
                    : "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-hover)]"
                }
              >
                {v === "toutes" ? "Toutes" : v === "perso" ? "Personnel" : "Professionnel"}
              </Link>
            ))}
          </nav>

          <nav aria-label="Filtrer par statut de rédaction" className="flex items-center gap-1">
            <Link
              href={lien({ statut: undefined })}
              aria-current={!statut ? "true" : undefined}
              className={
                !statut
                  ? "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-accent)] px-3 py-1.5 text-[length:var(--text-admin-sm)] font-semibold text-white"
                  : "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-hover)]"
              }
            >
              Tous statuts
            </Link>
            {STATUTS.map((s) => (
              <Link
                key={s}
                href={lien({ statut: s })}
                aria-current={s === statut ? "true" : undefined}
                className={
                  s === statut
                    ? "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-accent)] px-3 py-1.5 text-[length:var(--text-admin-sm)] font-semibold text-white"
                    : "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-hover)]"
                }
              >
                {s}
              </Link>
            ))}
          </nav>
        </div>

        {lignes.length === 0 ? (
          <AdminEmptyState
            title={recherche ? `Aucun résultat pour « ${recherche} »` : "Aucune publication"}
            description={
              recherche
                ? "Essayez un autre mot, ou effacez la recherche pour retrouver tout le dossier."
                : "Importez le dossier du trimestre avec « pnpm editorial:import », ou créez une publication depuis le calendrier."
            }
            secondaryAction={
              recherche ? (
                <AdminButton href={lien({ q: undefined })} variant="ghost" size="sm">
                  Effacer la recherche
                </AdminButton>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {lignes.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                      {p.dayKey.split("-").reverse().join("/")} · {p.heurePrevue}
                    </span>
                    <Link
                      href={`${base}/publications/${p.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {p.titreInterne}
                    </Link>
                  </div>
                  <div className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                    {p.compteLibelle}
                    {p.estReprise && " · reprise"}
                    {p.versionCourante > 1 && ` · v${p.versionCourante}`}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <AdminBadge tone={p.identite === "pro" ? "info" : "neutral"}>
                    {p.identite}
                  </AdminBadge>
                  <AdminBadge tone={p.statutRedaction === "valide" ? "success" : "warning"}>
                    {p.statutRedaction}
                  </AdminBadge>
                  {/* Le kit à un clic depuis la liste : c'est lui qu'on vient
                      chercher le matin, pas la fiche. */}
                  <AdminButton href={`${base}/publications/${p.id}/kit`} variant="ghost" size="sm">
                    Kit
                  </AdminButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
