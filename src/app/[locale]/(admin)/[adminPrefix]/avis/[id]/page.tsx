// Détail + modération complète d'un avis client (admin).

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
} from "../actions-form";

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
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

export default async function AvisDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
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
        description={`${r.rating}/5 ★ · déposé le ${DATE_FMT.format(r.createdAt)}`}
        actions={
          <Link href={base} className="admin-button-ghost">
            ← Retour
          </Link>
        }
      />

      <div className="grid gap-[var(--space-admin-5)] lg:grid-cols-[1.6fr_1fr]">
        {/* Colonne principale : contenu de l'avis */}
        <div className="space-y-[var(--space-admin-5)]">
          <AdminCard>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <AdminBadge tone={r.status === "published" ? "success" : "warning"}>
                {STATUS_LABELS[r.status] ?? r.status}
              </AdminBadge>
              {r.isVerified ? <AdminBadge tone="success">✓ Vérifié</AdminBadge> : null}
              {r.featured ? <AdminBadge tone="info">★ Mis en avant</AdminBadge> : null}
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
            <h3 className="mb-2 font-semibold">Réponse d'Axion-IA (publique)</h3>
            <p className="admin-meta-small mb-3">
              Le client ne peut pas répondre. Votre réponse apparaît publiquement sous l'avis.
            </p>
            <form action={replyForm} className="space-y-3">
              <input type="hidden" name="id" value={r.id} />
              <textarea
                name="replyBody"
                rows={4}
                maxLength={3000}
                defaultValue={r.replyBody ?? ""}
                className="admin-input w-full"
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
          {photoSrc ? (
            <AdminCard>
              <h3 className="mb-2 font-semibold">Photo ({r.photoKind ?? "—"})</h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoSrc}
                alt={`Photo de ${author}`}
                width={160}
                height={160}
                className="rounded-lg object-cover"
              />
            </AdminCard>
          ) : null}

          <AdminCard>
            <h3 className="mb-3 font-semibold">Modération</h3>
            <div className="flex flex-col gap-2">
              {r.status !== "published" ? (
                <form action={publishForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button w-full">
                    ✅ Publier
                  </button>
                </form>
              ) : (
                <form action={hideForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button-ghost w-full">
                    🙈 Masquer
                  </button>
                </form>
              )}

              <form action={verifyForm}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="verified" value={(!r.isVerified).toString()} />
                <button type="submit" className="admin-button-ghost w-full">
                  {r.isVerified ? "Retirer « Vérifié »" : "Marquer « Vérifié »"}
                </button>
              </form>

              <form action={featureForm}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="featured" value={(!r.featured).toString()} />
                <button type="submit" className="admin-button-ghost w-full">
                  {r.featured ? "Retirer « Mis en avant »" : "Mettre en avant"}
                </button>
              </form>

              <form action={rejectForm} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <input
                  name="notes"
                  className="admin-input w-full"
                  placeholder="Motif du rejet (optionnel)"
                  defaultValue={r.moderationNotes ?? ""}
                />
                <button type="submit" className="admin-button-ghost w-full">
                  ⛔ Rejeter
                </button>
              </form>

              {isSuperAdmin ? (
                <form action={deleteForm} className="border-admin-border mt-2 border-t pt-2">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button-ghost w-full text-red-600">
                    🗑 Supprimer définitivement
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
