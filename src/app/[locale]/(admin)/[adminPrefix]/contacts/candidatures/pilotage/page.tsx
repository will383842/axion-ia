// Pilotage du recrutement — l'écran qui manquait au lot 3.
//
// 🔴 POURQUOI IL EXISTE. `lastActivityAt` et `firstResponseAt` sont alimentés
//    depuis le lot 3, et rien ne les lisait. Une colonne tenue à jour que
//    personne ne consulte cesse un jour d'être tenue à jour sans que rien ne
//    rougisse. Cet écran est ce qui rend la porte unique d'écriture du journal
//    *utile*, donc surveillée.
//
// Deux blocs, et l'ordre n'est pas décoratif : d'abord ce qu'il faut RATTRAPER
// (les dossiers qui dorment), ensuite l'état du stock. Un tableau de bord qui
// ouvre sur des compteurs se lit comme un bilan ; celui-ci doit se lire comme
// une liste de gestes à poser.

import { redirect } from "next/navigation";
import { ArrowRight, Clock, Inbox, MailX } from "lucide-react";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminStatCard,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import {
  construireBilanPilotage,
  formaterDuree,
  FENETRE_DELAI_JOURS,
} from "@/features/admin-job-applications/pilotage";
import {
  listerDossiersEnSommeil,
  type DossierEnSommeil,
} from "@/server/careers/dossiers-en-sommeil";
import {
  LIBELLE_MOTIF_OUBLI,
  SEUIL_SANS_ACTIVITE_JOURS,
  SEUIL_SANS_REPONSE_JOURS,
} from "@/content/recrutement/oubli";
import { LIBELLE_STATUT, STATUTS_CANDIDATURE, TON_STATUT } from "@/content/recrutement/statuts";
import type { TonStatut } from "@/content/recrutement/statuts";
import { formatDateFrShort } from "@/lib/format-date-fr";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

/** Même masque que la liste : un tiret cadratin, jamais une cellule vide. */
const MASQUE = "—";

/**
 * Le ton d'une pastille de statut → le ton d'une tuile de compteur.
 *
 * 🔴 Les deux vocabulaires ne coïncident PAS : `AdminBadge` connaît `neutral`,
 *    `AdminStatCard` connaît `default`. Passer l'un pour l'autre ne lève aucune
 *    erreur au rendu — la tuile sortirait simplement sans sa pastille, et on
 *    chercherait longtemps pourquoi. La table le dit une fois.
 *
 * 🔑 `destructive` retombe sur `default` À DESSEIN : « Écartée » compte des
 *    décisions normales, pas des incidents. Peindre ce compteur en rouge
 *    apprendrait à ignorer le rouge, qui sert plus haut à dire « ce candidat
 *    attend depuis trois semaines ».
 */
const TON_TUILE = {
  neutral: "default",
  destructive: "default",
  info: "info",
  success: "success",
  warning: "warning",
} as const satisfies Record<TonStatut, "default" | "success" | "warning" | "info">;

