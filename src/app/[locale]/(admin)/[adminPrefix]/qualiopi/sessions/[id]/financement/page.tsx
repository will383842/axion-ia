/**
 * Admin — Qualiopi · Panneau de financement d'une session (T11).
 *
 * Affiche les informations de financement de la session (type, OPCO statut/
 * subrogation/dossier, CPF payeur/EDOF, France Travail dispositif) et les
 * validations bloquantes avec badges critiques.
 *
 * Composants clients :
 * - SetFinancementForm   : modification du financement.
 * - GenererFactureButton : génération d'une facture de formation.
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { SetFinancementForm } from "@/components/admin/qualiopi/SetFinancementForm";
import { PriseEnChargeForm } from "@/components/admin/qualiopi/PriseEnChargeForm";
import { GenererFactureButton } from "@/components/admin/qualiopi/GenererFactureButton";
import { prisma } from "@/lib/prisma";
import { getFinancementValidations } from "@/server/qualiopi/financements/validation-service";
import type { FactureFormationDestinataire } from "../../../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Financement session | Axion-IA Admin",
  robots: { index: false, follow: false },
};

/** Formate une date en `yyyy-mm-dd` pour un `<input type="date">` (ou null). */
function toDateInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const FINANCEMENT_LABELS: Record<string, string> = {
  direct: "Direct (entreprise)",
  opco: "OPCO",
  cpf: "CPF / EDOF",
  france_travail: "France Travail",
  mixte: "Mixte",
};

const OPCO_STATUT_LABELS: Record<string, string> = {
  non_demande: "Non demandé",
  demande_en_cours: "Demande en cours",
  accord_recu: "Accord reçu",
  refuse: "Refusé",
  paiement_recu: "Paiement reçu",
};

const FT_DISPOSITIF_LABELS: Record<string, string> = {
  aif: "AIF (Aide Individuelle à la Formation)",
  poei: "POEI (Préparation Opérationnelle à l'Emploi Individuelle)",
  csp: "CSP (Contrat de Sécurisation Professionnelle)",
};

const STATUT_FACTURE_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  emise: "Émise",
  payee: "Payée",
  annulee: "Annulée",
};

