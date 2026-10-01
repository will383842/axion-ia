/**
 * Admin — Dossier client · Page d'un PROJET (chantier visio, PR 3).
 *
 * Ce que l'on sait de CE projet : ses valeurs (besoin, budget, échéance…), à
 * côté la « valeur générale » de l'entreprise — jamais comparées l'une à
 * l'autre —, ses engagements et questions en cours, ses personnes, ses devis,
 * ses rendez-vous et son historique. Rien d'un autre projet.
 *
 * Régime REFUS (décision A2) : `gardeLectureEchanges` est la PREMIÈRE
 * instruction, avant tout accès à la base. Lien de retour vers la fiche client.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import {
  ListeSuivis,
  ListeValeurs,
  TYPES_SOCIETE,
  Trous,
} from "@/components/admin/dossier-client/Onglets";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { consoliderFaits } from "@/features/dossier-client/consolider-faits";
import {
  LIBELLE_ROLE_PROJET,
  LIBELLE_STATUT_PROJET,
  LIBELLE_STATUT_RENCONTRE,
} from "@/features/dossier-client/libelles";
import {
  lireFaitsDuClient,
  lireHistoriqueProjet,
  lirePersonnesDuClient,
  lireProjetsDuClient,
  lireQuestionnaireDuProjet,
  lireRencontresDuClient,
} from "@/features/dossier-client/queries";
import { VueQuestionnaire } from "@/components/admin/visio/VueQuestionnaire";
import { getClient } from "@/server/qualiopi/crm/clients";
import {
  lireCaseTestVisible,
  lirePersonnesCourtes,
} from "@/features/dossier-client/queries-rencontres";
import { NouveauRendezVous } from "@/components/admin/dossier-client/NouveauRendezVous";
import { lireMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { toParisLocalInput } from "@/lib/calendar-grid";
import { formatDateFrShort } from "@/lib/format-date-fr";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dossier client — Projet | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string; projetId: string }>;
  /**
   * PR 7 — `vue=questionnaire` : le questionnaire de cadrage du projet (une vue
   * de cette page, pas une page de plus : cliquet des pages de la console).
   */
  searchParams: Promise<{ vue?: string; message?: string; erreur?: string; sceau?: string }>;
}

const carteCls =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titreCls =
  "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const listeCls = "space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";

const LIBELLE_EVENEMENT: Readonly<Record<string, string>> = {
  cree: "Projet créé",
  statut_change: "Statut changé",
  reouvert: "Projet rouvert",
  fusionne: "Fusionné",
  deplace: "Déplacé vers une autre fiche",
  renomme: "Renommé",
};

