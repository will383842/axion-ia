// Planning unifié — fiche 360° d'une prestation.
//
// Ouverte au clic depuis le calendrier. Rassemble ce qu'un pilote doit voir
// sans naviguer : entreprise et contact (téléphone, e-mail), lieu, formateur,
// financement OPCO avec ses justificatifs, factures.
//
// RSC pur, 0 JS client.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlanningEventDetail } from "@/features/admin-planning/detail";
import { getTrainerConflicts } from "@/features/admin-planning/queries";
import {
  PLANNING_STATUT_LABELS,
  PLANNING_TYPE_LABELS,
  planningDetailHref,
  type PlanningEventType,
} from "@/features/admin-planning/types";
import { planningTimeLabel } from "@/features/admin-planning/labels";
import { dayKeyInParis } from "@/lib/calendar-grid";
import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { OPCO_STATUT_LABELS } from "@/server/qualiopi/financements/labels";
import { TriangleAlert } from "lucide-react";

export const dynamic = "force-dynamic";

const TYPES: PlanningEventType[] = ["formation", "coaching"];

// Libellés en minuscules : rendus entre parenthèses après le nom du formateur.
const STATUT_FORMATEUR_LABELS: Record<string, string> = {
  salarie: "salarié",
  sous_traitant: "indépendant",
  dirigeant: "dirigeant-formateur",
};

const FINANCEMENT_LABELS: Record<string, string> = {
  direct: "Direct",
  opco: "OPCO",
  cpf: "CPF",
  france_travail: "France Travail",
  mixte: "Mixte",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  kit_opco: "Kit OPCO",
  kit_cpf: "Kit CPF",
  kit_france_travail: "Kit France Travail",
  convention_tripartite: "Convention tripartite",
};

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
function money(cents: number | null): string {
  return cents === null ? "—" : euros.format(cents / 100);
}
function dash(v: string | null): string {
  return v !== null && v.trim() !== "" ? v : "—";
}

interface PageProps {
  params: Promise<{ adminPrefix: string; type: string; id: string }>;
}

