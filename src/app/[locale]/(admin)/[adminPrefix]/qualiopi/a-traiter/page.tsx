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
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  Euro,
  Mail,
  MessageSquareReply,
  Signature,
  TriangleAlert,
} from "lucide-react";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { RelancerSignatureButton } from "@/components/admin/qualiopi/RelancerSignatureButton";
import { RelancerQuestionnaireButton } from "@/components/admin/qualiopi/RelancerQuestionnaireButton";
import { compterQualiopiNav } from "@/server/admin/qualiopi-nav-counts";
import { listAlertes } from "@/server/qualiopi/alertes/alertes-service";
import { partieARelancer } from "@/server/qualiopi/documents/signature/relance-partie";
import { listerPiecesEnAttente } from "@/server/qualiopi/documents/signature/pieces-en-attente";
import { listerRetoursEnAttente } from "@/server/qualiopi/satisfaction/retours-en-attente";
import { prochainesEcheances } from "@/server/qualiopi/parcours/echeances-service";

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

  const [compteurs, signatures, alertesBrutes, retours, parcours] = await Promise.all([
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
  ]);

  // On ne montre ici que ce qui PRESSE : echeance depassee, encore rattrapable
  // ou deja hors delai. Les etapes « a faire » d'une session de decembre n'ont
  // rien a faire sur la page de ce matin — les afficher rendrait la page
  // illisible le jour ou dix sessions sont ouvertes.
  const echeancesUrgentes = parcours.echeances.filter(
    (e) => e.etape.etat === "hors_delai" || e.etape.etat === "rattrapable",
  );

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
    retours.length === 0 &&
    signatures.length === 0 &&
    compteurs.emails === 0 &&
    compteurs.relances === 0 &&
    echeancesUrgentes.length === 0 &&
    critiques.length === 0 &&
    importantes.length === 0;

  const carte =
    "mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]";
  const titreCarte =
    "mb-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
  const pastille =
    "inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[color:var(--color-admin-error)] px-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-bold text-white";
  const ligne =
    "flex flex-wrap items-center justify-between gap-[var(--space-admin-2)] border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-2)] last:border-b-0";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="À traiter"
        description="Tout ce qui attend une action, au même endroit — signatures, e-mails, relances, alertes. Quand cette page est vide, tout est à jour."
      />

      {rienAFaire && (
        <div className={carte}>
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)]">
            <CheckCheck
              size={16}
              aria-hidden="true"
              className="mr-[var(--space-admin-2)] inline-block align-[-3px]"
            />
            Rien à traiter — tout est à jour. Les pastilles rouges de la navigation vous ramèneront
            ici dès que quelque chose attendra.
          </p>
        </div>
      )}

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
        <div className={carte}>
          <h2 className={titreCarte}>
            <MessageSquareReply size={18} aria-hidden="true" className="shrink-0" />
            Retours en attente <span className={pastille}>{retours.length}</span>
          </h2>
          <ul>
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
                <li key={r.questionnaireId} className={ligne}>
                  <div className="min-w-0">
                    <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
                      {TYPE_QUESTIONNAIRE[r.type] ?? r.type} — {r.destinataire}
                      {r.estEntreprise && (
                        <span className="ml-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          (contact client)
                        </span>
                      )}
                    </p>
                    <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {r.sessionTitre} · {r.sessionNumero} — envoyé il y a {jours} jour
                      {jours > 1 ? "s" : ""} · {relances}
                      {r.relancesEpuisees && (
                        <span className="ml-[var(--space-admin-1)] font-semibold text-[color:var(--color-admin-warning)]">
                          — relances email épuisées, à reprendre au téléphone
                        </span>
                      )}
                    </p>
                  </div>
                  <RelancerQuestionnaireButton
                    questionnaireId={r.questionnaireId}
                    destinataire={r.destinataire}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Signatures */}
      {signatures.length > 0 && (
        <div className={carte}>
          <h2 className={titreCarte}>
            <Signature size={18} aria-hidden="true" className="shrink-0" />
            Signatures en attente <span className={pastille}>{signatures.length}</span>
          </h2>
          <ul>
            {signatures.map((s) => {
              const label = TYPE_LABELS[s.type] ?? s.type;
              const contexte = s.session ? `${s.session.titreSession} · ${s.session.numero}` : null;
              // partielle = une partie a signé → c'est (souvent) TON contreseing
              // qui manque. en_attente = personne n'a signé → relancer.
              const consigne =
                s.statutSignature === "partielle"
                  ? "une signature est posée — il manque la contrepartie"
                  : "aucune signature — relancer le signataire";
              const jours = joursDepuis(s.updatedAt);
              const attente = `en attente depuis ${jours} jour${jours > 1 ? "s" : ""}`;
              const cible = s.sessionId
                ? `${base}/qualiopi/sessions/${s.sessionId}`
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
                <li key={s.id} className={ligne}>
                  <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                    <strong>
                      {label} {s.numero}
                    </strong>
                    {contexte ? ` — ${contexte}` : ""}{" "}
                    <span className="text-[color:var(--color-admin-fg-muted)]">
                      ({consigne} — {attente})
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                    {partieRelance !== null && (
                      <RelancerSignatureButton documentGenereId={s.id} partie={partieRelance} />
                    )}
                    <AdminButton href={cible} variant="ghost" size="sm" iconAfter={ArrowRight}>
                      Ouvrir
                    </AdminButton>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* E-mails à valider */}
      {compteurs.emails > 0 && (
        <div className={carte}>
          <h2 className={titreCarte}>
            <Mail size={18} aria-hidden="true" className="shrink-0" />
            E-mails à valider <span className={pastille}>{compteurs.emails}</span>
          </h2>
          <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Des e-mails (devis, conventions, relances…) attendent votre relecture avant de partir.
          </p>
          <AdminButton
            href={`${base}/qualiopi/emails`}
            variant="ghost"
            size="sm"
            iconAfter={ArrowRight}
          >
            Ouvrir la corbeille de validation
          </AdminButton>
        </div>
      )}

      {/* Sessions — échéances (Lot 1 §1.4).
          🔴 Le bloc qui manquait, et il manquait en entier : la page « À
          traiter » ne parlait pas des sessions. Une convention non signée à
          J-3, une évaluation finale jamais saisie, un émargement resté vide —
          rien de tout cela n'apparaissait avant d'ouvrir le dossier concerné.
          C'est la cause racine des défauts du premier dossier réel.

          Placé EN PREMIER : ce sont les seules lignes de cette page dont
          l'échéance est déjà passée. */}
      {echeancesUrgentes.length > 0 && (
        <div className={carte}>
          <h2 className={titreCarte}>
            <CalendarClock size={18} aria-hidden="true" className="shrink-0" />
            Sessions — échéances dépassées{" "}
            <span className={pastille}>{echeancesUrgentes.length}</span>
          </h2>
          {/* La chronologie EST un ordre : une liste ordonnée, pas une pile de
              div. Le lecteur d'écran annonce « 1 sur 7 ». */}
          <ol className="list-none p-0">
            {echeancesUrgentes.slice(0, 20).map((e) => (
              <li key={`${e.sessionId}-${e.etape.cle}`} className={ligne}>
                <span className="min-w-0 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                  <strong>{e.etape.libelle}</strong>{" "}
                  <span className="text-[color:var(--color-admin-fg-muted)]">
                    — {e.numero} · {e.titre}
                  </span>
                  <br />
                  {/* 🔴 L'état est dans le TEXTE, jamais dans la seule couleur
                      (WCAG 1.4.1) : « rattrapable avant le … » et « hors délai :
                      +N j » ne se confondent pas, même en noir et blanc. */}
                  <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                    {e.etape.mention} · {e.etape.geste}
                  </span>
                </span>
                <AdminButton
                  href={`${base}/qualiopi/sessions/${e.sessionId}`}
                  variant="secondary"
                  size="sm"
                >
                  Ouvrir le dossier <ArrowRight size={14} aria-hidden="true" />
                </AdminButton>
              </li>
            ))}
          </ol>
          {echeancesUrgentes.length > 20 && (
            /* 🔴 Une liste coupée en silence se lit comme une liste complète.
               On dit combien il en reste. */
            <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {echeancesUrgentes.length - 20} autre
              {echeancesUrgentes.length - 20 > 1 ? "s" : ""} échéance
              {echeancesUrgentes.length - 20 > 1 ? "s" : ""} dépassée
              {echeancesUrgentes.length - 20 > 1 ? "s" : ""} — voir la liste des sessions.
            </p>
          )}
          {parcours.troncature !== null && (
            /* Et si le SERVICE lui-même a tronqué, on le dit aussi : sinon la
               page affirmerait la complétude d'un balayage plafonné. */
            <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Balayage plafonné à {parcours.troncature.plafond} sessions : cette liste peut être
              incomplète.
            </p>
          )}
        </div>
      )}

      {/* Relances de recouvrement.
          Bloc absent jusqu'ici : les relances proposées n'existaient QUE dans
          le hub facturation. Un impayé ne se signalait donc nulle part tant
          qu'on n'ouvrait pas cet écran — sur le sujet où l'oubli coûte le plus
          cher. L'envoi reste un clic (et une double validation) dans le hub :
          ce bloc y renvoie, il ne relance rien lui-même. */}
      {compteurs.relances > 0 && (
        <div className={carte}>
          <h2 className={titreCarte}>
            <Euro size={18} aria-hidden="true" className="shrink-0" />
            Relances à envoyer <span className={pastille}>{compteurs.relances}</span>
          </h2>
          <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Des factures échues attendent une relance. Rien ne part sans votre clic : le hub vous
            demandera de confirmer avoir pointé votre relevé bancaire.
          </p>
          <AdminButton
            href={`${base}/qualiopi/facturation`}
            variant="ghost"
            size="sm"
            iconAfter={ArrowRight}
          >
            Ouvrir le hub facturation
          </AdminButton>
        </div>
      )}

      {/* Alertes & relances */}
      {(critiques.length > 0 || importantes.length > 0) && (
        <div className={carte}>
          <h2 className={titreCarte}>
            <TriangleAlert size={18} aria-hidden="true" className="shrink-0" />
            Alertes &amp; relances{" "}
            <span className={pastille}>{critiques.length + importantes.length}</span>
          </h2>
          <ul>
            {[...critiques, ...importantes].map((a) => (
              <li key={a.id} className={ligne}>
                <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                  {/* Le niveau se lisait contre 🟠 : deux ronds que SEULE la
                      couleur distinguait — illisible en vision des couleurs
                      déficiente, sur l'information la plus urgente de la page.
                      Deux SILHOUETTES différentes le disent sans la couleur. */}
                  {a.niveau === "critique" ? (
                    <CircleAlert
                      size={15}
                      aria-label="Critique"
                      className="mr-[var(--space-admin-2)] inline-block shrink-0 align-[-2px] text-[color:var(--color-admin-destructive)]"
                    />
                  ) : (
                    <TriangleAlert
                      size={15}
                      aria-label="Important"
                      className="mr-[var(--space-admin-2)] inline-block shrink-0 align-[-2px] text-[color:var(--color-admin-warning)]"
                    />
                  )}
                  <strong>{a.titre}</strong>
                  {/* Certaines alertes recopient une réponse d'API brute — un
                      échec de job IA fait des centaines de caractères de JSON
                      (vu en production le 2026-08-02). Deux lignes ici ; le
                      texte complet vit dans l'infobulle et sur la page Alertes. */}
                  <span
                    title={a.message}
                    className="line-clamp-2 block text-[color:var(--color-admin-fg-muted)]"
                  >
                    {a.message}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-[var(--space-admin-2)]">
            <AdminButton
              href={`${base}/qualiopi/alertes`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Gérer les alertes (marquer lu / résoudre)
            </AdminButton>
          </p>
        </div>
      )}
    </AdminPageShell>
  );
}
