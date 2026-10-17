/**
 * Admin — Formateurs freelance › Interrupteurs (lot S0-ter, ADR 0066 (f)).
 *
 * Chaque interrupteur du parcours, son état, ce qui manque pour l'allumer et
 * son dernier changement. Les clés `formateurs.*` ne se changent QU'ICI :
 * l'éditeur générique de réglages les refuse.
 */

import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import {
  INTERRUPTEURS,
  INTERRUPTEURS_ENTREE,
  INTERRUPTEURS_SIGNATURE,
  prealablesManquantsEntree,
  type CleInterrupteurEntree,
  estPositionSure,
  prealablesManquants,
  prealablesManquantsSignature,
  type EtatsInterrupteursSignature,
  type CleInterrupteur,
  type CleInterrupteurSignature,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { PREFIXE_TEXTES_VALIDES } from "@/server/email/textes-valides";
import {
  faitsPrealables,
  libelleVersionContratCadreEnVigueur,
} from "@/server/qualiopi/formateurs-independants/prealables-faits";
import {
  lireInterrupteurs,
  lireInterrupteursEntree,
  lireInterrupteursSignature,
} from "@/server/qualiopi/formateurs-independants/interrupteurs-lecture";
import {
  basculerFormateursFormulaireFreelanceAction,
  basculerFormateursMenuFreelanceAction,
  basculerFormateursModelesComposeurAction,
  basculerFormateursAjoutConsoleAction,
  basculerFormateursSuiviEchangeAction,
  basculerFormateursDossiersContratsAction,
  basculerFormateursVirementsAFaireAction,
  basculerFormateursReponsesFormateursAction,
  basculerFormateursNatureOffreAction,
  basculerFormateursAffectationSureAction,
  basculerFormateursLettreV2Action,
  basculerFormateursGardeMissionPortesAction,
  basculerFormateursPresentationPayeeAction,
  basculerFormateursDas2CommunAction,
  basculerFormateursFinCollaborationAction,
  basculerFormateursChangementCoordonneesAction,
  basculerFormateursChoixCartesAction,
  basculerFormateursRangSuivantAction,
  basculerFormateursMissionsConsoleAction,
  basculerFormateursContratCadreEmissionAction,
  basculerFormateursMiseANiveauAction,
  basculerFormateursNouvelleVersionContratAction,
  basculerFormateursBilanFinFormationAction,
  basculerFormateursCertificatAutoAction,
  basculerFormateursSuiteContratCadreAction,
  basculerSignatureAlertesHorsJetonAction,
  basculerSignatureCopiePartielleAction,
  basculerSignatureExemplaireCaptationAction,
  basculerSignatureExemplaireContratTravailAction,
  basculerFormateursActivationAutoAction,
  basculerFormateursCommunesGeoCronAction,
  basculerFormateursContratAutoAction,
  basculerFormateursControleRegistrePeriodiqueAction,
  basculerFormateursDossierEnLigneAction,
  basculerFormateursEchangeOuvertAction,
  basculerFormateursGardeActivationAction,
  basculerFormateursGardeMissionAction,
  basculerFormateursInvitationAutoAction,
  basculerFormateursLettreAutoAction,
  basculerFormateursPassagePaiementAction,
  basculerFormateursPiecesCronAction,
  basculerFormateursProchesBlocAction,
  basculerFormateursRelancesAutoAction,
  basculerFormateursTextesValidesAction,
} from "@/server/actions/qualiopi/formateurs-interrupteurs";

import { prisma } from "@/lib/prisma";
import { peutEngager } from "@/server/auth/habilitations";
import { inscrireRattrapageFormAction } from "@/server/actions/qualiopi/rattrapage-bascule";
import {
  debutFenetreRattrapage,
  lireApercuRattrapage,
  type ApercuRattrapage,
  type ClientRattrapage,
} from "@/server/qualiopi/formateurs-independants/paiement/rattrapage-bascule";

import { BoutonInterrupteur } from "./BoutonInterrupteur";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Interrupteurs | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const ACTIONS: Record<CleInterrupteur, typeof basculerFormateursTextesValidesAction> = {
  textes_valides: basculerFormateursTextesValidesAction,
  echange_ouvert: basculerFormateursEchangeOuvertAction,
  invitation_auto: basculerFormateursInvitationAutoAction,
  dossier_en_ligne: basculerFormateursDossierEnLigneAction,
  relances_auto: basculerFormateursRelancesAutoAction,
  pieces_cron: basculerFormateursPiecesCronAction,
  controle_registre_periodique: basculerFormateursControleRegistrePeriodiqueAction,
  contrat_auto: basculerFormateursContratAutoAction,
  garde_activation: basculerFormateursGardeActivationAction,
  activation_auto: basculerFormateursActivationAutoAction,
  garde_mission: basculerFormateursGardeMissionAction,
  lettre_auto: basculerFormateursLettreAutoAction,
  passage_paiement: basculerFormateursPassagePaiementAction,
  communes_geo_cron: basculerFormateursCommunesGeoCronAction,
  proches_bloc: basculerFormateursProchesBlocAction,
};

const ACTIONS_SIGNATURE: Record<
  CleInterrupteurSignature,
  typeof basculerFormateursTextesValidesAction
> = {
  copie_partielle: basculerSignatureCopiePartielleAction,
  exemplaire_contrat_travail: basculerSignatureExemplaireContratTravailAction,
  alertes_hors_jeton: basculerSignatureAlertesHorsJetonAction,
  suite_contrat_cadre: basculerFormateursSuiteContratCadreAction,
  exemplaire_captation: basculerSignatureExemplaireCaptationAction,
  affectation_sure: basculerFormateursAffectationSureAction,
  lettre_v2: basculerFormateursLettreV2Action,
  garde_mission_portes: basculerFormateursGardeMissionPortesAction,
  presentation_payee: basculerFormateursPresentationPayeeAction,
  das2_commun: basculerFormateursDas2CommunAction,
  fin_collaboration: basculerFormateursFinCollaborationAction,
  changement_coordonnees: basculerFormateursChangementCoordonneesAction,
  choix_cartes: basculerFormateursChoixCartesAction,
  rang_suivant: basculerFormateursRangSuivantAction,
  missions_console: basculerFormateursMissionsConsoleAction,
  contrat_cadre_emission: basculerFormateursContratCadreEmissionAction,
  mise_a_niveau: basculerFormateursMiseANiveauAction,
  nouvelle_version_contrat: basculerFormateursNouvelleVersionContratAction,
  bilan_fin_formation: basculerFormateursBilanFinFormationAction,
  certificat_auto: basculerFormateursCertificatAutoAction,
};

const ACTIONS_ENTREE: Record<CleInterrupteurEntree, typeof basculerFormateursTextesValidesAction> =
  {
    nature_offre: basculerFormateursNatureOffreAction,
    formulaire_freelance: basculerFormateursFormulaireFreelanceAction,
    menu_freelance: basculerFormateursMenuFreelanceAction,
    modeles_composeur: basculerFormateursModelesComposeurAction,
    ajout_console: basculerFormateursAjoutConsoleAction,
    suivi_echange: basculerFormateursSuiviEchangeAction,
    dossiers_contrats: basculerFormateursDossiersContratsAction,
    reponses_formateurs: basculerFormateursReponsesFormateursAction,
    virements_a_faire: basculerFormateursVirementsAFaireAction,
  };

function libelleEtat(valeur: boolean | string | null, cle: CleInterrupteur): string {
  const sorte = INTERRUPTEURS[cle].sorte;
  if (sorte === "date") return typeof valeur === "string" ? `Le ${valeur}` : "Pas de date";
  if (sorte === "garde_niveau") return valeur === "avertir" ? "Avertir" : "Refuser";
  if (sorte === "garde") return valeur === true ? "Garde active" : "Garde levée";
  return valeur === true ? "Allumé" : "Coupé";
}

const DATE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  /** Lot D2 (M22) : aperçu du rattrapage avant la bascule (`AAAA-MM-01`). */
  searchParams: Promise<{ rattrapage?: string; ok?: string; erreur?: string }>;
}