export default async function PilotageRecrutementPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  // 🔑 Le rôle est passé au lecteur, pas tranché ici : c'est
  //    `listerDossiersEnSommeil` qui appelle le prédicat, pour la même raison
  //    que `reads.ts` — un booléen déjà calculé ne peut plus se vérifier, et un
  //    `true` posé par erreur ne se verrait nulle part.
  const role = (session.user as { role?: string }).role ?? null;
  const maintenant = new Date();
  const [bilan, sommeil] = await Promise.all([
    construireBilanPilotage(maintenant),
    listerDossiersEnSommeil(maintenant, role),
  ]);

  const base = `/fr/${adminPrefix}/contacts/candidatures`;
  const delai = bilan.delaiReponseMedianHeures;

  const colonnes: ReadonlyArray<AdminTableColumn<DossierEnSommeil>> = [
    { key: "depot", header: "Déposée le", cell: (d) => formatDateFrShort(d.submittedAt) },
    { key: "candidat", header: "Candidat", cell: (d) => d.contactName ?? MASQUE },
    { key: "offre", header: "Offre", cell: (d) => d.offerTitleSnap },
    {
      key: "statut",
      header: "Statut",
      cell: (d) => <AdminBadge tone={TON_STATUT[d.status]}>{LIBELLE_STATUT[d.status]}</AdminBadge>,
    },
    {
      key: "motif",
      header: "Pourquoi",
      cell: (d) => (
        <>
          <AdminBadge tone={d.motif === "jamais_repondu" ? "destructive" : "warning"}>
            {LIBELLE_MOTIF_OUBLI[d.motif]}
          </AdminBadge>
          <span className="admin-meta-small"> · {d.jours} j</span>
        </>
      ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Pilotage du recrutement"
        description={`${bilan.total} candidature${bilan.total > 1 ? "s" : ""} au total · ${sommeil.dossiers.length} dossier${sommeil.dossiers.length > 1 ? "s" : ""} à rattraper`}
      />

      {/* ── CE QU'IL FAUT RATTRAPER ─────────────────────────────────────── */}
      <section
        aria-label="Ce qu'il faut rattraper"
        className="mb-[var(--space-admin-5)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-3"
      >
        <AdminStatCard
          label={`Jamais répondu (> ${SEUIL_SANS_REPONSE_JOURS} j)`}
          value={sommeil.parMotif.jamais_repondu}
          tone={sommeil.parMotif.jamais_repondu > 0 ? "destructive" : "success"}
          icon={MailX}
          meta="le candidat n'a rien reçu depuis son dépôt"
        />
        <AdminStatCard
          label={`Sans activité (> ${SEUIL_SANS_ACTIVITE_JOURS} j)`}
          value={sommeil.parMotif.sans_activite}
          tone={sommeil.parMotif.sans_activite > 0 ? "warning" : "success"}
          icon={Clock}
          meta="aucune ligne au journal"
        />
        <AdminStatCard
          label="Délai médian de 1re réponse"
          value={delai === null ? MASQUE : formaterDuree(delai)}
          tone={delai !== null && delai > SEUIL_SANS_REPONSE_JOURS * 24 ? "warning" : "default"}
          icon={Inbox}
          // 🔑 L'effectif est DIT. Une médiane calculée sur trois dossiers
          //    n'est pas fausse, elle est fragile : l'afficher nue inviterait à
          //    tirer une conclusion qu'elle ne porte pas.
          meta={`${bilan.delaiEchantillon} dossier${bilan.delaiEchantillon > 1 ? "s" : ""} sur ${FENETRE_DELAI_JOURS} j`}
        />
      </section>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-section-title">Dossiers à rattraper</h2>
        {sommeil.plafondAtteint ? (
          // Une troncature ne doit JAMAIS être muette : sans cette ligne, un
          // écran plafonné se lit comme un écran complet.
          <p className="admin-alert admin-alert-warning" role="status">
            Liste tronquée : l’examen s’est arrêté au plafond. Il reste des dossiers non examinés —
            traiter ceux-ci d’abord, puis recharger.
          </p>
        ) : null}
        {sommeil.dossiers.length === 0 ? (
          <AdminEmptyState title="Aucun dossier en souffrance. Tout le monde a eu une réponse." />
        ) : (
          <AdminTable
            columns={colonnes}
            rows={sommeil.dossiers}
            getRowId={(d) => d.id}
            caption="Candidatures sans réponse ou sans activité"
            rowAction={(d) => (
              <AdminButton
                href={`${base}/${d.id}`}
                variant="ghost"
                size="sm"
                iconAfter={ArrowRight}
              >
                Ouvrir
              </AdminButton>
            )}
          />
        )}
      </AdminCard>

      {/* ── L'ÉTAT DU STOCK ─────────────────────────────────────────────── */}
      <AdminCard>
        <h2 className="admin-section-title">Le stock, par étape</h2>
        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {STATUTS_CANDIDATURE.map((s) => (
            <AdminStatCard
              key={s}
              label={LIBELLE_STATUT[s]}
              value={bilan.parStatut[s]}
              tone={TON_TUILE[TON_STATUT[s]]}
              // Chaque tuile est un lien vers la liste filtrée : un compteur
              // qu'on ne peut pas ouvrir oblige à reconstruire le filtre à la
              // main, et on finit par ne plus cliquer du tout.
              href={`${base}?view=standard&status=${s}`}
            />
          ))}
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
