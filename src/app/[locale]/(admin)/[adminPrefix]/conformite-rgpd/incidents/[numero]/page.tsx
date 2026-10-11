/**
 * Admin — Conformité RGPD · fiche d'un incident de données : le compte à rebours
 * CNIL, le formulaire (modifiable) et « Clore ». Administrateurs seulement : les
 * textes y sont déchiffrés. ⛔ Aucune suppression : un incident se clôt.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminSubmitButton } from "@/components/admin/ui/AdminSubmitButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { FormulaireIncident } from "@/components/admin/conformite-rgpd/FormulaireIncident";
import { cloreIncidentAction } from "@/features/conformite-rgpd/actions-incidents";
import { pastilleCnil } from "@/features/conformite-rgpd/incidents";
import { lireIncident, type Incident } from "@/features/conformite-rgpd/incidents-base";
import { peutImporterRegistre } from "@/features/conformite-rgpd/regles";
import { toParisLocalInput } from "@/lib/calendar-grid";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Conformité RGPD — incident | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; numero: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const ouiNon = (v: boolean | null) => (v === true ? "oui" : v === false ? "non" : "");

/** La fiche au format des champs du formulaire (dates en heure de Paris). */
function valeursFormulaire(i: Incident): Record<string, string> {
  const date = (d: Date | null) => (d ? toParisLocalInput(d) : "");
  return {
    decouvertLe: date(i.decouvertLe),
    survenuLe: date(i.survenuLe),
    description: i.description,
    donneesConcernees: i.donneesConcernees ?? "",
    nombrePersonnes: i.nombrePersonnes === null ? "" : String(i.nombrePersonnes),
    categoriesPersonnes: i.categoriesPersonnes ?? "",
    consequences: i.consequences ?? "",
    mesuresPrises: i.mesuresPrises ?? "",
    declareCnil: ouiNon(i.declareCnil),
    declareCnilLe: date(i.declareCnilLe),
    motifNonDeclaration: i.motifNonDeclaration ?? "",
    personnesPrevenues: ouiNon(i.personnesPrevenues),
    personnesPrevenuesLe: date(i.personnesPrevenuesLe),
    motifNonInformation: i.motifNonInformation ?? "",
  };
}

export default async function FicheIncidentPage({ params, searchParams }: PageProps) {
  const { adminPrefix, numero } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  }
  const base = `/fr/${adminPrefix}/conformite-rgpd`;
  if (!peutImporterRegistre(acces.role)) {
    return (
      <AccesRefuse
        motif="La fiche d'un incident est réservée aux administrateurs."
        retourHref={`${base}?onglet=incidents`}
      />
    );
  }
  const sp = await searchParams;
  const incident = /^\d{1,10}$/.test(numero) ? await lireIncident(Number(numero)) : null;
  if (!incident) notFound();
  const cnil = pastilleCnil(incident, new Date());

  return (
    <AdminPageShell width="wide">
      <div className="flex flex-col gap-[var(--space-admin-5)]">
        <AdminPageHeader
          title={`Incident n° ${incident.numero}`}
          breadcrumbs={
            <Link href={`${base}?onglet=incidents`} className="underline-offset-2 hover:underline">
              ← Incidents
            </Link>
          }
          meta={
            <span className="flex flex-wrap gap-[var(--space-admin-2)]">
              <AdminBadge tone={cnil.ton} dot>
                {cnil.libelle}
              </AdminBadge>
              {incident.statut === "clos" ? (
                <AdminBadge tone="neutral">Clos</AdminBadge>
              ) : (
                <AdminBadge tone="warning">Ouvert</AdminBadge>
              )}
            </span>
          }
          actions={
            incident.statut === "ouvert" ? (
              <form action={cloreIncidentAction}>
                <input type="hidden" name="incidentId" value={incident.id} />
                <input type="hidden" name="numero" value={incident.numero} />
                <AdminSubmitButton pendingLabel="Enregistrement…">Clore</AdminSubmitButton>
              </form>
            ) : undefined
          }
        />
        {sp.enregistre === "1" ? (
          <p role="status" className="admin-alert admin-alert-success">
            Incident enregistré.
          </p>
        ) : null}
        {sp.clos === "1" ? (
          <p role="status" className="admin-alert admin-alert-success">
            Incident clos.
          </p>
        ) : null}
        {sp.erreur ? (
          <p role="alert" className="admin-alert admin-alert-error">
            Refusé. {sp.erreur.slice(0, 400)}
          </p>
        ) : null}
        <FormulaireIncident
          key={incident.id}
          initial={valeursFormulaire(incident)}
          incidentId={incident.id}
          numero={incident.numero}
          libelle="Enregistrer"
        />
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Déclaré par {incident.creeParNom}.
        </p>
      </div>
    </AdminPageShell>
  );
}
