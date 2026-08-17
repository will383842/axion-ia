// Détail d'une candidature — PII déchiffrées, réponses lisibles (label question),
// download CV authentifié, formulaire de suivi (statut/notes/assignation/suppr).

import Link from "next/link";
import { Fragment } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { markInboxRead } from "@/features/admin-inbox/reads";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { getApplicationDetailAction } from "@/features/admin-job-applications/actions";
import { getJobOfferDetailAction } from "@/features/admin-job-offers/actions";
import { ApplicationStatusForm } from "./ApplicationStatusForm";
// Date affichée en FR (audit UX : ISO brut "2026-07-31" illisible pour Will).
import { formatDateFrShort } from "@/lib/format-date-fr";

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
  // Boîte de réception (2026-07-29) — « non lu » façon boîte mail : ouvrir la
  // fiche vaut lecture, sans geste. Best-effort : `markInboxRead` ne throw
  // jamais, une demande client s'affiche même si l'accusé échoue.
  await markInboxRead(session?.user?.id, "job_application", id);

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
        description={`Candidature · ${a.offerTitleSnap} · ${formatDateFrShort(a.submittedAt)}`}
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
              <Link
                href={`/fr/${adminPrefix}/contacts/candidatures/${a.id}/cv`}
                className="admin-link"
              >
                Télécharger {a.cvOriginalName ?? ""}
              </Link>
            ) : (
              "non fourni"
            )}
          </dd>
          <dt className="font-medium">Photo</dt>
          <dd>
            {a.hasPhoto ? (
              <PhotoCandidat
                href={`/fr/${adminPrefix}/contacts/candidatures/${a.id}/photo`}
                mimeType={a.photoMimeType}
                nomOriginal={a.photoOriginalName}
              />
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

/**
 * Photo du candidat : affichée quand le navigateur sait la rendre, proposée en
 * téléchargement sinon.
 *
 * 🔴 Le téléversement accepte le HEIC — format par défaut des iPhone — qu'aucun
 * navigateur hors Safari ne sait afficher, et que la route de consultation sert
 * donc en `application/octet-stream`. Une balise `<img>` inconditionnelle
 * produirait une image cassée : on aurait demandé une photo au candidat pour ne
 * jamais la voir, sans qu'aucune erreur ne le signale.
 */
const TYPES_AFFICHABLES = new Set(["image/jpeg", "image/png", "image/webp"]);

function PhotoCandidat({
  href,
  mimeType,
  nomOriginal,
}: {
  href: string;
  mimeType: string | null;
  nomOriginal: string | null;
}): React.ReactElement {
  if (mimeType && TYPES_AFFICHABLES.has(mimeType)) {
    return (
      <Link href={href} className="inline-block">
        {/* `next/image` est écarté : la route est authentifiée et hors
            web-root, l'optimiseur ne peut pas la lire. Dimensions fixées pour
            ne provoquer aucun décalage de mise en page au chargement. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt={`Photo de candidature${nomOriginal ? ` (${nomOriginal})` : ""}`}
          width={96}
          height={96}
          className="h-24 w-24 rounded-[var(--radius-admin-sm)] object-cover"
        />
      </Link>
    );
  }

  return (
    <>
      <Link href={href} className="admin-link">
        Télécharger {nomOriginal ?? "la photo"}
      </Link>
      <p className="admin-meta-small">
        Format non affichable dans le navigateur{mimeType ? ` (${mimeType})` : ""} — souvent une
        photo iPhone au format HEIC.
      </p>
    </>
  );
}
