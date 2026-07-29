// Boîte de réception unifiée — collecte + normalisation des 4 canaux.
//
// PARTI PRIS : on réutilise les fonctions de liste EXISTANTES de chaque canal
// (`listSubmissionsAction`, `listRendezVous`, `listApplicationsAction`) plutôt
// que de réécrire des requêtes Prisma. Elles portent déjà le contrôle de
// session, le déchiffrement des PII et les règles d'exclusion (archivés,
// corbeille) : les redoubler ici créerait deux vérités qui divergeraient au
// premier changement. Seul `PodcastRequest`, qui n'a pas de fonction de liste
// dédiée, est requêté directement.
//
// Volumétrie : on lit une fenêtre bornée par canal (`PER_CHANNEL_FETCH`) puis
// on trie et pagine EN MÉMOIRE. C'est le même parti pris que
// `features/admin-rendezvous` et il tient tant que les canaux se comptent en
// centaines de lignes — ce qui est le cas et le restera pour un flux entrant
// d'artisanat. Au-delà, il faudra une vue SQL UNION paginée.
//
// Build-safety (ADR 0026) : au build, `prisma` est un Proxy stub qui renvoie []
// → la page se rend vide sans connexion DB. Rien à guarder ici.

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { adminPath } from "@/lib/admin-path";
import { listSubmissionsAction } from "@/features/admin-submissions/actions";
import { listApplicationsAction } from "@/features/admin-job-applications/actions";
import { listRendezVous } from "@/features/admin-rendezvous/queries";
import { RDV_STATUS_LABELS } from "@/features/admin-rendezvous/types";
import { resolveSubmissionLabel } from "@/features/admin-submissions/type-labels";
import { podcastRequestStatusLabel } from "@/features/admin-podcast-requests/statuses";
import type { InboxChannel, InboxItem } from "./types";

/** Fenêtre lue par canal avant fusion. Borne dure : protège la mémoire. */
const PER_CHANNEL_FETCH = 200;

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  processed: "Traité",
  archived: "Archivé",
};

/** Aligné sur l'enum `JobApplicationStatus` du schéma Prisma. */
const APPLICATION_STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle",
  reviewing: "En cours d'examen",
  shortlisted: "Présélectionnée",
  rejected: "Refusée",
  hired: "Recrutée",
  archived: "Archivée",
};

/** Déchiffre sans jamais faire tomber la page si une valeur est corrompue. */
function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const out = decryptPii(value);
    return out && out.trim() ? out : null;
  } catch {
    return null;
  }
}

async function fetchMessages(): Promise<InboxItem[]> {
  const res = await listSubmissionsAction({ page: 1, pageSize: PER_CHANNEL_FETCH });
  return res.items.map((s) => ({
    key: `msg_${s.id}`,
    channel: "message" as const,
    detailHref: adminPath("fr", `contacts/messages/${s.id}`),
    receivedAt: s.submittedAt,
    subject: resolveSubmissionLabel(s.type, s.unifiedType),
    contactName: s.contactName || null,
    contactEmail: s.contactEmail || null,
    context: s.companyName || null,
    statusLabel: SUBMISSION_STATUS_LABELS[s.status] ?? s.status,
    // Un message sans réponse et non traité attend quelque chose de nous.
    needsAction: s.replyCount === 0 && s.status !== "processed" && s.status !== "archived",
  }));
}

async function fetchAppels(): Promise<InboxItem[]> {
  const { rows } = await listRendezVous({ page: 1, pageSize: PER_CHANNEL_FETCH });
  return rows.map((r) => ({
    key: r.key,
    channel: "appel" as const,
    detailHref: r.detailHref,
    // `startTime` est souvent nul (Calendly ne le transmet pas au navigateur) :
    // on retombe sur la date de capture pour que la ligne ait toujours une
    // place dans la chronologie au lieu de disparaître.
    receivedAt: r.createdAt,
    subject: r.title,
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    context:
      r.timeConfirmed && r.startTime
        ? `Créneau ${r.dayKey}`
        : `Créneau ${r.dayKey} · heure à confirmer`,
    statusLabel: RDV_STATUS_LABELS[r.status],
    // Un appel dont on ignore encore avec qui il a lieu demande une action.
    needsAction: r.status === "scheduled" && (r.contactName == null || r.contactEmail == null),
  }));
}

