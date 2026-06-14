/**
 * Admin — Qualiopi · Financements / Facturation (T11).
 *
 * Liste toutes les factures de formation + alertes de validation (sessions
 * à risque : OPCO sans accord, CPF sans vérification EDOF) + bouton export
 * comptable CSV par année.
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { ExportComptaButton } from "@/components/admin/qualiopi/ExportComptaButton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Financements / Facturation | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

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

const FINANCEMENT_LABELS: Record<string, string> = {
  direct: "Direct",
  opco: "OPCO",
  cpf: "CPF",
  france_travail: "France Travail",
  mixte: "Mixte",
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function QualiopiFinancementsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const userSession = await auth();
  const role = userSession?.user?.role;
  if (!userSession?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  // ── Factures ──────────────────────────────────────────────────────────────
  const factures = await prisma.factureFormation.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      numero: true,
      destinataire: true,
      destinataireNom: true,
      montantHtCents: true,
      statut: true,
      emiseAt: true,
      subrogation: true,
      numeroDossierOpco: true,
      session: {
        select: {
          id: true,
          numero: true,
          titreSession: true,
        },
      },
    },
    take: 200,
  });

  // ── Sessions à risque (validations bloquantes) ─────────────────────────────
  // OPCO sans accord : financementType=opco|mixte + opcoStatut NOT IN (accord_recu, paiement_recu)
  const sessionsOpcoSansAccord = await prisma.trainingSession.findMany({
    where: {
      financementType: { in: ["opco", "mixte"] },
      opcoStatut: { notIn: ["accord_recu", "paiement_recu"] },
      statut: { notIn: ["realisee", "annulee"] },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      opcoStatut: true,
      financementType: true,
    },
    take: 50,
  });

  // CPF sans vérification EDOF
  const sessionsCpfSansEdof = await prisma.trainingSession.findMany({
    where: {
      financementType: "cpf",
      edofVerifieAt: null,
      statut: { notIn: ["realisee", "annulee"] },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
    },
    take: 50,
  });

  const anneeEnCours = new Date().getFullYear();

  // ── Stats ─────────────────────────────────────────────────────────────────
  const nbEmises = factures.filter((f) => f.statut === "emise").length;
  const nbPayees = factures.filter((f) => f.statut === "payee").length;
  const totalHtCents = factures
    .filter((f) => f.statut !== "annulee")
    .reduce((acc, f) => acc + f.montantHtCents, 0);

  const nbAlertes = sessionsOpcoSansAccord.length + sessionsCpfSansEdof.length;

  // ── Styles ────────────────────────────────────────────────────────────────
  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";
  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Financements / Facturation"
        description="Suivi des financements OPCO, CPF et France Travail. Factures de formation exonérées de TVA (art. 261-4-4° CGI)."
      />

      {/* Stats */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total factures" value={factures.length} />
        <AdminStatCard
          label="Émises"
          value={nbEmises}
          tone={nbEmises > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Payées"
          value={nbPayees}
          tone={nbPayees > 0 ? "success" : "default"}
        />
        <AdminStatCard
          label="Alertes validation"
          value={nbAlertes}
          tone={nbAlertes > 0 ? "destructive" : "default"}
        />
      </div>

      {/* Alertes bloquantes */}
      {nbAlertes > 0 && (
        <section className="mb-[var(--space-admin-8)]">
          <h2 className={sectionHeadCls}>Alertes — sessions à risque ({nbAlertes})</h2>

          {sessionsOpcoSansAccord.length > 0 && (
            <div className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-error)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
              <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-error)]">
                OPCO — Accord non reçu ({sessionsOpcoSansAccord.length} session(s))
              </p>
              <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Ces sessions ont un financement OPCO déclaré mais l&apos;accord écrit n&apos;est pas
                encore enregistré. Ne démarrez pas la formation avant l&apos;accord OPCO écrit.
              </p>
              <ul className="flex flex-col gap-[var(--space-admin-2)]">
                {sessionsOpcoSansAccord.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
                  >
                    <span className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {s.numero}
                    </span>
                    <span className="text-[color:var(--color-admin-fg)]">{s.titreSession}</span>
                    <span className="text-[color:var(--color-admin-warning)]">
                      {FINANCEMENT_LABELS[s.financementType ?? ""] ?? s.financementType} —{" "}
                      {s.opcoStatut}
                    </span>
                    <Link
                      href={`/${locale}/${adminPrefix}/qualiopi/sessions/${s.id}/financement`}
                      className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                    >
                      Gérer
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sessionsCpfSansEdof.length > 0 && (
            <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-error)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
              <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-error)]">
                CPF — Vérification EDOF manquante ({sessionsCpfSansEdof.length} session(s))
              </p>
              <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Ces sessions déclarent un financement CPF sans vérification EDOF horodatée. La
                facturation est bloquée jusqu&apos;à vérification.
              </p>
              <ul className="flex flex-col gap-[var(--space-admin-2)]">
                {sessionsCpfSansEdof.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
                  >
                    <span className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {s.numero}
                    </span>
                    <span className="text-[color:var(--color-admin-fg)]">{s.titreSession}</span>
                    <Link
                      href={`/${locale}/${adminPrefix}/qualiopi/sessions/${s.id}/financement`}
                      className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                    >
                      Gérer
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Export compta CSV */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Export comptable</h2>
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Export CSV des factures de formation pour l&apos;année en cours ({anneeEnCours}). Total HT
          (hors annulées) :{" "}
          <span className="font-semibold text-[color:var(--color-admin-fg)]">
            {(totalHtCents / 100).toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })}
          </span>
        </p>
        <ExportComptaButton annee={anneeEnCours} />
      </section>

      {/* Liste des factures */}
      <section>
        <h2 className={sectionHeadCls}>Factures de formation ({factures.length})</h2>

        {factures.length === 0 ? (
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
            Aucune facture. Générez une facture depuis le panneau de financement d&apos;une session.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
            <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              <thead className="border-b border-[color:var(--color-admin-border)]">
                <tr>
                  <th className={headCls}>Numéro</th>
                  <th className={headCls}>Session</th>
                  <th className={headCls}>Destinataire</th>
                  <th className={headCls}>Montant HT</th>
                  <th className={headCls}>TVA</th>
                  <th className={headCls}>Statut</th>
                  <th className={headCls}>Date émission</th>
                  <th className={headCls}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {factures.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                  >
                    {/* Numéro */}
                    <td className={cellCls}>
                      <span className="font-mono text-[length:var(--text-admin-xs)]">
                        {f.numero}
                      </span>
                    </td>

                    {/* Session */}
                    <td className={cellCls}>
                      <div className="font-medium">
                        {f.session?.titreSession ?? "Coaching 1-to-1"}
                      </div>
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {f.session?.numero ?? ""}
                      </div>
                    </td>

                    {/* Destinataire */}
                    <td className={cellCls}>
                      <div>{DESTINATAIRE_LABELS[f.destinataire] ?? f.destinataire}</div>
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {f.destinataireNom}
                      </div>
                      {f.subrogation && (
                        <div className="mt-0.5 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                          Subrogation
                        </div>
                      )}
                    </td>

                    {/* Montant HT */}
                    <td className={cellCls}>
                      <span className="font-semibold">
                        {(f.montantHtCents / 100).toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </td>

                    {/* TVA */}
                    <td className={cellCls}>
                      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        Exonérée (261-4-4° CGI)
                      </span>
                    </td>

                    {/* Statut */}
                    <td className={cellCls}>
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

                    {/* Date émission */}
                    <td className={cellCls}>
                      {f.emiseAt != null ? (
                        <span className="whitespace-nowrap">
                          {new Date(f.emiseAt).toLocaleDateString("fr-FR")}
                        </span>
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className={cellCls}>
                      {f.session ? (
                        <Link
                          href={`/${locale}/${adminPrefix}/qualiopi/sessions/${f.session.id}/financement`}
                          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                        >
                          Voir session
                        </Link>
                      ) : (
                        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPageShell>
  );
}
