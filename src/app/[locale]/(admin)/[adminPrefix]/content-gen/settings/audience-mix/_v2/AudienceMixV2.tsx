// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Audience mix V2 — AdminPageShell + AdminPageHeader + AdminCard.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import {
  deleteAudienceMixProfile,
  upsertAudienceMixProfile,
} from "@/server/actions/content-gen/distribution";

interface MixRow {
  id: string;
  slug: string;
  name: string;
  isDefault: boolean;
  mix: unknown;
}

interface Props {
  rows: ReadonlyArray<MixRow>;
}

// Clés « SIZE:ORG » : SIZE ∈ enum CompanySize (TPE/PME/ETI/GRANDE_ENTREPRISE),
// ORG ∈ enum OrganisationType (schema.prisma). Toute valeur hors enum ferait
// échouer en silence l'insert du job au sampling orchestrateur (cf. régression C1
// 2026-06-21). Le placeholder ci-dessous n'utilise QUE des valeurs valides.
const DEFAULT_MIX = `{
  "TPE:entreprise_privee": 20,
  "PME:entreprise_privee": 35,
  "ETI:entreprise_privee": 15,
  "GRANDE_ENTREPRISE:entreprise_privee": 10,
  "PME:etablissement_public": 5,
  "ETI:etablissement_public": 5,
  "PME:association": 5,
  "PME:collectivite": 5
}`;

export function AudienceMixV2({ rows }: Props): React.ReactElement {
  async function upsert(formData: FormData) {
    "use server";
    const mix = JSON.parse(String(formData.get("mix") ?? "{}")) as Record<string, number>;
    const description = formData.get("description")
      ? String(formData.get("description"))
      : undefined;
    await upsertAudienceMixProfile({
      slug: String(formData.get("slug") ?? ""),
      name: String(formData.get("name") ?? ""),
      ...(description ? { description } : {}),
      mix,
      isDefault: formData.get("isDefault") === "on",
    });
  }

  async function remove(formData: FormData) {
    "use server";
    await deleteAudienceMixProfile(String(formData.get("slug")));
  }

  const columns: ReadonlyArray<AdminTableColumn<MixRow>> = [
    { key: "slug", header: "Slug", cell: (r) => <code>{r.slug}</code> },
    { key: "name", header: "Nom", cell: (r) => r.name },
    {
      key: "default",
      header: "Défaut",
      cell: (r) => (r.isDefault ? <AdminBadge tone="success">Défaut</AdminBadge> : "—"),
    },
    {
      key: "mix",
      header: "Mix",
      cell: (r) => (
        <code className="text-[length:var(--text-admin-xs)]">{JSON.stringify(r.mix)}</code>
      ),
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Mix audiences"
        description="Matrice taille INSEE (TPE/PME/ETI/GE) × type d'organisation. Clés JSON au format SIZE:ORG_TYPE."
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form action={upsert}>
          <h2 className="admin-h2">Créer / mettre à jour un profil</h2>
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="slug" className="admin-label">
                Slug
              </label>
              <input
                id="slug"
                name="slug"
                required
                minLength={2}
                maxLength={80}
                className="admin-input"
                placeholder="ex. mixte-equilibre"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="name" className="admin-label">
                Nom
              </label>
              <input id="name" name="name" required className="admin-input" />
            </div>
          </div>
          <div className="admin-field">
            <label htmlFor="description" className="admin-label">
              Description (optionnelle)
            </label>
            <input id="description" name="description" className="admin-input" />
          </div>
          <div className="admin-field">
            <label htmlFor="mix" className="admin-label">
              Mix (JSON, somme = 100)
            </label>
            <textarea
              id="mix"
              name="mix"
              rows={14}
              className="admin-input font-mono text-[length:var(--text-admin-sm)]"
              defaultValue={DEFAULT_MIX}
              required
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="isDefault" /> Défaut (exclusif)
            </label>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Enregistrer
            </button>
          </div>
        </form>
      </AdminCard>

      <AdminCard variant="compact">
        <h2 className="admin-h2">Profils existants</h2>
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          caption="Profils de mix d'audiences existants"
          emptyState={<AdminEmptyState title="Aucun profil — créez-en un ci-dessus." />}
          rowAction={(r) => (
            <form action={remove} className="inline">
              <input type="hidden" name="slug" value={r.slug} />
              <button type="submit" className="admin-button-ghost">
                Supprimer
              </button>
            </form>
          )}
        />
      </AdminCard>
    </AdminPageShell>
  );
}