async function fetchCandidatures(): Promise<InboxItem[]> {
  const res = await listApplicationsAction({ page: 1, pageSize: 100 });
  return res.items.map((a) => ({
    key: `job_${a.id}`,
    channel: "candidature" as const,
    detailHref: adminPath("fr", `contacts/candidatures/${a.id}`),
    receivedAt: a.submittedAt,
    subject: "Candidature",
    contactName: a.contactName || null,
    contactEmail: a.contactEmail || null,
    context: a.offerTitleSnap,
    statusLabel: APPLICATION_STATUS_LABELS[a.status] ?? a.status,
    needsAction: a.needsAttention,
  }));
}

async function fetchPodcast(): Promise<InboxItem[]> {
  const rows = await prisma.podcastRequest
    .findMany({
      orderBy: { createdAt: "desc" },
      take: PER_CHANNEL_FETCH,
      select: {
        id: true,
        companyName: true,
        leaderName: true,
        email: true,
        city: true,
        status: true,
        createdAt: true,
      },
    })
    .catch(() => []);
  return rows.map((p) => ({
    key: `pod_${p.id}`,
    channel: "podcast" as const,
    detailHref: adminPath("fr", `podcast/${p.id}`),
    receivedAt: p.createdAt,
    subject: "Demande de tournage",
    contactName: safeDecrypt(p.leaderName),
    contactEmail: safeDecrypt(p.email),
    context: `${p.companyName} · ${p.city}`,
    statusLabel: podcastRequestStatusLabel(p.status),
    needsAction: p.status === "new",
  }));
}

export interface InboxFilters {
  channel?: InboxChannel;
  /** Ne garder que ce qui attend une action de notre part. */
  onlyAction?: boolean;
  page?: number;
  pageSize?: number;
}

export interface InboxResult {
  rows: InboxItem[];
  total: number;
  page: number;
  totalPages: number;
  /** Compteurs par canal, calculés AVANT pagination (sur le jeu filtré action). */
  countsByChannel: Record<InboxChannel, number>;
  /** Nombre d'éléments en attente d'action, tous canaux confondus. */
  actionCount: number;
  /**
   * Vrai si au moins un canal a atteint `PER_CHANNEL_FETCH` : la vue est alors
   * potentiellement tronquée. Affiché à l'écran plutôt que tu, pour ne pas
   * faire passer une troncature silencieuse pour une liste exhaustive.
   */
  truncated: boolean;
}

export async function listInbox(filters: InboxFilters = {}): Promise<InboxResult> {
  // `allSettled` : un canal en panne (table absente, PII indéchiffrable) ne doit
  // pas vider la boîte entière — les autres restent lisibles.
  const settled = await Promise.allSettled([
    fetchAppels(),
    fetchMessages(),
    fetchCandidatures(),
    fetchPodcast(),
  ]);
  const perChannel = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  const truncated = perChannel.some((arr) => arr.length >= PER_CHANNEL_FETCH);
  let all = perChannel.flat();

  const countsByChannel: Record<InboxChannel, number> = {
    appel: 0,
    message: 0,
    candidature: 0,
    podcast: 0,
  };
  for (const it of all) countsByChannel[it.channel] += 1;
  const actionCount = all.filter((it) => it.needsAction).length;

  if (filters.channel) all = all.filter((it) => it.channel === filters.channel);
  if (filters.onlyAction) all = all.filter((it) => it.needsAction);

  all.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

  const total = all.length;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 25;
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const rows = all.slice((page - 1) * pageSize, page * pageSize);

  return {
    rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    countsByChannel,
    actionCount,
    truncated,
  };
}

export { PER_CHANNEL_FETCH };
