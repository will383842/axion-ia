// Contacts admin — sous-onglet RDV Calendly (Sprint Notif Infra 2026-05-26).
//
// Listing CalendlyEvent (table créée Phase 4, peuplée Phase 7).
// Bandeau d'information honnête sur les limitations Calendly Free + lien
// dashboard Calendly natif.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/ui";
import { ManualCalendlyEventButton } from "@/components/admin/contacts/ManualCalendlyEventButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programmé",
  canceled: "Annulé",
  completed: "Terminé",
  no_show: "Absent",
};

function formatDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function ContactsCalendlyPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const detailBase = `/fr/${adminPrefix}/contacts/calendly`;
  const events = await prisma.calendlyEvent
    .findMany({
      orderBy: { capturedAt: "desc" },
      take: 100,
      select: {
        id: true,
        eventTypeName: true,
        eventTypeSlug: true,
        status: true,
        inviteeName: true,
        inviteeEmail: true,
        startTime: true,
        capturedAt: true,
        pageUrl: true,
        utmSource: true,
        source: true,
      },
    })
    .catch(() => []);

  return (
    <>
      <AdminPageHeader
        title="RDV Calendly"
        description={`${events.length} réservation${events.length > 1 ? "s" : ""} captée${events.length > 1 ? "s" : ""} via widget /appel.`}
        actions={
          <div className="flex gap-2">
            <ManualCalendlyEventButton />
            <Link
              href="https://calendly.com/event_types/user/me"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-button-ghost"
            >
              Tableau de bord Calendly →
            </Link>
          </div>
        }
      />

      <div className="mt-[var(--space-admin-4)] rounded-lg border border-[color:var(--color-admin-warning-border)] bg-[color:var(--color-admin-warning-bg)] p-4 text-sm">
        <p className="font-semibold">
          ℹ️ La capture Calendly fonctionne en mode côté client gratuit.
        </p>
        <p className="mt-2">
          Seules les <strong>créations depuis /appel</strong> sont captées automatiquement (via
          Embed JS postMessage). Les annulations et déplacements doivent être marqués manuellement
          (consulter votre boîte Gmail pour les notifications Calendly officielles).
        </p>
      </div>

      {events.length === 0 ? (
        <div className="admin-card admin-card-wide mt-[var(--space-admin-4)] p-[var(--space-admin-6)] text-sm text-[color:var(--color-admin-fg-muted)]">
          Aucune réservation captée pour le moment. Une réservation effectuée via le widget /appel
          apparaîtra ici sous quelques secondes.
        </div>
      ) : (
        <div className="admin-card admin-card-wide mt-[var(--space-admin-4)] overflow-x-auto">
          <table className="admin-table w-full text-sm">
            <thead>
              <tr>
                <th>Capturé le</th>
                <th>Type RDV</th>
                <th>Invité</th>
                <th>Statut</th>
                <th>Source</th>
                <th>UTM</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`${detailBase}/${e.id}`} className="admin-link">
                      {formatDateTime(e.capturedAt)}
                    </Link>
                  </td>
                  <td>{e.eventTypeName}</td>
                  <td>
                    {e.inviteeName ? (
                      <>
                        <div>{e.inviteeName}</div>
                        {e.inviteeEmail && (
                          <div className="text-xs text-[color:var(--color-admin-fg-muted)]">
                            {e.inviteeEmail}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        href={`${detailBase}/${e.id}`}
                        className="text-[color:var(--color-admin-fg-muted)] underline"
                      >
                        (à compléter)
                      </Link>
                    )}
                  </td>
                  <td>
                    <span className={`admin-badge admin-badge-${e.status}`}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </td>
                  <td>{e.source}</td>
                  <td>
                    {e.utmSource ? (
                      <code className="text-xs">{e.utmSource}</code>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
