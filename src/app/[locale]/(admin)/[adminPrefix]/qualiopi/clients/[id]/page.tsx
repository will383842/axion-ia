/**
 * Admin — Qualiopi · Fiche client 360°.
 *
 * 🔴 Cette vue manquait : la liste des clients pointait directement sur le
 * FORMULAIRE d'édition — pour savoir ce qu'on a vendu à un client (sessions,
 * devis, factures, encours), il fallait ouvrir six listes et filtrer de tête.
 * La fiche réunit tout : identité + contact, 4 KPI (dont l'encours dû réel),
 * puis les 10 dernières lignes de chaque relation.
 *
 * Liens vérifiés dans l'arborescence (2026-08-02) :
 * - fiches existantes : sessions/[id], audits/[id], devis/[id], facturation/[id]
 * - PAS de fiche contrat de coaching (seul coaching/seances/[id] existe, c'est
 *   une séance) → lignes en texte simple, sans lien.
 * - PAS de fiche dossier de financement (panel dans le hub facturation) →
 *   « Tout voir » renvoie au hub.
 * - PAS de registre DocumentGenere dédié → section sans « Tout voir ».
 * - Aucune liste ne supporte de filtre `?client=` → les « Tout voir » sont des
 *   liens simples vers la liste, pas des listes pré-filtrées.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 *
 * ## Dossier client (chantier visio, PR 3) — sept onglets (Résumé, Rendez-vous, Questionnaire, E-mails, Prestations, Personnes, Devis et factures)
 *
 * « Pièces et facturation » (tout ce qui précède, inchangé) reste ouvert à tous
 * les rôles de la console : `gardePage("consultation")` reste EN TÊTE.
 *
 * Synthèse, Projets, Échanges et Personnes portent ce que le client a DIT en
 * rendez-vous. Régime FILTRE de la décision A2 : hors `ROLES_DOSSIER_ECHANGES`
 * (Will et les administrateurs), ils ne sont NI RENDUS NI REQUÊTÉS — la lecture
 * `features/dossier-client/queries` n'est appelée qu'après
 * `peutVoirLesEchanges(acces.role)` — et un message NOMME la raison.
 * Garde : `./__tests__/un-lecteur-ne-voit-ni-synthese-ni-echanges.spec.tsx`.
 */

