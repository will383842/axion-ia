// Submission detail (extracted) — Sprint Notif Infra 2026-05-26.
//
// Composant Server Component partagé entre :
//   - /submissions/[id]/page.tsx (legacy redirect-to-new-path)
//   - /contacts/messages/[id]/page.tsx (nouveau canonical)
//
// La logique fetch + RBAC + render reste 1:1 avec l'ancienne page legacy
// `/submissions/[id]/page.tsx`. Extraction motivée par la migration de route
// `submissions → contacts/messages` (Chantier 2).

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSubmissionDetailAction } from "@/features/admin-submissions/actions";
import { AdminPageShell, AdminPageHeader, AdminStatusBadge } from "@/components/admin/ui";
import { interventionTypeLabel } from "@/lib/intervention-label";
import { SubmissionUpdateForm } from "../[id]/SubmissionUpdateForm";
import { ReplyComposer } from "@/components/admin/contacts/ReplyComposer";
import { ReplyHistory } from "@/components/admin/contacts/ReplyHistory";
import { resolveSubmissionLabel } from "@/features/admin-submissions/type-labels";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { CandidatureCommercialeDetail } from "./CandidatureCommercialeDetail";

interface Props {
  adminPrefix: string;
  id: string;
  /** Lien de retour vers le listing (varie selon la route appelante). */
  backHref: string;
  backLabel?: string;
}

export async function SubmissionDetailContent({
  adminPrefix,
  id,
  backHref,
  backLabel = "← Soumissions",
}: Props): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const submission = await getSubmissionDetailAction(id);
  if (!submission) notFound();

  // Form v2 (2026-05-28) — extrait unifiedType depuis details JSON pour
  // afficher le label fin (presse, recrutement, etc.) plutôt que le type DB
  // générique « contact ». Cf. submission-type-labels.ts.
  const details =
    submission.details &&
    typeof submission.details === "object" &&
    !Array.isArray(submission.details)
      ? (submission.details as Record<string, unknown>)
      : null;
  const unifiedType =
    details && typeof details.unifiedType === "string" ? details.unifiedType : null;
  const typeLabel = resolveSubmissionLabel(submission.type, unifiedType);

  // Présentation lisible : on SORT le message + les métas utiles (ville/source)
  // du JSON brut pour les afficher en clair. Le reste (JSON, IP, User-Agent) part
  // dans un repli « Informations techniques » masqué par défaut.
  const messageText = details && typeof details.message === "string" ? details.message.trim() : "";
  const ville = details && typeof details.ville === "string" ? details.ville : null;
  const sourceUrl = details && typeof details.source === "string" ? details.source : null;
  // Candidature commerciale (tunnel sans CV 2026-08-12) : bloc structuré rendu
  // par un composant dédié (expériences en accordéon, chips IA/zone). Le pitch
  // vit déjà dans `details.message` → la carte Message générique est masquée
  // pour ne pas l'afficher deux fois.
  const candidature =
    details && details.candidature && typeof details.candidature === "object"
      ? (details.candidature as Record<string, unknown>)
      : null;
  // Preuve de consentement — vit à la RACINE de `details`, pas dans
  // `details.candidature` : sans ce passage explicite, la fiche candidature ne
  // pouvait PAS l'afficher (elle ne reçoit que le sous-objet).
  const vivierConsentAt =
    details && typeof details.vivierConsentAt === "string" ? details.vivierConsentAt : null;
  const consentVersion =
    details && typeof details.consentVersion === "string" ? details.consentVersion : null;
  // Score de tri (C1) — vit lui aussi à la RACINE de `details`. Absent sur
  // toutes les candidatures antérieures au 2026-08-23 : la fiche doit s'en
  // passer sans broncher, pas afficher « 0 » (une note fausse est pire que
  // pas de note).
  const score = details && typeof details.score === "number" ? details.score : null;
  const scorePriorite =
    details && typeof details.scorePriorite === "string" ? details.scorePriorite : null;
  const titreSociete =
    submission.companyName && submission.companyName !== "—"
      ? submission.companyName
      : submission.contactName;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`${typeLabel} · ${titreSociete}`}
        description={`Reçue le ${formatDateFrShort(submission.submittedAt)} · langue ${submission.locale.toUpperCase()}`}
        breadcrumbs={
          <a href={backHref} className="admin-link admin-back">
            {backLabel}
          </a>
        }
        actions={
          <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
            {/* Raccourci CRM : pré-remplit le formulaire « nouveau client » avec
                les coordonnées de ce lead (déchiffrées côté serveur sur la page
                cible). Évite la re-saisie manuelle inbox → CRM Qualiopi. L'URL
                ne porte que l'id — aucune PII n'y transite. */}
            <a
              href={`/fr/${adminPrefix}/qualiopi/clients/new?fromSubmission=${submission.id}`}
              className="admin-button"
            >
              Convertir en client
            </a>
            <ReplyComposer
              submissionId={submission.id}
              contactName={submission.contactName}
              contactEmail={submission.contactEmail}
              defaultSubject={`Re: votre demande ${typeLabel}`}
            />
          </div>
        }
      />
      <div className="admin-detail-grid">
        {candidature ? (
          <CandidatureCommercialeDetail
            candidature={candidature}
            vivierConsentAt={vivierConsentAt}
            consentVersion={consentVersion}
            score={score}
            scorePriorite={scorePriorite}
          />
        ) : null}
        {messageText && !candidature ? (
          <div className="admin-card admin-card-wide">
            <h2 className="admin-h2">Message</h2>
            <p
              className="text-[length:var(--text-admin-base)] leading-[var(--lh-admin-body)] text-[color:var(--color-admin-fg)]"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {messageText}
            </p>
            {(ville || sourceUrl) && (
              <p className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {ville ? <>{ville}</> : null}
                {ville && sourceUrl ? " · " : null}
                {sourceUrl ? <>reçu via {sourceUrl}</> : null}
              </p>
            )}
          </div>
        ) : null}
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
                    <td>{formatDateFrShort(b.bookingDate)}</td>
                    <td>{interventionTypeLabel(b.interventionType)}</td>
                    <td>{b.participantsCount}</td>
                    <td>
                      {b.pricePaidCents != null
                        ? `${(b.pricePaidCents / 100).toFixed(0)} € HT`
                        : "sur devis"}
                    </td>
                    <td>
                      {/* Le statut sortait en anglais (« confirmed », « pending »)
                          dans une classe `admin-badge-${status}` qui n'existe
                          nulle part : ni traduit, ni teinté. */}
                      <AdminStatusBadge type="booking" status={b.status} />
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
        <ReplyHistory submissionId={submission.id} />
        <details className="admin-card admin-card-wide">
          <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)] select-none">
            Informations techniques (données brutes, IP, navigateur)
          </summary>
          <dl className="admin-dl mt-[var(--space-admin-4)]">
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
          <pre className="admin-json mt-[var(--space-admin-4)]">
            {JSON.stringify(submission.details, null, 2)}
          </pre>
        </details>
      </div>
    </AdminPageShell>
  );
}

function DT({ children }: { children: React.ReactNode }) {
  return <dt className="admin-dt">{children}</dt>;
}
function DD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dd className={`admin-dd ${className ?? ""}`}>{children}</dd>;
}
