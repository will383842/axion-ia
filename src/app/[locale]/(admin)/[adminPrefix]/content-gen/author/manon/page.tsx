/**
 * Content Generator — Auteur Manon (admin /content-gen/author/manon).
 *
 * § 12.1bis + § 9.8 doctrine v2.1 (Option A IA disclosed, zéro réseau social).
 * Édition displayName / jobTitle / bio markdown / photoAlt / disclaimer.
 * Le JSON-LD Person est reconstruit à chaque save via la table AuthorProfile.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAuthor, updateAuthor } from "@/server/actions/content-gen/author";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { AuthorManonV2 } from "./_v2/AuthorManonV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function AuthorManonPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const author = await getAuthor("manon");

  if (author && (await isAdminV2Enabled())) {
    return <AuthorManonV2 author={author} />;
  }

  if (!author) {
    return (
      <section>
        <div className="admin-card">
          <h1 className="admin-h1-large">Profil Manon — introuvable</h1>
          <p>
            Le row <code>slug=&quot;manon&quot;</code> n&apos;existe pas dans{" "}
            <code>AuthorProfile</code>. Lance le seed Sprint 1 Day 1 (commit <code>d174f83</code>) :{" "}
            <code>pnpm tsx prisma/seeds/content-gen/author-manon.ts</code>.
          </p>
        </div>
      </section>
    );
  }

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Profil auteur Manon</h1>
          <p className="admin-meta">
            Doctrine v2.1 — IA disclosed (aiGenerated + isPersona) · 0 réseau social. JSON-LD Person
            rebuild à chaque save.
          </p>
        </div>
      </div>

      <form action={save} className="admin-card">
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
            className="admin-input"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
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
            Enregistrer + revalidate /fr/equipe/manon
          </button>
        </div>
      </form>

      <div className="admin-card">
        <h2>Photos (gérées via filesystem)</h2>
        <ul>
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
      </div>
    </section>
  );
}
