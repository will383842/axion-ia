// Boîte de réception — fiche d'un appel réservé.
//
// Déplacée de `/contacts/calendly/[id]` le 2026-07-29 (fusion des trois
// onglets RDV, cf. ../page.tsx). L'ancienne URL redirige ici.
//
// Ajouts 2026-07-29 (ADR 0036) : bouton « Enrichir depuis Calendly », affichage
// des identifiants Calendly captés et des liens d'annulation / report.

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/ui";
import { CalendlyEventEditor } from "@/components/admin/contacts/CalendlyEventEditor";
import { EnrichCalendlyEventButton } from "@/components/admin/contacts/EnrichCalendlyEventButton";
import { isCalendlyApiConfigured } from "@/server/calendly/api";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programmé",
  canceled: "Annulé",
  completed: "Terminé",
  no_show: "Absent",
};

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function AppelDetailPage({ params }: PageProps): Promise<React.ReactElement> {
  const { adminPrefix, id } = await params;
  const event = await prisma.calendlyEvent.findUnique({ where: { id } });
  if (!event) notFound();

  const backHref = `/fr/${adminPrefix}/contacts/appels`;
  const apiConfigured = isCalendlyApiConfigured();

  return (
    <>
      <AdminPageHeader
        title={`Appel réservé · ${event.eventTypeName}`}
        description={`Capturé le ${event.capturedAt.toISOString().slice(0, 16)} · source ${event.source}`}
        breadcrumbs={
          <Link href={backHref} className="admin-link admin-back">
            ← Appels réservés
          </Link>
        }
        actions={
          <div className="flex items-start gap-2">
            <EnrichCalendlyEventButton id={event.id} apiConfigured={apiConfigured} />
            <a
              href="https://calendly.com/event_types/user/me"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-button-ghost"
            >
              Tableau de bord Calendly →
            </a>
          </div>
        }
      />

      {/* Explique pourquoi la fiche arrive vide, plutôt que de laisser croire
          à une perte de données. Affiché uniquement quand c'est le cas. */}
      {!event.inviteeName && !event.inviteeEmail ? (
        <div className="mt-[var(--space-admin-4)] rounded-lg border border-[color:var(--color-admin-warning-border)] bg-[color:var(--color-admin-warning-bg)] p-4 text-sm">
          <p className="font-semibold">Contact non transmis par Calendly.</p>
          <p className="mt-2">
            Le widget ne communique au site que des identifiants techniques, jamais le nom ni
            l&apos;email.{" "}
            {apiConfigured
              ? "Cliquez sur « Enrichir depuis Calendly » pour les récupérer automatiquement."
              : "Complétez ci-dessous depuis le mail Calendly reçu dans Gmail — ou configurez CALENDLY_API_TOKEN pour que cette étape disparaisse."}
          </p>
        </div>
      ) : null}

      <div className="admin-detail-grid mt-[var(--space-admin-4)]">
        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Édition</h2>
          <CalendlyEventEditor
            id={event.id}
            initial={{
              inviteeName: event.inviteeName,
              inviteeEmail: event.inviteeEmail,
              inviteePhone: event.inviteePhone,
              startTime: event.startTime?.toISOString() ?? null,
              endTime: event.endTime?.toISOString() ?? null,
              location: event.location,
              status: event.status,
              notes: event.notes,
              linkedSubmissionId: event.linkedSubmissionId,
            }}
          />
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Métadonnées</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Slug du type</dt>
            <dd className="admin-dd">
              <code className="text-xs">{event.eventTypeSlug}</code>
            </dd>
            <dt className="admin-dt">Statut</dt>
            <dd className="admin-dd">{STATUS_LABEL[event.status] ?? event.status}</dd>
            <dt className="admin-dt">Source</dt>
            <dd className="admin-dd">{event.source}</dd>
            <dt className="admin-dt">Enrichi depuis Calendly</dt>
            <dd className="admin-dd">
              {event.enrichedAt ? (
                event.enrichedAt.toISOString().slice(0, 16).replace("T", " ")
              ) : (
                <span className="text-[color:var(--color-admin-fg-muted)]">jamais</span>
              )}
            </dd>
            <dt className="admin-dt">Identifiant Calendly</dt>
            <dd className="admin-dd">
              {event.inviteeUri ? (
                <code className="text-xs break-all">{event.inviteeUri}</code>
              ) : (
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  absent (saisie manuelle ou capture antérieure)
                </span>
              )}
            </dd>
            {event.cancelUrl && (
              <>
                <dt className="admin-dt">Annuler</dt>
                <dd className="admin-dd">
                  <a href={event.cancelUrl} target="_blank" rel="noopener noreferrer">
                    Page d&apos;annulation Calendly ↗
                  </a>
                </dd>
              </>
            )}
            {event.rescheduleUrl && (
              <>
                <dt className="admin-dt">Reporter</dt>
                <dd className="admin-dd">
                  <a href={event.rescheduleUrl} target="_blank" rel="noopener noreferrer">
                    Page de report Calendly ↗
                  </a>
                </dd>
              </>
            )}
            <dt className="admin-dt">Page</dt>
            <dd className="admin-dd">
              {event.pageUrl ? (
                <a href={event.pageUrl} target="_blank" rel="noopener noreferrer">
                  {event.pageUrl}
                </a>
              ) : (
                "—"
              )}
            </dd>
            {event.utmSource && (
              <>
                <dt className="admin-dt">UTM source</dt>
                <dd className="admin-dd">
                  <code className="text-xs">{event.utmSource}</code>
                </dd>
              </>
            )}
            {event.utmCampaign && (
              <>
                <dt className="admin-dt">UTM campagne</dt>
                <dd className="admin-dd">
                  <code className="text-xs">{event.utmCampaign}</code>
                </dd>
              </>
            )}
            {event.utmMedium && (
              <>
                <dt className="admin-dt">UTM support</dt>
                <dd className="admin-dd">
                  <code className="text-xs">{event.utmMedium}</code>
                </dd>
              </>
            )}
            {event.referrer && (
              <>
                <dt className="admin-dt">Provenance</dt>
                <dd className="admin-dd">
                  <code className="text-xs">{event.referrer}</code>
                </dd>
              </>
            )}
            <dt className="admin-dt">Capturé</dt>
            <dd className="admin-dd">{event.capturedAt.toISOString()}</dd>
            <dt className="admin-dt">Mis à jour</dt>
            <dd className="admin-dd">{event.updatedAt.toISOString()}</dd>
          </dl>
        </div>

        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Données Calendly brutes</h2>
          <pre className="admin-json text-xs">{JSON.stringify(event.rawPayload, null, 2)}</pre>
        </div>
      </div>
    </>
  );
}