/** Lot D2 (M22) — l'aperçu nominatif du rattrapage, lecture seule. */
async function apercuRattrapagePourPage(date: string | undefined): Promise<{
  date: string;
  apercu: ApercuRattrapage;
  noms: Map<string, string>;
  sessions: Map<string, string>;
} | null> {
  if (date === undefined || !/^\d{4}-\d{2}-01$/.test(date)) return null;
  const apercu = await lireApercuRattrapage(
    prisma as unknown as ClientRattrapage,
    date,
    debutFenetreRattrapage(date),
  ).catch(() => null);
  if (apercu === null) return null;
  const [formateurs, sessions] = await Promise.all([
    prisma.trainer.findMany({
      where: { id: { in: [...new Set(apercu.couples.map((c) => c.trainerId))] } },
      select: { id: true, prenom: true, nom: true },
    }),
    prisma.trainingSession.findMany({
      where: { id: { in: [...new Set(apercu.couples.map((c) => c.sessionId))] } },
      select: { id: true, numero: true, titreSession: true },
    }),
  ]);
  return {
    date,
    apercu,
    noms: new Map(formateurs.map((f) => [f.id, `${f.prenom} ${f.nom}`.trim()])),
    sessions: new Map(sessions.map((x) => [x.id, `${x.numero} · ${x.titreSession}`])),
  };
}

