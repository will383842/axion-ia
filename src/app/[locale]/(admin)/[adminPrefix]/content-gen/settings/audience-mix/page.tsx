/**
 * Content Generator — Settings audience mix (§ 25.2 v1.7).
 *
 * CRUD profils AudienceMixProfile. Matrice taille INSEE × OrganisationType.
 * Édition JSON brut V1 (validation somme = 100 % serveur).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  deleteAudienceMixProfile,
  listAudienceMixProfiles,
  upsertAudienceMixProfile,
} from "@/server/actions/content-gen/distribution";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

const DEFAULT_MIX = `{
  "TPE:entreprise_privee": 20,
  "PME:entreprise_privee": 35,
  "ETI:entreprise_privee": 15,
  "GE:entreprise_privee": 10,
  "PME:secteur_public": 5,
  "ETI:secteur_public": 5,
  "PME:association": 5,
  "PME:profession_liberale": 5
}`;

export default async function AudienceMixPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const rows = await listAudienceMixProfiles();

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

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Mix audiences</h1>
          <p className="admin-meta">
            Matrice taille INSEE (TPE/PME/ETI/GE) × type d&apos;organisation. Clés JSON au format{" "}
            <code>SIZE:ORG_TYPE</code>.
          </p>
        </div>
      </div>

      <form action={upsert} className="admin-card">
        <h2>Créer / mettre à jour un profil</h2>
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
            className="admin-input"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
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

      <div className="admin-card admin-table-wrapper">
        <h2>Profils existants</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Nom</th>
              <th>Défaut</th>
              <th>Mix</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>Aucun profil — créez-en un ci-dessus.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.slug}</code>
                  </td>
                  <td>{r.name}</td>
                  <td>{r.isDefault ? "✅" : "—"}</td>
                  <td>
                    <code style={{ fontSize: 11 }}>{JSON.stringify(r.mix)}</code>
                  </td>
                  <td>
                    <form action={remove} style={{ display: "inline" }}>
                      <input type="hidden" name="slug" value={r.slug} />
                      <button type="submit" className="admin-button-ghost">
                        Supprimer
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
