/**
 * Admin — Qualiopi · Alertes financement (sessions).
 *
 * Alertes de validation bloquantes au niveau SESSION (OPCO sans accord, CPF
 * sans vérification EDOF) + export comptable CSV legacy (`exportComptaCsvAction`,
 * absent du Hub — cf. `qualiopi/facturation/comptabilite` qui n'exporte que le
 * FEC). Ne liste PLUS les factures : c'est un doublon visible de « Facturation
 * (Hub) » (`qualiopi/facturation`), qui interroge la même table sans filtre par
 * défaut. Retiré le 2026-09-23 — mesuré : 1 seule ligne dans `factures_formation`
 * en prod, donc dette d'organisation, pas urgence opérationnelle. Cf. commentaire
 * de `src/lib/admin-nav.ts` (la PR 320, 2026-07-14) : la fonction propre de cet
 * écran a toujours été « alertes OPCO/CPF session + export CSV legacy », jamais
 * la liste elle-même — restée par prudence, jamais retirée depuis.
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { ExportComptaButton } from "@/components/admin/qualiopi/ExportComptaButton";
import { prisma } from "@/lib/prisma";
import { libellerStatutOpco } from "@/server/qualiopi/financements/labels";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Alertes financement (sessions) | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

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
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  // ── Factures — total HT de l'année pour le contexte de l'export CSV ────────
  // Select réduit au strict nécessaire depuis le retrait de la liste (2026-09-23) :
  // seul le montant HT (hors annulées) sert encore, pour le sous-titre de
  // l'export comptable. Le détail par facture vit désormais UNIQUEMENT dans
  // « Facturation (Hub) ».
  const factures = await prisma.factureFormation.findMany({
    orderBy: { createdAt: "desc" },
    select: { montantHtCents: true, statut: true },
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
  const totalHtCents = factures
    .filter((f) => f.statut !== "annulee")
    .reduce((acc, f) => acc + f.montantHtCents, 0);

  const nbAlertes = sessionsOpcoSansAccord.length + sessionsCpfSansEdof.length;

  // ── Styles ────────────────────────────────────────────────────────────────
  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Alertes financement (sessions)"
        description="Suivi des financements OPCO, CPF et France Travail au niveau session (alertes de risque). La liste des factures est désormais UNIQUEMENT sur « Facturation (Hub) » — cet écran ne la double plus."
      />

      {/* Stats — un seul indicateur : les autres (total/émises/payées) */}
      {/* duplicaient les KPIs du Hub sans filtre ni pagination. */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard
          label="Alertes validation"
          value={nbAlertes}
          tone={nbAlertes > 0 ? "destructive" : "default"}
          icon={AlertTriangle}
        />
      </div>

      {/* Alertes bloquantes */}
      {nbAlertes > 0 && (
        <section className="mb-[var(--space-admin-8)]">
          <h2 className={sectionHeadCls}>Alertes — sessions à risque ({nbAlertes})</h2>

          {sessionsOpcoSansAccord.length > 0 && (
            <div className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-error)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
              <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-error)]">
                OPCO — Accord non reçu ({sessionsOpcoSansAccord.length} session
                {sessionsOpcoSansAccord.length > 1 ? "s" : ""})
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
                    <span className="text-[color:var(--color-admin-warning-fg)]">
                      {FINANCEMENT_LABELS[s.financementType ?? ""] ?? s.financementType} —{" "}
                      {libellerStatutOpco(s.opcoStatut)}
                    </span>
                    <Link
                      href={`/${locale}/${adminPrefix}/qualiopi/sessions/${s.id}/financement`}
                      className="inline-flex min-h-[24px] items-center text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
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
                CPF — Vérification EDOF manquante ({sessionsCpfSansEdof.length} session
                {sessionsCpfSansEdof.length > 1 ? "s" : ""})
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
                      className="inline-flex min-h-[24px] items-center text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
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
    </AdminPageShell>
  );
}
