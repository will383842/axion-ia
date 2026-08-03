// Détail + modération complète d’un avis client (admin).

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminBadge } from "@/components/admin/ui";
import { getReviewDetailAction } from "@/features/admin-reviews/actions";
import { clientSectorLabel } from "@/content/sectors";
import { serviceLineLabel } from "@/lib/reviews/service-lines";
import {
  publishForm,
  hideForm,
  rejectForm,
  replyForm,
  verifyForm,
  featureForm,
  deleteForm,
  uploadPhotoForm,
  removePhotoForm,
} from "../actions-form";
import { Ban } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  published: "Publié",
  hidden: "Masqué",
  rejected: "Rejeté",
  archived: "Archivé",
};

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
  /** `?erreur=…` posé par les adaptateurs de modération quand l'action échoue. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

export default async function AvisDetailPage({ params, searchParams }: PageProps) {
  const { adminPrefix, id } = await params;
  const sp = await searchParams;
  const erreur = Array.isArray(sp["erreur"]) ? sp["erreur"][0] : sp["erreur"];
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const role = (session.user as { role?: string }).role;
  const isSuperAdmin = role === "super_admin";

  const r = await getReviewDetailAction(id);
  if (!r) notFound();

  const base = `/fr/${adminPrefix}/avis`;
  const author = `${r.authorFirstName} ${r.authorLastInitial}`.trim();
  const photoSrc = r.photoUrl ?? (r.photoStoragePath ? `${base}/${r.id}/photo` : null);

  return (
    <AdminPageShell width="full">
      <AdminPageHeader
        title={`Avis de ${author}`}
        description={`Note ${r.rating} sur 5 · déposé le ${DATE_FMT.format(r.createdAt)}`}
        actions={
          <Link href={base} className="admin-button-ghost">
            ← Retour
          </Link>
        }
      />

      {erreur ? (
        <p role="alert" className="admin-alert admin-alert-error mb-[var(--space-admin-4)]">
          {erreur}
        </p>
      ) : null}

      <div className="grid gap-[var(--space-admin-5)] lg:grid-cols-[1.6fr_1fr]">
        {/* Colonne principale : contenu de l’avis */}
        <div className="space-y-[var(--space-admin-5)]">
          <AdminCard>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <AdminBadge tone={r.status === "published" ? "success" : "warning"}>
                {STATUS_LABELS[r.status] ?? r.status}
              </AdminBadge>
              {r.isVerified ? <AdminBadge tone="success">Vérifié</AdminBadge> : null}
              {r.featured ? <AdminBadge tone="info">Mis en avant</AdminBadge> : null}
              <span className="admin-meta-small">Note : {r.rating}/5</span>
            </div>
            {r.title ? <h2 className="mb-2 text-lg font-semibold">{r.title}</h2> : null}
            <p className="whitespace-pre-wrap">{r.comment}</p>
            <dl className="admin-meta-small mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
              <dt>Entreprise</dt>
              <dd>{r.companyName ?? "—"}</dd>
              <dt>Secteur</dt>
              <dd>{r.clientSector ? clientSectorLabel(r.clientSector) : "—"}</dd>
              <dt>Ville</dt>
              <dd>{r.cityName ?? "—"}</dd>
              <dt>Département</dt>
              <dd>{r.departmentCode ?? "—"}</dd>
              <dt>Service</dt>
              <dd>{r.serviceLine ? serviceLineLabel(r.serviceLine) : "—"}</dd>
              <dt>Slug</dt>
              <dd>
                <code>{r.slug}</code>
              </dd>
              <dt>Consentement</dt>
              <dd>{r.consentVersion ?? "—"}</dd>
            </dl>
          </AdminCard>

          {/* Réponse Axion-IA */}
          <AdminCard>
            <h3 className="mb-2 font-semibold">Réponse d’Axion-IA (publique)</h3>
            <p className="admin-meta-small mb-3">
              Le client ne peut pas répondre. Votre réponse apparaît publiquement sous l’avis.
            </p>
            <form action={replyForm} className="space-y-3">
              <input type="hidden" name="id" value={r.id} />
              <textarea
                aria-label="Merci pour votre retour"
                name="replyBody"
                rows={4}
                maxLength={3000}
                defaultValue={r.replyBody ?? ""}
                className="admin-input"
                placeholder="Merci pour votre retour…"
              />
              <button type="submit" className="admin-button">
                Enregistrer la réponse
              </button>
              {r.repliedAt ? (
                <span className="admin-meta-small ml-3">
                  Dernière réponse : {DATE_FMT.format(r.repliedAt)} par {r.repliedBy}
                </span>
              ) : null}
            </form>
          </AdminCard>
        </div>

        {/* Colonne latérale : photo + modération */}
        <div className="space-y-[var(--space-admin-5)]">
          <AdminCard>
            <h3 className="mb-2 font-semibold">Photo</h3>
            {photoSrc ? (
              <div className="mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoSrc}
                  alt={`Photo de ${author}`}
                  width={160}
                  height={160}
                  className="rounded-lg object-cover"
                />
                <p className="admin-meta-small mt-1">Type : {r.photoKind ?? "—"}</p>
                <form action={removePhotoForm} className="mt-2">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button-ghost admin-button-ghost-danger">
                    Retirer la photo
                  </button>
                </form>
              </div>
            ) : (
              <p className="admin-meta-small mb-3">
                Aucune photo. N’ajoutez qu’une vraie photo (portrait ou logo) fournie par le client
                avec son accord — jamais d’illustration générique.
              </p>
            )}
            <form
              action={uploadPhotoForm}
              encType="multipart/form-data"
              className="space-y-2 border-t border-[color:var(--color-admin-border)] pt-3"
            >
              <input type="hidden" name="id" value={r.id} />
              <label htmlFor="photo" className="admin-meta-small block">
                {photoSrc ? "Remplacer par" : "Ajouter"} une photo (JPG, PNG, WebP — 5 Mo max)
              </label>
              <input
                id="photo"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                className="admin-input"
              />
              <select
                aria-label="Type de photo"
                name="photoKind"
                defaultValue={r.photoKind ?? "portrait"}
                className="admin-input"
              >
                <option value="portrait">Portrait</option>
                <option value="logo">Logo d’entreprise</option>
              </select>
              <button type="submit" className="admin-button admin-button-block">
                {photoSrc ? "Remplacer la photo" : "Envoyer la photo"}
              </button>
            </form>
          </AdminCard>

          <AdminCard>
            <h3 className="mb-3 font-semibold">Modération</h3>
            <div className="flex flex-col gap-2">
              {r.status !== "published" ? (
                <form action={publishForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button admin-button-block">
                    Publier
                  </button>
                </form>
              ) : (
                <form action={hideForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button-ghost admin-button-block">
                    Masquer
                  </button>
                </form>
              )}

              <form action={verifyForm}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="verified" value={(!r.isVerified).toString()} />
                <button type="submit" className="admin-button-ghost admin-button-block">
                  {r.isVerified ? "Retirer « Vérifié »" : "Marquer « Vérifié »"}
                </button>
              </form>

              <form action={featureForm}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="featured" value={(!r.featured).toString()} />
                <button type="submit" className="admin-button-ghost admin-button-block">
                  {r.featured ? "Retirer « Mis en avant »" : "Mettre en avant"}
                </button>
              </form>

              <form action={rejectForm} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <input
                  aria-label="Motif du rejet (optionnel)"
                  name="notes"
                  className="admin-input"
                  placeholder="Motif du rejet (optionnel)"
                  defaultValue={r.moderationNotes ?? ""}
                />
                <button type="submit" className="admin-button-ghost admin-button-block">
                  <Ban
                    size={14}
                    aria-hidden="true"
                    className="inline-block shrink-0 align-[-0.125em]"
                  />{" "}
                  Rejeter
                </button>
              </form>

              {isSuperAdmin ? (
                <form
                  action={deleteForm}
                  className="mt-2 border-t border-[color:var(--color-admin-border)] pt-2"
                >
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className="admin-button-ghost admin-button-block admin-button-ghost-danger"
                  >
                    Supprimer définitivement
                  </button>
                </form>
              ) : null}
            </div>
          </AdminCard>
        </div>
      </div>
    </AdminPageShell>
  );
}
