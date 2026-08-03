// Avis clients V2 — liste + modération (AdminPageShell + AdminTable + actions inline).

import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
  AdminFilterTabs,
  AdminButton,
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import type { AdminReview } from "@/features/admin-reviews/actions";
import { clientSectorLabel } from "@/content/sectors";
import { serviceLineLabel } from "@/lib/reviews/service-lines";
import { publishForm, hideForm } from "../actions-form";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  published: "Publié",
  hidden: "Masqué",
  rejected: "Rejeté",
  archived: "Archivé",
};
const STATUS_TONE: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  published: "success",
  pending: "warning",
  hidden: "neutral",
  rejected: "destructive",
  archived: "neutral",
};
const STATUS_TABS = ["pending", "published", "hidden", "rejected", "archived", "all"] as const;

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<AdminReview>;
  total: number;
  page: number;
  totalPages: number;
  counts: Record<string, number>;
}

export function AvisListV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
  counts,
}: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}/avis`;
  // Défaut aligné sur le schéma serveur (`actions.ts`) : `all`, et non
  // `pending` qui ouvrait la page sur le compartiment vide.
  const activeStatus = sp["status"] ?? "all";

  const columns: ReadonlyArray<AdminTableColumn<AdminReview>> = [
    {
      key: "author",
      header: "Auteur",
      cell: (r) => (
        <>
          <div className="flex items-center gap-2">
            <span>
              {r.authorFirstName} {r.authorLastInitial}
            </span>
            {r.isVerified ? <AdminBadge tone="success">Vérifié</AdminBadge> : null}
            {r.featured ? (
              <AdminBadge tone="neutral">
                <Star size={12} aria-hidden="true" className="mr-1 inline-block align-[-1px]" />
                Mis en avant
              </AdminBadge>
            ) : null}
          </div>
          <div className="admin-meta-small">
            {r.companyName ?? "—"}
            {r.clientSector ? ` · ${clientSectorLabel(r.clientSector)}` : ""}
            {r.cityName ? ` · ${r.cityName}` : ""}
          </div>
        </>
      ),
    },
    {
      key: "rating",
      header: "Note",
      // Le « ★ » collé au chiffre était un caractère de texte : sa graisse et sa
      // chasse dependaient de la police du poste, et il ne s alignait sur rien.
      cell: (r) => (
        <span className="inline-flex items-center gap-1 tabular-nums">
          {r.rating}/5
          <Star size={13} aria-hidden="true" className="shrink-0" />
        </span>
      ),
    },
    {
      key: "service",
      header: "Service",
      cell: (r) => (r.serviceLine ? serviceLineLabel(r.serviceLine) : "—"),
    },
    {
      key: "excerpt",
      header: "Avis",
      cell: (r) => (
        <span className="admin-meta-small" title={r.comment}>
          {r.comment.slice(0, 90)}
          {r.comment.length > 90 ? "…" : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Statut",
      cell: (r) => (
        <AdminBadge tone={STATUS_TONE[r.status] ?? "neutral"}>
          {STATUS_LABELS[r.status] ?? r.status}
        </AdminBadge>
      ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Avis clients"
        description={`${total} avis · page ${page}/${totalPages}`}
      />

      {/* Les boutons de modération rendaient `void` : un échec ne produisait
          rien à l'écran, exactement comme un succès. L'erreur revient
          maintenant dans l'URL (cf. `actions-form.ts`). */}
      {sp["erreur"] ? (
        <p role="alert" className="admin-alert admin-alert-error mb-[var(--space-admin-4)]">
          {sp["erreur"]}
        </p>
      ) : null}

      {/* 🔴 Ces six filtres étaient rendus en `admin-button` / `-ghost` : une
          rangée de boutons pleins et teintés, avec le poids visuel d'actions,
          pour ce qui est un choix unique et exclusif. C'est précisément le
          motif que la passe « filtres rétrogradés » du 2026-08-02 a corrigé
          ailleurs (facturation, dossiers, planning) — cette page avait été
          oubliée, vérifié à l'écran après déploiement. `AdminFilterTabs` rend
          un sélecteur segmenté, et affiche le compteur en pastille au lieu de
          « (77) » collé au libellé. */}
      <AdminFilterTabs
        className="mb-[var(--space-admin-4)]"
        current={activeStatus}
        options={STATUS_TABS.map((s) => ({
          value: s,
          label: s === "all" ? "Tous" : (STATUS_LABELS[s] ?? s),
          href: `${base}?status=${s}`,
          ...(s === "all" ? {} : { count: counts[s] ?? 0 }),
        }))}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <input type="hidden" name="status" value={activeStatus} />
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Recherche
              </label>
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
                placeholder="Auteur, société, ville, texte…"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button-secondary">
              Rechercher
            </button>
            <Link href={base} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucun avis pour ce filtre." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(r) => r.id}
          caption="Liste des avis clients"
          rowAction={(r) => (
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton
                href={`${base}/${r.id}`}
                variant="ghost"
                size="sm"
                iconAfter={ArrowRight}
              >
                Voir
              </AdminButton>
              {r.status !== "published" ? (
                <form action={publishForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button">
                    Publier
                  </button>
                </form>
              ) : (
                <form action={hideForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button-ghost">
                    Masquer
                  </button>
                </form>
              )}
            </div>
          )}
        />
      )}

      {/* 🔴 Le sous-titre annonçait « page 1/N » et la page N n'existait
          nulle part à l'écran : au-delà de la première, les lignes
          n'étaient atteignables qu'en éditant l'URL. Les filtres en cours
          sont reportés dans les liens — sinon changer de page les
          effacerait, et on repartirait d'une autre liste. */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={`/fr/${adminPrefix}/avis`}
        preservedParams={{
          status: sp["status"],
          search: sp["search"],
        }}
      />
    </AdminPageShell>
  );
}
