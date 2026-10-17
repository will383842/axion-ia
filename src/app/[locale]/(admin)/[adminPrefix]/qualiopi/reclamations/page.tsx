/**
 * Admin — Qualiopi · Registre des réclamations (T12 / off.31).
 *
 * Liste les réclamations et expose le formulaire de création + réponse.
 * Server Component — auth + lecture DB. Composants clients pour les mutations.
 *
 * Chantier QNC, L09 — quand l'interrupteur `qualiopi.reclamations.actif`
 * couvre une réclamation, sa ligne porte le SUIVI DATÉ (étapes signées,
 * échéances en jours ouvrés, session rattachée, amélioration liée) à la place
 * des gestes libres. Interrupteur éteint : l'écran est celui d'avant.
 */

import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { Hash, Bell, Hourglass, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { listReclamations } from "@/server/qualiopi/registres/reclamations-service";
import {
  creerReclamationAction,
  repondreReclamationAction,
  setStatutReclamationAction,
  ajouterEtapeReclamationAction,
} from "@/server/actions/qualiopi/reclamations";
import { ReclamationSuivi } from "@/components/admin/qualiopi/ReclamationSuivi";
import {
  inscriptionDeTest,
  lireInterrupteurReclamations,
} from "@/server/qualiopi/reclamations/interrupteur";
import {
  lireSuivisReclamations,
  type SuiviReclamation,
} from "@/server/qualiopi/reclamations/lecture";
import {
  ReclamationForm,
  ReclamationReponseForm,
} from "@/components/admin/qualiopi/ReclamationForm";
import { genererRegistrePdfAction } from "@/server/actions/qualiopi/exports-pdf";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Réclamations | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const SOURCE_LABELS: Record<string, string> = {
  stagiaire: "Stagiaire",
  client: "Client",
  financeur: "Financeur",
  autre: "Autre",
};

const STATUT_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  resolue: "Résolue",
  cloturee: "Clôturée",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiReclamationsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const reclamations = await listReclamations({ take: 100 });

  // L09 — le cycle daté, réclamation par réclamation (essai = banc d'essai seul).
  const etatCycle = await lireInterrupteurReclamations();
  const dansLeCycle = new Set<string>();
  if (etatCycle !== "eteint") {
    // Seules les réclamations qui ont une étape de réception entrent dans le cycle.
    const avecReception = new Set(
      (
        await prisma.reclamationEtape.findMany({
          where: { etape: "reception", reclamationId: { in: reclamations.map((r) => r.id) } },
          select: { reclamationId: true },
        })
      ).map((e) => e.reclamationId),
    );
    for (const r of reclamations) {
      if (!avecReception.has(r.id)) continue;
      if (etatCycle === "actif" || (await inscriptionDeTest(r.enrollmentId))) dansLeCycle.add(r.id);
    }
  }
  const suivis = await lireSuivisReclamations(reclamations.filter((r) => dansLeCycle.has(r.id)));
  const inscriptionsRecentes =
    etatCycle === "eteint"
      ? []
      : await prisma.enrollment
          .findMany({
            where: {
              ...(etatCycle === "essai"
                ? { OR: [{ estTestInterne: true }, { session: { estTestInterne: true } }] }
                : {}),
              session: {
                // Date.now() est OK ici : Server Component re-render à chaque requête HTTP.
                // eslint-disable-next-line react-hooks/purity
                dateDebut: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
              },
            },
            select: {
              id: true,
              trainee: { select: { prenom: true, nom: true } },
              session: { select: { numero: true } },
            },
            orderBy: { session: { dateDebut: "desc" } },
            take: 200,
          })
          .catch(() => []);
  const nouvelles = reclamations.filter((r) => r.statut === "nouvelle").length;
  const enCours = reclamations.filter((r) => r.statut === "en_cours").length;
  const resolues = reclamations.filter(
    (r) => r.statut === "resolue" || r.statut === "cloturee",
  ).length;

  const cellCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Réclamations"
        description="Registre des réclamations (indicateur 31). Une alerte est levée si une réclamation reste sans réponse au-delà de 15 jours. Toute réclamation doit être enregistrée et traitée."
        actions={
          <PdfExportButton
            label="Exporter le registre (PDF)"
            input={{ type: "reclamations" as const }}
            action={genererRegistrePdfAction}
          />
        }
      />

      {/* KPIs */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Total" value={reclamations.length} icon={Hash} />
        <AdminStatCard
          label="Nouvelles"
          value={nouvelles}
          tone={nouvelles > 0 ? "warning" : "default"}
          icon={Bell}
        />
        <AdminStatCard
          label="En cours"
          value={enCours}
          tone={enCours > 0 ? "warning" : "default"}
          icon={Hourglass}
        />
        <AdminStatCard
          label="Résolues / clôturées"
          value={resolues}
          tone="success"
          icon={CheckCircle2}
        />
      </div>

      {/* Formulaire création */}
      <div className="mb-[var(--space-admin-8)]">
        <ReclamationForm
          creerAction={creerReclamationAction}
          {...(etatCycle !== "eteint"
            ? {
                cycle: {
                  inscriptions: inscriptionsRecentes.map((i) => ({
                    id: i.id,
                    libelle: `${i.session.numero} — ${`${i.trainee.prenom} ${i.trainee.nom}`.trim()}`,
                  })),
                },
              }
            : {})}
        />
      </div>

      {/* Liste */}
      {reclamations.length === 0 ? (
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Aucune réclamation enregistrée.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Numéro</th>
                <th className={headCls}>Réclamant</th>
                <th className={headCls}>Origine</th>
                <th className={headCls}>Objet</th>
                <th className={headCls}>Reçue le</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Répondu le</th>
                <th className={headCls}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reclamations.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">{r.numero}</span>
                  </td>
                  <td className={cellCls}>
                    <div className="font-medium">{r.reclamantNom}</div>
                    {r.reclamantEmail && (
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {r.reclamantEmail}
                      </div>
                    )}
                  </td>
                  <td className={cellCls}>{SOURCE_LABELS[r.source] ?? r.source}</td>
                  <td className={cellCls}>
                    <div className="max-w-xs">{r.objet}</div>
                    {r.gravite && (
                      <span
                        className={
                          r.gravite === "critique"
                            ? "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
                            : r.gravite === "majeure"
                              ? "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]"
                              : "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                        }
                      >
                        {r.gravite}
                      </span>
                    )}
                  </td>
                  <td className={cellCls}>{r.dateReception.toLocaleDateString("fr-FR")}</td>
                  <td className={cellCls}>
                    <span
                      className={
                        r.statut === "resolue" || r.statut === "cloturee"
                          ? "text-[color:var(--color-admin-success)]"
                          : r.statut === "nouvelle" || r.statut === "en_cours"
                            ? "text-[color:var(--color-admin-warning)]"
                            : "text-[color:var(--color-admin-fg-muted)]"
                      }
                    >
                      {STATUT_LABELS[r.statut] ?? r.statut}
                    </span>
                  </td>
                  <td className={cellCls}>
                    {r.dateReponse != null ? (
                      <span className="text-[color:var(--color-admin-success)]">
                        {r.dateReponse.toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {suivis.get(r.id) !== undefined ? (
                      <SuiviLigne
                        reclamationId={r.id}
                        numero={r.numero}
                        suivi={suivis.get(r.id) as SuiviReclamation}
                        locale={locale}
                      />
                    ) : (
                      r.statut !== "cloturee" && (
                        <ReclamationReponseForm
                          reclamationId={r.id}
                          statutActuel={r.statut}
                          repondreAction={repondreReclamationAction}
                          setStatutAction={setStatutReclamationAction}
                        />
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}

/** L09 — la cellule de suivi d'une réclamation du cycle daté. */
function SuiviLigne({
  reclamationId,
  numero,
  suivi,
  locale,
}: {
  reclamationId: string;
  numero: string;
  suivi: SuiviReclamation;
  locale: "fr" | "en";
}) {
  const session = suivi.rattachement.session;
  return (
    <ReclamationSuivi
      reclamationId={reclamationId}
      numero={numero}
      etapes={suivi.etapes}
      possibles={suivi.possibles}
      echeances={suivi.echeances}
      session={
        session
          ? { libelle: session.libelle, href: adminPath(locale, `qualiopi/sessions/${session.id}`) }
          : null
      }
      stagiaire={suivi.rattachement.stagiaire?.libelle ?? null}
      ameliorations={suivi.ameliorations}
      emailsReponse={suivi.emailsReponse}
      hrefAmelioration={adminPath(locale, "qualiopi/revue-direction")}
      ajouterEtapeAction={ajouterEtapeReclamationAction}
    />
  );
}
