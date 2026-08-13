// Sous-onglet « Podcast » de /contacts/messages (demande Will 2026-08-13) :
// les demandes de tournage vivent dans leur propre table (PodcastRequest),
// pas dans `submissions` — ce panneau les affiche DANS la boîte Messages,
// avec les mêmes colonnes que le listing des messages. La page /podcast
// (canal dédié, sidebar + ⌘K) reste inchangée ; le détail pointe vers elle.

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { AdminBadge } from "@/components/admin/ui";
import {
  podcastRequestStatusLabel,
  podcastRequestStatusTone,
} from "@/features/admin-podcast-requests/statuses";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";
import { formatDateFrShort, formatTimeFr } from "@/lib/format-date-fr";
import { splitNomPrenom } from "@/lib/nom-prenom";

interface Props {
  adminPrefix: string;
  /** Sous-onglets Catégorie construits par la page messages. */
  categoryTabs: React.ReactNode;
}

export async function PodcastRequestsView({
  adminPrefix,
  categoryTabs,
}: Props): Promise<React.ReactElement> {
  const requests = await prisma.podcastRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows = requests.map((r) => {
    const { prenom, nom } = splitNomPrenom(decryptPii(r.leaderName));
    return {
      id: r.id,
      detailHref: `/fr/${adminPrefix}/podcast/${r.id}`,
      cells: [
        <AdminBadge key="status" tone={podcastRequestStatusTone(r.status)}>
          {podcastRequestStatusLabel(r.status)}
        </AdminBadge>,
        formatDateFrShort(r.createdAt),
        formatTimeFr(r.createdAt),
        <span
          key="message"
          className="line-clamp-2 block max-w-[44ch] min-w-[24ch] text-[length:var(--text-admin-sm)] whitespace-normal"
        >
          {`${r.companyName} — ${r.activity} · tournage à ${r.city} (${r.postalCode})`}
        </span>,
        nom ?? "—",
        prenom ?? "—",
        decryptPii(r.email),
        decryptPii(r.phone),
      ],
    };
  });

  return (
    <AdminListScaffold
      title="Messages — Demandes de podcast"
      itemLabel="demande"
      total={requests.length}
      page={1}
      totalPages={1}
      filters={categoryTabs}
      columnHeaders={["Statut", "Date", "Heure", "Demande", "Nom", "Prénom", "Email", "Téléphone"]}
      rows={rows}
      rowClickable
      emptyTitle="Aucune demande de podcast"
      emptyDescription="Les demandes déposées sur /podcast (ou via le QR du flyer) apparaîtront ici."
      paginationBaseHref={`/fr/${adminPrefix}/contacts/messages`}
      paginationPreservedParams={{ cat: "podcast" }}
    />
  );
}
