/**
 * Admin — Qualiopi · Émargement d'une session (T8).
 *
 * Charge la session + enrollments + créneaux côté serveur, puis rend :
 * - Un bouton "Générer les créneaux" (GenererCreneauxButton client).
 * - EmargementGrid : grille créneaux × stagiaires (client).
 * - ImportReleveForm : import CSV distanciel (client).
 * - Récapitulatif taux de présence par stagiaire.
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSessionEmargement } from "@/server/qualiopi/presence/queries";
import { classifierPresence } from "@/server/qualiopi/presence/taux";
import {
  libellesEmargementParInscription,
  type LibelleEmargement,
} from "@/server/qualiopi/presence/provenance";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { EmargementGrid } from "@/components/admin/qualiopi/EmargementGrid";
import { ImportReleveForm } from "@/components/admin/qualiopi/ImportReleveForm";
import { GenererCreneauxButton } from "@/components/admin/qualiopi/GenererCreneauxButton";
import { SessionJoursEditor } from "@/components/admin/qualiopi/SessionJoursEditor";
import { LiensEmargement } from "@/components/admin/qualiopi/LiensEmargement";
import { BandeauContresignatureFinanceur } from "@/components/admin/qualiopi/BandeauContresignatureFinanceur";
import { constatContresignatureSession } from "@/server/qualiopi/emargement/constat-financeur-session";
import { DossierSessionButton } from "@/components/admin/qualiopi/DossierSessionButton";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminBlocRepliable } from "@/components/admin/ui/AdminBlocRepliable";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { CalendarCheck, CheckCircle2, CircleAlert, CircleX, UsersRound } from "lucide-react";
import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import {
  generateSessionCreneauxAction,
  saveEmargementAction,
  importReleveConnexionAction,
  genererReleveConnexionDocumentAction,
} from "@/server/actions/qualiopi/presence";
import { saveSessionJoursAction } from "@/server/actions/qualiopi/session-jours";
import {
  emettreLiensSessionAction,
  envoyerLiensEmargementAction,
  revoquerLiensSessionAction,
} from "@/server/actions/qualiopi/emargement-liens";
import { EmargementDemiJournee } from "@/components/admin/qualiopi/EmargementDemiJournee";
import { lireSuiviEmargement } from "@/server/qualiopi/emargement/demi-journee/suivi";
import {
  cocherFicheJourFormAction,
  saisirRattrapageFormAction,
} from "@/server/actions/qualiopi/emargement-demi-journee";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { CLASSE_ANCRE_SECTION } from "@/features/admin-qualiopi/session-hub/ancres";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Émargement session | Axion-IA Admin",
  robots: { index: false, follow: false },
};

function formatDateFR(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const MODALITE_LABELS: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  hybride: "Hybride",
};

const STATUT_LABELS: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

const TAUX_LABELS: Record<"complete" | "partielle" | "aucune", string> = {
  complete: "Complète",
  partielle: "Partielle",
  aucune: "Aucune",
};

const COLONNE =
  "px-[var(--space-admin-4)] text-left text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-fg-muted)]";
const CELLULE =
  "border-y border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-4)] align-middle text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] first:border-l last:border-r";

const ICONE_CATEGORIE = {
  complete: CheckCircle2,
  partielle: CircleAlert,
  aucune: CircleX,
} as const;

const BORDURE_CATEGORIE: Record<"complete" | "partielle" | "aucune", string> = {
  complete: "border-l-[color:var(--color-admin-success)]",
  partielle: "border-l-[color:var(--color-admin-warning)]",
  aucune: "border-l-[color:var(--color-admin-destructive)]",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function premier(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function EmargementPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const data = await getSessionEmargement(id);
  if (!data) notFound();

  const { session, enrollments, creneaux, jours } = data;

  // Seuil de qualification « complète » depuis la config Qualiopi (défaut 80).
  // ⚠️ Doit être le MÊME seuil que l'attestation (`attestation-service.ts`) et le
  // relevé PDF, sinon la grille affiche « Complète » là où l'attestation générée
  // sera « partielle » dès que l'admin règle `seuil_presence_pct` ≠ 80.
  const seuilPresencePct = await getQualiopiConfig("seuil_presence_pct").catch(() => 80);

  // 🔴 Ce que le FINANCEUR réclamera. L'organisme l'apprenait au refus de
  // règlement : la contresignature du formateur conditionne le paiement chez la
  // plupart des financeurs, et aucune surface de l'outil ne le disait là où on
  // s'occupe des signatures.
  //
  // ⛔ NON BLOQUANT — décision de Will du 25/08/2026. Le constat n'est qu'un
  // constat : il ne conditionne aucun bouton de cette page.
  const constatFinanceur = await constatContresignatureSession(id, new Date());

  // QNC L06 — le panneau n'existe que si `qualiopi.emargement.actif` agit sur
  // la session : éteint, cette page est celle d'avant.
  const suiviDemiJournee = await lireSuiviEmargement(id);
  const retoursFormulaire = (await searchParams) ?? {};

  // Prépare les props pour EmargementGrid (clés sérialisables)
  // c.date est un DateTime Prisma (Date JS) → on extrait la partie ISO date (Europe/Paris).
  const creneauxRows = creneaux.map((c) => ({
    id: c.id,
    enrollmentId: c.enrollmentId,
    date:
      c.date instanceof Date
        ? c.date.toLocaleDateString("fr-CA") // "YYYY-MM-DD" via locale fr-CA
        : String(c.date),
    demiJournee: c.demiJournee as DemiJourneeLabel,
    libelle: c.libelle,
    dureePrevueMinutes: c.dureePrevueMinutes,
    dureeRealiseeMinutes: c.dureeRealiseeMinutes,
    present: c.present,
  }));

  const enrollmentRows = enrollments.map((e) => ({
    id: e.id,
    traineeId: e.traineeId,
    nom: e.trainee.nom,
    prenom: e.trainee.prenom,
    email: e.trainee.email,
    tauxPresencePct: e.tauxPresencePct,
  }));

  // 🔴 `G-prerequis-02` (audit initial 2026-09-14) — la colonne « Émargement
  // signé » lisait `emargementSigneAt` seul, que la grille manuelle posait sans
  // aucune signature. Elle lit désormais la PROVENANCE de chaque créneau : une
  // signature vivante, un relevé importé, ou une déclaration à la main — et la
  // date de la première signature au registre. Toute la règle vit dans
  // `presence/provenance.ts`, testée sans rendu.
  const libelleParInscription = libellesEmargementParInscription(enrollments, creneaux);
  const tonBadge: Record<LibelleEmargement["ton"], "success" | "warning" | "neutral"> = {
    succes: "success",
    alerte: "warning",
    neutre: "neutral",
  };

  const hasCreneaux = creneauxRows.length > 0;
  const nbComplets = enrollments.filter(
    (e) => classifierPresence(e.tauxPresencePct ?? 0, seuilPresencePct) === "complete",
  ).length;
  const nbASuivre = enrollments.length - nbComplets;
  const isDistanciel = session.modalite === "distanciel" || session.modalite === "hybride";

  const tonCategorie: Record<
    "complete" | "partielle" | "aucune",
    "success" | "warning" | "destructive"
  > = { complete: "success", partielle: "warning", aucune: "destructive" };

  const TEXTE_AIDE =
    "m-0 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";
  const LIBELLE_ID =
    "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  const VALEUR_ID =
    "m-0 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";

  return (
    <>
      {/* L2 — le retour à la fiche, le fil d'Ariane et l'en-tête de la session
          sont portés par `sessions/[id]/layout.tsx` : une seule façon de revenir,
          la même sur les quatre sous-pages. */}
      {/* `admin-page-header` : repère sans style, lu par les parcours E2E
          (tests/e2e/qualiopi/parcours) qui y vérifient la modalité RÉELLE : la
          description garde donc ses séparateurs « · ». Pas d'`AdminPageHeader` :
          l'en-tête de la fiche (h1) est porté par `sessions/[id]/layout.tsx`
          (garde `fiche-lecture-seule.spec.tsx`). */}
      <header className="admin-page-header mb-[var(--space-admin-5)] border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-4)]">
        <h2 className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Émargement
        </h2>
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {`Session ${session.numero} · ${MODALITE_LABELS[session.modalite] ?? session.modalite} · ${formatDateFR(session.dateDebut)} → ${formatDateFR(session.dateFin)}`}
        </p>
        <div className="mt-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]">
          <AdminBadge tone={session.statut === "annulee" ? "destructive" : "info"}>
            {STATUT_LABELS[session.statut] ?? session.statut}
          </AdminBadge>
          <AdminBadge tone="neutral">
            {enrollments.length} stagiaire{enrollments.length > 1 ? "s" : ""}
          </AdminBadge>
          <AdminBadge tone={hasCreneaux ? "success" : "warning"}>
            {hasCreneaux ? "Créneaux générés" : "Créneaux à générer"}
          </AdminBadge>
        </div>
      </header>

      {/* Chiffres clés : calculés sur les données déjà chargées, aucune requête. */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Stagiaires"
          value={enrollments.length}
          tone="info"
          icon={UsersRound}
        />
        <AdminStatCard
          label="Créneaux"
          value={creneauxRows.length}
          tone={hasCreneaux ? "success" : "warning"}
          icon={CalendarCheck}
        />
        <AdminStatCard
          label="Présence complète"
          value={nbComplets}
          tone={enrollments.length > 0 && nbComplets === enrollments.length ? "success" : "default"}
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="À suivre"
          value={nbASuivre}
          tone={nbASuivre > 0 ? "warning" : "success"}
          icon={CircleAlert}
        />
      </div>

      <div className="flex flex-col">
        {/* Informations session */}
        <AdminBloc teinte="gris" niveau={2} titre="La session en bref">
          <dl className="m-0 grid grid-cols-2 gap-[var(--space-admin-4)] sm:grid-cols-4">
            <div>
              <dt className={LIBELLE_ID}>Statut</dt>
              <dd className={VALEUR_ID}>{STATUT_LABELS[session.statut] ?? session.statut}</dd>
            </div>
            <div>
              <dt className={LIBELLE_ID}>Modalité</dt>
              <dd className={VALEUR_ID}>{MODALITE_LABELS[session.modalite] ?? session.modalite}</dd>
            </div>
            <div>
              <dt className={LIBELLE_ID}>Durée réelle</dt>
              <dd className={VALEUR_ID}>{session.dureeReelleHeures ?? "—"} h</dd>
            </div>
            <div>
              <dt className={LIBELLE_ID}>Stagiaires</dt>
              <dd className={VALEUR_ID}>{enrollments.length}</dd>
            </div>
          </dl>
        </AdminBloc>

        {/* Ce que le financeur réclamera — en tête, AVANT les journées et la
            grille : c'est la seule information de cet écran qui se paie en
            argent, et la lire après avoir tout fermé ne sert à rien.
            Il disparaît de lui-même quand tout est contresigné, et ne s'affiche
            jamais sur une session en financement direct. */}
        {/* `id` stables : le fil conducteur de la fiche (« Où en est ce dossier »)
            mène ICI en un clic — `/emargement#contresignature`, `#journees`,
            `#liens`, `#feuille`. Garde : `le-suivi-mene-au-geste.spec.ts`. */}
        <div id="contresignature" className={CLASSE_ANCRE_SECTION}>
          <BandeauContresignatureFinanceur
            constat={constatFinanceur}
            href={`/${locale}/${adminPrefix}/qualiopi/sessions/${id}#formateur`}
            libelleLien="Voir le formateur désigné (il contresigne depuis son espace)"
          />
        </div>

        {/* Journées réellement animées (D14) — AVANT la génération des
            créneaux, parce qu'elle en dépend : sans journées déclarées, les
            créneaux sont déduits de la plage de dates, ce qui est faux dès que
            les journées ne se suivent pas. */}
        <div id="journees" className={CLASSE_ANCRE_SECTION}>
          <SessionJoursEditor
            sessionId={id}
            joursInitiaux={jours}
            hasCreneaux={hasCreneaux}
            saveAction={saveSessionJoursAction}
          />
        </div>

        {/* Liens de signature — après les journées (dont ils dépendent) et avant
            la grille : c'est l'ordre dans lequel l'admin travaille. */}
        <div id="liens" className={CLASSE_ANCRE_SECTION}>
          <LiensEmargement
            sessionId={id}
            hasCreneaux={hasCreneaux}
            emettreAction={emettreLiensSessionAction}
            envoyerAction={envoyerLiensEmargementAction}
            revoquerAction={revoquerLiensSessionAction}
          />
        </div>

        {suiviDemiJournee !== null && (
          <div className={CLASSE_ANCRE_SECTION}>
            <EmargementDemiJournee
              sessionId={id}
              retour={`/${locale}/${adminPrefix}/qualiopi/sessions/${id}/emargement`}
              suivi={suiviDemiJournee}
              ok={premier(retoursFormulaire["ok"])}
              erreur={premier(retoursFormulaire["erreur"])}
              rattrapageAction={saisirRattrapageFormAction}
              ficheJourAction={cocherFicheJourFormAction}
            />
          </div>
        )}

        {/* Générer les créneaux */}
        <AdminBloc teinte="gris" niveau={2} titre="Créneaux de présence">
          <GenererCreneauxButton
            sessionId={id}
            genererAction={generateSessionCreneauxAction}
            hasCreneaux={hasCreneaux}
          />
        </AdminBloc>

        {/* Dossier d'audit de la session (oubli M2) */}
        <AdminBloc teinte="gris" niveau={2} titre="Dossier d'audit">
          <div className="flex flex-col gap-[var(--space-admin-3)]">
            <AdminBlocRepliable titre="À quoi sert ce dossier">
              <p className={TEXTE_AIDE}>
                Un ZIP rangé sous le numéro de cette session : ses documents, sa feuille
                d&apos;émargement, et la vérification d&apos;intégrité de chaque chaîne de
                signatures. C&apos;est ce que vous remettez à un auditeur qui demande « le dossier
                de cette session ».
              </p>
            </AdminBlocRepliable>
            <div>
              <DossierSessionButton sessionId={id} />
            </div>
          </div>
        </AdminBloc>

        {/* Tirage à jour de la feuille d'émargement.
            La feuille du registre est figée à son émission — tirée AVANT la
            session, comme l'usage le veut, elle porte « Signatures enregistrées
            au tirage : 0 » à vie. Ce lien la rejoue avec les signatures
            réellement recueillies, sans créer de pièce ni renuméroter.
            Passe par AdminButton, et non par un <a> habillé : le cliquet de
            design (admin-design-tokens) n'admet que les combinaisons
            `.admin-*` + utilitaire déjà déclarées. */}
        <AdminBloc teinte="gris" niveau={2} titre="Feuille d'émargement à jour">
          <div className="flex flex-col gap-[var(--space-admin-3)]">
            <AdminBlocRepliable titre="Ce que fait ce tirage">
              <p className={TEXTE_AIDE}>
                Réimpression de la feuille avec les signatures recueillies à cet instant. La pièce
                du registre, elle, reste figée à sa date d&apos;émission : si vous l&apos;avez
                générée avant la session, elle affiche une feuille vierge. C&apos;est ce tirage-ci
                qu&apos;il faut joindre à une preuve de présence — il ne crée aucun document et ne
                renumérote rien.
              </p>
            </AdminBlocRepliable>
            <div>
              <AdminButton href={`/api/qualiopi/sessions/${id}/emargement`} variant="secondary">
                Télécharger la feuille à jour (PDF)
              </AdminButton>
            </div>
          </div>
        </AdminBloc>

        {/* Grille émargement */}
        <AdminBloc
          teinte="terracotta"
          niveau={2}
          titre="Feuille d'émargement présentiel"
          id="feuille"
          className={CLASSE_ANCRE_SECTION}
        >
          <div className="flex flex-col gap-[var(--space-admin-3)]">
            {/* 🔴 `G-prerequis-02` — la grille se faisait passer pour un émargement
                signé. Elle DÉCLARE une présence ; l'écran doit le dire avant le clic. */}
            <p className={TEXTE_AIDE}>
              Cocher une case ici <strong>déclare</strong> une présence : ce n&apos;est pas une
              signature.
            </p>
            <AdminBlocRepliable titre="Lire les règles de saisie">
              <p className={TEXTE_AIDE}>
                Toute case modifiée est enregistrée comme saisie manuelle — y compris sur un créneau
                issu d&apos;un relevé de connexion, qui cesse alors d&apos;être compté comme relevé
                —, n&apos;est jamais comptée comme émargement signé, et apparaît comme telle dans le
                récapitulatif ci-dessous et dans le dossier d&apos;audit. Les signatures se
                recueillent par les liens d&apos;émargement ci-dessus ou sur le poste du formateur ;
                un créneau déjà signé n&apos;est pas modifié par cette grille, et une case que vous
                n&apos;avez pas changée n&apos;est pas réécrite.
              </p>
            </AdminBlocRepliable>
            {enrollments.length === 0 ? (
              <AdminEmptyState
                variant="inline"
                icon={<UsersRound aria-hidden="true" size={28} />}
                title="Aucun stagiaire inscrit à cette session."
                description="La feuille apparaît dès qu'un stagiaire est inscrit."
              />
            ) : (
              <EmargementGrid
                sessionId={id}
                enrollments={enrollmentRows}
                creneaux={creneauxRows}
                seuilCompletePct={seuilPresencePct}
                hasJours={jours.length > 0}
                saveAction={saveEmargementAction}
              />
            )}
          </div>
        </AdminBloc>

        {/* Import relevé de connexion (distanciel / hybride) */}
        {isDistanciel && (
          <AdminBloc teinte="gris" niveau={2} titre="Relevé de connexion distanciel">
            <div className="flex flex-col gap-[var(--space-admin-3)]">
              <p className={TEXTE_AIDE}>
                Importez le rapport d&apos;export de votre plateforme de visioconférence. Le
                rapprochement automatique est effectué par email puis par nom.
              </p>
              <ImportReleveForm
                sessionId={id}
                importAction={importReleveConnexionAction}
                genererReleveAction={genererReleveConnexionDocumentAction}
              />
            </div>
          </AdminBloc>
        )}

        {/* Récapitulatif taux de présence */}
        {enrollments.length > 0 && (
          <AdminBloc teinte="bleu" niveau={2} titre="Récapitulatif des taux de présence">
            {/* Chaque ligne se lit comme une carte (cellules bordées, espacement entre
                lignes, bordure gauche colorée), mais reste un vrai <table> : la garde
                `ecran-emargement-signe.spec.ts` lit la dernière cellule de la ligne. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-separate border-spacing-y-[var(--space-admin-3)]">
                <thead>
                  <tr>
                    <th scope="col" className={COLONNE}>
                      Stagiaire
                    </th>
                    <th scope="col" className={COLONNE}>
                      Taux présence
                    </th>
                    <th scope="col" className={COLONNE}>
                      Qualification
                    </th>
                    <th scope="col" className={COLONNE}>
                      Émargement signé
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => {
                    const cat = classifierPresence(e.tauxPresencePct ?? 0, seuilPresencePct);
                    const libelle = libelleParInscription.get(e.id);
                    const Icone = ICONE_CATEGORIE[cat];
                    return (
                      <tr key={e.id}>
                        <td
                          className={`${CELLULE} rounded-l-[var(--radius-admin-md)] border-l-4 text-left ${BORDURE_CATEGORIE[cat]}`}
                        >
                          <div className="text-[length:var(--text-admin-base)] font-semibold">
                            {e.trainee.prenom} {e.trainee.nom}
                          </div>
                          <div className="text-[length:var(--text-admin-sm)] font-normal text-[color:var(--color-admin-fg-muted)]">
                            {e.trainee.email}
                          </div>
                        </td>
                        <td className={CELLULE}>
                          {e.tauxPresencePct !== null ? (
                            <AdminBadge tone={tonCategorie[cat]} compact={false} plein>
                              <span className="inline-flex items-center gap-[var(--space-admin-2)]">
                                <Icone aria-hidden="true" size={16} />
                                {e.tauxPresencePct} %
                              </span>
                            </AdminBadge>
                          ) : (
                            <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                          )}
                        </td>
                        <td className={CELLULE}>
                          <AdminBadge tone={tonCategorie[cat]}>{TAUX_LABELS[cat]}</AdminBadge>
                        </td>
                        <td className={`${CELLULE} rounded-r-[var(--radius-admin-md)]`}>
                          <AdminBadge tone={tonBadge[libelle?.ton ?? "neutre"]}>
                            {libelle?.texte ?? "Non"}
                          </AdminBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AdminBloc>
        )}
      </div>
    </>
  );
}