export default async function InterrupteursFormateursPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = await searchParams;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const { etats, lignes } = await lireInterrupteurs();
  const lignesSignature = await lireInterrupteursSignature();
  // Un préalable peut viser un autre interrupteur de ce registre.
  const etatsSignature = Object.fromEntries(
    lignesSignature.map((l) => [l.cle, l.valeur === true]),
  ) as EtatsInterrupteursSignature;
  const lignesEntree = await lireInterrupteursEntree();
  // Les faits lus dans les réglages (canal de changement de compte : interrupteurs et
  // textes F43/F44). Lecture en échec : aucun fait établi, l'écran montre le refus.
  const faits = faitsPrealables(
    await prisma.setting
      .findMany({
        where: {
          OR: [
            { key: { startsWith: "formateurs." } },
            { key: { startsWith: "signature." } },
            { key: { startsWith: PREFIXE_TEXTES_VALIDES } },
          ],
        },
        select: { key: true, value: true },
      })
      .catch(() => []),
  );
  const direction = acces.role === "super_admin" || acces.role === "admin";
  const remunere = peutEngager(acces.role, "remunerer_formateur");
  const rattrapage = remunere ? await apercuRattrapagePourPage(sp.rattrapage) : null;
  const retour = `/${locale}/${adminPrefix}/qualiopi/formateurs/interrupteurs`;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Interrupteurs"
        description="Formateurs freelance. Couper est toujours possible ; allumer exige ses préalables."
      />
      <AdminCard>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Interrupteur</th>
              <th>État</th>
              <th>Préalables manquants</th>
              <th>Dernier changement</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const def = INTERRUPTEURS[l.cle];
              const sure = estPositionSure(l.cle, l.valeur);
              const cible =
                def.sorte === "garde_niveau"
                  ? l.valeur === "avertir"
                    ? "refuser"
                    : "avertir"
                  : def.sorte === "date"
                    ? "2000-01-01"
                    : l.valeur !== true;
              const manques = sure ? prealablesManquants(l.cle, cible, etats, faits) : [];
              const habilite =
                def.habilitation === "valider_texte_email"
                  ? acces.role === "super_admin"
                  : direction;
              return (
                <tr key={l.cle}>
                  <td>
                    <strong>{def.libelle}</strong>
                    <div className="admin-meta-small">{def.aide}</div>
                    {l.cle === "contrat_auto" ? (
                      <div className="admin-meta-small">
                        Version en vigueur : {libelleVersionContratCadreEnVigueur()}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <AdminBadge tone={sure ? "neutral" : "success"}>
                      {libelleEtat(l.valeur, l.cle)}
                    </AdminBadge>
                    {!l.lisible && l.misAJourLe ? (
                      <div className="admin-meta-small">Valeur illisible : position sûre.</div>
                    ) : null}
                  </td>
                  <td>
                    {manques.length ? (
                      <ul className="admin-meta-small">
                        {manques.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="admin-meta-small">—</span>
                    )}
                  </td>
                  <td className="admin-meta-small">
                    {l.misAJourLe
                      ? `${DATE.format(l.misAJourLe)}${l.misAJourPar ? ` · ${l.misAJourPar}` : ""}`
                      : "Jamais"}
                  </td>
                  <td>
                    <BoutonInterrupteur
                      action={ACTIONS[l.cle]}
                      sorte={def.sorte}
                      valeur={l.valeur}
                      desactive={!habilite}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCard>
      <AdminCard>
        <h2>Comportements neufs livrés coupés</h2>
        <p className="admin-meta-small">
          Comportements ajoutés au socle de signature commun et aux missions, livrés coupés :
          coupés, tout se comporte exactement comme avant eux.
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Interrupteur</th>
              <th>État</th>
              <th>Préalables manquants</th>
              <th>Dernier changement</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lignesSignature.map((l) => {
              const def = INTERRUPTEURS_SIGNATURE[l.cle];
              const manques = l.valeur
                ? []
                : prealablesManquantsSignature(l.cle, true, etats, etatsSignature);
              return (
                <tr key={l.cle}>
                  <td>
                    <strong>{def.libelle}</strong>
                    <div className="admin-meta-small">{def.aide}</div>
                  </td>
                  <td>
                    <AdminBadge tone={l.valeur ? "success" : "neutral"}>
                      {l.valeur ? "Allumé" : "Coupé"}
                    </AdminBadge>
                    {!l.lisible && l.misAJourLe ? (
                      <div className="admin-meta-small">Valeur illisible : position sûre.</div>
                    ) : null}
                  </td>
                  <td>
                    {manques.length ? (
                      <ul className="admin-meta-small">
                        {manques.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="admin-meta-small">—</span>
                    )}
                  </td>
                  <td className="admin-meta-small">
                    {l.misAJourLe
                      ? `${DATE.format(l.misAJourLe)}${l.misAJourPar ? ` · ${l.misAJourPar}` : ""}`
                      : "Jamais"}
                  </td>
                  <td>
                    <BoutonInterrupteur
                      action={ACTIONS_SIGNATURE[l.cle]}
                      sorte="envoi"
                      valeur={l.valeur}
                      desactive={!direction}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCard>
      <AdminCard>
        <h2>Entrée des formateurs freelance</h2>
        <p className="admin-meta-small">
          Nouveautés de l&apos;entrée (offre, candidature, échange), livrées coupées : coupées, tout
          se comporte exactement comme avant elles.
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Interrupteur</th>
              <th>État</th>
              <th>Préalables manquants</th>
              <th>Dernier changement</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lignesEntree.map((l) => {
              const def = INTERRUPTEURS_ENTREE[l.cle];
              const manques = l.valeur ? [] : prealablesManquantsEntree(l.cle, true, etats);
              return (
                <tr key={l.cle}>
                  <td>
                    <strong>{def.libelle}</strong>
                    <div className="admin-meta-small">{def.aide}</div>
                  </td>
                  <td>
                    <AdminBadge tone={l.valeur ? "success" : "neutral"}>
                      {l.valeur ? "Allumé" : "Coupé"}
                    </AdminBadge>
                    {!l.lisible && l.misAJourLe ? (
                      <div className="admin-meta-small">Valeur illisible : position sûre.</div>
                    ) : null}
                  </td>
                  <td>
                    {manques.length ? (
                      <ul className="admin-meta-small">
                        {manques.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="admin-meta-small">—</span>
                    )}
                  </td>
                  <td className="admin-meta-small">
                    {l.misAJourLe
                      ? `${DATE.format(l.misAJourLe)}${l.misAJourPar ? ` · ${l.misAJourPar}` : ""}`
                      : "Jamais"}
                  </td>
                  <td>
                    <BoutonInterrupteur
                      action={ACTIONS_ENTREE[l.cle]}
                      sorte="envoi"
                      valeur={l.valeur}
                      desactive={!direction}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCard>
      {remunere && (
        <AdminCard>
          <h2 id="rattrapage">Avant la bascule : rattrapage du relevé mensuel</h2>
          <p className="admin-meta-small">
            Avant de donner une date au « Passage au paiement par mission », chaque session
            d&apos;un indépendant commencée avant cette date reste au relevé mensuel. L&apos;aperçu
            ne change rien ; l&apos;inscription ajoute seulement ce qui manque.
          </p>
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
          <form method="get" action={retour} className="flex flex-wrap items-end gap-2">
            <label className="admin-label" htmlFor="rattrapage-date">
              Date de bascule prévue (un 1er du mois)
            </label>
            <input
              id="rattrapage-date"
              name="rattrapage"
              type="date"
              defaultValue={rattrapage?.date}
              className="admin-input"
              required
            />
            <button type="submit" className="admin-button-secondary">
              Voir l&apos;aperçu
            </button>
          </form>
          {sp.rattrapage !== undefined && rattrapage === null && (
            <p className="admin-meta-small">
              Aperçu indisponible : la date doit être un 1er du mois.
            </p>
          )}
          {rattrapage !== null && (
            <>
              <p>
                {rattrapage.apercu.couples.length} couple(s) avant le {rattrapage.date} ·{" "}
                <strong>{rattrapage.apercu.aRevendiquer} à inscrire</strong> ·{" "}
                {rattrapage.apercu.conflits.length} déjà revendiqué(s) par mission (à trancher).
              </p>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Formateur</th>
                    <th>Session</th>
                    <th>Première journée</th>
                    <th>Aujourd&apos;hui</th>
                  </tr>
                </thead>
                <tbody>
                  {rattrapage.apercu.couples.map((c) => (
                    <tr key={`${c.trainerId}-${c.sessionId}`}>
                      <td>{rattrapage.noms.get(c.trainerId) ?? "—"}</td>
                      <td>{rattrapage.sessions.get(c.sessionId) ?? "—"}</td>
                      <td>{c.premiereJournee}</td>
                      <td>
                        {c.regimeActuel === null
                          ? "à inscrire"
                          : c.regimeActuel === "par_mission"
                            ? "par mission : à trancher"
                            : "relevé mensuel"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rattrapage.apercu.aRevendiquer > 0 && (
                <form action={inscrireRattrapageFormAction} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="retour" value={retour} />
                  <input type="hidden" name="dateBascule" value={rattrapage.date} />
                  <input
                    type="hidden"
                    name="aRevendiquerVu"
                    value={rattrapage.apercu.aRevendiquer}
                  />
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="confirmer" value="oui" required />
                    J&apos;inscris ces {rattrapage.apercu.aRevendiquer} couple(s) au relevé mensuel.
                  </label>
                  <button type="submit" className="admin-button self-start">
                    Inscrire au relevé mensuel
                  </button>
                </form>
              )}
            </>
          )}
        </AdminCard>
      )}
    </AdminPageShell>
  );
}