const DESTINATAIRE_LABELS: Record<string, string> = {
  entreprise: "Entreprise",
  opco: "OPCO",
  stagiaire: "Stagiaire",
  france_travail: "France Travail",
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper destinataire par défaut selon type de financement
// ─────────────────────────────────────────────────────────────────────────────

function defaultDestinataireForType(
  ft: string | null,
  subrogation: boolean,
): FactureFormationDestinataire {
  if (subrogation) return "opco";
  if (ft === "france_travail") return "france_travail";
  if (ft === "cpf") return "stagiaire";
  if (ft === "opco") return "opco";
  return "entreprise";
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function FinancementSessionPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const userSession = await auth();
  const role = userSession?.user?.role;
  if (!userSession?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      statut: true,
      modalite: true,
      dateDebut: true,
      dateFin: true,
      financementType: true,
      opcoStatut: true,
      opcoSubrogation: true,
      conventionTripartiteSigneeAt: true,
      numeroDossierOpco: true,
      edofVerifieAt: true,
      ftDispositif: true,
      ftAifPrescriptionDate: true,
      ftPoeiOffreEmploiNumero: true,
      ftPoeiAccordFinancementAt: true,
      ftPoeiEngagementSigneAt: true,
      cpfPayeurResteCharge: true,
      priseEnChargeMontantCents: true,
      priseEnChargeUnite: true,
      priseEnChargePlafondFormationCents: true,
      priseEnChargePlafondAnnuelCents: true,
      priseEnChargeSourceUrl: true,
      priseEnChargeReleveLe: true,
      montantHtCents: true,
      dureeReelleHeures: true,
      nbParticipantsPrevus: true,
      nbParticipantsReels: true,
      facturesFormation: {
        select: {
          id: true,
          numero: true,
          destinataire: true,
          destinataireNom: true,
          montantHtCents: true,
          statut: true,
          emiseAt: true,
          subrogation: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!trainingSession) notFound();

  // Source unique de vérité : couvre OPCO, CPF/EDOF, CPF éligibilité, POEI 3 preuves.
  const financementValidations = await getFinancementValidations(trainingSession.id);
  // Ne garder que les entrées en échec pour l'affichage des alertes.
  const alertes = financementValidations
    .filter((e) => e.result.ok === false)
    .map((e) => ({
      gravite: e.result.gravite ?? ("warning" as const),
      message: e.result.alerte ?? e.code,
    }));

  const defaultDestinataire = defaultDestinataireForType(
    trainingSession.financementType,
    trainingSession.opcoSubrogation,
  );

  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";
  const infoLabelCls =
    "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  const infoValueCls =
    "mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";

  const dateDebut = trainingSession.dateDebut.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const dateFin = trainingSession.dateFin.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-3)]">
        <Link
          href={`/${locale}/${adminPrefix}/qualiopi/sessions`}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Sessions
        </Link>
        <Link
          href={`/${locale}/${adminPrefix}/qualiopi/financements`}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          Financements
        </Link>
      </div>

      <AdminPageHeader
        title={`Financement — ${trainingSession.titreSession ?? trainingSession.numero}`}
        description={`Session ${trainingSession.numero} · ${dateDebut} → ${dateFin}`}
      />

      {/* ── Alertes bloquantes ───────────────────────────────────────────── */}
      {alertes.length > 0 && (
        <section className="mb-[var(--space-admin-6)]">
          <div className="flex flex-col gap-[var(--space-admin-3)]">
            {alertes.map((a, i) => (
              <div
                key={i}
                role="alert"
                className={
                  a.gravite === "critique"
                    ? "flex items-start gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-error)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
                    : "flex items-start gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
                }
              >
                <span
                  className={
                    a.gravite === "critique"
                      ? "shrink-0 font-bold text-[color:var(--color-admin-error)]"
                      : "shrink-0 font-bold text-[color:var(--color-admin-warning)]"
                  }
                  aria-hidden="true"
                >
                  {a.gravite === "critique" ? "●" : "◑"}
                </span>
                <div>
                  <span
                    className={
                      a.gravite === "critique"
                        ? "text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-error)] uppercase"
                        : "text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-warning)] uppercase"
                    }
                  >
                    {a.gravite === "critique" ? "Bloquant" : "Avertissement"}
                  </span>
                  <p className="mt-0.5 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                    {a.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Récapitulatif du financement actuel ─────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>État actuel du financement</h2>
        <div className="grid grid-cols-2 gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] sm:grid-cols-4">
          <div>
            <p className={infoLabelCls}>Type</p>
            <p className={infoValueCls}>
              {trainingSession.financementType != null
                ? (FINANCEMENT_LABELS[trainingSession.financementType] ??
                  trainingSession.financementType)
                : "Non défini"}
            </p>
          </div>

          {(trainingSession.financementType === "opco" ||
            trainingSession.financementType === "mixte") && (
            <>
              <div>
                <p className={infoLabelCls}>Statut OPCO</p>
                <p
                  className={
                    trainingSession.opcoStatut === "accord_recu" ||
                    trainingSession.opcoStatut === "paiement_recu"
                      ? `${infoValueCls} text-[color:var(--color-admin-success)]`
                      : `${infoValueCls} text-[color:var(--color-admin-warning)]`
                  }
                >
                  {OPCO_STATUT_LABELS[trainingSession.opcoStatut] ?? trainingSession.opcoStatut}
                </p>
              </div>
              <div>
                <p className={infoLabelCls}>Subrogation</p>
                <p className={infoValueCls}>
                  {trainingSession.opcoSubrogation ? (
                    <span className="text-[color:var(--color-admin-warning)]">Oui</span>
                  ) : (
                    "Non"
                  )}
                </p>
              </div>
              {trainingSession.numeroDossierOpco && (
                <div>
                  <p className={infoLabelCls}>Dossier OPCO</p>
                  <p className={infoValueCls}>{trainingSession.numeroDossierOpco}</p>
                </div>
              )}
            </>
          )}

          {trainingSession.financementType === "cpf" && (
            <>
              <div>
                <p className={infoLabelCls}>Payeur reste à charge</p>
                <p className={infoValueCls}>{trainingSession.cpfPayeurResteCharge ?? "—"}</p>
              </div>
              <div>
                <p className={infoLabelCls}>EDOF vérifié</p>
                <p className={infoValueCls}>
                  {trainingSession.edofVerifieAt != null ? (
                    <span className="text-[color:var(--color-admin-success)]">
                      Oui — {new Date(trainingSession.edofVerifieAt).toLocaleDateString("fr-FR")}
                    </span>
                  ) : (
                    <span className="text-[color:var(--color-admin-error)]">Non vérifié</span>
                  )}
                </p>
              </div>
            </>
          )}

          {trainingSession.financementType === "france_travail" && (
            <div>
              <p className={infoLabelCls}>Dispositif FT</p>
              <p className={infoValueCls}>
                {trainingSession.ftDispositif != null
                  ? (FT_DISPOSITIF_LABELS[trainingSession.ftDispositif] ??
                    trainingSession.ftDispositif)
                  : "—"}
              </p>
            </div>
          )}

          <div>
            <p className={infoLabelCls}>Montant HT</p>
            <p className={infoValueCls}>
              {(trainingSession.montantHtCents / 100).toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
              })}
            </p>
          </div>

          {trainingSession.conventionTripartiteSigneeAt != null && (
            <div>
              <p className={infoLabelCls}>Convention tripartite</p>
              <p className={infoValueCls}>
                Signée —{" "}
                {new Date(trainingSession.conventionTripartiteSigneeAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Formulaire de modification du financement ────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Modifier le financement</h2>
        <SetFinancementForm
          sessionId={id}
          financementType={trainingSession.financementType}
          opcoStatut={trainingSession.opcoStatut}
          opcoSubrogation={trainingSession.opcoSubrogation}
          numeroDossierOpco={trainingSession.numeroDossierOpco}
          ftDispositif={trainingSession.ftDispositif}
          cpfPayeurResteCharge={trainingSession.cpfPayeurResteCharge}
          conventionTripartiteSigneeAt={toDateInput(trainingSession.conventionTripartiteSigneeAt)}
          ftPoeiOffreEmploiNumero={trainingSession.ftPoeiOffreEmploiNumero}
          ftPoeiAccordFinancementAt={toDateInput(trainingSession.ftPoeiAccordFinancementAt)}
          ftPoeiEngagementSigneAt={toDateInput(trainingSession.ftPoeiEngagementSigneAt)}
        />
      </section>

      {/* ── Barème de prise en charge OPCO ──────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Barème de prise en charge OPCO (dossier)</h2>
        <PriseEnChargeForm
          sessionId={id}
          priseEnChargeMontantCents={trainingSession.priseEnChargeMontantCents}
          priseEnChargeUnite={trainingSession.priseEnChargeUnite}
          priseEnChargePlafondFormationCents={trainingSession.priseEnChargePlafondFormationCents}
          priseEnChargePlafondAnnuelCents={trainingSession.priseEnChargePlafondAnnuelCents}
          priseEnChargeSourceUrl={trainingSession.priseEnChargeSourceUrl}
          priseEnChargeReleveLe={trainingSession.priseEnChargeReleveLe}
        />
      </section>

      {/* ── Génération de facture ─────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Facturation</h2>
        {alertes.some((a) => a.gravite === "critique") ? (
          <p className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-error)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]">
            Résolvez les alertes bloquantes ci-dessus avant de générer une facture.
          </p>
        ) : (
          <GenererFactureButton sessionId={id} defaultDestinataire={defaultDestinataire} />
        )}
      </section>

      {/* ── Factures existantes ───────────────────────────────────────────── */}
      {trainingSession.facturesFormation.length > 0 && (
        <section>
          <h2 className={sectionHeadCls}>
            Factures générées ({trainingSession.facturesFormation.length})
          </h2>
          <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
            <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              <thead className="border-b border-[color:var(--color-admin-border)]">
                <tr>
                  <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Numéro
                  </th>
                  <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Destinataire
                  </th>
                  <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Montant HT
                  </th>
                  <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Statut
                  </th>
                  <th className="px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                    Émise le
                  </th>
                </tr>
              </thead>
              <tbody>
                {trainingSession.facturesFormation.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                  >
                    <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
                      <span className="font-mono text-[length:var(--text-admin-xs)]">
                        {f.numero}
                      </span>
                    </td>
                    <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
                      <div>{DESTINATAIRE_LABELS[f.destinataire] ?? f.destinataire}</div>
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {f.destinataireNom}
                      </div>
                      {f.subrogation && (
                        <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                          Subrogation
                        </div>
                      )}
                    </td>
                    <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
                      <span className="font-semibold">
                        {(f.montantHtCents / 100).toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </td>
                    <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
                      {f.statut === "payee" ? (
                        <span className="text-[color:var(--color-admin-success)]">
                          ● {STATUT_FACTURE_LABELS[f.statut]}
                        </span>
                      ) : f.statut === "annulee" ? (
                        <span className="text-[color:var(--color-admin-error)]">
                          ○ {STATUT_FACTURE_LABELS[f.statut]}
                        </span>
                      ) : f.statut === "emise" ? (
                        <span className="text-[color:var(--color-admin-warning)]">
                          ◑ {STATUT_FACTURE_LABELS[f.statut]}
                        </span>
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">
                          ○ {STATUT_FACTURE_LABELS[f.statut] ?? f.statut}
                        </span>
                      )}
                    </td>
                    <td className="px-[var(--space-admin-4)] py-[var(--space-admin-3)]">
                      {f.emiseAt != null ? (
                        <span className="whitespace-nowrap">
                          {new Date(f.emiseAt).toLocaleDateString("fr-FR")}
                        </span>
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminPageShell>
  );
}
