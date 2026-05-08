// Detail soumission admin (M9 Tier 1 section 1).
//
// Affiche tous les champs + bookings lies (si type=intervention) + form update
// (status, internalNotes, assignedTo). RBAC verifie cote action.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSubmissionDetailAction } from "@/features/admin-submissions/actions";
import { SubmissionUpdateForm } from "./SubmissionUpdateForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  audit: "Audit",
  implementation: "Implémentation",
  intervention: "Intervention",
  contact: "Contact",
};

export default async function SubmissionDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const submission = await getSubmissionDetailAction(id);
  if (!submission) notFound();

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/submissions`} className="admin-link admin-back">
            ← Soumissions
          </a>
          <h1 className="admin-h1-large">
            {TYPE_LABELS[submission.type] ?? submission.type} · {submission.companyName}
          </h1>
          <p className="admin-meta">
            Reçue le {submission.submittedAt.toISOString().slice(0, 10)} • locale{" "}
            {submission.locale.toUpperCase()}
          </p>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="admin-card">
          <h2 className="admin-h2">Identité société</h2>
          <dl className="admin-dl">
            <DT>Société</DT>
            <DD>{submission.companyName}</DD>
            {submission.sector && (
              <>
                <DT>Secteur</DT>
                <DD>{submission.sector}</DD>
              </>
            )}
            {submission.employeesCount && (
              <>
                <DT>Effectif</DT>
                <DD>{submission.employeesCount}</DD>
              </>
            )}
            {submission.address && (
              <>
                <DT>Adresse</DT>
                <DD>{submission.address}</DD>
              </>
            )}
          </dl>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Contact</h2>
          <dl className="admin-dl">
            <DT>Nom</DT>
            <DD>{submission.contactName}</DD>
            <DT>Email</DT>
            <DD>
              <a href={`mailto:${submission.contactEmail}`} className="admin-link">
                {submission.contactEmail}
              </a>
            </DD>
            {submission.contactPhone && (
              <>
                <DT>Téléphone</DT>
                <DD>{submission.contactPhone}</DD>
              </>
            )}
            {submission.contactRole && (
              <>
                <DT>Rôle</DT>
                <DD>{submission.contactRole}</DD>
              </>
            )}
          </dl>
        </div>

        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Détails formulaire</h2>
          <pre className="admin-json">{JSON.stringify(submission.details, null, 2)}</pre>
        </div>

        {submission.bookings.length > 0 && (
          <div className="admin-card admin-card-wide">
            <h2 className="admin-h2">Réservations liées ({submission.bookings.length})</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Participants</th>
                  <th>Prix</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {submission.bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.bookingDate.toISOString().slice(0, 10)}</td>
                    <td>{b.interventionType}</td>
                    <td>{b.participantsCount}</td>
                    <td>
                      {b.pricePaidCents != null
                        ? `${(b.pricePaidCents / 100).toFixed(0)} € HT`
                        : "sur devis"}
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge-${b.status}`}>{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Workflow admin</h2>
          <SubmissionUpdateForm
            id={submission.id}
            currentStatus={submission.status}
            currentInternalNotes={submission.internalNotes}
            currentAssignedTo={submission.assignedTo}
          />
        </div>

        {(submission.ipAddress || submission.userAgent) && (
          <div className="admin-card admin-card-wide">
            <h2 className="admin-h2">Métadonnées techniques</h2>
            <dl className="admin-dl">
              {submission.ipAddress && (
                <>
                  <DT>IP</DT>
                  <DD>{submission.ipAddress}</DD>
                </>
              )}
              {submission.userAgent && (
                <>
                  <DT>User-Agent</DT>
                  <DD className="admin-meta-small">{submission.userAgent}</DD>
                </>
              )}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

function DT({ children }: { children: React.ReactNode }) {
  return <dt className="admin-dt">{children}</dt>;
}
function DD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dd className={`admin-dd ${className ?? ""}`}>{children}</dd>;
}
