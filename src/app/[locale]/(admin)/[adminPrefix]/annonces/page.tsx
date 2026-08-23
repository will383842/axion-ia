/**
 * Admin — Performance des annonces de recrutement.
 *
 * Répond à une seule question : « quelle annonce rapporte ? ». Sans cet écran,
 * une candidature arrive sans qu'on sache d'où elle vient, et on décide de
 * remettre — ou non — de l'argent dans un canal à l'aveugle.
 *
 * 🔴 CE QUE CET ÉCRAN NE DIT PAS ENCORE. La colonne qui décide vraiment est
 * « coût par apporteur ACTIF » (celui qui a déposé un premier contact), pas le
 * volume de candidatures. Elle suppose le registre d'attribution, qui n'existe
 * pas encore. Ce tableau classe donc par VOLUME et QUALITÉ D'ENTRÉE, pas par
 * rentabilité — et il le dit à l'écran. Un agrégateur qui laisse croire qu'il
 * mesure autre chose que ce qu'il mesure est pire que pas d'agrégateur.
 *
 * Tout est dérivé des `Submission` à l'affichage : aucune table de métriques,
 * donc rien qui puisse diverger de la réalité décrite.
 *
 * Lecture seule.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Inbox, Megaphone, PhoneCall, Users } from "lucide-react";

import { auth } from "@/auth";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { formatDateFr } from "@/lib/format-date-fr";
import {
  getAnnoncesStats,
  type AnnonceStatRow,
} from "@/features/admin-job-applications/annonces-stats";
import { SCORE_SEUIL_HAUTE, SCORE_SEUIL_MOYENNE } from "@/lib/commercial-application/scoring";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Annonces de recrutement | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

function Tableau({
  titre,
  sousTitre,
  lignes,
}: {
  titre: string;
  sousTitre: string;
  lignes: readonly AnnonceStatRow[];
}) {
  return (
    <AdminCard>
      <h2 className="admin-h2">{titre}</h2>
      <p className="admin-help mb-[var(--space-admin-3)]">{sousTitre}</p>

      {lignes.length === 0 ? (
        <AdminEmptyState
          title="Aucune candidature sur la période"
          description="Rien à agréger pour l'instant — l'écran se remplira à la première candidature reçue."
        />
      ) : (
        // `overflow-x-auto` : 7 colonnes ne tiennent pas sur un écran étroit.
        // Le tableau défile dans SON conteneur, jamais la page (règle
        // AGENTS.md : le corps ne défile jamais horizontalement).
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Provenance</th>
                <th scope="col">Candidatures</th>
                <th scope="col">Prioritaires</th>
                <th scope="col">À qualifier</th>
                <th scope="col">Vivier</th>
                <th scope="col">Score moyen</th>
                <th scope="col">Coût</th>
                <th scope="col">€ / candidature</th>
                <th scope="col">Dernière</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <th scope="row">{l.label}</th>
                  <td>{l.candidatures}</td>
                  <td>{l.prioritaires}</td>
                  <td>{l.aQualifier}</td>
                  <td>{l.vivier}</td>
                  <td>
                    {l.scoreMoyen === null ? "—" : `${l.scoreMoyen}/100`}
                    {l.sansScore > 0 ? (
                      <span className="admin-help"> ({l.sansScore} sans note)</span>
                    ) : null}
                  </td>
                  {/* Dépense NON SAISIE → « — », jamais « 0 € ». Un zéro
                      affirmerait une acquisition gratuite ; un tiret dit
                      qu'on ne sait pas. Une case vide se remarque, un zéro se
                      croit. */}
                  <td>{l.coutEur > 0 ? `${l.coutEur} €` : "—"}</td>
                  <td>
                    {l.coutParCandidature !== null ? (
                      <strong>{l.coutParCandidature} €</strong>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{l.derniere ? formatDateFr(l.derniere) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}

export default async function AnnoncesStatsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const stats = await getAnnoncesStats();

  const prioritaires = stats.parSourceDeclaree.reduce((n, l) => n + l.prioritaires, 0);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Annonces de recrutement"
        description={`Provenance des candidatures commerciales depuis le ${formatDateFr(stats.depuis)}. Tout est recalculé à l'affichage depuis les candidatures elles-mêmes.`}
      />

      {/* `.admin-kpi-grid` — définie dans `admin.css`. J'avais écrit
          `.admin-stat-grid`, qui n'existe pas : les quatre cartes se seraient
          empilées sans mise en page, sans qu'aucune erreur ne le dise. C'est
          `admin-design-tokens.test.ts` qui l'a vu — une classe `admin-*`
          inconnue de la feuille de style est un style qui ne s'applique pas. */}
      <div className="admin-kpi-grid">
        <AdminStatCard
          icon={Inbox}
          label="Candidatures"
          value={String(stats.total)}
          meta="sur 90 jours"
        />
        <AdminStatCard
          icon={PhoneCall}
          label="Prioritaires"
          value={String(prioritaires)}
          meta={`score ≥ ${SCORE_SEUIL_HAUTE} — à appeler`}
        />
        <AdminStatCard
          icon={Megaphone}
          label="Canaux actifs"
          value={String(stats.parSourceDeclaree.filter((l) => l.id !== "—").length)}
          meta="sources déclarées distinctes"
        />
        <AdminStatCard
          icon={Users}
          label="Sans provenance"
          value={String(stats.sansProvenance)}
          meta="ni source déclarée, ni UTM"
        />
      </div>

      {/* 🔴 Cet avertissement n'est pas décoratif : sans lui, ce tableau se lit
          comme un classement de rentabilité, ce qu'il n'est pas encore. */}
      <AdminCard>
        <h2 className="admin-h2">Ce que ce tableau mesure — et ce qu&apos;il ne mesure pas</h2>
        <p className="admin-help">
          Il classe les canaux par <strong>volume</strong> et par{" "}
          <strong>qualité d&apos;entrée</strong> (la note de tri). Il ne dit rien de la{" "}
          <strong>rentabilité</strong> : la seule colonne qui décide vraiment est le coût par
          apporteur <em>actif</em> — celui qui a déposé un premier contact. Elle suppose le registre
          d&apos;attribution, qui n&apos;existe pas encore. Un canal gratuit qui produit 200
          inscrits et zéro actif coûte plus cher qu&apos;un canal à 300 € qui en produit dix.
        </p>
        <p className="admin-help mt-[var(--space-admin-2)]">
          Les deux tableaux ci-dessous se contredisent souvent, et c&apos;est normal : le premier
          dit ce que le candidat <strong>déclare</strong>, le second ce que son lien{" "}
          <strong>prouve</strong>. On clique une annonce, on revient trois jours plus tard par
          Google, et on coche « site web ». Voir l&apos;écart vaut mieux que le subir.
        </p>
        <p className="admin-help mt-[var(--space-admin-2)]">
          <strong>
            La colonne « € / candidature » ne s&apos;affiche que si la dépense a été saisie.
          </strong>{" "}
          Elle se renseigne à la main dans <code>COUTS_ANNONCES</code> (
          <code>src/content/recrutement/partenaire-landings.ts</code>) — un canal absent y est
          traité comme gratuit, ce qui est le bon défaut pour Google for Jobs, LinkedIn organique ou
          le bouche à oreille. Un tiret signifie « non saisi », jamais « gratuit ».
        </p>
        <p className="admin-help mt-[var(--space-admin-2)]">
          Seuils de tri : <strong>≥ {SCORE_SEUIL_HAUTE}</strong> prioritaire ·{" "}
          <strong>
            {SCORE_SEUIL_MOYENNE} à {SCORE_SEUIL_HAUTE - 1}
          </strong>{" "}
          à qualifier · <strong>&lt; {SCORE_SEUIL_MOYENNE}</strong> vivier. Les candidatures
          antérieures au 2026-08-23 n&apos;ont pas de note : elles sont comptées « sans note »
          plutôt que rangées à tort dans le vivier.
        </p>
      </AdminCard>

      <Tableau
        titre="Par source déclarée"
        sousTitre="Ce que le candidat a coché dans le tunnel (« Comment nous avez-vous connus ? »)."
        lignes={stats.parSourceDeclaree}
      />

      <Tableau
        titre="Par UTM"
        sousTitre="Ce que le lien prouve — cookie posé au premier clic, avant tout formulaire."
        lignes={stats.parUtmSource}
      />
    </AdminPageShell>
  );
}
