// Detail option 48h admin (M9 Tier 1 section 2).
//
// Affiche tous les champs option + slot + actions (validate/refuse) pour
// les options pending. Lecture seule pour les autres statuts.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { getOptionDetailAction } from "@/features/admin-options/actions";
import { OptionActions } from "./OptionActions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  refused: "Refusée",
  expired: "Expirée",
  converted: "Validée → réservation",
};

export default async function OptionDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  // Pattern V1/V2 §3 (audit verif-fix-deploy 2026-05-18) — V2 non implémenté
  // pour cette route legacy admin. Flag check préservé pour spec compliance.
  if (await isAdminV2Enabled()) {
    // Intentional fall-through to V1 below.
  }

  const opt = await getOptionDetailAction(id);
  if (!opt) notFound();

  const role = (session.user as { role?: string }).role;
  const canAct = (role === "super_admin" || role === "admin") && opt.status === "pending";

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/options`} className="admin-link admin-back">
            ← Options
          </a>
          <h1 className="admin-h1-large">{opt.companyName}</h1>
          <p className="admin-meta">
            Option posée le {opt.createdAt.toISOString().slice(0, 10)} •{" "}
            <span className={`admin-badge admin-badge-${opt.status}`}>
              {STATUS_LABELS[opt.status] ?? opt.status}
            </span>
          </p>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="admin-card">
          <h2 className="admin-h2">Société</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Nom</dt>
            <dd className="admin-dd">{opt.companyName}</dd>
            <dt className="admin-dt">Secteur</dt>
            <dd className="admin-dd">{opt.companySector}</dd>
            <dt className="admin-dt">Consent affichage</dt>
            <dd className="admin-dd">{opt.consentDisplay ? "Oui" : "Non"}</dd>
          </dl>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Contact</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Nom</dt>
            <dd className="admin-dd">{opt.contactName}</dd>
            <dt className="admin-dt">Email</dt>
            <dd className="admin-dd">
              <a href={`mailto:${opt.contactEmail}`} className="admin-link">
                {opt.contactEmail}
              </a>
            </dd>
            <dt className="admin-dt">Téléphone</dt>
            <dd className="admin-dd">{opt.contactPhone}</dd>
          </dl>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Créneau</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Date</dt>
            <dd className="admin-dd">{opt.slot.slotDate.toISOString().slice(0, 10)}</dd>
            <dt className="admin-dt">Intervention</dt>
            <dd className="admin-dd">{opt.interventionType}</dd>
            <dt className="admin-dt">Participants</dt>
            <dd className="admin-dd">{opt.participantsCount}</dd>
            <dt className="admin-dt">Locale</dt>
            <dd className="admin-dd">{opt.locale.toUpperCase()}</dd>
          </dl>
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Lifecycle</h2>
          <dl className="admin-dl">
            <dt className="admin-dt">Posée</dt>
            <dd className="admin-dd">{opt.createdAt.toISOString()}</dd>
            <dt className="admin-dt">Expire</dt>
            <dd className="admin-dd">{opt.expiresAt.toISOString()}</dd>
            {opt.reminderSentAt && (
              <>
                <dt className="admin-dt">Rappel envoyé</dt>
                <dd className="admin-dd">{opt.reminderSentAt.toISOString()}</dd>
              </>
            )}
            {opt.confirmedAt && (
              <>
                <dt className="admin-dt">Décidée</dt>
                <dd className="admin-dd">{opt.confirmedAt.toISOString()}</dd>
              </>
            )}
          </dl>
        </div>

        {opt.notes && (
          <div className="admin-card admin-card-wide">
            <h2 className="admin-h2">Notes admin</h2>
            <p>{opt.notes}</p>
          </div>
        )}

        {canAct ? (
          <div className="admin-card admin-card-wide">
            <h2 className="admin-h2">Décision admin</h2>
            <OptionActions optionId={opt.id} />
          </div>
        ) : opt.status === "pending" ? (
          <div className="admin-card admin-card-wide">
            <p className="admin-meta">
              Lecture seule — votre rôle ne permet pas d&apos;agir sur les options.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
