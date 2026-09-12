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
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { DELAI_CONTESTATION_JOURS } from "@/server/qualiopi/remuneration/autofacturation";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { transitionStatementFormAction } from "@/server/actions/qualiopi/trainer-remuneration";
import {
  contesterAutofactureFormAction,
  emettreAutofactureFormAction,
  transmettreAutofactureFormAction,
} from "@/server/actions/qualiopi/autofacture";
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
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

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
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
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
        {/*
          🔴 L'échéance ne s'affichait NULLE PART, alors que la colonne existe
          depuis le 2026-07-09. On ne pouvait pas savoir, en ouvrant un relevé,
          si on était en retard de payer — et l'échéance est ce qui déclenche les
          pénalités de plein droit stipulées à la clause 4 du contrat.
        */}
        {releve.echeance !== null && releve.payeAt === null && (
          <p
            className={
              releve.retardJours === null
                ? "admin-muted mt-[var(--space-admin-2)]"
                : "admin-alert admin-alert-error mt-[var(--space-admin-3)]"
            }
            role={releve.retardJours === null ? undefined : "alert"}
          >
            {releve.retardJours === null ? (
              <>À régler avant le {releve.echeance.toLocaleDateString("fr-FR")}.</>
            ) : (
              <>
                Échéance dépassée depuis {releve.retardJours} jour
                {releve.retardJours > 1 ? "s" : ""} (le{" "}
                {releve.echeance.toLocaleDateString("fr-FR")}). Les pénalités au taux BCE majoré de
                10 points et l&apos;indemnité forfaitaire de 40 € courent de plein droit, sans mise
                en demeure.
              </>
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

      {/*
        ── Autofacturation ───────────────────────────────────────────────────

        🔴 CETTE CARTE EXISTE POUR RENDRE VISIBLE UNE DISTINCTION QUE RIEN
        D'AUTRE NE MONTRE : émise ≠ transmise.

        La fenêtre de contestation de huit jours court depuis la TRANSMISSION.
        Une pièce émise dont l'envoi n'est pas parti n'ouvre AUCUN délai — et
        sans cette carte, l'opérateur verrait « facture reçue » sur le relevé et
        croirait l'affaire close. Il paierait à l'échéance une facture que le
        formateur n'a jamais vue, sans lui avoir laissé la possibilité de la
        contester : la quatrième condition de régularité serait perdue en
        silence.
      */}
      <AdminCard>
        <h2 className="admin-h2">Autofacturation</h2>

        {releve.autofacture.emiseAt === null ? (
          <>
            <p className="admin-muted">
              Établir la facture d&apos;honoraires <strong>au nom et pour le compte</strong> du
              formateur, sur mandat. La pièce porte SON SIRET, SON régime de TVA et la mention «
              Autofacturation », et lui est transmise aussitôt — c&apos;est cette transmission qui
              ouvre ses {DELAI_CONTESTATION_JOURS} jours pour contester.
            </p>
            <p className="admin-muted">
              Sans mandat en vigueur, sans SIRET ou sans régime de TVA renseignés sur sa fiche,
              l&apos;émission est refusée : la pièce serait irrégulière et sa TVA non déductible.
            </p>
            {releve.statut !== "valide" ? (
              <p className="admin-muted">
                Le relevé doit d&apos;abord être <strong>validé</strong> : la facture est émise
                après constat des interventions et des heures animées.
              </p>
            ) : (
              <form action={emettreAutofactureFormAction} className="mt-[var(--space-admin-3)]">
                <input type="hidden" name="statementId" value={releve.id} />
                <input type="hidden" name="retour" value={retour} />
                <button type="submit" className="admin-button">
                  Émettre l&apos;autofacture
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <p>
              Facture <strong>{releve.numeroFacture ?? "—"}</strong> établie le{" "}
              {releve.autofacture.emiseAt.toLocaleDateString("fr-FR")} au nom du formateur.
            </p>

            {/*
              🔴 LA PIÈCE, LÀ OÙ L'ON DÉCIDE DE L'ENVOYER.

              Le PDF existait, `/api/qualiopi/documents/[id]` savait le servir, et
              AUCUN écran n'y menait — la famille « code complet sans appelant »,
              mais côté lecteur. Le bouton « Transmettre » était donc un geste
              aveugle : il ouvre une fenêtre de contestation de huit jours sur un
              document que personne n'avait pu lire.

              Or la transmission reste MANUELLE précisément pour qu'on contrôle
              avant l'envoi (décision de Will). Sans ce lien, on avait le coût du
              geste sans son bénéfice.

              ⚠️ Ouvert dans un onglet : partir consulter la pièce ne doit pas
              faire perdre l'écran d'où l'on va cliquer « Transmettre ».
            */}
            {releve.autofacture.documentId !== null ? (
              <p>
                <a
                  href={`/api/qualiopi/documents/${releve.autofacture.documentId}`}
                  className="admin-button-ghost"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText size={16} aria-hidden />
                  Voir la facture (PDF)
                </a>
              </p>
            ) : (
              // On DIT pourquoi le lien manque plutôt que de ne rien afficher :
              // une absence muette se lit « le PDF n'existe pas », ce qui est
              // faux — il existe, il n'est simplement pas rattaché.
              <p className="admin-muted">
                Cette facture a été émise avant le rattachement des pièces ({" "}
                {releve.numeroFacture ?? "n° inconnu"} ) : elle existe au registre des documents,
                mais aucun lien direct ne l&apos;ouvre depuis cet écran.
              </p>
            )}

            {releve.autofacture.transmiseAt === null ? (
              <>
                {/* 🔴 L'état le plus dangereux du circuit, et il est DIT. */}
                <div className="admin-alert admin-alert-error" role="alert">
                  Pièce émise mais <strong>NON TRANSMISE</strong> : l&apos;envoi n&apos;est pas
                  parti. Aucun délai de contestation ne court, et le formateur ignore que cette
                  facture existe. Ne payez pas sans la lui avoir transmise.
                </div>
                <form
                  action={transmettreAutofactureFormAction}
                  className="mt-[var(--space-admin-3)]"
                >
                  <input type="hidden" name="statementId" value={releve.id} />
                  <input type="hidden" name="retour" value={retour} />
                  <button type="submit" className="admin-button">
                    Transmettre au formateur
                  </button>
                </form>
              </>
            ) : (
              <p className="admin-muted">
                Transmise le {releve.autofacture.transmiseAt.toLocaleDateString("fr-FR")}
                {releve.autofacture.contestationAvantAt !== null && (
                  <>
                    {" "}
                    — contestation possible jusqu&apos;au{" "}
                    {releve.autofacture.contestationAvantAt.toLocaleDateString("fr-FR")} inclus,
                    après quoi la facture est réputée acceptée.
                  </>
                )}
              </p>
            )}

            {releve.autofacture.contesteeAt !== null ? (
              <div className="admin-alert admin-alert-error mt-[var(--space-admin-3)]" role="alert">
                <strong>
                  Contestée le {releve.autofacture.contesteeAt.toLocaleDateString("fr-FR")}
                </strong>{" "}
                — le paiement est bloqué.
                {releve.autofacture.contestationMotif !== null && (
                  <> Motif : « {releve.autofacture.contestationMotif} »</>
                )}
              </div>
            ) : (
              /*
                ⚠️ Le formulaire reste offert même après le terme des huit jours.
                Passé ce délai la facture est « réputée acceptée » — mais cela ne
                fait pas disparaître un désaccord que le formateur exprime. Le
                refuser effacerait un fait et laisserait partir un virement sur
                une pièce contestée. L'arbitrage reste humain ; l'écran le rend
                possible, il ne le préempte pas.
              */
              <form action={contesterAutofactureFormAction} className="mt-[var(--space-admin-4)]">
                <input type="hidden" name="statementId" value={releve.id} />
                <input type="hidden" name="retour" value={retour} />
                <div className="admin-field">
                  <label className="admin-label" htmlFor="motif">
                    Le formateur conteste ? Enregistrez son motif — cela bloque le paiement
                  </label>
                  <textarea id="motif" name="motif" rows={2} className="admin-input" required />
                </div>
                <button type="submit" className="admin-button-ghost mt-[var(--space-admin-2)]">
                  Enregistrer la contestation
                </button>
              </form>
            )}
          </>
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
