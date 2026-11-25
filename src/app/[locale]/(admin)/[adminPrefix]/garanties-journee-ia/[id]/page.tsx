/**
 * Admin — Garantie Journée IA · fiche d'un dossier : échéances calculées, saisie des dates, décision,
 * virement, archivage. « Réputée acceptée » est un état CALCULÉ et affiché, jamais écrit.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminSubmitButton } from "@/components/admin/ui/AdminSubmitButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import {
  BadgeEcheance,
  BadgeHorsDelai,
} from "@/components/admin/garanties-journee-ia/BadgeEcheance";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import { dossiersDejaRembourses, lireGarantie } from "@/server/garanties-journee-ia/lecture";
import {
  calculerEcheances,
  demandeHorsDelai,
  estReputeeAcceptee,
} from "@/lib/garantie-journee-ia/echeances";
import {
  aujourdhuiParis,
  etatEcheance,
  jourFr,
  PROCHAINE_ACTION,
} from "@/lib/garantie-journee-ia/presentation";
import {
  archiverGarantieJourneeIaAction,
  enregistrerDatesGarantieJourneeIaAction,
  enregistrerDecisionGarantieJourneeIaAction,
  enregistrerVirementGarantieJourneeIaAction,
} from "@/server/actions/qualiopi/garanties-journee-ia";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dossier de garantie Journée IA | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams: Promise<{ erreur?: string; ok?: string; avertissement?: string }>;
}

const euros = (c: number | null): string =>
  c === null ? "—" : `${(c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;

export default async function GarantieFichePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const q = await searchParams;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const d = await lireGarantie(id);
  if (!d) notFound();

  const aujourdhui = aujourdhuiParis();
  const echeances = calculerEcheances(d, aujourdhui);
  const reputee = estReputeeAcceptee(d, aujourdhui);
  const horsDelai = demandeHorsDelai(d);
  const autres = await dossiersDejaRembourses(d.sirenSnapshot, d.id);
  const ecriture = acces.peutEcrire;
  const argent = peutEngager(acces.role, "facturer");

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title={`Garantie Journée IA — ${d.clientNom}`}
        description={`Journée du ${jourFr(d.dateJournee)} · prix ${euros(d.prixHtCents)} HT · seuil ${euros(d.seuilHtCents)} HT`}
        breadcrumbs={<Link href={`/${locale}/${adminPrefix}/garanties-journee-ia`}>← Liste</Link>}
      />
      {q.erreur ? (
        <p
          role="alert"
          className="mb-4 rounded border border-[color:var(--color-admin-error-fg)] bg-[color:var(--color-admin-error-soft)] p-3 text-sm text-[color:var(--color-admin-error-fg)]"
        >
          {q.erreur}
        </p>
      ) : null}
      {q.ok ? (
        <p
          role="status"
          className="mb-4 rounded border border-[color:var(--color-admin-success-fg)] bg-[color:var(--color-admin-success-soft)] p-3 text-sm text-[color:var(--color-admin-success-fg)]"
        >
          Enregistré.
        </p>
      ) : null}
      {autres.length > 0 || q.avertissement === "siren" ? (
        <p
          role="alert"
          className="mb-4 rounded border border-[color:var(--color-admin-warning-fg)] bg-[color:var(--color-admin-warning-soft)] p-3 text-sm text-[color:var(--color-admin-warning-fg)]"
        >
          Attention : un autre dossier du même SIREN a déjà une décision de remboursement (garantie
          « une seule fois », art. 47.10 e). Le groupe de sociétés n&apos;est pas contrôlé : à vous
          de juger.
        </p>
      ) : null}
      {d.archiveLe ? (
        <p className="mb-4 rounded border p-3 text-sm">Dossier archivé : aucune saisie possible.</p>
      ) : null}

      <h2 className="mb-2 text-lg font-semibold">Échéances</h2>
      {horsDelai ? (
        <p
          role="alert"
          className="mb-2 rounded border border-[color:var(--color-admin-error-fg)] bg-[color:var(--color-admin-error-soft)] p-3 text-sm text-[color:var(--color-admin-error-fg)]"
        >
          <BadgeHorsDelai /> Demande reçue après les 30 jours suivant la remise du rapport. Aucune
          acceptation tacite : décider au cas par cas (rembourser, refuser ou offrir un avoir). Si «
          Rembourser » est choisi, le virement est dû sous 30 jours après la décision.
        </p>
      ) : null}
      {reputee ? (
        <p
          role="alert"
          className="mb-2 rounded border border-[color:var(--color-admin-error-fg)] bg-[color:var(--color-admin-error-soft)] p-3 text-sm text-[color:var(--color-admin-error-fg)]"
        >
          Demande réputée acceptée : aucune réponse écrite dans les 15 jours (état calculé, non
          enregistré). Le virement est dû.
        </p>
      ) : null}
      <ul className="mb-6 flex flex-col gap-2 text-sm">
        {echeances.map((e) => (
          <li key={e.type} className="flex flex-wrap items-center gap-2">
            <BadgeEcheance etat={etatEcheance(e, aujourdhui)} />
            <span>
              {e.libelle} — {jourFr(e.date)}
            </span>
            {e.faite ? null : <span className="text-xs">{PROCHAINE_ACTION[e.type]}</span>}
          </li>
        ))}
      </ul>

      {ecriture && !d.archiveLe ? (
        <>
          <form
            action={enregistrerDatesGarantieJourneeIaAction}
            className="mb-6 flex flex-col gap-3"
          >
            <h2 className="text-lg font-semibold">Dates saisies</h2>
            <input type="hidden" name="id" value={d.id} />
            <label className="flex flex-col gap-1 text-sm">
              Rapport remis le
              <input
                name="rapportRemisLe"
                type="date"
                defaultValue={d.rapportRemisLe ?? ""}
                className="admin-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Demande écrite du client reçue le
              <input
                name="demandeRecueLe"
                type="date"
                defaultValue={d.demandeRecueLe ?? ""}
                className="admin-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Notes internes
              <textarea
                name="notes"
                rows={3}
                defaultValue={d.notes ?? ""}
                className="admin-input"
              />
            </label>
            <AdminSubmitButton>Enregistrer les dates</AdminSubmitButton>
          </form>

          {argent ? (
            <>
              <form
                action={enregistrerDecisionGarantieJourneeIaAction}
                className="mb-6 flex flex-col gap-3"
              >
                <h2 className="text-lg font-semibold">Décision (réponse écrite)</h2>
                <input type="hidden" name="id" value={d.id} />
                <label className="flex flex-col gap-1 text-sm">
                  Décision
                  <select
                    name="decision"
                    defaultValue={d.decision ?? "remboursement"}
                    className="admin-input"
                  >
                    <option value="remboursement">Rembourser</option>
                    <option value="refus">Refuser</option>
                    <option value="avoir">Offrir un avoir</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Réponse envoyée le
                  <input
                    name="decisionLe"
                    type="date"
                    defaultValue={d.decisionLe ?? ""}
                    required
                    className="admin-input"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Montant remboursé (€, si remboursement)
                  <input name="montantRembourseEuros" inputMode="decimal" className="admin-input" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Montant de l&apos;avoir (€ HT, 4 470 € au plus, si « Offrir un avoir »)
                  <input
                    name="montantAvoirEuros"
                    inputMode="decimal"
                    defaultValue={
                      d.montantAvoirHtCents === null ? "" : String(d.montantAvoirHtCents / 100)
                    }
                    className="admin-input"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Total des gains constatés (€, facultatif)
                  <input name="totalGainsEuros" inputMode="decimal" className="admin-input" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Avoir émis le (facultatif)
                  <input
                    name="avoirEmisLe"
                    type="date"
                    defaultValue={d.avoirEmisLe ?? ""}
                    className="admin-input"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Identifiant de l&apos;avoir (Hub factures, facultatif)
                  <input name="avoirId" defaultValue={d.avoirId ?? ""} className="admin-input" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Note (facultative ; obligatoire pour un refus, 10 caractères au moins)
                  <textarea
                    name="motifDecision"
                    rows={2}
                    defaultValue={d.motifDecision ?? ""}
                    className="admin-input"
                  />
                </label>
                <AdminSubmitButton>Enregistrer la décision</AdminSubmitButton>
              </form>

              <form
                action={enregistrerVirementGarantieJourneeIaAction}
                className="mb-6 flex flex-col gap-3"
              >
                <h2 className="text-lg font-semibold">Virement</h2>
                <input type="hidden" name="id" value={d.id} />
                <label className="flex flex-col gap-1 text-sm">
                  Virement effectué le
                  <input
                    name="virementLe"
                    type="date"
                    defaultValue={d.virementLe ?? ""}
                    required
                    className="admin-input"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Montant viré (€) — {euros(d.montantRembourseCents)} enregistré
                  <input name="montantRembourseEuros" inputMode="decimal" className="admin-input" />
                </label>
                <AdminSubmitButton>Enregistrer le virement</AdminSubmitButton>
              </form>
            </>
          ) : (
            <p className="mb-6 text-sm">
              La décision et le virement engagent l&apos;organisme : ils sont réservés aux rôles
              habilités à facturer.
            </p>
          )}
        </>
      ) : null}

      {ecriture ? (
        <form action={archiverGarantieJourneeIaAction}>
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="archiver" value={d.archiveLe ? "non" : "oui"} />
          <AdminSubmitButton variant="destructive">
            {d.archiveLe ? "Désarchiver" : "Archiver (jamais supprimé)"}
          </AdminSubmitButton>
        </form>
      ) : null}
    </AdminPageShell>
  );
}
