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
import { CircleDot, Mail, Mic, PhoneCall, TriangleAlert, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import { listInbox } from "@/features/admin-inbox/queries";
import { clientsParEmail } from "@/server/qualiopi/crm/entrees";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";

import {
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

/**
 * Pictogramme et teinte d'identité par canal — refonte 2026-08-02.
 *
 * Remplace les emojis que portait `INBOX_CHANNEL_ICONS` : leur dessin dépend du
 * système et de la police du poste, ingérable dans un tableau dense où ils se
 * répètent ligne après ligne. Les composants sont ceux que la barre latérale
 * donne déjà à ces destinations, et chaque canal porte une teinte de la palette
 * d'identité — l'œil trie les lignes sans lire.
 */
const CANAL: Record<InboxChannel, { icone: LucideIcon; teinte: string }> = {
  appel: { icone: PhoneCall, teinte: "bleu" },
  message: { icone: Mail, teinte: "teal" },
  candidature: { icone: UserPlus, teinte: "violet" },
  podcast: { icone: Mic, teinte: "magenta" },
};

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

  // 🔴 La session était lue pour résoudre le « non lu », jamais pour décider de
  // ce qui s'affiche. Le canal « appel » servait donc le nom et l'adresse de
  // chaque prospect à tous les rôles, y compris ceux à qui la fiche du même
  // appel est refusée depuis le 2026-08-27. Les lignes restent (compteurs et
  // chronologie justes) ; les coordonnées, non.
  const role = (session?.user as { role?: string } | undefined)?.role;
  const peutVoirAppels = peutVoirLesAppels(role);
  // Le canal « candidature » suit la même règle, mais par le RÔLE : c'est la
  // lecture qui applique le prédicat commun. Sans ce rôle, la Boîte servait le
  // nom et l'adresse de chaque candidat à `reader` — le défaut du 2026-08-25,
  // rouvert par l'extraction de la lecture sans session, rattrapé par sa garde.

  const result = await listInbox({
    adminUserId,
    peutVoirAppels,
    roleAdmin: role ?? null,
    ...(channel ? { channel } : {}),
    ...(onlyAction ? { onlyAction: true } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  // Annotation « déjà client » — un seul `findMany` sur les e-mails de la page.
  // ⚠️ La fonction est IMPORTÉE, jamais recopiée : deux règles doivent rester
  // communes aux deux appelants (comparaison insensible à la casse, et « le
  // premier client créé gagne » en cas de doublon d'e-mail). Dupliquées, elles
  // finiraient par désigner deux clients différents pour la même demande.
  const clientsCrm = await clientsParEmail(result.rows.map((r) => r.contactEmail));

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
      label: INBOX_CHANNEL_LABELS[c],
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
      cell: (r) => {
        const { icone: IconeCanal, teinte } = CANAL[r.channel];
        return (
          <span className="flex items-center gap-[var(--space-admin-3)] whitespace-nowrap">
            {/* Pastille « non lu » — s'efface d'elle-même à l'ouverture de la
                fiche. Doublée du gras : la couleur seule ne suffit pas (WCAG). */}
            {/* 🔴 `aria-prohibited-attr` (serious) — corrigé le 2026-09-03.
                Ce `<span>` portait un `aria-label` alors qu'il n'a aucun rôle :
                un élément générique ne peut pas porter de nom accessible, et
                axe le refuse. Le lecteur d'écran n'annonçait donc RIEN là où le
                voyant dit « non lu ».

                🔑 Le défaut est ANCIEN. Il n'apparaissait pas parce que cette
                pastille ne se rend que s'il existe au moins un élément non lu —
                et la base de recette n'en portait aucun. C'est le socle du
                recrutement (60 candidatures, dont 18 à traiter) qui l'a rendu
                visible, dès son premier passage en CI. C'est exactement ce
                qu'on attendait de lui.

                Corrigé par un texte pour lecteur d'écran + une pastille
                décorative, plutôt que par `role="img"` : le dépôt a déjà ce
                motif partout ailleurs, et un texte réel survit à un moteur
                d'accessibilité qui changerait d'avis sur les rôles. */}
            {r.unread ? (
              <>
                <span className="sr-only">Non lu</span>
                <span
                  aria-hidden="true"
                  title="Non lu"
                  className="inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--color-admin-info)]"
                />
              </>
            ) : null}
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-admin-md)]"
              style={{
                background: `var(--color-admin-id-${teinte}-soft)`,
                color: `var(--color-admin-id-${teinte})`,
              }}
            >
              <IconeCanal size={14} />
            </span>
            <span
              className={`text-[length:var(--text-admin-sm)] ${r.unread ? "font-semibold" : ""}`}
            >
              {INBOX_CHANNEL_LABELS[r.channel]}
            </span>
          </span>
        );
      },
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
      // Reprise de l'écran « Entrées récentes », dont c'était la SEULE valeur
      // propre : dire tout de suite si l'expéditeur est déjà un client, pour
      // qu'on ne le convertisse pas une seconde fois. Cet écran refaisait par
      // ailleurs l'union appels + messages que cette page fait déjà — quatre
      // portes pour un seul geste (UNE-SEULE-PORTE.md). Il redirige désormais ici.
      key: "client",
      header: "Client",
      hiddenBelow: "lg",
      cell: (r) => {
        const client = r.contactEmail
          ? (clientsCrm.get(r.contactEmail.trim().toLowerCase()) ?? null)
          : null;
        return client ? (
          <Link
            href={`/fr/${adminPrefix}/qualiopi/clients/${client.id}`}
            className="whitespace-nowrap text-[color:var(--color-admin-accent)] hover:underline"
            title={client.raisonSociale}
          >
            {client.numero}
          </Link>
        ) : (
          <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
        );
      },
    },
    {
      key: "status",
      header: "Statut",
      cell: (r) => (
        <span className="whitespace-nowrap">
          {/* La pastille rouge était en `aria-hidden` : l'information « ça attend une action
              de votre part » n'existait qu'en COULEUR, et pour les seuls
              voyants. Une icône porteuse d'un nom accessible la rend audible. */}
          {r.needsAction ? (
            <CircleDot
              size={14}
              className="shrink-0 text-[color:var(--color-admin-destructive)]"
              aria-label="En attente d'une action de votre part"
            />
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
            <TriangleAlert
              size={14}
              aria-hidden="true"
              className="inline-block shrink-0 align-[-0.125em]"
            />{" "}
            {result.failedChannels.length === 1 ? "Un canal n'a" : "Des canaux n'ont"} pas pu être
            chargé
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
          <TriangleAlert
            size={14}
            aria-hidden="true"
            className="inline-block shrink-0 align-[-0.125em]"
          />{" "}
          Vue limitée aux entrées les plus récentes de chaque canal. Ouvrez le canal concerné pour
          voir l&apos;historique complet.
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
