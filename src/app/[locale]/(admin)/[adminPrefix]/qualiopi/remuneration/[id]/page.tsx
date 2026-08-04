/**
 * Admin — Qualiopi · Détail d'un relevé d'honoraires.
 *
 * Montre TOUTES les lignes du formateur sur la période, pas seulement celles qui
 * sont facturées : cacher une ligne analytique ou prévisionnelle rendrait le
 * total incompréhensible (« pourquoi 3 jours animés et 2 facturés ? »).
 *
 * Les actions offertes viennent de `transitionsPossibles(statut)` — la même
 * matrice que celle qui garde l'action serveur. L'UI ne peut donc proposer un
 * bouton que l'action refuserait, ni oublier une transition légale.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { transitionStatementFormAction } from "@/server/actions/qualiopi/trainer-remuneration";
import { getReleveDetail } from "@/server/qualiopi/remuneration/queries";
import { transitionsPossibles } from "@/server/qualiopi/remuneration/run";
import {
  euros,
  libelleAnomalie,
  LIBELLE_MODELE,
  LIBELLE_NATURE,
  LIBELLE_STATUT_LIGNE,
  LIBELLE_STATUT_RELEVE,
  MOIS_FR,
  TON_STATUT_LIGNE,
  TON_STATUT_RELEVE,
  libelleRegimeTva,
  libellePrestation,
} from "../_labels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Relevé d'honoraires | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}

export default async function ReleveDetailPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const sp = await searchParams;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const releve = await getReleveDetail(id);
  if (releve === null) notFound();

  const listeUrl = `/${locale}/${adminPrefix}/qualiopi/remuneration`;
  const retour = `${listeUrl}/${id}`;
  const cibles = transitionsPossibles(releve.statut);

  // La facture n'est réclamée qu'au moment où on la reçoit.
  const demandeFacture = cibles.includes("facture_recue");
  const demandePaiement = cibles.includes("paye");
  const ecartFacture =
    releve.montantFactureTtcCents !== null &&
    releve.montantFactureTtcCents !== releve.totalTtcCents;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`Relevé — ${releve.trainerNom}`}
        description={`${MOIS_FR[releve.periodeMonth - 1]} ${releve.periodeYear} · régime ${libelleRegimeTva(releve.tvaRegime)}`}
        meta={
          <AdminBadge tone={TON_STATUT_RELEVE[releve.statut]} dot>
            {LIBELLE_STATUT_RELEVE[releve.statut]}
          </AdminBadge>
        }
      />

      <Link href={listeUrl} className="admin-link">
        <ArrowLeft size={14} aria-hidden /> Retour aux relevés
      </Link>

      {sp.ok !== undefined && (
        <div className="admin-alert admin-alert-success" role="status">
          {sp.ok}
        </div>
      )}
      {sp.erreur !== undefined && (
        <div className="admin-alert admin-alert-error" role="alert">
          {sp.erreur}
        </div>
      )}

      {/* ── Totaux ────────────────────────────────────────────────────────── */}
      <AdminCard>
        <h2 className="admin-h2">Montants</h2>
        <dl className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-3">
          <div>
            <dt className="admin-muted">Total HT</dt>
            <dd className="tabular-nums">{euros(releve.totalHtCents)}</dd>
          </div>
          <div>
            <dt className="admin-muted">TVA</dt>
            <dd className="tabular-nums">{euros(releve.tvaCents)}</dd>
          </div>
          <div>
            <dt className="admin-muted">Total TTC</dt>
            <dd className="tabular-nums">{euros(releve.totalTtcCents)}</dd>
          </div>
        </dl>

        {releve.numeroFacture !== null && (
          <p className="admin-muted mt-[var(--space-admin-3)]">
            Facture {releve.numeroFacture}
            {releve.montantFactureTtcCents !== null && (
              <> — {euros(releve.montantFactureTtcCents)} TTC</>
            )}
          </p>
        )}
        {ecartFacture && (
          <div className="admin-alert admin-alert-error mt-[var(--space-admin-3)]" role="alert">
            La facture reçue ne correspond pas au montant dû. Le paiement restera bloqué tant que
            l&apos;écart n&apos;est pas levé — rejeter la facture, ou corriger le relevé.
          </div>
        )}
        {releve.payeAt !== null && (
          <p className="admin-muted mt-[var(--space-admin-3)]">
            Payé le {releve.payeAt.toLocaleDateString("fr-FR")}
            {releve.moyenPaiement !== null && <> par {releve.moyenPaiement}</>}
          </p>
        )}
      </AdminCard>

      {/* ── Transitions ───────────────────────────────────────────────────── */}
      <AdminCard>
        <h2 className="admin-h2">Actions</h2>
        {cibles.length === 0 ? (
          <p className="admin-muted">
            Ce relevé est dans un état terminal. Une correction se fait par une ligne
            d&apos;ajustement sur la période suivante, jamais en réécrivant celui-ci.
          </p>
        ) : (
          <form
            action={transitionStatementFormAction}
            className="flex flex-col gap-[var(--space-admin-4)]"
          >
            <input type="hidden" name="id" value={releve.id} />
            <input type="hidden" name="retour" value={retour} />

            {demandeFacture && (
              <fieldset className="flex flex-wrap gap-[var(--space-admin-3)]">
                <legend className="admin-label">Facture reçue du formateur</legend>
                <div className="admin-field">
                  <label className="admin-label" htmlFor="numeroFacture">
                    Numéro
                  </label>
                  <input id="numeroFacture" name="numeroFacture" className="admin-input" />
                </div>
                <div className="admin-field">
                  <label className="admin-label" htmlFor="dateFacture">
                    Date
                  </label>
                  <input id="dateFacture" name="dateFacture" type="date" className="admin-input" />
                </div>
                <div className="admin-field">
                  <label className="admin-label" htmlFor="montantFactureTtcEuros">
                    Montant TTC (€)
                  </label>
                  <input
                    id="montantFactureTtcEuros"
                    name="montantFactureTtcEuros"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={(releve.totalTtcCents / 100).toFixed(2)}
                    className="admin-input"
                  />
                </div>
              </fieldset>
            )}

            {demandePaiement && (
              <fieldset className="flex flex-wrap gap-[var(--space-admin-3)]">
                <legend className="admin-label">Paiement</legend>
                <div className="admin-field">
                  <label className="admin-label" htmlFor="moyenPaiement">
                    Moyen
                  </label>
                  <input
                    id="moyenPaiement"
                    name="moyenPaiement"
                    defaultValue="virement"
                    className="admin-input"
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-label" htmlFor="referenceVirement">
                    Référence
                  </label>
                  <input id="referenceVirement" name="referenceVirement" className="admin-input" />
                </div>
              </fieldset>
            )}

            <div className="flex flex-wrap gap-[var(--space-admin-3)]">
              {cibles.map((cible) => (
                <button
                  key={cible}
                  type="submit"
                  name="to"
                  value={cible}
                  className={cible === "annule" ? "admin-button-ghost" : "admin-button"}
                >
                  {LIBELLE_STATUT_RELEVE[cible]}
                </button>
              ))}
            </div>
            <p className="admin-muted">
              Un paiement n&apos;est possible qu&apos;après réception d&apos;une facture dont le TTC
              égale le montant dû.
            </p>
          </form>
        )}
      </AdminCard>

      {/* ── Lignes ────────────────────────────────────────────────────────── */}
      <AdminCard>
        <h2 className="admin-h2">Lignes du mois</h2>
        <p className="admin-muted">
          Toutes les lignes du formateur sur la période. Seules celles marquées « facturée » entrent
          dans le total.
        </p>
        <table className="admin-table mt-[var(--space-admin-3)]">
          <thead>
            <tr>
              <th scope="col">Prestation</th>
              <th scope="col">Modèle</th>
              <th scope="col">Nature</th>
              <th scope="col">Statut</th>
              <th scope="col" className="text-right">
                Heures
              </th>
              <th scope="col" className="text-right">
                Montant HT
              </th>
              <th scope="col">Facturée</th>
            </tr>
          </thead>
          <tbody>
            {releve.lignes.map((l) => (
              <tr key={l.id}>
                <td>
                  {libellePrestation(l.prestationType)}
                  {l.motif !== null && (
                    <>
                      {" "}
                      <AdminBadge tone="destructive" compact>
                        {libelleAnomalie(l.motif)}
                      </AdminBadge>
                    </>
                  )}
                </td>
                <td>{LIBELLE_MODELE[l.model]}</td>
                <td>{LIBELLE_NATURE[l.nature]}</td>
                <td>
                  <AdminBadge tone={TON_STATUT_LIGNE[l.statut]} compact>
                    {LIBELLE_STATUT_LIGNE[l.statut]}
                  </AdminBadge>
                </td>
                <td className="text-right tabular-nums">{l.heures ?? "—"}</td>
                <td className="text-right tabular-nums">{euros(l.montantHtCents)}</td>
                <td>{l.rattacheeAuReleve ? "oui" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>
    </AdminPageShell>
  );
}
