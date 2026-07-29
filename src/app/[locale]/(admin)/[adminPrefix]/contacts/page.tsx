// Boîte de réception — vue « Tout » (refonte 2026-07-29).
//
// Réunit dans une seule chronologie les 4 canaux par lesquels quelqu'un peut
// nous joindre : appel réservé, message, candidature, demande de podcast.
// Auparavant `/contacts` redirigeait vers les messages — la console n'avait
// aucun écran répondant à « qu'est-ce qui est arrivé depuis hier ? », alors
// que c'est la première question qu'on se pose en ouvrant un back-office.
//
// Cette page ne fait que LIRE. Chaque ligne renvoie à la fiche native de son
// canal, qui porte les actions (répondre, archiver, changer de statut) : on ne
// duplique aucune règle métier ici.

import Link from "next/link";
import { auth } from "@/auth";
import { listInbox } from "@/features/admin-inbox/queries";
import {
  INBOX_CHANNEL_ICONS,
  INBOX_CHANNEL_LABELS,
  INBOX_CHANNEL_ORDER,
  type InboxChannel,
  type InboxItem,
} from "@/features/admin-inbox/types";
import {
  AdminPageHeader,
  AdminFilterTabs,
  AdminTable,
  AdminPagination,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function InboxPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const base = `/fr/${adminPrefix}/contacts`;

  const channel = INBOX_CHANNEL_ORDER.includes(sp["canal"] as InboxChannel)
    ? (sp["canal"] as InboxChannel)
    : undefined;
  const onlyAction = sp["action"] === "1";
  const page = sp["page"] ? parseInt(sp["page"], 10) : 1;

  // `adminUserId` résout le « non lu », qui est un état PAR PERSONNE : dans une
  // boîte partagée, ce qu'un admin a ouvert ne l'est pas pour les autres.
  const session = await auth();
  const adminUserId = session?.user?.id ?? null;

  const result = await listInbox({
    adminUserId,
    ...(channel ? { channel } : {}),
    ...(onlyAction ? { onlyAction: true } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  const keep = (extra: Record<string, string>): string => {
    const qs = new URLSearchParams(extra);
    return qs.toString() ? `${base}?${qs.toString()}` : base;
  };

  const channelTabs = [
    {
      value: "all",
      label: "Tous les canaux",
      href: keep(onlyAction ? { action: "1" } : {}),
      count: Object.values(result.countsByChannel).reduce((a, b) => a + b, 0),
    },
    ...INBOX_CHANNEL_ORDER.map((c) => ({
      value: c,
      label: `${INBOX_CHANNEL_ICONS[c]} ${INBOX_CHANNEL_LABELS[c]}`,
      href: keep({ canal: c, ...(onlyAction ? { action: "1" } : {}) }),
      count: result.countsByChannel[c],
    })),
  ];

  const actionTabs = [
    { value: "all", label: "Tout", href: keep(channel ? { canal: channel } : {}) },
    {
      value: "action",
      label: `À traiter (${result.actionCount})`,
      href: keep({ action: "1", ...(channel ? { canal: channel } : {}) }),
    },
  ];

  const columns: ReadonlyArray<AdminTableColumn<InboxItem>> = [
    {
      key: "channel",
      header: "Canal",
      cell: (r) => (
        <span className="whitespace-nowrap">
          {/* Pastille « non lu » — s'efface d'elle-même à l'ouverture de la
              fiche. Doublée du gras : la couleur seule ne suffit pas (WCAG). */}
          {r.unread ? (
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full bg-[color:var(--color-admin-info)] align-middle"
              title="Non lu"
              aria-label="Non lu"
            />
          ) : null}
          <span aria-hidden="true">{INBOX_CHANNEL_ICONS[r.channel]}</span>{" "}
          <span className={`text-[length:var(--text-admin-sm)] ${r.unread ? "font-semibold" : ""}`}>
            {INBOX_CHANNEL_LABELS[r.channel]}
          </span>
        </span>
      ),
    },
    {
      key: "received",
      header: "Reçu le",
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.receivedAt)}</span>,
    },
    {
      key: "subject",
      header: "Objet",
      cell: (r) => <span className={r.unread ? "font-semibold" : ""}>{r.subject}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      cell: (r) =>
        r.contactName || r.contactEmail ? (
          <span className="block">
            <span className="block">{r.contactName ?? "—"}</span>
            {r.contactEmail ? (
              <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {r.contactEmail}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-[color:var(--color-admin-fg-muted)]">à compléter</span>
        ),
    },
    {
      key: "context",
      header: "Contexte",
      hiddenBelow: "lg",
      cell: (r) => r.context ?? <span className="text-[color:var(--color-admin-fg-muted)]">—</span>,
    },
    {
      key: "status",
      header: "Statut",
      cell: (r) => (
        <span className="whitespace-nowrap">
          {r.needsAction ? (
            <span className="mr-1" title="En attente d'une action de votre part" aria-hidden="true">
              🔴
            </span>
          ) : null}
          {r.statusLabel}
        </span>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Boîte de réception"
        description="Tout ce qui arrive du site, dans l'ordre d'arrivée — appels réservés, messages, candidatures et demandes de podcast."
      />

      <div className="mb-[var(--space-admin-4)]">
        <AdminFilterTabs label="Canal" options={channelTabs} current={channel ?? "all"} />
      </div>
      <div className="mb-[var(--space-admin-4)]">
        <AdminFilterTabs
          label="Filtre"
          options={actionTabs}
          current={onlyAction ? "action" : "all"}
        />
      </div>

      {/* Un canal illisible se lit sinon exactement comme un canal vide — c'est
          ce qui a permis à un `pageSize` invalide de vivre un déploiement entier
          derrière un paisible « Message 0 ». Il ne peut plus passer inaperçu. */}
      {result.failedChannels.length > 0 ? (
        <div className="mb-[var(--space-admin-3)] rounded-lg border border-[color:var(--color-admin-danger-border)] bg-[color:var(--color-admin-danger-bg)] p-4 text-sm">
          <p className="font-semibold">
            ⚠️ {result.failedChannels.length === 1 ? "Un canal n'a" : "Des canaux n'ont"} pas pu
            être chargé
            {result.failedChannels.length === 1 ? "" : "s"} :{" "}
            {result.failedChannels.map((c) => INBOX_CHANNEL_LABELS[c]).join(", ")}.
          </p>
          <p className="mt-2">
            Les compteurs ci-dessus sont donc incomplets. Ouvrez le canal concerné directement pour
            voir ses données, et signalez l&apos;incident — le détail est dans les journaux serveur.
          </p>
        </div>
      ) : null}

      {/* Une troncature silencieuse ferait passer une liste partielle pour
          exhaustive : on l'affiche. */}
      {result.truncated ? (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          ⚠️ Vue limitée aux entrées les plus récentes de chaque canal. Ouvrez le canal concerné
          pour voir l&apos;historique complet.
        </p>
      ) : null}

      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {result.total} entrée{result.total > 1 ? "s" : ""} · page {result.page} /{" "}
        {result.totalPages}
      </p>

      {result.rows.length === 0 ? (
        <AdminEmptyState
          title="Rien à afficher"
          description={
            onlyAction
              ? "Aucune demande n'attend d'action de votre part. "
              : "Aucune demande reçue pour ce filtre."
          }
        />
      ) : (
        <AdminTable
          columns={columns}
          rows={result.rows}
          getRowId={(r) => r.key}
          rowHref={(r) => r.detailHref}
          rowAction={() => (
            <span
              aria-hidden="true"
              className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-muted)]"
            >
              ›
            </span>
          )}
        />
      )}

      <AdminPagination
        page={result.page}
        totalPages={result.totalPages}
        baseHref={base}
        preservedParams={{
          ...(channel ? { canal: channel } : {}),
          ...(onlyAction ? { action: "1" } : {}),
        }}
      />

      <p className="mt-[var(--space-admin-6)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Pour répondre, archiver ou changer un statut, ouvrez la fiche —{" "}
        <Link href={`${base}/messages`} className="admin-link">
          Messages
        </Link>
        ,{" "}
        <Link href={`${base}/appels`} className="admin-link">
          Appels réservés
        </Link>
        ,{" "}
        <Link href={`${base}/candidatures`} className="admin-link">
          Candidatures
        </Link>
        .
      </p>
    </>
  );
}
