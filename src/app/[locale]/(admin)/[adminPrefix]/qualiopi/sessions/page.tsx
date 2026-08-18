/**
 * Admin — Qualiopi · Liste des sessions de formation (T8).
 *
 * Affiche une PAGE de sessions avec : numéro, titre, formation, dates,
 * modalité, statut, nb inscrits, taux de présence moyen.
 * Lien vers la page émargement par session.
 *
 * 🔴 Fenêtre par défaut : 12 mois glissants (cf. `FENETRE_SESSIONS_MOIS`), et
 * 25 lignes par page. L'écran chargeait auparavant TOUTES les sessions avec
 * TOUTES leurs inscriptions ; il ne s'affichait plus sous 30 s à la cible.
 * L'historique complet reste atteignable par le lien « archives » ci-dessous —
 * la fenêtre borne la VUE, jamais les données.
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CalendarDays, PlayCircle, CalendarClock, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPagination } from "@/components/admin/ui/AdminPagination";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { listSessionsForAdmin } from "@/server/qualiopi/presence/queries";
import {
  prochainesEcheances,
  type ResultatEcheances,
} from "@/server/qualiopi/parcours/echeances-service";
import { LIBELLE_ETAT_DOSSIER } from "@/server/qualiopi/parcours/libelles";
import { FENETRE_SESSIONS_MOIS, parsePageParam } from "@/server/qualiopi/presence/sessions-liste";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { SEUIL_PARTIELLE_PCT } from "@/server/qualiopi/presence/taux";
import { AdminEmptyState } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Sessions | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const STATUT_LABELS: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

const MODALITE_LABELS: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  hybride: "Hybride",
};

function formatDateFR(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function QualiopiSessionsPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const sp = await searchParams;
  const avecArchives = sp["archives"] === "1";
  const liste = await listSessionsForAdmin({
    page: parsePageParam(sp["page"]),
    avecArchives,
  });
  const sessions = liste.rows;

  // Lot 1 §1.4 — la colonne « Dossier ».
  //
  // 🔴 Bornée aux sessions DE CETTE PAGE, jamais au périmètre entier. La sonde
  // `sessions_liste` mesure cette lecture (10 ms au volume cible, budget 450) ;
  // balayer 300 sessions pour en afficher 25 la ferait exploser, et le Lot 0
  // existe pour qu'on ne le découvre pas en production.
  //
  // Fail-soft : la colonne disparaît, la liste reste. Une liste de sessions
  // indisponible parce qu'un indicateur secondaire a échoué serait un défaut
  // bien pire que l'absence de l'indicateur.
  const { parSession } = await prochainesEcheances({
    sessionIds: sessions.map((s) => s.id),
  }).catch((): ResultatEcheances => ({ parSession: new Map(), echeances: [], troncature: null }));

  // Même seuil que la grille d'émargement, le détail de session et l'attestation.
  // Il était figé à 80 ici : réglé à 90, une session à 85 % s'affichait verte dans
  // cette liste et « partielle » sur la page de détail, pour la même quantité.
  const seuilPresencePct = await getQualiopiConfig("seuil_presence_pct");

  // Préfixe locale inclus : les liens de pagination et d'archives se résolvent
  // directement, sans passer par le redirect 301 de proxy.ts.
  const base = `/${locale}/${adminPrefix}/qualiopi/sessions`;
  const hrefArchives = `${base}?archives=1`;
  const perimetre = avecArchives
    ? "Archives comprises — tout l'historique"
    : `Les ${FENETRE_SESSIONS_MOIS} derniers mois et les sessions à venir`;
  const pagination = `page ${liste.page} / ${liste.totalPages}`;
  const description = `${perimetre} · ${liste.total} sessions · ${pagination}.`;
  const labelArchives = `Voir les archives (${liste.nbArchives} sessions plus anciennes)`;
  // 🔴 Le message envoyait AILLEURS que là où se trouve l'action.
  //
  // Il disait « Créez-en une depuis la page Formations » : la création se fait
  // sur `sessions/new`, et le bouton « + Nouvelle session » qui y mène est
  // **sur cette page même**, en tête. On envoyait donc chercher ailleurs un
  // bouton déjà visible — c'est le pire des états vides : il coûte un
  // aller-retour ET fait douter de ce qu'on a sous les yeux.
  //
  // La seconde branche disait « Ouvrez les archives » sans rien de cliquable,
  // alors que `hrefArchives` est calculé juste au-dessus.
  const titreVide = avecArchives ? "Aucune session au registre" : "Aucune session sur la période";
  const descriptionVide = avecArchives
    ? "Le registre est vide : aucune session n'a encore été créée."
    : `Des sessions plus anciennes existent peut-être hors des ${FENETRE_SESSIONS_MOIS} derniers mois.`;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Sessions"
        description={description}
        actions={
          <Link href={`/${locale}/${adminPrefix}/qualiopi/sessions/new`} className="admin-button">
            + Nouvelle session
          </Link>
        }
      />

      {/* Accès EXPLICITE aux archives : la fenêtre de 12 mois cache des
          sessions réelles, il faut donc dire combien et par où les reprendre.
          Une fenêtre muette se lit comme une perte de données. */}
      <div className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
        {avecArchives ? (
          <Link href={base} className="admin-button-ghost">
            ← Revenir aux {FENETRE_SESSIONS_MOIS} derniers mois
          </Link>
        ) : liste.nbArchives > 0 ? (
          <Link href={hrefArchives} className="admin-button-ghost">
            {labelArchives}
          </Link>
        ) : null}
      </div>

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        {/* Les quatre compteurs portent sur la FENÊTRE entière, pas sur les 25
            lignes affichées : ils venaient d'un `filter` sur le tableau rendu,
            ce qui, une fois la liste paginée, aurait affiché « 3 en cours »
            pour la seule page courante.

            🔴 ET LEURS LIBELLÉS LE DISENT. Avant la fenêtre de 12 mois, « Total
            sessions » comptait tout l'historique ; il compte désormais la
            fenêtre. Un indicateur dont le SENS change sans que le LIBELLÉ bouge
            est un chiffre faux mais plausible — la pire espèce, parce que
            personne ne le vérifie. Le périmètre est donc écrit dans le libellé,
            et il suit le mode : en archives, les compteurs portent sur tout.

            🔴 Mais il n'est écrit QUE là où il change quelque chose, et il est
            écrit JUSTE. La fenêtre ne borne que le PASSÉ (`dateDebut >= J-12
            mois`, aucune borne haute) :
              — « Réalisées » est entièrement passé → son sens change, le
                libellé doit le porter ;
              — « Sessions » mélange passé et futur → « 12 derniers mois » seul
                serait faux, il faut « et à venir » ;
              — « En cours » et « Planifiées » ne sont pas rognés en pratique
                (une session en cours a commencé récemment, une session
                planifiée est à venir) : leur coller « 12 derniers mois »
                affirmerait une restriction qui ne s'applique pas. Un périmètre
                surajouté ment autant qu'un périmètre tu. */}
        <AdminStatCard
          label={
            liste.avecArchives
              ? "Sessions (tout l'historique)"
              : `Sessions (${FENETRE_SESSIONS_MOIS} derniers mois et à venir)`
          }
          value={liste.total}
          icon={CalendarDays}
        />
        <AdminStatCard
          label="En cours"
          value={liste.compteurs.enCours}
          icon={PlayCircle}
          tone={liste.compteurs.enCours > 0 ? "warning" : "default"}
        />
        <AdminStatCard label="Planifiées" value={liste.compteurs.planifiees} icon={CalendarClock} />
        <AdminStatCard
          label={
            liste.avecArchives
              ? "Réalisées (tout l'historique)"
              : `Réalisées (${FENETRE_SESSIONS_MOIS} derniers mois)`
          }
          value={liste.compteurs.realisees}
          icon={CheckCircle2}
          tone={liste.compteurs.realisees > 0 ? "success" : "default"}
        />
      </div>

      {sessions.length === 0 ? (
        <AdminEmptyState
          title={titreVide}
          description={descriptionVide}
          primaryAction={
            <Link href={`${base}/new`} className="admin-button">
              + Nouvelle session
            </Link>
          }
          secondaryAction={
            avecArchives ? undefined : (
              <Link
                href={hrefArchives}
                className="text-[color:var(--color-admin-accent)] underline underline-offset-2"
              >
                {labelArchives}
              </Link>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>N°</th>
                <th className={headCls}>Titre</th>
                <th className={headCls}>Dates</th>
                <th className={headCls}>Modalité</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Inscrits</th>
                <th className={headCls}>Taux présence</th>
                <th className={headCls}>Dossier</th>
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  {/* Numéro */}
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">{s.numero}</span>
                  </td>

                  {/* Titre + formationId */}
                  <td className={cellCls}>
                    <div className="font-medium">{s.titreSession ?? "—"}</div>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      Formation : {s.formationNumero} — {s.formationTitre}
                    </div>
                  </td>

                  {/* Dates */}
                  <td className={cellCls}>
                    <div className="whitespace-nowrap">{formatDateFR(s.dateDebut)}</div>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      → {formatDateFR(s.dateFin)}
                    </div>
                  </td>

                  {/* Modalité */}
                  <td className={cellCls}>{MODALITE_LABELS[s.modalite] ?? s.modalite}</td>

                  {/* Statut */}
                  <td className={cellCls}>
                    {s.statut === "realisee" ? (
                      <span className="text-[color:var(--color-admin-success)]">
                        ● {STATUT_LABELS[s.statut]}
                      </span>
                    ) : s.statut === "annulee" ? (
                      <span className="text-[color:var(--color-admin-error)]">
                        ○ {STATUT_LABELS[s.statut]}
                      </span>
                    ) : s.statut === "en_cours" ? (
                      <span className="text-[color:var(--color-admin-warning)]">
                        ◑ {STATUT_LABELS[s.statut]}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        ○ {STATUT_LABELS[s.statut] ?? s.statut}
                      </span>
                    )}
                  </td>

                  {/* Inscrits */}
                  <td className={cellCls}>{s.nbInscrits}</td>

                  {/* Taux présence moyen */}
                  <td className={cellCls}>
                    {s.tauxPresenceMoyen !== null ? (
                      <span
                        className={
                          s.tauxPresenceMoyen >= seuilPresencePct
                            ? "text-[color:var(--color-admin-success)]"
                            : s.tauxPresenceMoyen >= SEUIL_PARTIELLE_PCT
                              ? "text-[color:var(--color-admin-warning)]"
                              : // `--color-admin-destructive` et non `--color-admin-error` :
                                // ce dernier n'est défini nulle part, la couleur du taux le
                                // plus critique était donc simplement héritée.
                                "text-[color:var(--color-admin-destructive)]"
                        }
                      >
                        {s.tauxPresenceMoyen} %
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>

                  {/* Dossier (Lot 1 §1.4) — n/N étapes acquittées + pire état.
                      🔴 L'état est ÉCRIT, la couleur ne fait que le doubler :
                      une pastille seule ne dit rien à qui ne la perçoit pas, ni
                      sur une page imprimée pour l'auditeur (WCAG 1.4.1). */}
                  <td className={cellCls}>
                    {(() => {
                      const p = parSession.get(s.id);
                      if (!p) {
                        // Le service a échoué, ou la session est hors périmètre.
                        // On ne fabrique pas un « à jour » rassurant.
                        return <span className="text-[color:var(--color-admin-fg-muted)]">—</span>;
                      }
                      return (
                        <>
                          <div className="font-medium whitespace-nowrap">
                            {LIBELLE_ETAT_DOSSIER[p.pire]}
                          </div>
                          <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                            {p.fait}/{p.total} étapes
                          </div>
                        </>
                      );
                    })()}
                  </td>

                  {/* Actions */}
                  <td className={cellCls}>
                    {/* Quatre verbes soulignés empilés : c'est la cellule que
                        Will a pointée en production. On encadre les quatre —
                        n'en encadrer qu'un rendrait les trois autres muets —
                        et on les pose côte à côte, à la ligne si besoin. */}
                    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/sessions/${s.id}`}
                        className="admin-button-secondary"
                      >
                        Ouvrir
                      </Link>
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/sessions/${s.id}/emargement`}
                        className="admin-button-ghost"
                      >
                        Émargement
                      </Link>
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/sessions/${s.id}/evaluations`}
                        className="admin-button-ghost"
                      >
                        Évaluations
                      </Link>
                      <Link
                        href={`/${locale}/${adminPrefix}/qualiopi/sessions/${s.id}/financement`}
                        className="admin-button-ghost"
                      >
                        Financement
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* `archives` est préservé dans les liens : sans lui, passer à la page 2
          des archives retomberait silencieusement dans la fenêtre de 12 mois. */}
      <AdminPagination
        page={liste.page}
        totalPages={liste.totalPages}
        baseHref={base}
        preservedParams={{ archives: avecArchives ? "1" : undefined }}
      />
    </AdminPageShell>
  );
}