import * as E from "@/components/admin/dossier-client/fiche/emplacements";
import { FilDesEchanges } from "@/components/admin/dossier-client/FilDesEchanges";
import { lireFilDesEchanges } from "@/features/dossier-client/fil-des-echanges";
import { prisma } from "@/lib/prisma";
import { SuiviPrestations } from "@/components/admin/dossier-client/SuiviPrestations";
import {
  assemblerPrestations,
  lireSuivisDesProjets,
} from "@/features/dossier-client/suivi-prestations";
import { BandeauOuEnEst } from "@/components/admin/dossier-client/BandeauOuEnEst";
import {
  construireBandeau,
  TEXTE_LECTURE_IMPOSSIBLE,
  type LigneBandeau,
} from "@/features/dossier-client/bandeau-ou-en-est";
import { BlocQuestionnaireFiche } from "@/components/admin/dossier-client/BlocQuestionnaireFiche";
import { lireQuestionnairesDeLaFiche } from "@/features/dossier-client/questionnaires-de-la-fiche";
import { exportCompletActif } from "@/features/questionnaire-preaudit/export-complet";
import { suiviActif } from "@/features/questionnaire-preaudit/ouvertures";
import { lireBrouillonAction } from "@/features/questionnaire-preaudit/actions-suivi-ouvertures";
import type { Metadata } from "next";
import { SuppressionManuelle } from "@/components/admin/dossier-client/SuppressionManuelle";
import { adminPath } from "@/lib/admin-path";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { calculerEncoursDuCents } from "@/server/qualiopi/crm/clients";
import { opcoDuClient, OPCO_LABELS } from "@/server/qualiopi/financements/opco-referentiel";
import {
  anneeParis,
  consommationOpcoParAnnee,
} from "@/server/qualiopi/financements/consommation-opco";
import { DejaPrisEnChargeOpco } from "@/components/admin/qualiopi/DejaPrisEnChargeOpco";
import { rafraichirEffectifInseeFormAction } from "@/server/actions/qualiopi/clients";
import { bandeauEtatFonds } from "@/server/qualiopi/financements/etat-fonds-opco";
import { etatFondsDuClient } from "@/server/qualiopi/financements/etat-fonds-opco-lecture";
import { BandeauEtatFonds } from "@/components/admin/qualiopi/BandeauEtatFonds";
import { bandeauPourLeRole } from "@/server/partners/client-attributions";
import { AVERTISSEMENT_SIREN_CONTRAIRE, sirenContreditLeSiret, sirenDuClient } from "@/lib/siret";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminFilterTabs } from "@/components/admin/ui/AdminFilterTabs";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import { envoiAllume } from "@/server/qualiopi/formateurs-independants/interrupteurs-envoi";
import { lireFormateursProches } from "@/server/qualiopi/formateurs-proches/formateurs-proches-service";
import { FormateursProches } from "@/components/admin/qualiopi/FormateursProches";
import {
  OngletEchanges,
  OngletPersonnes,
  OngletProjets,
  OngletSynthese,
} from "@/components/admin/dossier-client/Onglets";
import { motifSansAccesAuxEchanges, peutVoirLesEchanges } from "@/features/dossier-client/acces";
import { consoliderFaits } from "@/features/dossier-client/consolider-faits";
import { confirmerSirenFormAction } from "@/features/dossier-client/actions";
import { sirenProposeParQuestionnaire } from "@/features/questionnaire-preaudit/completer-fiche";
import {
  lireCaseTestVisible,
  lireFichesVivantes,
  lireFusionsDeLaFiche,
  lirePersonnesCourtes,
} from "@/features/dossier-client/queries-rencontres";
import { NouveauRendezVous } from "@/components/admin/dossier-client/NouveauRendezVous";
import { FusionDeFiches } from "@/components/admin/dossier-client/FusionDeFiches";
import { BrancheOpcoBloc } from "@/components/admin/qualiopi/BrancheOpcoBloc";
import { lireMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { compterDocumentsParProjet } from "@/features/dossier-client/documents/queries";
import { toParisLocalInput } from "@/lib/calendar-grid";
import {
  rechercherSiren,
  type ResultatAnnuaire,
} from "@/features/dossier-client/recherche-entreprises";
import {
  lireFaitsARanger,
  lireFaitsDuClient,
  lirePersonnesDuClient,
  lireProjetsDuClient,
  lireRencontresDuClient,
} from "@/features/dossier-client/queries";

export const dynamic = "force-dynamic";

const COMPTEURS_VIDES: Readonly<Record<string, E.CompteurOnglet>> = {};

/**
 * Abri d'un emplacement : si sa lecture échoue, la fiche reste affichée et la place dit « Lecture
 * impossible » (jamais un trou muet). Avec `repli`, c'est cette valeur qui est rendue (compteurs).
 */
async function abri<T>(lecture: () => Promise<T>): Promise<T | React.ReactElement>;
async function abri<T, R>(lecture: () => Promise<T>, repli: R): Promise<T | R>;
async function abri<T, R>(
  lecture: () => Promise<T>,
  repli?: R,
): Promise<T | R | React.ReactElement> {
  try {
    return await lecture();
  } catch {
    if (repli !== undefined) return repli;
    return (
      <AdminBloc teinte="gris" niveau={3} titre="Lecture impossible">
        <p role="status" className="text-[length:var(--text-admin-sm)]">
          Cette partie de la fiche : {TEXTE_LECTURE_IMPOSSIBLE}. Rechargez la page ; le reste de la
          fiche reste fiable.
        </p>
      </AdminBloc>
    );
  }
}
export const metadata: Metadata = {
  title: "Qualiopi — Fiche client | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Libellés + tonalités FR (convention console : maps locales par page)
// ─────────────────────────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "info" | "success" | "warning" | "destructive";

const CLIENT_STATUT: Record<string, { label: string; tone: BadgeTone }> = {
  prospect: { label: "Prospect", tone: "neutral" },
  devis_envoye: { label: "Devis envoyé", tone: "warning" },
  client_actif: { label: "Client actif", tone: "success" },
  client_inactif: { label: "Client inactif", tone: "neutral" },
  perdu: { label: "Perdu", tone: "destructive" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Briques locales (RSC pur)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams?: Promise<{
    onglet?: string;
    bloc?: string;
    erreur?: string;
    annuaire?: string;
    message?: string;
    releve?: string;
    supprimer?: string;
    retirer?: string;
    jeton?: string;
    sceau?: string;
  }>;
}

const ONGLETS_DOSSIER = [
  "resume",
  "activite",
  "rendez-vous",
  "questionnaire",
  "emails",
  "prestations",
  "personnes",
] as const;
type Onglet = (typeof ONGLETS_DOSSIER)[number] | "devis-factures";

const LIBELLE_ONGLET: Readonly<Record<Onglet, string>> = {
  resume: "Résumé",
  activite: "Activité",
  "rendez-vous": "Rendez-vous",
  questionnaire: "Questionnaire",
  emails: "E-mails",
  prestations: "Prestations",
  personnes: "Personnes",
  "devis-factures": "Devis et factures",
};

/**
 * Les anciens noms d'onglets (adresses déjà enregistrées : redirections des actions, liens des
 * pages de rendez-vous, e-mails) mènent au nouvel onglet. Aucune adresse ne casse.
 */
const ANCIENS_ONGLETS: Readonly<Record<string, Onglet>> = {
  synthese: "resume",
  echanges: "rendez-vous",
  projets: "prestations",
  facturation: "devis-factures",
};

/** L'onglet demandé, ramené à ce que le rôle peut voir. */
function ongletAffiche(demande: string | undefined, voitEchanges: boolean): Onglet {
  if (!voitEchanges) return "devis-factures";
  const d = ANCIENS_ONGLETS[demande ?? ""] ?? demande;
  if (d === "devis-factures") return "devis-factures";
  // L'onglet Activité n'existe que lorsque son lot l'a rempli.
  if (d === "activite") return E.ONGLET_ACTIVITE_PRET ? "activite" : "resume";
  return (ONGLETS_DOSSIER as ReadonlyArray<string>).includes(d ?? "") ? (d as Onglet) : "resume";
}

export default async function FicheClient360Page({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const sp = (await searchParams) ?? {};

  // Le rôle est consulté AVANT toute lecture du dossier (régime A2, voir plus bas).
  const voitEchanges = peutVoirLesEchanges(acces.role);

  const client = await E.lireClient360Cache(id);
  if (!client) notFound();

  const qBase = `/${locale}/${adminPrefix}/qualiopi`;
  const clientsBase = `${qBase}/clients`;
  const ficheHref = `${clientsBase}/${client.id}`;

  // ── Dossier client : régime FILTRE (décision A2) ─────────────────────────
  // 🔴 La vérification du rôle PRÉCÈDE toute lecture du dossier : hors de la
  // liste, aucune requête n'est faite (pas seulement aucun rendu).
  const onglet = ongletAffiche(sp.onglet, voitEchanges);
  // N1 : seuls les messages scellés par nos actions s'affichent (un lien forgé, rien).
  const erreur = lireMessageDeRetour(sp, "erreur");
  const maintenant = new Date();
  const ctx: E.ContexteFiche = {
    clientId: client.id,
    locale,
    adminPrefix,
    qBase,
    ficheHref,
    role: acces.role,
    peutEcrire: acces.peutEcrire,
    voitEchanges,
    maintenant,
    sp,
    erreur,
    message: lireMessageDeRetour(sp, "message"),
  };
  // Lot OPCO A5 : suspension de la branche ou date limite de dépôt de l'OPCO.
  const bandeauFonds = bandeauEtatFonds(await etatFondsDuClient(client, maintenant));
  // Lot OPCO A7d : ce que l'OPCO a déjà pris en charge, année en cours et précédente.
  const estEntreprise = client.type === "entreprise";
  const opcoClient = opcoDuClient(client);
  const anneeCourante = anneeParis(maintenant);
  const priseEnChargeOpco =
    estEntreprise && opcoClient !== null
      ? await consommationOpcoParAnnee(client.id, opcoClient, [anneeCourante, anneeCourante - 1])
      : null;
  // Retour du bouton « Rafraîchir depuis l'INSEE » (message scellé).
  const messageReleveInsee =
    sp.releve === "insee"
      ? (lireMessageDeRetour(sp, "message") ?? lireMessageDeRetour(sp, "erreur"))
      : null;

  // « SIREN à compléter » : l'annuaire public n'est interrogé que sur demande
  // (lien « Chercher le SIREN »), côté serveur, 3 s au plus. Aucun JavaScript
  // dans le navigateur : la console est au bord de son cliquet de poids.
  // Lot A9 : le SIREN se lit aussi dans le SIRET (règle unique `sirenDuClient`).
  const sirenLu = estEntreprise ? sirenDuClient(client) : null;
  // INT-T07-A : le bandeau d'attribution d'Axion Partners, décidé ICI, au serveur, pour le rôle déjà
  // jugé par la garde : un rôle qui ne crée pas de devis n'appelle pas Partners et ne reçoit aucun nom.
  const bandeauPartners = await bandeauPourLeRole(acces.role, sirenLu);
  const sirenContraire = estEntreprise && sirenContreditLeSiret(client);
  const sirenACompleter = estEntreprise && sirenLu === null;
  // Le SIREN tapé par le prospect dans le questionnaire avant audit : PROPOSÉ, jamais posé
  // sans le clic de Will (« Poser ce SIREN » passe par la porte unique et son verrou).
  // Lecture d'appoint : une panne ici ne doit jamais empêcher la fiche de s'afficher.
  const sirenPropose =
    sirenACompleter && acces.peutEcrire
      ? await sirenProposeParQuestionnaire(client.id).catch(() => null)
      : null;
  const annuaire: ResultatAnnuaire | null =
    sirenACompleter && acces.peutEcrire && sp.annuaire === "1"
      ? await rechercherSiren(client.raisonSociale, client.adresseVille ?? null)
      : null;
  const ongletCourant = typeof sp.onglet === "string" ? sp.onglet : "";

  // Lot L15c — « Formateurs proches » (W6 D-W6-1) : au-dessus des onglets, pour
  // les rôles qui habilitent un formateur. 🔴 Le rôle est jugé AVANT toute
  // lecture : hors rôle, ni l'interrupteur ni les formateurs ne sont requêtés.
  // Interrupteur `formateurs.proches_bloc` absent = encadré absent.
  const proches =
    peutEngager(acces.role, "habiliter_formateur") && (await envoiAllume("proches_bloc"))
      ? await lireFormateursProches(client.id, maintenant)
      : undefined;

  // Bandeau « Où en est ce client » : mêmes lectures de dossier que les onglets, donc mêmes
  // garde de rôle (rien n'est requêté hors `voitEchanges`). Une lecture en panne ne bloque pas la
  // fiche, mais elle ne se lit JAMAIS comme « rien » : la ligne dit « lecture impossible ».
  // Les lectures réussies servent aussi aux onglets (une seule lecture par affichage) ; une
  // lecture en panne y est refaite, pour que l'onglet montre la vraie erreur.
  let lignesBandeau: ReadonlyArray<LigneBandeau> | null = null;
  let rendezVousLus: Awaited<ReturnType<typeof lireRencontresDuClient>> | null = null;
  let questionnairesLus: Awaited<ReturnType<typeof lireQuestionnairesDeLaFiche>> | null = null;
  let projetsLus: Awaited<ReturnType<typeof lireProjetsDuClient>> | null = null;
  if (voitEchanges) {
    const enPanneBandeau: LigneBandeau["cle"][] = [];
    const lire = async <T,>(cle: LigneBandeau["cle"], lecture: Promise<T>): Promise<T | null> =>
      lecture.catch(() => {
        enPanneBandeau.push(cle);
        return null;
      });
    const [rendezVous, questionnairesBandeau, filBandeau, prestationsBandeau] = await Promise.all([
      lire("rendez_vous", lireRencontresDuClient(id)),
      lire("questionnaire", lireQuestionnairesDeLaFiche(id)),
      lire("email", lireFilDesEchanges(id, adminPrefix)),
      lire("prestations", lireProjetsDuClient(id)),
    ]);
    rendezVousLus = rendezVous;
    questionnairesLus = questionnairesBandeau;
    projetsLus = prestationsBandeau;
    lignesBandeau = construireBandeau({
      maintenant,
      rendezVous: rendezVous ?? [],
      questionnaires: questionnairesBandeau ?? [],
      fil: filBandeau?.fil ?? [],
      prestations: prestationsBandeau ?? [],
      nbDevis: client.devis.length,
      enPanne: enPanneBandeau,
      sourcesDuFilEnPanne: filBandeau?.sourcesEnPanne ?? 0,
    });
  }

  let contenuDossier: React.ReactNode = null;
  if (voitEchanges && onglet === "resume") {
    const [faits, projets, resumeDesTaches, resumeDesPrestations, resumeDesNotes] =
      await Promise.all([
        lireFaitsDuClient(id),
        projetsLus ?? lireProjetsDuClient(id),
        abri(() => E.resumeTaches(ctx)),
        abri(() => E.resumePrestations(ctx)),
        abri(() => E.resumeNotes(ctx)),
      ]);
    contenuDossier = (
      <>
        {/* EMPLACEMENT:RESUME-TACHES (lot B3) */}
        {resumeDesTaches}
        {/* EMPLACEMENT:RESUME-PRESTATIONS (lot B8) */}
        {resumeDesPrestations}
        {/* EMPLACEMENT:RESUME-NOTES (lot B4) */}
        {resumeDesNotes}
        <OngletSynthese
          consolidation={consoliderFaits(faits, projets, maintenant)}
          projets={projets}
          ficheHref={ficheHref}
          erreur={erreur}
        />
      </>
    );
  } else if (voitEchanges && onglet === "activite") {
    // EMPLACEMENT:ONGLET-ACTIVITE (lot B2)
    contenuDossier = await abri(() => E.ongletActivite(ctx));
  } else if (voitEchanges && onglet === "questionnaire") {
    const questionnaires = questionnairesLus ?? (await lireQuestionnairesDeLaFiche(id));
    const enBref = await abri(() => E.questionnaireEnBref(ctx));
    contenuDossier = (
      <>
        {/* EMPLACEMENT:QUESTIONNAIRE-EN-BREF (lot B10) */}
        {enBref}
        {questionnaires.length === 0 ? (
          <p className="mb-[var(--space-admin-6)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucun questionnaire n&apos;a été envoyé à ce client.
          </p>
        ) : (
          <BlocQuestionnaireFiche
            questionnaires={questionnaires}
            adminPrefix={adminPrefix}
            ficheHref={ficheHref}
            afficherOuvertures={suiviActif()}
            voitBrouillons={acces.role === "super_admin" && suiviActif()}
            voitAdresses={acces.role === "super_admin"}
            peutExporter={acces.role === "super_admin" && exportCompletActif()}
            // Le contenu d'un brouillon : super-administrateur ET interrupteur (l'action revérifie).
            {...(acces.role === "super_admin" && suiviActif()
              ? { lireBrouillon: lireBrouillonAction }
              : {})}
          />
        )}
      </>
    );
  } else if (voitEchanges && onglet === "emails") {
    const fil = await lireFilDesEchanges(id, adminPrefix);
    // Les rendez-vous ont leur onglet : celui-ci ne montre que les courriers.
    contenuDossier = (
      <FilDesEchanges
        fil={fil.fil.filter((x) => x.genre !== "rendez_vous")}
        sourcesEnPanne={fil.sourcesEnPanne}
        clientId={id}
        adminPrefix={adminPrefix}
      />
    );
  } else if (voitEchanges && onglet === "prestations") {
    const [projets, faitsARanger, nbDocuments] = await Promise.all([
      projetsLus ?? lireProjetsDuClient(id),
      lireFaitsARanger(id),
      compterDocumentsParProjet(id),
    ]);
    // Ce que le client a pris (type, étape, montant) : lecture d'appoint, une panne ne cache rien.
    const suivis = await lireSuivisDesProjets(projets.map((p) => p.id));
    contenuDossier = (
      <>
        {suivis !== null ? (
          <SuiviPrestations
            clientId={id}
            prestations={assemblerPrestations(projets, suivis)}
            ficheHref={ficheHref}
            message={sp.bloc === "suivi" ? lireMessageDeRetour(sp, "message") : null}
            erreur={sp.bloc === "suivi" ? erreur : null}
          />
        ) : null}
        <OngletProjets
          clientId={id}
          projets={projets}
          faitsARanger={faitsARanger}
          ficheHref={ficheHref}
          qBase={qBase}
          erreur={sp.bloc === "suivi" ? null : erreur}
          nbDocuments={nbDocuments}
        />
      </>
    );
  } else if (voitEchanges && onglet === "rendez-vous") {
    const [rencontres, projets, personnesCourtes, caseTest] = await Promise.all([
      rendezVousLus ?? lireRencontresDuClient(id),
      projetsLus ?? lireProjetsDuClient(id),
      lirePersonnesCourtes(id),
      lireCaseTestVisible(id),
    ]);
    contenuDossier = (
      <>
        {/* Chantier visio (PR 4, B9) : un rendez-vous hors Calendly en 2 clics. */}
        <NouveauRendezVous
          clientId={id}
          projetId={null}
          personnes={personnesCourtes}
          caseTestVisible={caseTest}
          debutParDefaut={
            toParisLocalInput(new Date(maintenant.getTime() + 24 * 3_600_000)).slice(0, 11) +
            "10:00"
          }
        />
        <OngletEchanges
          rencontres={rencontres}
          projets={projets}
          rendezVousBase={`/${locale}/${adminPrefix}/rendez-vous`}
          maintenant={maintenant}
        />
      </>
    );
  } else if (voitEchanges && onglet === "personnes") {
    const [personnes, projets, fusions, fichesVivantes, decision] = await Promise.all([
      lirePersonnesDuClient(id),
      lireProjetsDuClient(id),
      lireFusionsDeLaFiche(id),
      lireFichesVivantes(),
      abri(() => E.personnesDecision(ctx)),
    ]);
    contenuDossier = (
      <>
        {/* EMPLACEMENT:PERSONNES-DECISION (lot B5) */}
        {decision}
        <OngletPersonnes
          clientId={id}
          personnes={personnes}
          projets={projets}
          // Le refus d'un retrait s'affiche dans son écran, pas sous « Ajouter une personne ».
          erreur={sp.retirer ? null : erreur}
          message={lireMessageDeRetour(sp, "message")}
          retrait={(personneId) => <E.ActionsDeLaPersonne ctx={ctx} personneId={personneId} />}
        />
        {/* Chantier visio (PR 4, A3) : fusion déclenchée par Will, réversible. */}
        <FusionDeFiches
          clientId={id}
          fusions={fusions}
          fiches={fichesVivantes.filter((f) => f.id !== id)}
        />
      </>
    );
  }

  // « Facture établie hors console » : lecture d'appoint (une panne ne cache pas l'onglet).
  const factureHorsConsoleLe =
    voitEchanges && onglet === "devis-factures"
      ? await prisma.clientFactureHorsConsole
          .findUnique({ where: { clientId: client.id }, select: { etabliLe: true } })
          .then((l) => l?.etabliLe ?? null)
          .catch(() => null)
      : null;

  const encoursDuCents = calculerEncoursDuCents(client.facturesFormation);
  // La requête ramène TOUTES les factures (l'encours l'exige) ; l'affichage,
  // lui, s'aligne sur les autres sections : les 10 dernières.
  const factures = client.facturesFormation.slice(0, 10);

  // Valeurs des emplacements de l'en-tête : rien n'est lu hors `voitEchanges` (régime A2).
  const [enTete, archivage, compteurs] = voitEchanges
    ? await Promise.all([
        abri(() => E.enTeteFiche(ctx)),
        abri(() => E.archivageFiche(ctx)),
        // EMPLACEMENT:COMPTEURS (lot B1)
        abri(() => E.compteursOnglets(ctx), COMPTEURS_VIDES),
      ])
    : ([null, null, COMPTEURS_VIDES] as const);

  const statutClient = CLIENT_STATUT[client.statut];
  const adresseStructuree = [
    client.adresseRue,
    [client.adresseCodePostal, client.adresseVille].filter(Boolean).join(" "),
  ]
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join(", ");
  const adresse = adresseStructuree !== "" ? adresseStructuree : (client.adresse ?? null);
  const nbEmailsAValider = client._count.emailsEnAttente;

  const infoLabelCls =
    "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  const infoValueCls =
    "mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const sectionCls = "mb-[var(--space-admin-8)]";
  // `mb-0!` : le `margin-bottom` de `.admin-carte` s'ajouterait au `gap` de la grille.
  const blocCls = "admin-carte mb-0! min-w-0";
  const blocTitreCls = "admin-carte-titre";

  // Adresse et pénalités : au bloc Société d'une entreprise, au bloc Contact
  // d'un particulier (lot A9).
  const adresseEtPenalites = (
    <>
      <div className="sm:col-span-2">
        <p className={infoLabelCls}>Adresse</p>
        <p className={infoValueCls}>{adresse ?? "—"}</p>
      </div>
      {/* Pénalités de retard : APPLICATION opt-in, désactivée par défaut.
          Affiché sur la fiche parce que c'est une décision commerciale qu'on
          doit pouvoir constater sans ouvrir le formulaire d'édition.
          ⚠️ Ne dit RIEN des mentions légales, imprimées sans condition sur
          toute facture (art. L.441-9 / L.441-10 / D.441-5). */}
      <div className="sm:col-span-2">
        <p className={infoLabelCls}>Pénalités de retard</p>
        <p className={infoValueCls}>
          {client.penalitesRetardActives
            ? "Appliquées à ce client (chiffrées dans les relances)"
            : "Non appliquées (mentions légales imprimées sur les factures dans tous les cas)"}
        </p>
      </div>
    </>
  );

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={clientsBase}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Clients
        </Link>
      </div>

      <AdminPageHeader
        title={client.raisonSociale}
        meta={
          <>
            <AdminBadge tone="neutral">{client.numero}</AdminBadge>
            <AdminBadge tone="outline">
              {client.type === "particulier" ? "Particulier" : "Entreprise"}
            </AdminBadge>
            <AdminBadge tone={statutClient?.tone ?? "neutral"} dot>
              {statutClient?.label ?? client.statut}
            </AdminBadge>
          </>
        }
        actions={
          <>
            {/* Le wizard pré-sélectionne le client (?clientId=) : le parcours
                de vente démarre depuis la fiche, sans re-chercher le client. */}
            {/* Envoi du questionnaire, SANS rendez-vous : bouton secondaire (aucun bouton plein quand le
                lecteur voit les échanges). Il ouvre la page d'aperçu ; rien ne part sans le clic
                « Envoyer ». */}
            {voitEchanges ? (
              <AdminButton variant="secondary" href={`${ficheHref}/questionnaire`}>
                Envoyer le questionnaire
              </AdminButton>
            ) : null}
            <AdminButton
              variant={voitEchanges ? "secondary" : "primary"}
              href={`${qBase}/vente/new?clientId=${client.id}`}
            >
              Nouvelle vente
            </AdminButton>
            <AdminButton variant="secondary" href={`${clientsBase}/${client.id}/edit`}>
              Modifier la fiche
            </AdminButton>
          </>
        }
      />

      {/* EMPLACEMENT:EN-TETE (lot B1) */}
      {enTete}

      <BandeauEtatFonds bandeau={bandeauFonds} />

      {/* Suppression MANUELLE (Will, 25/10/2026) : super-administrateur seul, après confirmation. */}
      <SuppressionManuelle
        type="client"
        id={client.id}
        peutSupprimer={acces.role === "super_admin"}
        page={adminPath("fr", `/qualiopi/clients/${client.id}`)}
        ouvert={sp.supprimer === "client"}
        jeton={sp.jeton ?? null}
        erreur={erreur}
      />
      {/* EMPLACEMENT:ARCHIVAGE (lot B6) */}
      {archivage}

      {proches !== undefined ? (
        <FormateursProches resultat={proches} formateursBase={`${qBase}/formateurs`} />
      ) : null}

      {lignesBandeau !== null && !E.EN_TETE_REMPLACE_LE_BANDEAU ? (
        <BandeauOuEnEst lignes={lignesBandeau} ficheHref={ficheHref} />
      ) : null}

      {/* ── Onglets du dossier client (A2 : administrateurs seulement) ─────── */}
      {voitEchanges ? (
        <AdminFilterTabs
          className="mb-[var(--space-admin-6)]"
          current={onglet}
          options={([...ONGLETS_DOSSIER, "devis-factures"] as const)
            .filter((o) => o !== "activite" || E.ONGLET_ACTIVITE_PRET)
            .map((o) => ({
              value: o,
              label: LIBELLE_ONGLET[o],
              href: `${ficheHref}?onglet=${o}`,
              ...(compteurs[o]?.count !== undefined ? { count: compteurs[o].count } : {}),
            }))}
        />
      ) : (
        <p className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          {motifSansAccesAuxEchanges(acces.role)}
        </p>
      )}

      {erreur !== null && onglet === "devis-factures" ? (
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]">
          {erreur}
        </p>
      ) : null}

      {onglet === "resume" || onglet === "devis-factures" ? (
        <>
          {/* ── Branche et OPCO (lot OPCO A7b) : IDCC, effectif, OPCO, enveloppe,
            adhérent ; « Modifier » sur place. Rien pour un particulier. ────────── */}
          <BrancheOpcoBloc
            client={client}
            peutEcrire={acces.peutEcrire}
            complementEffectif={
              <>
                {acces.peutEcrire && sirenLu !== null && client.effectifSource !== "saisie" ? (
                  <form
                    action={rafraichirEffectifInseeFormAction}
                    className="mt-[var(--space-admin-1)]"
                  >
                    <input type="hidden" name="clientId" value={client.id} />
                    <AdminButton type="submit" variant="secondary">
                      Rafraîchir depuis l&apos;INSEE
                    </AdminButton>
                  </form>
                ) : null}
                {messageReleveInsee !== null ? (
                  <p
                    role="status"
                    className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]"
                  >
                    {messageReleveInsee}
                  </p>
                ) : null}
              </>
            }
          />

          {/* ── Société | Contact (lot A9) ─────────────────────────────────────────
            Deux blocs : aucun identifiant de la société ne doit sembler appartenir
            à la personne. Un particulier n'a que le bloc Contact. L'effectif et
            l'OPCO se lisent dans « Branche et OPCO », une seule fois. ─────────── */}
          <div className={`${sectionCls} grid gap-[var(--space-admin-4)] lg:grid-cols-[3fr_2fr]`}>
            {estEntreprise ? (
              <section data-bloc="societe" aria-labelledby="bloc-societe" className={blocCls}>
                <h2 id="bloc-societe" className={blocTitreCls}>
                  Société
                </h2>
                <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className={infoLabelCls}>Raison sociale</p>
                    <p className={infoValueCls}>{client.raisonSociale}</p>
                  </div>
                  <div>
                    <p className={infoLabelCls}>SIRET</p>
                    <p className={`${infoValueCls} font-mono`}>{client.siret ?? "—"}</p>
                  </div>
                  <div>
                    <p className={infoLabelCls}>SIREN</p>
                    {sirenLu !== null ? (
                      <>
                        <p className={`${infoValueCls} font-mono`}>{sirenLu}</p>
                        {sirenContraire ? (
                          <div className="mt-[var(--space-admin-2)]">
                            <AdminBloc
                              teinte="terracotta"
                              niveau={3}
                              titre="SIREN contredit le SIRET"
                            >
                              <p role="status" className="text-[length:var(--text-admin-sm)]">
                                {AVERTISSEMENT_SIREN_CONTRAIRE}
                              </p>
                            </AdminBloc>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="mt-[var(--space-admin-1)] flex flex-col gap-[var(--space-admin-1)]">
                        <AdminBadge tone="warning" className="self-start">
                          SIREN à compléter
                        </AdminBadge>
                        {sirenPropose !== null ? (
                          <form
                            action={confirmerSirenFormAction}
                            data-bloc="siren-propose-questionnaire"
                            className="flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]"
                          >
                            <input type="hidden" name="clientId" value={client.id} />
                            <input type="hidden" name="siren" value={sirenPropose.siren} />
                            <span>
                              Proposé par le questionnaire avant audit :{" "}
                              <span className="font-mono">{sirenPropose.siren}</span>
                              {sirenPropose.siret !== null ? (
                                <>
                                  {" "}
                                  (SIRET <span className="font-mono">{sirenPropose.siret}</span>)
                                </>
                              ) : null}
                            </span>
                            <AdminButton type="submit" variant="secondary">
                              Poser ce SIREN
                            </AdminButton>
                          </form>
                        ) : null}
                        {acces.peutEcrire && annuaire === null ? (
                          <Link
                            href={`${ficheHref}?${ongletCourant ? `onglet=${ongletCourant}&` : ""}annuaire=1`}
                            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                          >
                            Chercher le SIREN dans l&apos;annuaire
                          </Link>
                        ) : null}
                        {annuaire !== null && !annuaire.ok ? (
                          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                            L&apos;annuaire des entreprises ne répond pas pour l&apos;instant.
                            Saisissez le SIRET dans « Éditer » (le SIREN en sera tiré), ou réessayez
                            plus tard.
                          </p>
                        ) : null}
                        {annuaire !== null && annuaire.ok && annuaire.propositions.length === 0 ? (
                          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                            Aucune entreprise trouvée à ce nom.
                          </p>
                        ) : null}
                        {annuaire !== null && annuaire.ok && annuaire.propositions.length > 0 ? (
                          <ul className="space-y-[var(--space-admin-1)] text-[length:var(--text-admin-xs)]">
                            {annuaire.propositions.map((prop) => (
                              <li key={prop.siren}>
                                <form
                                  action={confirmerSirenFormAction}
                                  className="flex flex-wrap items-center gap-[var(--space-admin-2)]"
                                >
                                  <input type="hidden" name="clientId" value={client.id} />
                                  <input type="hidden" name="siren" value={prop.siren} />
                                  <span className="font-mono">{prop.siren}</span>
                                  <span>{prop.nom}</span>
                                  <span className="text-[color:var(--color-admin-fg-muted)]">
                                    {[prop.codePostal, prop.ville].filter(Boolean).join(" ")}
                                  </span>
                                  <AdminButton type="submit" variant="secondary">
                                    C&apos;est elle
                                  </AdminButton>
                                </form>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {adresseEtPenalites}
                </div>
              </section>
            ) : null}

            <section data-bloc="contact" aria-labelledby="bloc-contact" className={blocCls}>
              <h2 id="bloc-contact" className={blocTitreCls}>
                Contact
              </h2>
              <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
                <div>
                  <p className={infoLabelCls}>Nom</p>
                  <p className={infoValueCls}>{client.contactNom || "—"}</p>
                </div>
                <div>
                  <p className={infoLabelCls}>Rôle</p>
                  <p className={infoValueCls}>{client.contactFonction || "—"}</p>
                </div>
                <div className="min-w-0">
                  <p className={infoLabelCls}>E-mail</p>
                  <p className={`${infoValueCls} truncate`}>{client.contactEmail || "—"}</p>
                </div>
                <div>
                  <p className={infoLabelCls}>Téléphone</p>
                  <p className={infoValueCls}>{client.contactTelephone || "—"}</p>
                </div>
                {!estEntreprise ? adresseEtPenalites : null}
              </div>
            </section>
          </div>

          {estEntreprise ? (
            <section className={sectionCls}>
              <DejaPrisEnChargeOpco
                opcoLibelle={opcoClient !== null ? OPCO_LABELS[opcoClient] : null}
                lignes={priseEnChargeOpco}
              />
            </section>
          ) : null}
        </>
      ) : null}

      {contenuDossier}

      {/* EMPLACEMENT:DEVIS-FACTURES (lot B7) */}
      {onglet === "devis-factures" ? (
        <E.OngletDevisFactures
          ctx={ctx}
          client={client}
          encoursDuCents={encoursDuCents}
          factures={factures}
          factureHorsConsoleLe={factureHorsConsoleLe}
          bandeauPartners={bandeauPartners}
          nbEmailsAValider={nbEmailsAValider}
        />
      ) : null}
    </AdminPageShell>
  );
}
