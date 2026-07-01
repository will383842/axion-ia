// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Auteur Manon V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Server Action save préservée (updateAuthor avec slug="manon").

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { updateAuthor } from "@/server/actions/content-gen/author";

interface AuthorData {
  displayName: string;
  jobTitle: string;
  bioMd: string;
  photoAlt: string | null;
  aiGenerated: boolean;
  linkedinUrl: string | null;
  knowsAbout: ReadonlyArray<string>;
  isPersona: boolean;
  personaDisclaimer: string | null;
  photoUrl80: string;
  photoUrl256: string;
  photoUrl1024: string;
}

interface Props {
  author: AuthorData;
}

export function AuthorManonV2({ author }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    const photoAlt = formData.get("photoAlt") ? String(formData.get("photoAlt")) : undefined;
    const linkedinUrl = formData.get("linkedinUrl")
      ? String(formData.get("linkedinUrl"))
      : undefined;
    const personaDisclaimer = formData.get("personaDisclaimer")
      ? String(formData.get("personaDisclaimer"))
      : undefined;
    await updateAuthor({
      slug: "manon",
      displayName: String(formData.get("displayName") ?? ""),
      jobTitle: String(formData.get("jobTitle") ?? ""),
      bioMd: String(formData.get("bioMd") ?? ""),
      ...(photoAlt ? { photoAlt } : {}),
      aiGenerated: formData.get("aiGenerated") === "on",
      ...(linkedinUrl ? { linkedinUrl } : {}),
      knowsAbout: String(formData.get("knowsAbout") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      isPersona: formData.get("isPersona") === "on",
      ...(personaDisclaimer ? { personaDisclaimer } : {}),
    });
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Profil auteur Manon"
        description="Doctrine v2.1 — IA disclosed (aiGenerated + isPersona) · 0 réseau social. JSON-LD Person rebuild à chaque save."
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form action={save}>
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="displayName" className="admin-label">
                Nom affiché
              </label>
              <input
                id="displayName"
                name="displayName"
                required
                minLength={2}
                maxLength={80}
                defaultValue={author.displayName}
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="jobTitle" className="admin-label">
                Fonction
              </label>
              <input
                id="jobTitle"
                name="jobTitle"
                required
                minLength={2}
                maxLength={120}
                defaultValue={author.jobTitle}
                className="admin-input"
              />
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="bioMd" className="admin-label">
              Bio (Markdown, max 20 000)
            </label>
            <textarea
              id="bioMd"
              name="bioMd"
              rows={10}
              defaultValue={author.bioMd}
              className="admin-input font-mono text-[length:var(--text-admin-sm)]"
              maxLength={20_000}
            />
          </div>

          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="photoAlt" className="admin-label">
                Alt photo
              </label>
              <input
                id="photoAlt"
                name="photoAlt"
                defaultValue={author.photoAlt ?? ""}
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="linkedinUrl" className="admin-label">
                LinkedIn URL (Manon = vide par défaut)
              </label>
              <input
                id="linkedinUrl"
                name="linkedinUrl"
                type="url"
                defaultValue={author.linkedinUrl ?? ""}
                className="admin-input"
                placeholder="laisser vide pour Manon"
              />
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="knowsAbout" className="admin-label">
              knowsAbout (CSV)
            </label>
            <input
              id="knowsAbout"
              name="knowsAbout"
              defaultValue={author.knowsAbout.join(", ")}
              className="admin-input"
              placeholder="audit IA, intervention, méthodologie 5 étapes"
            />
          </div>

          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="aiGenerated" defaultChecked={author.aiGenerated} /> Image
              générée IA (déclare aiGenerated dans JSON-LD)
            </label>
          </div>

          <div className="admin-field">
            <label className="admin-label">
              <input type="checkbox" name="isPersona" defaultChecked={author.isPersona} /> Persona
              éditoriale (déclare disclaimer obligatoire)
            </label>
          </div>

          <div className="admin-field">
            <label htmlFor="personaDisclaimer" className="admin-label">
              Persona disclaimer (requis si isPersona = on)
            </label>
            <textarea
              id="personaDisclaimer"
              name="personaDisclaimer"
              rows={3}
              defaultValue={author.personaDisclaimer ?? ""}
              className="admin-input"
              placeholder="ex. Manon est une persona éditoriale IA disclosed. Les contenus sont supervisés par l'équipe Axion-IA."
            />
          </div>

          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Enregistrer + revalider /fr/equipe/manon
            </button>
          </div>
        </form>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Photos (gérées via le système de fichiers)</h2>
        <ul className="admin-meta-block">
          <li>
            <code>{author.photoUrl80}</code>
          </li>
          <li>
            <code>{author.photoUrl256}</code>
          </li>
          <li>
            <code>{author.photoUrl1024}</code>
          </li>
        </ul>
        <p className="admin-meta">
          V1 : photos servies depuis <code>/auteurs/</code>. Upload UI prévu V1.5.
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
