// Refonte admin mai 2026 — PR 11 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Users V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badges → <AdminBadge>. Le formulaire de filtres garde les classes
// utilitaires admin.css (legit — pas de composant filtre dédié).

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
  AdminButton,
  AdminEtatBooleen,
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { formatDateFrShort } from "@/lib/format-date-fr";
import {
  ROLES_ADMIN,
  LIBELLES_ROLE,
  DESCRIPTIONS_ROLE,
  libelleRole,
  tonaliteRole,
} from "@/features/admin-users/roles";

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
};
// Track 2 : tonalité des badges dérivée des enums (avant : `.admin-badge-${role}`
// / `.admin-badge-${status}` non définis → badge neutre non coloré).
//
// 🔴 `D6-2-M1` — les tables `ROLE_LABELS` et `ROLE_TONE` vivaient ICI, typées
// `Record<string, …>`, et ne connaissaient que quatre rôles sur six. Un compte
// « secrétaire » se serait affiché sous l'étiquette brute `secretaire`, badge
// gris, et n'aurait figuré dans AUCUNE option du filtre ci-dessous. Elles vivent
// désormais dans `features/admin-users/roles.ts`, typées sur `RoleAdmin` : un
// septième rôle casse la compilation tant qu'il n'a pas de libellé.
const STATUS_TONE: Record<string, "success" | "neutral"> = {
  active: "success",
  suspended: "neutral",
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<UserRow>;
  total: number;
  page: number;
  totalPages: number;
  isSuperAdmin: boolean;
}

export function UsersV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
  isSuperAdmin,
}: Props): React.ReactElement {
  const columns: ReadonlyArray<AdminTableColumn<UserRow>> = [
    { key: "name", header: "Nom", cell: (u) => u.name },
    { key: "email", header: "Email", cell: (u) => u.email },
    {
      key: "role",
      header: "Rôle",
      cell: (u) => <AdminBadge tone={tonaliteRole(u.role)}>{libelleRole(u.role)}</AdminBadge>,
    },
    {
      key: "status",
      header: "Statut",
      cell: (u) => (
        <AdminBadge tone={STATUS_TONE[u.status] ?? "neutral"}>
          {STATUS_LABELS[u.status] ?? u.status}
        </AdminBadge>
      ),
    },
    {
      key: "twoFactor",
      header: "2FA",
      cell: (u) => (
        <AdminEtatBooleen
          actif={u.twoFactorEnabled}
          libelles={{ vrai: "2FA activée", faux: "2FA désactivée" }}
        />
      ),
    },
    {
      key: "lastLogin",
      header: "Dernière connexion",
      cell: (u) => formatDateFrShort(u.lastLoginAt),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Utilisateurs admin"
        description={`${total} utilisateur${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          isSuperAdmin ? (
            <Link href={`/fr/${adminPrefix}/users/new`} className="admin-button">
              + Nouvel utilisateur
            </Link>
          ) : undefined
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <p className="admin-meta">
          {/* Le renvoi « (CLAUDE.md §15) » qui fermait cette phrase a été retiré
              le 2026-08-03 : c'est le nom d'un fichier de consignes du dépôt,
              affiché à l'écran d'un utilisateur qui n'y a pas accès et n'a
              aucune raison de savoir qu'il existe. La règle qu'il citait est
              déjà énoncée juste avant. */}
          {/* 🔴 Les quatre rôles étaient nommés en `snake_case` — `super_admin`,
              `editor`, `reader` — alors que le tableau juste en dessous les
              affiche « Super Admin », « Éditeur », « Lecteur ». Deux vocabulaires
              pour la même notion sur le même écran, et celui du haut est celui
              de la base de données. On emploie partout les noms affichés.
              « reset 2FA cross-user » devient une phrase française. */}
          {/* 🔴 `D6-2-M1` — cette phrase annonçait « Quatre rôles » et en énumérait
              quatre, écrits un à un, alors que le produit en portait six depuis
              cinq jours. Une énumération à la main est une septième recopie : elle
              vieillit en silence. Elle se dérive maintenant du SSOT. */}
          {ROLES_ADMIN.map((role, i) => (
            <span key={role}>
              {i > 0 ? " · " : ""}
              <strong>{LIBELLES_ROLE[role]}</strong> ({DESCRIPTIONS_ROLE[role]})
            </span>
          ))}
          . Seul le Super Admin crée un compte, change un rôle ou réinitialise la double
          authentification d&apos;un autre utilisateur.
          {/* 🔴 Cette phrase affirmait : « La double authentification est obligatoire
              pour les deux premiers. » C&apos;est FAUX, et ça l&apos;était déjà.
              `auth.ts` teste `requires2FA = user.twoFactorEnabled` — le flag du
              compte, et rien d&apos;autre. L&apos;imposition par rôle existe en
              commentaire (`_ROLES_REQUIRING_2FA`, préfixé et jamais lu) mais elle
              est DÉSACTIVÉE, pour permettre la première connexion.
              ⚠️ Une phrase d&apos;écran qui annonce une protection absente est pire
              qu&apos;un silence : elle dispense d&apos;aller vérifier. La colonne
              « 2FA » du tableau ci-dessous, elle, dit l&apos;état réel de chaque
              compte — c&apos;est vers elle qu&apos;on renvoie. */}{" "}
          La double authentification n&apos;est <strong>pas imposée</strong> : chaque titulaire
          l&apos;active depuis son profil. La colonne « 2FA » ci-dessous donne l&apos;état réel de
          chaque compte — un compte privilégié qui y figure comme inactif ne l&apos;est pas.
        </p>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="role" className="admin-label">
                Rôle
              </label>
              <select
                id="role"
                name="role"
                defaultValue={sp["role"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Tous</option>
                {ROLES_ADMIN.map((role) => (
                  <option key={role} value={role}>
                    {LIBELLES_ROLE[role]}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="status" className="admin-label">
                Statut
              </label>
              <select
                id="status"
                name="status"
                defaultValue={sp["status"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Tous</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Recherche (nom/email)
              </label>
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
                placeholder="Min 2 caractères"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button-secondary">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/users`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucun utilisateur trouvé." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(u) => u.id}
          caption="Liste des utilisateurs admin"
          rowAction={(u) => (
            <AdminButton
              href={`/fr/${adminPrefix}/users/${u.id}`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Détail
            </AdminButton>
          )}
        />
      )}

      {/* 🔴 L'en-tête annonçait « page 1 / N » sans offrir la page 2 — dixième
          liste de la console dans ce cas. Les trois filtres sont reportés dans
          les liens : sans eux, changer de page repartirait d'une autre liste
          que celle qu'on est en train de lire. */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={`/fr/${adminPrefix}/users`}
        preservedParams={{
          role: sp["role"],
          status: sp["status"],
          search: sp["search"],
        }}
      />
    </AdminPageShell>
  );
}
