// Contacts admin — détail RDV Calendly (Sprint Notif Infra 2026-05-26 /
// fix P1-6 audit 2026-05-27).
//
// Édition inline des champs (inviteeName/Email/Phone/startTime/status/notes/
// linkedSubmissionId) + JSON viewer rawPayload + lien dashboard Calendly natif.

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/ui";
import { CalendlyEventEditor } from "@/components/admin/contacts/CalendlyEventEditor";

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

export default async function CalendlyDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix, id } = await params;
  const event = await prisma.calendlyEvent.findUnique({ where: { id } });
  if (!event) notFound();

  const backHref = `/fr/${adminPrefix}/contacts/calendly`;

  return (
    <>
      <AdminPageHeader
        title={`RDV Calendly · ${event.eventTypeName}`}
        description={`Capturé le ${event.capturedAt.toISOString().slice(0, 16)} · source ${event.source}`}
        breadcrumbs={
          <Link href={backHref} className="admin-link admin-back">
            ← RDV Calendly
          </Link>
        }
        actions={
          <a
            href="https://calendly.com/event_types/user/me"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-button-ghost"
          >
            Tableau de bord Calendly →
          </a>
        }
      />

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
