// Monteurs & vidéastes — les candidatures VIDÉO FREELANCE, prix côte à côte.
//
// Demande Will 2026-09-26 : « que les monteurs et ceux qui filment soient bien
// visibles » dans la console. L'onglet « Monteur vidéo » retiré le 2026-09-23
// ne montrait qu'une liste de noms, comme toutes les autres offres ; ce qui
// manquait, c'était de LIRE LES PRIX sans ouvrir chaque fiche. Cette vue a une
// raison d'exister que le sélecteur d'offre n'a pas : une colonne par question
// de l'offre (tarifs, matériel, déplacement, liens), un tableau par offre.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import {
  listerCandidaturesVideoFreelance,
  PLAFOND_VIDEO_FREELANCE,
  type CandidatVideo,
  type OffreVideo,
} from "@/features/admin-job-applications/video-freelance";
import { LIBELLE_STATUT, TON_STATUT } from "@/content/recrutement/statuts";
import { formatDateFrShort } from "@/lib/format-date-fr";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

const MASQUE = "—";
const URL_RE = /(https?:\/\/[^\s<>"]+)/g;

/** Une réponse libre, avec ses liens cliquables (exemples de montages, rushes). */
function Reponse({ texte }: { texte: string | undefined }) {
  if (!texte) return <span className="admin-meta-small">{MASQUE}</span>;
  const morceaux = texte.split(URL_RE);
  return (
    <span className="block max-w-[22rem] text-sm whitespace-pre-wrap">
      {morceaux.map((m, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={m}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all underline"
          >
            {m}
          </a>
        ) : (
          <span key={i}>{m}</span>
        ),
      )}
    </span>
  );
}

/** Libellé court de colonne : le début de la question, jusqu'à sa première ponctuation. */
function entete(label: string): string {
  const court = label.split(/[:?(]/)[0]?.trim() ?? label;
  return court.length > 40 ? `${court.slice(0, 39)}…` : court;
}

function TableauOffre({ offre, base }: { offre: OffreVideo; base: string }) {
  const colonnes: ReadonlyArray<AdminTableColumn<CandidatVideo>> = [
    {
      key: "candidat",
      header: "Candidat",
      cell: (c) => (
        <Link href={`${base}/${c.id}`} className="font-medium underline">
          {c.nom ?? "masqué"}
        </Link>
      ),
    },
    { key: "ville", header: "Ville", cell: (c) => c.ville ?? MASQUE },
    { key: "depot", header: "Reçue le", cell: (c) => formatDateFrShort(c.submittedAt) },
    {
      key: "statut",
      header: "Statut",
      cell: (c) => <AdminBadge tone={TON_STATUT[c.status]}>{LIBELLE_STATUT[c.status]}</AdminBadge>,
    },
    ...offre.questions.map((q): AdminTableColumn<CandidatVideo> => ({
      key: `q_${q.id}`,
      header: `${entete(q.labelFr ?? q.id)}${q.required ? " *" : ""}`,
      cell: (c) => <Reponse texte={c.reponses[q.id]} />,
    })),
  ];

  return (
    <AdminCard className="mb-[var(--space-admin-5)]">
      <div className="mb-[var(--space-admin-3)] flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="admin-section-title">{offre.titre}</h2>
        <span className="admin-meta-small">
          {offre.total} candidature{offre.total > 1 ? "s" : ""}
          {offre.total > offre.candidats.length
            ? ` · ${PLAFOND_VIDEO_FREELANCE} plus récentes affichées`
            : ""}
          {offre.offerId ? (
            <>
              {" · "}
              <Link href={`${base}?offerId=${offre.offerId}`} className="underline">
                gérer dans la liste
              </Link>
            </>
          ) : null}
        </span>
      </div>
      {offre.candidats.length === 0 ? (
        <AdminEmptyState title="Aucune candidature pour l'instant." />
      ) : (
        <div className="overflow-x-auto">
          <AdminTable
            columns={colonnes}
            rows={offre.candidats}
            getRowId={(c) => c.id}
            caption={`Candidatures — ${offre.titre}`}
          />
        </div>
      )}
    </AdminCard>
  );
}

export default async function CandidaturesVideoPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/fr/${adminPrefix}/login`);

  const role = (session.user as { role?: string }).role ?? null;
  const offres = await listerCandidaturesVideoFreelance({ role, acteurId: session.user.id });
  const base = `/fr/${adminPrefix}/contacts/candidatures`;
  const total = offres.reduce((n, o) => n + o.total, 0);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Monteurs & vidéastes"
        description={`${total} candidature${total > 1 ? "s" : ""} vidéo freelance · tarifs, matériel et exemples côte à côte`}
      />
      {offres.length === 0 ? (
        <AdminEmptyState title="Aucune offre vidéo freelance en base." />
      ) : (
        offres.map((o) => <TableauOffre key={o.slug} offre={o} base={base} />)
      )}
    </AdminPageShell>
  );
}
