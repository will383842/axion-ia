// Détail d'une candidature — PII déchiffrées, réponses lisibles (label question),
// download CV authentifié, formulaire de suivi (statut/notes/assignation/suppr).

import Link from "next/link";
import { Fragment } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { getApplicationDetailAction } from "@/features/admin-job-applications/actions";
import { getJobOfferDetailAction } from "@/features/admin-job-offers/actions";
import { ApplicationStatusForm } from "./ApplicationStatusForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

function yn(v: boolean | null): string {
  return v === true ? "Oui" : v === false ? "Non" : "—";
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const a = await getApplicationDetailAction(id);
  if (!a) notFound();

  // Labels des questions de l'offre → rendu lisible des réponses (pas de JSON brut).
  const offer = await getJobOfferDetailAction(a.offerId);
  const qLabels: Record<string, string> = {};
  if (offer && Array.isArray(offer.screeningQuestions)) {
    for (const q of offer.screeningQuestions as Array<{
      id?: string;
      labelFr?: string;
    }>) {
      if (q.id) qLabels[q.id] = q.labelFr ?? q.id;
    }
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`${a.civility ? `${a.civility} ` : ""}${a.firstName} ${a.lastName}`}
        description={`Candidature · ${a.offerTitleSnap} · ${a.submittedAt.toISOString().slice(0, 10)}`}
        actions={
          <Link href={`/fr/${adminPrefix}/contacts/candidatures`} className="admin-button-ghost">
            ← Liste
          </Link>
        }
      />

      <AdminCard>
        <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
          <dt className="font-medium">Email</dt>
          <dd>{a.email}</dd>
          <dt className="font-medium">Téléphone</dt>
          <dd>{a.phone}</dd>
          <dt className="font-medium">Ville</dt>
          <dd>{a.city ?? "—"}</dd>
          <dt className="font-medium">Poste actuel</dt>
          <dd>{a.currentRole ?? "—"}</dd>
          <dt className="font-medium">Expérience</dt>
          <dd>{a.experienceBand ?? "—"}</dd>
          <dt className="font-medium">Disponibilité</dt>
          <dd>{a.availability ?? "—"}</dd>
          <dt className="font-medium">Prétention de revenus</dt>
          <dd>{a.salaryExpectation ?? "—"}</dd>
          <dt className="font-medium">LinkedIn</dt>
          <dd>
            {a.linkedinUrl ? (
              <a href={a.linkedinUrl} target="_blank" rel="noopener" className="admin-link">
                {a.linkedinUrl}
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt className="font-medium">Permis</dt>
          <dd>{yn(a.hasDriverLicense)}</dd>
          <dt className="font-medium">Véhicule</dt>
          <dd>{yn(a.hasVehicle)}</dd>
          <dt className="font-medium">CV</dt>
          <dd>
            {a.hasCv ? (
              <Link href={`/fr/${adminPrefix}/contacts/candidatures/${a.id}/cv`} className="admin-link">
                Télécharger {a.cvOriginalName ?? ""}
              </Link>
            ) : (
              "non fourni"
            )}
          </dd>
          <dt className="font-medium">Photo</dt>
          <dd>
            {a.hasPhoto ? (
              <Link href={`/fr/${adminPrefix}/contacts/candidatures/${a.id}/photo`} className="admin-link">
                Voir {a.photoOriginalName ?? ""}
              </Link>
            ) : (
              "non fournie"
            )}
          </dd>
        </dl>
      </AdminCard>

      {a.motivation ? (
        <AdminCard>
          <h3 className="admin-section-title">Petit mot du candidat</h3>
          <p className="text-sm whitespace-pre-wrap">{a.motivation}</p>
        </AdminCard>
      ) : null}

      {Object.keys(a.answers).length > 0 ? (
        <AdminCard>
          <h3 className="admin-section-title">Réponses aux questions</h3>
          <dl className="space-y-3 text-sm">
            {Object.entries(a.answers).map(([qid, val]) => (
              <Fragment key={qid}>
                <dt className="font-medium">{qLabels[qid] ?? qid}</dt>
                <dd className="text-fg-muted whitespace-pre-wrap">{val}</dd>
              </Fragment>
            ))}
          </dl>
        </AdminCard>
      ) : null}

      <AdminCard>
        <h3 className="admin-section-title">Suivi</h3>
        <ApplicationStatusForm
          id={a.id}
          status={a.status}
          internalNotes={a.internalNotes}
          assignedTo={a.assignedTo}
          needsAttention={a.needsAttention}
        />
      </AdminCard>
    </AdminPageShell>
  );
}
