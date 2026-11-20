/**
 * Admin — Qualiopi · 🔴 À traiter (refonte console phase 1, 2026-08-01).
 *
 * LA porte d'entrée de la console. Verdict de Will sur l'ancienne organisation :
 * « on ne sait pas où regarder, on ne sait pas par quoi commencer ». Cette page
 * répond à la seule question du matin : « qu'est-ce que je dois faire ? »
 *
 * Quatre blocs, dans l'ordre d'urgence :
 *   ✍️  Signatures — pièces à contresigner (quelqu'un a signé, il manque une
 *       partie) et signatures client qui n'ont pas commencé.
 *   ✉️  E-mails — la corbeille de validation F60.
 *   🚨  Alertes & relances — les alertes actives de l'évaluateur quotidien
 *       (OPCO sans réponse, impayés, devis dormants, vigilance URSSAF, NDA…).
 *   🔓  Dossiers rouverts depuis plus de 7 jours (lot L4, ADR 0060 D5) : un
 *       dossier rouvert ne se reverrouille pas seul ; au-delà d'une semaine,
 *       c'est une tâche — clore à nouveau, ou savoir pourquoi.
 *
 * 🔴 Zéro logique propre : les chiffres viennent de `compterQualiopiNav()`
 * (le MÊME module que les pastilles de la sidebar) et les listes des services
 * existants. Cette page AGRÈGE, elle ne recalcule rien — un chiffre calculé
 * deux fois dirait un jour deux choses différentes.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import { peutLireLesAlertes } from "@/server/qualiopi/alertes/routage";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  Clock,
  Euro,
  LockOpen,
  Mail,
  MessageSquareReply,
  Signature,
  TriangleAlert,
} from "lucide-react";

import { auth } from "@/auth";
import { BlocHorodatagesEnRetard } from "@/components/admin/qualiopi/BlocHorodatagesEnRetard";
import { listerHorodatagesEnRetard } from "@/server/qualiopi/documents/signature/lire-horodatages";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { RelancerSignatureButton } from "@/components/admin/qualiopi/RelancerSignatureButton";
import { ContresignerLotButton } from "@/components/admin/qualiopi/ContresignerLotButton";
import { estContresignable } from "@/server/qualiopi/documents/signature/contresignables";
import { peutSignerPourOrganisme } from "@/server/qualiopi/documents/signature/garde-engagement";
import { RelancerQuestionnaireButton } from "@/components/admin/qualiopi/RelancerQuestionnaireButton";
import { compterQualiopiNav } from "@/server/admin/qualiopi-nav-counts";
import { listAlertes } from "@/server/qualiopi/alertes/alertes-service";
import { partieARelancer } from "@/server/qualiopi/documents/signature/relance-partie";
import { listerPiecesEnAttente } from "@/server/qualiopi/documents/signature/pieces-en-attente";
import { listerRetoursEnAttente } from "@/server/qualiopi/satisfaction/retours-en-attente";
import { prochainesEcheances } from "@/server/qualiopi/parcours/echeances-service";
import {
  DELAI_ALERTE_ROUVERT_JOURS,
  listerDossiersRouvertsAnciens,
} from "@/server/qualiopi/sessions/dossiers-rouverts";
import {
  chargerEtatsVerrou,
  dateHeureParis,
  dossierFige,
} from "@/server/qualiopi/sessions/verrou-dossier";
import { hrefEtape } from "@/server/qualiopi/parcours/cible-etape";
import {
  etapeBloqueeParLeVerrou,
  MENTION_GESTE_VERROUILLE,
} from "@/server/qualiopi/parcours/etape-dossier-clos";
import { CIBLE_SIGNATURE_PIECES } from "@/server/qualiopi/parcours/session-parcours";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — À traiter | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

/**
 * Nombre de jours entiers écoulés depuis une date (arrondi au jour inférieur).
 * Utilisé pour afficher « en attente depuis X jours » sur les signatures — la
 * seule donnée déjà en base (`updatedAt`) qui dit depuis quand ça traîne,
 * jusqu'ici sélectionnée mais jamais affichée à l'écran.
 */