/** Ligne d'une liste de définitions. */
function Line({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-x-2 py-1">
      <dt className="min-w-[9rem] text-[color:var(--color-admin-fg-muted)]">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export default async function PlanningDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix, type, id } = await params;
  if (!(TYPES as string[]).includes(type)) notFound();

  const e = await getPlanningEventDetail(type as PlanningEventType, id);
  if (e === null) notFound();

  const base = `/fr/${adminPrefix}`;
  const ficheCompleteHref =
    e.type === "formation"
      ? `${base}/qualiopi/sessions/${e.id}`
      : `${base}/coaching/seances/${e.id}`;
  const retourHref = `${base}/planning?date=${dayKeyInParis(e.debut)}`;
  const fin = e.financement;

  // Conflit de formateur : rien n'empêchait jusqu'ici d'affecter le même
  // formateur à deux prestations simultanées (la garde d'habilitation ne
  // vérifie pas la disponibilité).
  const conflits =
    e.formateur !== null
      ? await getTrainerConflicts(e.formateur.id, {
          key: `${e.type}:${e.id}`,
          debut: e.debut,
          fin: e.fin,
          statut: e.statut,
        })
      : [];

  return (
    <>
      <AdminPageHeader
        title={e.titre}
        description={`${PLANNING_TYPE_LABELS[e.type]} · ${planningTimeLabel(e)} · ${PLANNING_STATUT_LABELS[e.statut]}`}
      />

      <div className="mb-[var(--space-admin-4)] flex flex-wrap gap-2">
        <Link href={retourHref} className="admin-button-ghost">
          Retour au planning
        </Link>
        <Link href={ficheCompleteHref} className="admin-button">
          Fiche complète →
        </Link>
      </div>

      {conflits.length > 0 && (
        <div
          role="alert"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-paper)] p-3"
        >
          <strong>
            <TriangleAlert
              size={14}
              aria-hidden="true"
              className="inline-block shrink-0 align-[-0.125em]"
            />{" "}
            Conflit de planning — {e.formateur?.nomComplet} est déjà mobilisé sur {conflits.length}{" "}
            autre{conflits.length > 1 ? "s" : ""} prestation
            {conflits.length > 1 ? "s" : ""} qui chevauche ce créneau.
          </strong>
          <ul className="mt-2 space-y-1">
            {conflits.map((c) => (
              <li key={c.key}>
                <Link href={planningDetailHref(adminPrefix, c)}>
                  {planningTimeLabel(c)} — {c.titre} ({PLANNING_TYPE_LABELS[c.type]})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-detail-grid">
        <AdminCard>
          <h2 className="admin-h2">Entreprise & contact</h2>
          <dl>
            {e.client !== null ? (
              <>
                <Line label="Client">{e.client.raisonSociale}</Line>
                <Line label="SIRET">{dash(e.client.siret)}</Line>
                <Line label="Adresse">{dash(e.client.adresse)}</Line>
                <Line label="Contact">
                  {dash(e.client.contactNom)}
                  {e.client.contactFonction !== null ? ` — ${e.client.contactFonction}` : ""}
                </Line>
                <Line label="Téléphone">
                  {e.client.contactTelephone !== null ? (
                    <a href={`tel:${e.client.contactTelephone}`}>{e.client.contactTelephone}</a>
                  ) : (
                    "—"
                  )}
                </Line>
                <Line label="E-mail">
                  {e.client.contactEmail !== null ? (
                    <a href={`mailto:${e.client.contactEmail}`}>{e.client.contactEmail}</a>
                  ) : (
                    "—"
                  )}
                </Line>
                <Line label="OPCO">{dash(e.client.opcoIdentifie)}</Line>
              </>
            ) : (
              <p className="text-[color:var(--color-admin-fg-muted)]">Aucun client rattaché.</p>
            )}
            {e.beneficiaire !== null && (
              <>
                <Line label="Bénéficiaire">{dash(e.beneficiaire.nom)}</Line>
                <Line label="E-mail bénéf.">{dash(e.beneficiaire.email)}</Line>
              </>
            )}
          </dl>
        </AdminCard>

        <AdminCard>
          <h2 className="admin-h2">Déroulé & formateur</h2>
          <dl>
            <Line label="Horaire">{planningTimeLabel(e)}</Line>
            <Line label="Lieu">{e.lieu ?? "— (non renseigné)"}</Line>
            <Line label="Formateur">
              {e.formateur !== null
                ? `${e.formateur.nomComplet} (${STATUT_FORMATEUR_LABELS[e.formateur.statut] ?? e.formateur.statut})`
                : "— non assigné"}
            </Line>
            {e.formateur !== null && (
              <>
                <Line label="Tél. formateur">{dash(e.formateur.telephone)}</Line>
                <Line label="E-mail formateur">
                  <a href={`mailto:${e.formateur.email}`}>{e.formateur.email}</a>
                </Line>
              </>
            )}
            {e.participants !== null && (
              <Line label="Participants">
                {e.participants.inscrits} inscrit{e.participants.inscrits > 1 ? "s" : ""} /{" "}
                {e.participants.prevus} prévu{e.participants.prevus > 1 ? "s" : ""}
                {e.participants.reels !== null ? ` · ${e.participants.reels} réels` : ""}
              </Line>
            )}
            <Line label="Statut">{PLANNING_STATUT_LABELS[e.statut]}</Line>
          </dl>
        </AdminCard>

        <AdminCard>
          <h2 className="admin-h2">Financement</h2>
          <dl>
            <Line label="Montant HT">{money(e.montantHtCents)}</Line>
            {fin !== null ? (
              <>
                <Line label="Type">
                  {fin.financementType !== null
                    ? (FINANCEMENT_LABELS[fin.financementType] ?? fin.financementType)
                    : "—"}
                </Line>
                {fin.opcoStatut !== null && (
                  <Line label="Accord OPCO">
                    {OPCO_STATUT_LABELS[fin.opcoStatut] ?? fin.opcoStatut}
                  </Line>
                )}
                <Line label="N° dossier OPCO">{dash(fin.numeroDossierOpco)}</Line>
                <Line label="Subrogation">{fin.subrogation ? "Oui" : "Non"}</Line>
                <Line label="Prise en charge">{money(fin.priseEnChargeMontantCents)}</Line>
                <Line label="Convention tripartite">
                  {fin.conventionTripartiteSigneeAt !== null
                    ? `Signée le ${dayKeyInParis(fin.conventionTripartiteSigneeAt)}`
                    : "— non signée"}
                </Line>
                {fin.priseEnChargeSourceUrl !== null && (
                  <Line label="Barème">
                    <a href={fin.priseEnChargeSourceUrl} target="_blank" rel="noreferrer noopener">
                      Portail OPCO ↗
                    </a>
                  </Line>
                )}
              </>
            ) : (
              <p className="text-[color:var(--color-admin-fg-muted)]">
                Aucun financement rattaché.
              </p>
            )}
          </dl>
        </AdminCard>

        <AdminCard>
          <h2 className="admin-h2">Justificatifs & factures</h2>
          <h3 className="admin-h3">Justificatifs de financement</h3>
          {e.justificatifs.length === 0 ? (
            <p className="text-[color:var(--color-admin-fg-muted)]">Aucun justificatif émis.</p>
          ) : (
            <ul className="space-y-1">
              {e.justificatifs.map((d) => (
                <li key={d.id}>
                  {DOC_TYPE_LABELS[d.type] ?? d.type} · {d.numero}{" "}
                  {/* `pdfUrl` = témoin d'upload R2, pas cible : l'URL stockée est
                      pré-signée 900 s et périmée. Cf. `/api/qualiopi/documents/[id]`. */}
                  {d.pdfUrl !== null ? (
                    <a
                      href={`/api/qualiopi/documents/${d.id}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      PDF ↗
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <h3 className="admin-h3 mt-[var(--space-admin-4)]">Factures</h3>
          {e.factures.length === 0 ? (
            <p className="text-[color:var(--color-admin-fg-muted)]">Aucune facture.</p>
          ) : (
            <ul className="space-y-1">
              {e.factures.map((f) => (
                <li key={f.id}>
                  {f.numero} · {money(f.montantHtCents)} HT · {f.destinataire} ·{" "}
                  <strong>{f.statut}</strong>
                  {f.emiseAt !== null ? ` · émise le ${dayKeyInParis(f.emiseAt)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </>
  );
}
