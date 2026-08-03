// Coaching 1-to-1 — liste de toutes les séances (admin, tous formateurs).
//
// 🔴 REFONTE 2026-08-03. Cette page était restée sur les jetons du SITE PUBLIC
// — `text-mocha`, `border-sand`, `bg-cream`, `text-terracotta` — et n'employait
// aucune primitive admin : un `<h1>` nu, un `<table>` nu, pas d'`AdminPageShell`.
// Sur le fond admin, ces couleurs sont quasi invisibles : c'est exactement la
// cause du « rien ne s'encadre » corrigé sur `coaching/page.tsx`. Ses deux
// sœurs — celle-ci et `coaching/formateurs` — avaient été oubliées.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
  AdminBadge,
  AdminButton,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { ArrowRight, CalendarX } from "lucide-react";
import { listAllSessions } from "@/server/coaching-admin/queries";
import { coachingInterventionLabel, sessionStatutLabel } from "@/server/formateur/coaching-options";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

type Seance = Awaited<ReturnType<typeof listAllSessions>>[number];

export default async function CoachingSeancesPage({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  const base = `/${locale}/${adminPrefix}/coaching/seances`;
  const sessions = await listAllSessions();

  const colonnes: ReadonlyArray<AdminTableColumn<Seance>> = [
    { key: "date", header: "Date", cell: (s) => dateFmt.format(s.dateSeance) },
    {
      key: "prestation",
      header: "Prestation",
      cell: (s) => coachingInterventionLabel(s.interventionSlug),
    },
    { key: "formateur", header: "Formateur", cell: (s) => `${s.trainer.prenom} ${s.trainer.nom}` },
    {
      key: "beneficiaire",
      header: "Bénéficiaire",
      cell: (s) =>
        s.beneficiaireNom
          ? `${s.beneficiaireNom}${s.beneficiaireEntreprise ? ` (${s.beneficiaireEntreprise})` : ""}`
          : "—",
    },
    {
      key: "statut",
      header: "Statut",
      cell: (s) => <AdminBadge tone="neutral">{sessionStatutLabel(s.statut)}</AdminBadge>,
    },
    {
      // 🔴 Cette colonne affichait « 3 opt · 1 CR · 2 jrn » — trois abréviations
      // que rien n'explicitait, sous un en-tête « Contenu » qui ne les annonçait
      // pas davantage.
      key: "contenu",
      header: "Éléments consignés",
      cell: (s) => (
        <span className="admin-meta-small">
          {s._count.optimisations} optimisation{s._count.optimisations > 1 ? "s" : ""} ·{" "}
          {s._count.comptesRendus} compte{s._count.comptesRendus > 1 ? "s" : ""}-rendu
          {s._count.comptesRendus > 1 ? "s" : ""} · {s._count.journaux} entrée
          {s._count.journaux > 1 ? "s" : ""} de journal
        </span>
      ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Séances 1-to-1"
        description="Toutes les séances d'accompagnement individuel, tous formateurs confondus."
      />

      <AdminCard>
        <AdminTable
          columns={colonnes}
          rows={sessions}
          getRowId={(s) => s.id}
          caption="Liste des séances de coaching 1-to-1"
          emptyState={
            <AdminEmptyState
              icon={<CalendarX size={22} aria-hidden="true" />}
              title="Aucune séance enregistrée"
              description="Les séances apparaissent ici dès qu'un formateur en déclare une."
            />
          }
          rowAction={(s) => (
            <AdminButton href={`${base}/${s.id}`} variant="ghost" size="sm" iconAfter={ArrowRight}>
              Ouvrir
            </AdminButton>
          )}
        />
      </AdminCard>
    </AdminPageShell>
  );
}
