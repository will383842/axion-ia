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
import { ArrowLeft, CheckCircle2, FileText } from "lucide-react";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminBlocRepliable } from "@/components/admin/ui/AdminBlocRepliable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { DELAI_CONTESTATION_JOURS } from "@/server/qualiopi/remuneration/autofacturation";
import { transitionStatementFormAction } from "@/server/actions/qualiopi/trainer-remuneration";
import {
  contesterAutofactureFormAction,
  emettreAutofactureFormAction,
  transmettreAutofactureFormAction,
} from "@/server/actions/qualiopi/autofacture";
import { getReleveDetail } from "@/server/qualiopi/remuneration/queries";
import {
  ibanAffichePourVirement,
  motifsChangementIbanDu,
} from "@/server/qualiopi/formateurs-independants/paiement/virement-mission-base";
import { LIBELLE_SUSPENSION_VIREMENT } from "@/server/qualiopi/formateurs-independants/paiement/virement-mission";
import { prisma } from "@/lib/prisma";
import { transitionsPossibles } from "@/server/qualiopi/remuneration/run";
import { euros, LIBELLE_STATUT_RELEVE, MOIS_FR, libelleRegimeTva } from "../_labels";
import {
  LignesDuMois,
  MessageFormateurNonRetenu,
  PastilleStatutReleve,
  TuilesReleve,
} from "../_composants";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { TEXTES_FORMATEUR } from "@/lib/email/templates/formateur-independant-textes";
import {
  accepterDesaccordFormAction,
  refuserDesaccordFormAction,
} from "@/server/actions/qualiopi/desaccord-mission";
import { LIBELLE_ANOMALIE_MISSION } from "@/server/qualiopi/formateurs-independants/paiement/anomalies-mission";
import {
  apercuDesaccordAccepte,
  LONGUEUR_MAX_MOTIF_NON_RETENU,
  LONGUEUR_MIN_MOTIF_NON_RETENU,
} from "@/server/qualiopi/formateurs-independants/paiement/desaccord-mission";
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
  // Lot D (M6) : un relevé de mission se paie sur l'IBAN AFFICHÉ ici ; son
  // empreinte repart avec le formulaire et est comparée au clic.
  const ibanAffiche =
    demandePaiement && releve.origine === "passage_mission"
      ? await ibanAffichePourVirement(prisma, releve.trainerId).catch(() => null)
      : null;
  // Règle C-1 (relecture de la PR 1561) : mission ET mensuel. Les mêmes motifs que le clic
  // refusera ; `null` : demandes illisibles (le clic refusera aussi).
  const motifsIban = demandePaiement
    ? await motifsChangementIbanDu(prisma, releve.trainerId, new Date()).catch(() => null)
    : [];
  // Lot D2 (M10) : un désaccord ouvert sur une facture de MISSION se tranche ici.
  const desaccordOuvert =
    releve.origine === "passage_mission" &&
    releve.avoirDeId === null &&
    releve.autofacture.contesteeAt !== null &&
    releve.desaccord.closeAt === null &&
    releve.statut !== "annule" &&
    releve.statut !== "paye";
  const apercuAccepte = desaccordOuvert
    ? await apercuDesaccordAccepte(releve.id).catch(() => null)
    : null;
  const f59 = TEXTES_FORMATEUR["formateur-desaccord-non-retenu"].variantes[0].paragraphes.map((p) =>
    p
      .replace("[date]", releve.autofacture.contesteeAt?.toLocaleDateString("fr-FR") ?? "[date]")
      .replace("[numéro]", releve.numeroFacture ?? "[numéro]"),
  );
  const ecartFacture =
    releve.montantFactureTtcCents !== null &&
    releve.montantFactureTtcCents !== releve.totalTtcCents;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`Relevé — ${releve.trainerNom}`}
        description={`${MOIS_FR[releve.periodeMonth - 1]} ${releve.periodeYear} · régime ${libelleRegimeTva(releve.tvaRegime)}`}
        meta={<PastilleStatutReleve statut={releve.statut} />}
      />

      <div>
        <div>
          <Link href={listeUrl} className="admin-link">
            <ArrowLeft size={14} aria-hidden /> Retour aux relevés
          </Link>
        </div>

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

        {/* ── Chiffres clés ─────────────────────────────────────────────────── */}
        <TuilesReleve
          totalHtCents={releve.totalHtCents}
          tvaCents={releve.tvaCents}
          totalTtcCents={releve.totalTtcCents}
          payeAt={releve.payeAt}
          echeance={releve.echeance}
          retardJours={releve.retardJours}
          ecartFacture={ecartFacture}
        />

        {/* ── Montants : détails sous les tuiles ────────────────────────────── */}
        <AdminBloc teinte="gris" titre="Montants">
          <div className="flex flex-col gap-[var(--space-admin-3)] pt-[var(--space-admin-3)]">
            {releve.numeroFacture !== null && (
              <p className="admin-muted">
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
                  releve.retardJours === null ? "admin-muted" : "admin-alert admin-alert-error"
                }
                role={releve.retardJours === null ? undefined : "alert"}
              >
                {releve.retardJours === null ? (
                  <>À régler avant le {releve.echeance.toLocaleDateString("fr-FR")}.</>
                ) : (
                  <>
                    Échéance dépassée depuis {releve.retardJours} jour
                    {releve.retardJours > 1 ? "s" : ""} (le{" "}
                    {releve.echeance.toLocaleDateString("fr-FR")}). Les pénalités au taux BCE majoré
                    de 10 points et l&apos;indemnité forfaitaire de 40 € courent de plein droit,
                    sans mise en demeure.
                  </>
                )}
              </p>
            )}
            {ecartFacture && (
              <div className="admin-alert admin-alert-error" role="alert">
                La facture reçue ne correspond pas au montant dû. Le paiement restera bloqué tant
                que l&apos;écart n&apos;est pas levé — rejeter la facture, ou corriger le relevé.
              </div>
            )}
            {releve.payeAt !== null && (
              <p className="admin-muted">
                Payé le {releve.payeAt.toLocaleDateString("fr-FR")}
                {releve.moyenPaiement !== null && <> par {releve.moyenPaiement}</>}
              </p>
            )}
          </div>
        </AdminBloc>

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
        <AdminBloc teinte="bleu" titre="Autofacturation">
          <div className="flex flex-col gap-[var(--space-admin-4)]">
            {releve.autofacture.emiseAt === null ? (
              <>
                <AdminBlocRepliable titre="Comment ça marche">
                  <div className="flex flex-col gap-[var(--space-admin-3)]">
                    <p className="admin-muted">
                      Établir la facture d&apos;honoraires <strong>au nom et pour le compte</strong>{" "}
                      du formateur, sur mandat. La pièce porte SON SIRET, SON régime de TVA et la
                      mention « Autofacturation », et lui est transmise aussitôt — c&apos;est cette
                      transmission qui ouvre ses {DELAI_CONTESTATION_JOURS} jours pour contester.
                    </p>
                    <p className="admin-muted">
                      Sans mandat en vigueur, sans SIRET ou sans régime de TVA renseignés sur sa
                      fiche, l&apos;émission est refusée : la pièce serait irrégulière et sa TVA non
                      déductible.
                    </p>
                  </div>
                </AdminBlocRepliable>
                {releve.statut !== "valide" ? (
                  <p className="admin-alert admin-alert-warning" role="status">
                    Le relevé doit d&apos;abord être <strong>validé</strong> : la facture est émise
                    après constat des interventions et des heures animées.
                  </p>
                ) : (
                  <form action={emettreAutofactureFormAction}>
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
                    {releve.numeroFacture ?? "n° inconnu"} ) : elle existe au registre des
                    documents, mais aucun lien direct ne l&apos;ouvre depuis cet écran.
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
                    <form action={transmettreAutofactureFormAction}>
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

                {releve.autofacture.contesteeAt !== null &&
                releve.desaccord.closeIssue === "non_retenue" ? (
                  <div className="admin-alert admin-alert-success" role="status">
                    <strong>
                      Désaccord du {releve.autofacture.contesteeAt.toLocaleDateString("fr-FR")} non
                      retenu le {releve.desaccord.closeAt?.toLocaleDateString("fr-FR")}
                    </strong>{" "}
                    — le paiement est débloqué. Motif envoyé : « {releve.desaccord.closeMotif} »
                  </div>
                ) : releve.autofacture.contesteeAt !== null ? (
                  <div className="admin-alert admin-alert-error" role="alert">
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
                  <form
                    action={contesterAutofactureFormAction}
                    className="flex flex-col gap-[var(--space-admin-2)]"
                  >
                    <input type="hidden" name="statementId" value={releve.id} />
                    <input type="hidden" name="retour" value={retour} />
                    <div className="admin-field">
                      <label className="admin-label" htmlFor="motif">
                        Le formateur conteste ? Enregistrez son motif — cela bloque le paiement
                      </label>
                      <textarea id="motif" name="motif" rows={2} className="admin-input" required />
                    </div>
                    <div>
                      <button type="submit" className="admin-button-ghost">
                        Enregistrer la contestation
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </AdminBloc>

        {/* ── Lot D2 (M22) : anomalies constatées par le passage ────────────── */}
        {releve.anomaliesMission.length > 0 && (
          <AdminBloc teinte="ambre" titre="Anomalies du passage">
            <ul className="m-0 flex list-none flex-col gap-[var(--space-admin-4)] p-0">
              {releve.anomaliesMission.map((a) => (
                <li
                  key={`${a.code}-${a.detail}`}
                  className="rounded-[var(--radius-admin-md)] border border-l-4 border-[color:var(--color-admin-border)] border-l-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
                >
                  <strong>{LIBELLE_ANOMALIE_MISSION[a.code].pourquoi}</strong>{" "}
                  <span className="admin-muted">
                    ({a.detail} · constaté le{" "}
                    {new Date(`${a.constateLe}T12:00:00Z`).toLocaleDateString("fr-FR")})
                  </span>
                  <br />
                  {LIBELLE_ANOMALIE_MISSION[a.code].quoiFaire}
                </li>
              ))}
            </ul>
            <p className="admin-muted pt-[var(--space-admin-3)]">
              Rien n&apos;est validé seul : chaque relevé de mission attend votre validation.
            </p>
          </AdminBloc>
        )}

        {/* ── Lot D2 (M10) : avoir, réémission, désaccord ──────────────────── */}
        {(releve.avoirs.length > 0 ||
          releve.remplacements.length > 0 ||
          releve.remplaceId !== null ||
          releve.avoirDeId !== null) && (
          <AdminBloc teinte="gris" titre="Correction de la facture">
            <ul className="m-0 flex list-none flex-col gap-[var(--space-admin-3)] p-0">
              {releve.avoirDeId !== null && (
                <li>
                  Ce relevé est un avoir.{" "}
                  <Link className="admin-link" href={`${listeUrl}/${releve.avoirDeId}`}>
                    Voir la facture annulée
                  </Link>
                </li>
              )}
              {releve.remplaceId !== null && (
                <li>
                  Ce relevé remplace une facture annulée par avoir.{" "}
                  <Link className="admin-link" href={`${listeUrl}/${releve.remplaceId}`}>
                    Voir la facture d&apos;origine
                  </Link>
                </li>
              )}
              {releve.avoirs.map((a) => (
                <li key={a.id}>
                  Avoir {a.numeroFacture ?? "(numéro à venir avec la nouvelle facture)"}.{" "}
                  <Link className="admin-link" href={`${listeUrl}/${a.id}`}>
                    Voir l&apos;avoir
                  </Link>
                </li>
              ))}
              {releve.remplacements.map((n) => (
                <li key={n.id}>
                  Relevé réémis {n.numeroFacture ?? `(${LIBELLE_STATUT_RELEVE[n.statut]})`}.{" "}
                  <Link className="admin-link" href={`${listeUrl}/${n.id}`}>
                    Voir le relevé réémis
                  </Link>
                </li>
              ))}
            </ul>
          </AdminBloc>
        )}

        {desaccordOuvert && (
          <AdminBloc teinte="ambre" titre="Désaccord du formateur : à trancher">
            <div className="flex flex-col gap-[var(--space-admin-4)]">
              <p className="admin-alert admin-alert-warning" role="status">
                Reçu le {releve.autofacture.contesteeAt?.toLocaleDateString("fr-FR")} : «{" "}
                {releve.autofacture.contestationMotif ?? "non précisé"} ». Le paiement de ce relevé
                est bloqué.
              </p>

              <h3 className="admin-h3">Désaccord accepté</h3>
              <p className="admin-muted">
                Corrigez d&apos;abord la donnée d&apos;origine (journées, forfait) dans les écrans
                de la mission. L&apos;outil recalcule alors le relevé : aucun montant ne se saisit
                ici.
              </p>
              {apercuAccepte === null ? (
                <p className="admin-muted">Aperçu indisponible : rechargez la page.</p>
              ) : !apercuAccepte.ok ? (
                <p className="admin-alert admin-alert-warning" role="status">
                  {apercuAccepte.motif === "rien_n_a_change"
                    ? "Le recalcul donne exactement la facture contestée : corrigez d'abord la donnée d'origine."
                    : apercuAccepte.motif === "mois_non_payable"
                      ? "Le recalcul ne trouve pas un mois complet (feuilles ou conditions manquantes)."
                      : apercuAccepte.motif === "lignes_non_recalculables"
                        ? "Ce relevé porte une indemnité ou un ajustement : correction à la main."
                        : `Recalcul impossible (${apercuAccepte.motif}).`}
                </p>
              ) : (
                <form
                  action={accepterDesaccordFormAction}
                  className="flex flex-col gap-[var(--space-admin-2)]"
                >
                  <input type="hidden" name="statementId" value={releve.id} />
                  <input type="hidden" name="retour" value={retour} />
                  <input
                    type="hidden"
                    name="htVuCents"
                    value={apercuAccepte.nouveau.releve.totalHtCents}
                  />
                  <p>
                    Facture {apercuAccepte.ancien.numero} :{" "}
                    {euros(apercuAccepte.ancien.totalHtCents)} HT +{" "}
                    {euros(apercuAccepte.ancien.tvaCents)} TVA ={" "}
                    {euros(apercuAccepte.ancien.totalTtcCents)} TTC, annulée par un avoir total.
                  </p>
                  <p>
                    Relevé recalculé : {euros(apercuAccepte.nouveau.releve.totalHtCents)} HT +{" "}
                    {euros(apercuAccepte.nouveau.releve.tvaCents)} TVA ={" "}
                    <strong>{euros(apercuAccepte.nouveau.releve.totalTtcCents)} TTC</strong>, réémis
                    « à valider », même échéance que la facture d&apos;origine.
                  </p>
                  <label className="flex min-h-[44px] items-center gap-[var(--space-admin-2)]">
                    <input type="checkbox" name="confirmer" value="oui" required />
                    La donnée d&apos;origine est corrigée : j&apos;émets l&apos;avoir et je réémets
                    ce relevé.
                  </label>
                  <button type="submit" className="admin-button self-start">
                    Désaccord accepté : avoir et réémission
                  </button>
                </form>
              )}

              <h3 className="admin-h3">Désaccord non retenu</h3>
              <MessageFormateurNonRetenu paragraphes={f59} />
              <form
                action={refuserDesaccordFormAction}
                className="flex flex-col gap-[var(--space-admin-2)]"
              >
                <input type="hidden" name="statementId" value={releve.id} />
                <input type="hidden" name="retour" value={retour} />
                <label className="admin-label" htmlFor="motif-non-retenu">
                  Votre motif (il remplace « [motif écrit par vous] »)
                </label>
                <textarea
                  id="motif-non-retenu"
                  name="motif"
                  rows={3}
                  required
                  minLength={LONGUEUR_MIN_MOTIF_NON_RETENU}
                  maxLength={LONGUEUR_MAX_MOTIF_NON_RETENU}
                  className="admin-input"
                />
                <label className="flex min-h-[44px] items-center gap-[var(--space-admin-2)]">
                  <input type="checkbox" name="confirmer" value="oui" required />
                  Je ne retiens pas ce désaccord : F59 part et le paiement est débloqué.
                </label>
                <button type="submit" className="admin-button-secondary self-start">
                  Désaccord non retenu
                </button>
              </form>
            </div>
          </AdminBloc>
        )}

        {/* ── Transitions ───────────────────────────────────────────────────── */}
        <AdminBloc teinte="gris" titre="Actions">
          {cibles.length === 0 ? (
            <AdminEmptyState
              variant="inline"
              icon={<CheckCircle2 size={28} aria-hidden />}
              title="Aucune action possible"
              description="Ce relevé est dans un état terminal. Une correction se fait par une ligne d'ajustement sur la période suivante, jamais en réécrivant celui-ci."
            />
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
                    <input
                      id="dateFacture"
                      name="dateFacture"
                      type="date"
                      className="admin-input"
                    />
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
                  {motifsIban === null ? (
                    <p className="admin-alert admin-alert-error w-full" role="alert">
                      Demandes de changement de compte illisibles : le paiement sera refusé.
                    </p>
                  ) : (
                    motifsIban.length > 0 && (
                      <p className="admin-alert admin-alert-error w-full" role="alert">
                        {motifsIban.map((m) => LIBELLE_SUSPENSION_VIREMENT[m]).join(" ")} Paiement
                        refusé tant que ce motif tient.
                      </p>
                    )
                  )}
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
                    <input
                      id="referenceVirement"
                      name="referenceVirement"
                      className="admin-input"
                    />
                  </div>
                  {releve.origine === "passage_mission" &&
                    (ibanAffiche !== null ? (
                      <p className="admin-muted w-full">
                        Virement sur le compte se terminant par{" "}
                        <strong className="tabular-nums">{ibanAffiche.fin4}</strong>. Si le compte
                        change avant votre clic, le paiement est refusé.
                        <input
                          type="hidden"
                          name="ibanEmpreinteAffichee"
                          value={ibanAffiche.empreinte}
                        />
                      </p>
                    ) : (
                      <p className="admin-alert admin-alert-error w-full" role="alert">
                        Aucun IBAN lisible pour ce formateur : le virement ne peut pas être marqué
                        fait.
                      </p>
                    ))}
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
                Un paiement n&apos;est possible qu&apos;après réception d&apos;une facture dont le
                TTC égale le montant dû.
              </p>
            </form>
          )}
        </AdminBloc>

        {/* ── Lignes ────────────────────────────────────────────────────────── */}
        <AdminBloc teinte="gris" titre="Lignes du mois">
          <div className="flex flex-col gap-[var(--space-admin-4)]">
            <AdminBlocRepliable titre="Comment lire ces lignes">
              <p className="admin-muted">
                Toutes les lignes du formateur sur la période. Seules celles marquées « facturée »
                entrent dans le total.
              </p>
            </AdminBlocRepliable>
            <LignesDuMois lignes={releve.lignes} />
          </div>
        </AdminBloc>
      </div>
    </AdminPageShell>
  );
}