function joursDepuis(date: Date, maintenant = new Date()): number {
  return Math.max(0, Math.floor((maintenant.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

/** Libellé humain d'un type de pièce signable (sous-ensemble courant). */
const TYPE_LABELS: Record<string, string> = {
  convention: "Convention",
  convention_tripartite: "Convention tripartite",
  contrat: "Contrat de formation",
  devis: "Devis",
  lettre_mission: "Lettre de mission",
  contrat_sous_traitance: "Contrat de sous-traitance",
  releve_connexion: "Relevé de connexion",
  protocole_afest: "Protocole AFEST",
};

export default async function ATraiterPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  // 🔴 2026-08-19 (constat `D5-4-02`) — la garde testait `admin` / `super_admin`
  // en dur. Or `ROLES_PAR_GUICHET` route les alertes vers `responsable_qualite`
  // et `secretaire` : ils les recevaient par e-mail, puis étaient renvoyés à
  // l'écran de connexion en cliquant sur le lien du message.
  //
  // Le droit d'entrer est désormais DÉRIVÉ du routage : est admis qui reçoit.
  // Cet écran affiche et redirige, il ne pose aucun acte engageant — chaque
  // action reste gardée par sa propre habilitation.
  if (!session?.user || !peutLireLesAlertes(role)) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}`;

  const [compteurs, signatures, alertesBrutes, retours, parcours, rouverts, horodatagesEnRetard] =
    await Promise.all([
      compterQualiopiNav(),
      listerPiecesEnAttente(),
      listAlertes({ resolue: false, limit: 50 }).catch(() => []),
      listerRetoursEnAttente(),
      // 🔴 Lot 1 §1.4 — cette page EXISTAIT et IGNORAIT les sessions. Il fallait
      // ouvrir chaque dossier pour apprendre qu'une convention n'etait pas signee
      // a J-3. Meme service que la pastille de nav : deux calculs diraient un
      // jour deux chiffres, et un badge qui ment n'est plus jamais regarde.
      prochainesEcheances().catch(() => ({
        echeances: [],
        parSession: new Map(),
        troncature: null,
      })),
      // Lot L4 — `null` = registre illisible : dit à l'écran, jamais tu.
      listerDossiersRouvertsAnciens().catch(() => null),
      // Horodatages en attente depuis plus de 24 h — lecture seule ; `null` = illisible (dit).
      listerHorodatagesEnRetard().catch(() => null),
    ]);

  // On ne montre ici que ce qui PRESSE : echeance depassee, encore rattrapable
  // ou deja hors delai. Les etapes « a faire » d'une session de decembre n'ont
  // rien a faire sur la page de ce matin — les afficher rendrait la page
  // illisible le jour ou dix sessions sont ouvertes.
  const echeancesUrgentes = parcours.echeances.filter(
    (e) => e.etape.etat === "hors_delai" || e.etape.etat === "rattrapable",
  );
  // 🔴 ADR 0060 — une étape due sur un dossier CLOS dont le geste est
  // verrouillé ne se « traite » plus sans rouvrir le dossier : on ne décrit pas
  // un bouton que la fiche masque. Deux requêtes pour les lignes affichées ;
  // en échec, rien n'est marqué (l'écran d'avant, jamais une page tombée).
  const etatsVerrou = await chargerEtatsVerrou(
    echeancesUrgentes.slice(0, 20).map((e) => e.sessionId),
  ).catch(() => new Map<string, never>());
  const figeSession = (sessionId: string): boolean => {
    const lu = etatsVerrou.get(sessionId);
    return lu !== undefined && dossierFige(lu.etat);
  };

  // Les pièces déjà remplacées par une version signée ne sont pas des tâches :
  // le filtre est appliqué DANS `listerPiecesEnAttente`, avec le compteur de la
  // pastille, pour que les deux ne puissent plus diverger (cf. le module).

  // 🔴 Audit du 2026-08-01 (défaut P1) — `signature_en_attente` et
  // `signature_contreseing_du` sont les MÊMES pièces que celles déjà listées
  // dans le bloc « Signatures » ci-dessous, avec plus de détail (type, contexte
  // session, lien direct). Les laisser dans le bloc Alertes fait apparaître la
  // même pièce deux fois sur cette page. On les filtre UNIQUEMENT ici : elles
  // continuent d'exister côté évaluateur/DB pour la pastille de la sidebar et
  // pour /qualiopi/alertes, qui doivent rester exhaustives.
  const alertes = alertesBrutes.filter(
    (a) => a.code !== "signature_en_attente" && a.code !== "signature_contreseing_du",
  );

  const critiques = alertes.filter((a) => a.niveau === "critique");
  const importantes = alertes.filter((a) => a.niveau === "important");
  // 🔴 Audit du 2026-08-01 (défaut P1) — `compteurs.total` (compterQualiopiNav)
  // compte TOUTES les alertes non lues, y compris niveau « info », qu'aucun des
  // 3 blocs de cette page n'affiche. Une seule alerte « info » en attente
  // rendait `rienAFaire` faux SANS qu'aucun bloc n'ait de contenu à montrer :
  // écran vide, sans le message rassurant. `rienAFaire` doit refléter
  // exactement ce qui est rendu à l'écran, pas le total de la pastille.
  const rienAFaire =
    rouverts !== null &&
    rouverts.length === 0 &&
    horodatagesEnRetard !== null &&
    horodatagesEnRetard.length === 0 &&
    retours.length === 0 &&
    signatures.length === 0 &&
    compteurs.emails === 0 &&
    compteurs.relances === 0 &&
    echeancesUrgentes.length === 0 &&
    critiques.length === 0 &&
    importantes.length === 0;

  // ── Présentation (refonte visuelle) ────────────────────────────────────────
  // Aucun calcul nouveau : les nombres des tuiles sont les longueurs des listes
  // déjà chargées ci-dessus.
  const nbAlertes = critiques.length + importantes.length;
  const nbRouverts = rouverts?.length ?? 0;
  const nbHorodatages = horodatagesEnRetard?.length ?? 0;
  const nbAFaire =
    signatures.length +
    retours.length +
    compteurs.emails +
    compteurs.relances +
    echeancesUrgentes.length +
    nbAlertes +
    nbRouverts +
    nbHorodatages;

  // Une tuile ne mène à sa section que si celle-ci est rendue (chiffre > 0).
  const ancre = (n: number, href: string) => (n > 0 ? { href } : {});

  const tonDe = (n: number, tonSiPositif: "warning" | "destructive" = "warning") =>
    n > 0 ? tonSiPositif : "success";

  const titreSection =
    "mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]";
  const section = "mb-[var(--space-admin-8)] scroll-mt-[var(--space-admin-6)]";
  const liste = "m-0 flex list-none flex-col gap-[var(--space-admin-3)] p-0";
  const meta = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";
  const encadreWarning =
    "mt-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-warning-soft)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-warning-fg)]";
  const encadreDanger =
    "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-destructive-soft)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-destructive-fg)]";

  type Ton = "warning" | "destructive" | "info" | "success";
  const bordureGauche: Record<Ton, string> = {
    warning: "border-l-[color:var(--color-admin-warning)]",
    destructive: "border-l-[color:var(--color-admin-destructive)]",
    info: "border-l-[color:var(--color-admin-info)]",
    success: "border-l-[color:var(--color-admin-success)]",
  };
  const carteElement = (ton: Ton) =>
    `flex flex-wrap items-center justify-between gap-[var(--space-admin-4)] rounded-[var(--radius-admin-lg)] border border-l-4 border-[color:var(--color-admin-border)] ${bordureGauche[ton]} bg-[color:var(--color-admin-surface)] p-[var(--space-admin-5)]`;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="À traiter"
        description="Tout ce qui attend une action, au même endroit — signatures, e-mails, relances, alertes. Quand cette page est vide, tout est à jour."
        meta={
          rienAFaire ? (
            <AdminBadge tone="success" plein>
              Tout est à jour
            </AdminBadge>
          ) : nbAFaire > 0 ? (
            <AdminBadge tone="warning" plein>
              {nbAFaire} à traiter
            </AdminBadge>
          ) : (
            <AdminBadge tone="warning" plein>
              À vérifier : un registre n&apos;a pas pu être lu
            </AdminBadge>
          )
        }
      />

      {/* Chiffres clés — une tuile par type de tâche, cliquable vers sa section. */}
      <div className="mb-[var(--space-admin-8)] grid grid-cols-2 gap-[var(--space-admin-4)] lg:grid-cols-4">
        <AdminStatCard
          label="Signatures"
          value={signatures.length}
          icon={Signature}
          tone={tonDe(signatures.length)}
          {...ancre(signatures.length, "#signatures")}
        />
        <AdminStatCard
          label="Retours en attente"
          value={retours.length}
          icon={MessageSquareReply}
          tone={tonDe(retours.length)}
          {...ancre(retours.length, "#retours")}
        />
        <AdminStatCard
          label="E-mails à valider"
          value={compteurs.emails}
          icon={Mail}
          tone={tonDe(compteurs.emails)}
          {...ancre(compteurs.emails, "#emails")}
        />
        <AdminStatCard
          label="Échéances dépassées"
          value={echeancesUrgentes.length}
          icon={CalendarClock}
          tone={tonDe(echeancesUrgentes.length, "destructive")}
          {...ancre(echeancesUrgentes.length, "#echeances")}
        />
        <AdminStatCard
          label="Relances à envoyer"
          value={compteurs.relances}
          icon={Euro}
          tone={tonDe(compteurs.relances)}
          {...ancre(compteurs.relances, "#relances")}
        />
        <AdminStatCard
          label="Alertes"
          value={nbAlertes}
          icon={TriangleAlert}
          tone={tonDe(nbAlertes, critiques.length > 0 ? "destructive" : "warning")}
          {...ancre(nbAlertes, "#alertes")}
        />
        <AdminStatCard
          label="Dossiers rouverts"
          value={rouverts === null ? "—" : nbRouverts}
          icon={LockOpen}
          tone={rouverts === null ? "default" : tonDe(nbRouverts)}
          {...ancre(nbRouverts, "#rouverts")}
        />
        <AdminStatCard
          label="Horodatages en retard"
          value={horodatagesEnRetard === null ? "—" : nbHorodatages}
          icon={Clock}
          tone={horodatagesEnRetard === null ? "default" : tonDe(nbHorodatages)}
        />
      </div>

      {rienAFaire && (
        <AdminEmptyState
          icon={<CheckCheck size={24} aria-hidden="true" />}
          title="Rien à traiter — tout est à jour."
          description="Les pastilles rouges de la navigation vous ramèneront ici dès que quelque chose attendra."
          className="mb-[var(--space-admin-8)]"
        />
      )}

      {/* Dossiers rouverts depuis plus de 7 jours (lot L4, ADR 0060 D5).
          En tête : c'est une PREUVE modifiable que personne ne regarde. Le motif
          et l'auteur sont écrits en entier — ce sont eux que l'auditeur lira
          dans le dossier d'audit. */}
      {rouverts === null ? (
        <div className={`${encadreDanger} mb-[var(--space-admin-8)]`}>
          Le registre des réouvertures n&apos;a pas pu être lu : l&apos;absence de dossier rouvert
          ci-dessous n&apos;est PAS un constat.
        </div>
      ) : rouverts.length > 0 ? (
        <section id="rouverts" className={section}>
          <h2 className={titreSection}>
            <LockOpen size={20} aria-hidden="true" className="shrink-0" />
            Dossiers rouverts depuis plus de {DELAI_ALERTE_ROUVERT_JOURS} jours{" "}
            <AdminBadge tone="warning" plein>
              {rouverts.length}
            </AdminBadge>
          </h2>
          <p className={`${meta} mb-[var(--space-admin-4)]`}>
            Un dossier rouvert ne se referme pas tout seul. Une fois la correction faite, « Clore à
            nouveau » depuis la fiche session.
          </p>
          <ul className={liste}>
            {rouverts.map((d) => (
              <li key={d.sessionId} className={carteElement("warning")}>
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-semibold text-[color:var(--color-admin-fg)]">
                    {d.numero} · {d.titre}
                  </p>
                  <p className={`${meta} m-0 mt-[var(--space-admin-1)]`}>
                    {`Rouvert le ${dateHeureParis(d.depuis)} par ${d.par} (il y a ${d.jours} jour${d.jours > 1 ? "s" : ""})`}
                  </p>
                  <p className={encadreWarning}>{`Motif : « ${d.motif} »`}</p>
                </div>
                <AdminButton
                  href={`${base}/qualiopi/sessions/${d.sessionId}`}
                  variant="secondary"
                  size="md"
                  iconAfter={ArrowRight}
                >
                  Ouvrir le dossier
                </AdminButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BlocHorodatagesEnRetard lignes={horodatagesEnRetard} base={base} />

      {/* Retours en attente — questionnaires envoyés restés sans réponse.
          🔴 Constaté sur le premier dossier réel : les questionnaires partaient
          (crons J+1/J+30), puis PLUS RIEN — aucun écran ne montrait qui n'avait
          pas répondu, personne ne relançait. Le cron relance à J+3 puis J+10
          (plafond 2) ; au-delà, la ligne reste ICI, marquée « à reprendre au
          téléphone » — la relance téléphonique est un acte humain. Le compteur
          de relances est la PREUVE, devant l'auditeur, que le recueil est
          organisé : une non-réponse d'un tiers n'est pas une faute, l'absence
          de tentative tracée, si. */}
      {retours.length > 0 && (
        <section id="retours" className={section}>
          <h2 className={titreSection}>
            <MessageSquareReply size={20} aria-hidden="true" className="shrink-0" />
            Retours en attente{" "}
            <AdminBadge tone="warning" plein>
              {retours.length}
            </AdminBadge>
          </h2>
          <ul className={liste}>
            {retours.map((r) => {
              const TYPE_QUESTIONNAIRE: Record<string, string> = {
                positionnement: "Positionnement",
                satisfaction_chaud: "Satisfaction à chaud",
                satisfaction_froid: "Satisfaction à froid",
                satisfaction_entreprise: "Enquête entreprise",
              };
              const jours = joursDepuis(r.envoyeAt);
              const relances =
                r.relanceCount === 0
                  ? "jamais relancé"
                  : `${r.relanceCount} relance${r.relanceCount > 1 ? "s" : ""}${
                      r.derniereRelanceAt
                        ? ` (dernière le ${r.derniereRelanceAt.toLocaleDateString("fr-FR")})`
                        : ""
                    }`;
              return (
                <li
                  key={r.questionnaireId}
                  className={carteElement(r.relancesEpuisees ? "destructive" : "warning")}
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-semibold text-[color:var(--color-admin-fg)]">
                      {TYPE_QUESTIONNAIRE[r.type] ?? r.type} — {r.destinataire}
                      {r.estEntreprise && (
                        <span className={`${meta} ml-[var(--space-admin-2)] font-normal`}>
                          (contact client)
                        </span>
                      )}
                    </p>
                    <p className={`${meta} m-0 mt-[var(--space-admin-1)]`}>
                      {r.sessionTitre} · {/* Lot L4 — la ligne mène à LA fiche session. */}
                      <Link
                        href={`${base}/qualiopi/sessions/${r.sessionId}`}
                        className="text-[color:var(--color-admin-accent)] underline underline-offset-2"
                      >
                        {r.sessionNumero}
                      </Link>{" "}
                      — envoyé il y a {jours} jour
                      {jours > 1 ? "s" : ""} · {relances}
                    </p>
                    {r.relancesEpuisees && (
                      <p className={encadreWarning}>
                        relances email épuisées, à reprendre au téléphone
                      </p>
                    )}
                  </div>
                  <RelancerQuestionnaireButton
                    questionnaireId={r.questionnaireId}
                    destinataire={r.destinataire}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Signatures */}
      {signatures.length > 0 && (
        <section id="signatures" className={section}>
          <h2 className={titreSection}>
            <Signature size={20} aria-hidden="true" className="shrink-0" />
            Signatures en attente{" "}
            <AdminBadge tone="warning" plein>
              {signatures.length}
            </AdminBadge>
          </h2>
          {/* S6a (i) — ce qu'il ne reste qu'à l'organisme de signer, d'un geste. */}
          {peutSignerPourOrganisme(role) && (
            <div className="mb-[var(--space-admin-4)]">
              <ContresignerLotButton
                ids={signatures
                  .filter(
                    (s) =>
                      s.statutSignature === "partielle" &&
                      estContresignable(
                        s.type,
                        s.signatures.map((sig) => sig.partie),
                      ),
                  )
                  .map((s) => s.id)}
              />
            </div>
          )}
          <ul className={liste}>
            {signatures.map((s) => {
              const label = TYPE_LABELS[s.type] ?? s.type;
              const contexte = s.session ? `${s.session.titreSession} · ${s.session.numero}` : null;
              // partielle = une partie a signé → c'est (souvent) TON contreseing
              // qui manque. en_attente = personne n'a signé → relancer.
              const partielle = s.statutSignature === "partielle";
              const consigne = partielle
                ? "une signature est posée — il manque la contrepartie"
                : "aucune signature — relancer le signataire";
              const jours = joursDepuis(s.updatedAt);
              const attente = `en attente depuis ${jours} jour${jours > 1 ? "s" : ""}`;
              // 🔴 L3 (30/09/2026) — une pièce de session ouvre la fiche AU
              // bloc « Signature des pièces contractuelles », pas en haut d'une
              // page de huit écrans. Même helper que la checklist de la fiche.
              const cible = s.sessionId
                ? hrefEtape(
                    s.sessionId,
                    { phase: "preparer", cible: CIBLE_SIGNATURE_PIECES },
                    `${base}/qualiopi/sessions`,
                  )
                : s.trainerId
                  ? `${base}/qualiopi/formateurs/${s.trainerId}`
                  : `${base}/qualiopi/sessions`;
              // Partie à relancer, décidée ICI (côté serveur) par le module pur
              // adossé au SSOT des circuits. `null` = pas de bouton : soit la
              // prochaine signature est celle de l'organisme (contreseing de
              // Will), soit la partie signe authentifiée (formateur) et un lien
              // public serait refusé par l'action.
              const partieRelance = partieARelancer(
                s.type,
                s.statutSignature,
                s.signatures.map((sig) => sig.partie),
              );
              return (
                <li key={s.id} className={carteElement(partielle ? "info" : "warning")}>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 flex flex-wrap items-center gap-[var(--space-admin-2)]">
                      <AdminBadge tone={partielle ? "info" : "warning"} plein>
                        <Signature size={14} aria-hidden="true" />
                        {partielle ? "Contresignature" : "À relancer"}
                      </AdminBadge>
                      <span className="font-semibold text-[color:var(--color-admin-fg)]">
                        {label} {s.numero}
                      </span>
                    </p>
                    {contexte && (
                      <p className={`${meta} m-0 mt-[var(--space-admin-2)]`}>{contexte}</p>
                    )}
                    <p className={`${meta} m-0 mt-[var(--space-admin-1)]`}>
                      {consigne} — {attente}
                    </p>
                  </div>
                  <span className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                    {partieRelance !== null && (
                      <RelancerSignatureButton documentGenereId={s.id} partie={partieRelance} />
                    )}
                    <AdminButton href={cible} variant="ghost" size="md" iconAfter={ArrowRight}>
                      Ouvrir
                    </AdminButton>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* E-mails à valider */}
      {compteurs.emails > 0 && (
        <section id="emails" className={section}>
          <h2 className={titreSection}>
            <Mail size={20} aria-hidden="true" className="shrink-0" />
            E-mails à valider{" "}
            <AdminBadge tone="warning" plein>
              {compteurs.emails}
            </AdminBadge>
          </h2>
          <div className={carteElement("warning")}>
            <p className={`${meta} m-0 min-w-0 flex-1`}>
              Des e-mails (devis, conventions, relances…) attendent votre relecture avant de partir.
            </p>
            <AdminButton
              href={`${base}/qualiopi/emails`}
              variant="secondary"
              size="md"
              iconAfter={ArrowRight}
            >
              Ouvrir la corbeille de validation
            </AdminButton>
          </div>
        </section>
      )}

      {/* Sessions — échéances (Lot 1 §1.4).
          🔴 Le bloc qui manquait, et il manquait en entier : la page « À
          traiter » ne parlait pas des sessions. Une convention non signée à
          J-3, une évaluation finale jamais saisie, un émargement resté vide —
          rien de tout cela n'apparaissait avant d'ouvrir le dossier concerné.
          C'est la cause racine des défauts du premier dossier réel.

          Ce sont les seules lignes de cette page dont l'échéance est déjà
          passée. */}
      {echeancesUrgentes.length > 0 && (
        <section id="echeances" className={section}>
          <h2 className={titreSection}>
            <CalendarClock size={20} aria-hidden="true" className="shrink-0" />
            Sessions — échéances dépassées{" "}
            <AdminBadge tone="destructive" plein>
              {echeancesUrgentes.length}
            </AdminBadge>
          </h2>
          {/* La chronologie EST un ordre : une liste ordonnée, pas une pile de
              div. Le lecteur d'écran annonce « 1 sur 7 ». */}
          <ol className={liste}>
            {echeancesUrgentes.slice(0, 20).map((e) => (
              <li
                key={`${e.sessionId}-${e.etape.cle}`}
                className={carteElement(e.etape.etat === "hors_delai" ? "destructive" : "warning")}
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-semibold text-[color:var(--color-admin-fg)]">
                    {e.etape.libelle}
                  </p>
                  <p className={`${meta} m-0 mt-[var(--space-admin-1)]`}>
                    {e.numero} · {e.titre}
                  </p>
                  {/* 🔴 L'état est dans le TEXTE, jamais dans la seule couleur
                      (WCAG 1.4.1) : « rattrapable avant le … » et « hors délai :
                      +N j » ne se confondent pas, même en noir et blanc. */}
                  <p className={encadreWarning}>
                    {e.etape.mention} ·{" "}
                    {etapeBloqueeParLeVerrou(e.etape, figeSession(e.sessionId))
                      ? MENTION_GESTE_VERROUILLE
                      : e.etape.geste}
                  </p>
                </div>
                {/* 🔴 L3 (30/09/2026) — « Ouvrir le dossier » menait en haut de
                    la fiche, sans rien de plus : il fallait retrouver l'étape
                    parmi huit écrans. Il mène désormais à l'onglet de sa phase
                    et à la section qui porte le geste — ou directement à la
                    sous-page (`hrefEtape`, le même lien que la checklist). */}
                <AdminButton
                  href={hrefEtape(e.sessionId, e.etape, `${base}/qualiopi/sessions`)}
                  variant="secondary"
                  size="md"
                >
                  Ouvrir le dossier <ArrowRight size={14} aria-hidden="true" />
                </AdminButton>
              </li>
            ))}
          </ol>
          {echeancesUrgentes.length > 20 && (
            /* 🔴 Une liste coupée en silence se lit comme une liste complète.
               On dit combien il en reste. */
            <p className={`${meta} mt-[var(--space-admin-3)]`}>
              {echeancesUrgentes.length - 20} autre
              {echeancesUrgentes.length - 20 > 1 ? "s" : ""} échéance
              {echeancesUrgentes.length - 20 > 1 ? "s" : ""} dépassée
              {echeancesUrgentes.length - 20 > 1 ? "s" : ""} — voir la liste des sessions.
            </p>
          )}
          {parcours.troncature !== null && (
            /* Et si le SERVICE lui-même a tronqué, on le dit aussi : sinon la
               page affirmerait la complétude d'un balayage plafonné. */
            <p className={`${meta} mt-[var(--space-admin-3)]`}>
              Balayage plafonné à {parcours.troncature.plafond} sessions : cette liste peut être
              incomplète.
            </p>
          )}
        </section>
      )}

      {/* Relances de recouvrement.
          Bloc absent jusqu'ici : les relances proposées n'existaient QUE dans
          le hub facturation. Un impayé ne se signalait donc nulle part tant
          qu'on n'ouvrait pas cet écran — sur le sujet où l'oubli coûte le plus
          cher. L'envoi reste un clic (et une double validation) dans le hub :
          ce bloc y renvoie, il ne relance rien lui-même. */}
      {compteurs.relances > 0 && (
        <section id="relances" className={section}>
          <h2 className={titreSection}>
            <Euro size={20} aria-hidden="true" className="shrink-0" />
            Relances à envoyer{" "}
            <AdminBadge tone="warning" plein>
              {compteurs.relances}
            </AdminBadge>
          </h2>
          <div className={carteElement("warning")}>
            <p className={`${meta} m-0 min-w-0 flex-1`}>
              Des factures échues ou des devis sans réponse attendent une relance. Rien ne part sans
              votre clic.
            </p>
            <AdminButton
              href={`${base}/qualiopi/facturation`}
              variant="secondary"
              size="md"
              iconAfter={ArrowRight}
            >
              Ouvrir le hub facturation
            </AdminButton>
          </div>
        </section>
      )}

      {/* Alertes & relances */}
      {nbAlertes > 0 && (
        <section id="alertes" className={section}>
          <h2 className={titreSection}>
            <TriangleAlert size={20} aria-hidden="true" className="shrink-0" />
            Alertes &amp; relances{" "}
            <AdminBadge tone={critiques.length > 0 ? "destructive" : "warning"} plein>
              {nbAlertes}
            </AdminBadge>
          </h2>
          <ul className={liste}>
            {[...critiques, ...importantes].map((a) => {
              const critique = a.niveau === "critique";
              return (
                <li key={a.id} className={carteElement(critique ? "destructive" : "warning")}>
                  <div className="min-w-0 flex-1">
                    {/* Le niveau se lisait contre 🟠 : deux ronds que SEULE la
                        couleur distinguait — illisible en vision des couleurs
                        déficiente, sur l'information la plus urgente de la page.
                        Deux SILHOUETTES différentes le disent sans la couleur. */}
                    <p className="m-0 flex flex-wrap items-center gap-[var(--space-admin-2)]">
                      <AdminBadge tone={critique ? "destructive" : "warning"} plein>
                        {critique ? (
                          <CircleAlert size={14} aria-hidden="true" />
                        ) : (
                          <TriangleAlert size={14} aria-hidden="true" />
                        )}
                        {critique ? "Critique" : "Important"}
                      </AdminBadge>
                      <span className="font-semibold text-[color:var(--color-admin-fg)]">
                        {a.titre}
                      </span>
                    </p>
                    {/* Certaines alertes recopient une réponse d'API brute — un
                        échec de job IA fait des centaines de caractères de JSON
                        (vu en production le 2026-08-02). Deux lignes ici ; le
                        texte complet vit dans l'infobulle et sur la page Alertes. */}
                    <p
                      title={a.message}
                      className={`${meta} m-0 mt-[var(--space-admin-2)] line-clamp-2`}
                    >
                      {a.message}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-[var(--space-admin-4)]">
            <AdminButton
              href={`${base}/qualiopi/alertes`}
              variant="secondary"
              size="md"
              iconAfter={ArrowRight}
            >
              Gérer les alertes (marquer lu / résoudre)
            </AdminButton>
          </p>
        </section>
      )}
    </AdminPageShell>
  );
}