export default async function ProjetPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id, projetId } = await params;
  const demande = await searchParams;
  // 🔴 Première instruction : la garde, AVANT toute lecture.
  const acces = await gardeLectureEchanges(`/${locale}/${adminPrefix}/login`);
  const ficheHref = `/${locale}/${adminPrefix}/qualiopi/clients/${id}`;
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={ficheHref} />;
  }

  const [client, projets, faits, personnes, rencontres] = await Promise.all([
    getClient(id),
    lireProjetsDuClient(id),
    lireFaitsDuClient(id),
    lirePersonnesDuClient(id),
    lireRencontresDuClient(id),
  ]);
  const projet = projets.find((p) => p.id === projetId);
  if (!client || projet === undefined) notFound();

  const historique = await lireHistoriqueProjet(projet.id);
  const [personnesCourtes, caseTest] = await Promise.all([
    lirePersonnesCourtes(id),
    lireCaseTestVisible(id),
  ]);
  const maintenant = new Date();
  const demainDixHeures =
    toParisLocalInput(new Date(maintenant.getTime() + 24 * 3_600_000)).slice(0, 11) + "10:00";
  const conso = consoliderFaits(faits, projets, maintenant);
  const portee = conso.projets[projet.id];
  const personnesDuProjet = personnes.filter((p) => p.roles.some((r) => r.projetId === projet.id));
  const rencontresDuProjet = rencontres.filter((r) => r.projetId === projet.id);
  const vueQuestionnaire = demande.vue === "questionnaire";
  const questionnaire = vueQuestionnaire ? await lireQuestionnaireDuProjet(projet.id) : null;
  const retourQuestionnaire = `${ficheHref}/projets/${projet.id}?vue=questionnaire`;

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link href={ficheHref} className={`text-[length:var(--text-admin-xs)] ${lienCls}`}>
          ← {client.raisonSociale}
        </Link>
      </div>

      <AdminPageHeader
        title={projet.titre}
        meta={
          <>
            <AdminBadge tone="neutral">{projet.numero}</AdminBadge>
            <AdminBadge tone="info" dot>
              {LIBELLE_STATUT_PROJET[projet.statut]}
            </AdminBadge>
          </>
        }
        actions={
          <AdminButton href={`${ficheHref}/preparer?projet=${projet.id}`}>
            Préparer le prochain échange
          </AdminButton>
        }
      />

      {vueQuestionnaire ? (
        <VueQuestionnaire
          clientId={id}
          projetId={projet.id}
          retour={retourQuestionnaire}
          questionnaire={questionnaire}
          message={lireMessageDeRetour(demande, "message") ?? undefined}
          erreur={lireMessageDeRetour(demande, "erreur") ?? undefined}
        />
      ) : null}

      <section className={carteCls}>
        <h2 className={titreCls}>Ce que l&apos;on sait de ce projet</h2>
        <ListeValeurs portee={portee} vide="Rien de validé pour ce projet." />
        <div className="mt-[var(--space-admin-3)]">
          <Trous trous={portee?.trous ?? []} />
        </div>
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>Valeur générale de l&apos;entreprise</h2>
        <p className={`mb-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] ${mutedCls}`}>
          Ce qui a été dit pour toute l&apos;entreprise, affiché à côté, sans être comparé au
          projet.
        </p>
        <ListeValeurs
          portee={conso.entreprise}
          types={TYPES_SOCIETE}
          vide="Rien de validé sur l'entreprise."
        />
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>Engagements et questions en cours</h2>
        <ListeSuivis portee={portee} vide="Aucun engagement ni question en cours." />
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>Personnes du projet</h2>
        {personnesDuProjet.length === 0 ? (
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
            Aucune personne rattachée à ce projet.
          </p>
        ) : (
          <ul className={listeCls}>
            {personnesDuProjet.map((p) => (
              <li key={p.id}>
                <span className="font-medium">{p.nom}</span>
                {p.fonction ? <span className={mutedCls}> · {p.fonction}</span> : null} —{" "}
                {p.roles
                  .filter((r) => r.projetId === projet.id)
                  .map((r) => LIBELLE_ROLE_PROJET[r.role])
                  .join(", ")}
                {!p.rencontree ? <span className={mutedCls}> (jamais rencontrée)</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>Devis liés</h2>
        {/* Chantier visio (PR 7) : le devis s'ouvre VIDE, l'aide « Ce que le
            client a dit » s'affiche à côté (décision de Will du 29/09). */}
        <div className="mb-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]">
          <AdminButton
            href={`/${locale}/${adminPrefix}/qualiopi/devis/new?clientId=${id}&projetId=${projet.id}`}
            variant="secondary"
          >
            Créer un devis pour ce projet
          </AdminButton>
          <AdminButton
            href={`/${locale}/${adminPrefix}/qualiopi/vente/new?clientId=${id}&projetId=${projet.id}`}
            variant="secondary"
          >
            Vente guidée pour ce projet
          </AdminButton>
          <AdminButton href={retourQuestionnaire} variant="secondary">
            Questionnaire de cadrage
          </AdminButton>
        </div>
        {projet.devis.length === 0 ? (
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>Aucun devis lié.</p>
        ) : (
          <ul className={listeCls}>
            {projet.devis.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/${locale}/${adminPrefix}/qualiopi/devis/${d.id}`}
                  className={`font-mono ${lienCls}`}
                >
                  {d.numero}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>Rendez-vous du projet</h2>
        {/* Chantier visio (PR 4, B9) : un rendez-vous en 2 clics depuis le projet. */}
        <NouveauRendezVous
          clientId={id}
          projetId={projet.id}
          personnes={personnesCourtes}
          caseTestVisible={caseTest}
          debutParDefaut={demainDixHeures}
        />
        {rencontresDuProjet.length === 0 ? (
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
            Aucun rendez-vous rangé dans ce projet.
          </p>
        ) : (
          <ul className={listeCls}>
            {rencontresDuProjet.map((r) => (
              <li key={r.id}>
                <span className="font-medium">{r.titre}</span>{" "}
                <span className={mutedCls}>
                  {r.debutPrevu !== null ? formatDateFrShort(r.debutPrevu) : ""}
                  {r.statut !== null ? ` · ${LIBELLE_STATUT_RENCONTRE[r.statut]}` : ""}
                </span>
                {r.compteRenduValide?.enBref ? (
                  <p className="mt-[var(--space-admin-1)] whitespace-pre-line">
                    {r.compteRenduValide.enBref}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>Historique</h2>
        <ul className={listeCls}>
          {historique.map((h, i) => (
            <li key={i}>
              {formatDateFrShort(h.survenuLe)} — {LIBELLE_EVENEMENT[h.action] ?? h.action}
              {h.nouveauStatut !== null && h.action !== "cree"
                ? ` : ${LIBELLE_STATUT_PROJET[h.nouveauStatut]}`
                : ""}
            </li>
          ))}
        </ul>
      </section>
    </AdminPageShell>
  );
}
