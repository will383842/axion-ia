// Admin — détail d'une demande de tournage podcast : coordonnées déchiffrées,
// changement de statut de traitement, notes internes, suppression RGPD.
// Server component + `<form action>` (zéro JS client), pattern qr-codes/[id].

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { markInboxRead } from "@/features/admin-inbox/reads";
import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminBadge,
  AdminFormField,
  AdminSubmitButton,
} from "@/components/admin/ui";
import {
  updatePodcastRequestAction,
  deletePodcastRequestAction,
} from "@/features/admin-podcast-requests/actions";
import {
  PODCAST_REQUEST_STATUSES,
  podcastRequestStatusLabel,
  podcastRequestStatusTone,
} from "@/features/admin-podcast-requests/statuses";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

const fmt = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(d) : "—";

export default async function PodcastRequestDetailPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const request = await prisma.podcastRequest.findUnique({ where: { id } });
  if (!request) notFound();
  // Boîte de réception (2026-07-29) — « non lu » façon boîte mail : ouvrir la
  // fiche vaut lecture, sans geste. Best-effort : `markInboxRead` ne throw
  // jamais, une demande client s'affiche même si l'accusé échoue.
  await markInboxRead(session?.user?.id, "podcast_request", id);

  const base = `/${locale}/${adminPrefix}/podcast`;
  const leaderName = decryptPii(request.leaderName);
  const email = decryptPii(request.email);
  const phone = decryptPii(request.phone);

  const facts: ReadonlyArray<readonly [string, string]> = [
    ["Dirigeant", leaderName],
    ["E-mail", email],
    ["Téléphone", phone],
    ["Lieu du tournage", `${request.city} (${request.postalCode})`],
    ["Reçue le", fmt(request.createdAt)],
    ["Prise en charge le", fmt(request.handledAt)],
    ["Origine", request.source],
    ["Langue du formulaire", request.locale],
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`Podcast — ${request.companyName}`}
        description="Demande de tournage déposée depuis la page publique /podcast."
        meta={
          <AdminBadge tone={podcastRequestStatusTone(request.status)}>
            {podcastRequestStatusLabel(request.status)}
          </AdminBadge>
        }
        actions={
          <a href={base} className="admin-link">
            ← Retour à la liste
          </a>
        }
      />

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <section className="space-y-[var(--space-admin-6)]">
          <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-6)]">
            <h2 className="mb-[var(--space-admin-4)] font-semibold">
              Activité de l&apos;entreprise
            </h2>
            <p className="text-[length:var(--text-admin-sm)] whitespace-pre-line">
              {request.activity}
            </p>
          </div>

          <form action={updatePodcastRequestAction} className="admin-form">
            <input type="hidden" name="id" value={request.id} />
            <AdminFormField
              label="Statut de traitement"
              name="status"
              type="select"
              defaultValue={request.status}
              options={PODCAST_REQUEST_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
            <AdminFormField
              label="Notes internes"
              name="internalNotes"
              type="textarea"
              rows={5}
              defaultValue={request.internalNotes ?? ""}
              hint="Jamais visible côté site. Sert au suivi (date proposée, contraintes de lieu, etc.)."
            />
            <AdminSubmitButton>Enregistrer</AdminSubmitButton>
          </form>
        </section>

        <aside className="space-y-[var(--space-admin-6)]">
          <dl className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-6)] text-[length:var(--text-admin-sm)]">
            {facts.map(([label, value]) => (
              <div key={label} className="mb-[var(--space-admin-3)] last:mb-0">
                <dt className="text-[color:var(--color-admin-fg-muted)]">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>

          <form action={deletePodcastRequestAction}>
            <input type="hidden" name="id" value={request.id} />
            <button type="submit" className="admin-button-refuse">
              Supprimer définitivement
            </button>
          </form>
        </aside>
      </div>
    </AdminPageShell>
  );
}
