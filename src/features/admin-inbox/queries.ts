// Boîte de réception unifiée — collecte + normalisation des 4 canaux.
//
// PARTI PRIS : on réutilise les fonctions de liste EXISTANTES de chaque canal
// (`listSubmissionsAction`, `listRendezVous`, `listApplicationsAction`) plutôt
// que de réécrire des requêtes Prisma. Elles portent déjà le contrôle de
// session, le déchiffrement des PII et les règles d'exclusion (archivés,
// corbeille) : les redoubler ici créerait deux vérités qui divergeraient au
// premier changement.
//
// Seul `PodcastRequest`, qui n'a pas de fonction de liste dédiée, est requêté
// directement.
//
// 🔴 RECTIFIÉ LE 2026-08-27 : « elles portent déjà le contrôle de session » est
// vrai des trois autres canaux et FAUX du canal `appel` — `listRendezVous` ne
// contient ni `auth` ni session. Cette phrase est exactement ce qui a permis de
// ne pas se poser la question, et de servir le nom et l'adresse de chaque
// prospect à tous les rôles de la console. Le canal `appel` reçoit désormais son
// habilitation explicitement (`filters.peutVoirAppels`).
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
import { listSubmissions } from "@/features/admin-submissions/reads";
import { listApplications } from "@/features/admin-job-applications/reads";
import { listRendezVous } from "@/features/admin-rendezvous/queries";
import { RDV_STATUS_LABELS } from "@/features/admin-rendezvous/types";
import { resolveSubmissionLabel } from "@/features/admin-submissions/type-labels";
import { podcastRequestStatusLabel } from "@/features/admin-podcast-requests/statuses";
import type { InboxChannel, InboxItem } from "./types";
import { ENTITY_BY_CHANNEL, fetchReadIds } from "./reads";

/**
 * Fenêtre lue par canal avant fusion.
 *
 * ⚠️ PLAFONNÉE À 100 — ce n'est pas un choix esthétique. `listSubmissionsAction`
 * et `listApplicationsAction` valident leur entrée avec `pageSize.max(100)` :
 * au-delà, le `.parse()` Zod LÈVE. Le premier jet passait 200, ce qui faisait
 * échouer le canal Messages à chaque chargement — et l'échec était avalé par le
 * `Promise.allSettled` ci-dessous, écrit pour qu'un canal en panne ne vide pas
 * la boîte entière. Le filet de sécurité masquait donc la panne qu'il aurait dû
 * rendre visible : la boîte affichait « Message 0 » en permanence, sans erreur.
 *
 * Deux verrous posés depuis :
 *   1. cette constante respecte la borne la plus basse des trois sources ;
 *   2. `listInbox` remonte désormais `failedChannels`, affiché à l'écran — un
 *      canal muet ne peut plus passer pour un canal vide.
 */
const PER_CHANNEL_FETCH = 100;

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

/**
 * ⚠️ **POURQUOI `listSubmissions` ET NON `listSubmissionsAction`.**
 *
 * Les deux actions commencent par une garde qui appelle `auth()`, laquelle lit
 * un **cookie de navigateur**. Cette union en dépendait donc pour deux de ses
 * quatre canaux — et un appel MCP, qui porte un secret partagé dans un en-tête,
 * n'a pas de cookie. Voir `admin-submissions/reads.ts`.
 *
 * ⚠️ **CE CHANGEMENT N'OUVRE RIEN, ET ÇA A ÉTÉ VÉRIFIÉ AVANT DE L'ÉCRIRE.**
 *    L'écran `/contacts` n'a jamais été protégé par la garde de l'action : il
 *    l'est par le middleware — `src/auth.config.ts`, callback `authorized()`,
 *    qui redirige vers la connexion toute requête d'une page sous le préfixe
 *    d'administration sans session. Le layout admin, lui, ne refuse PAS
 *    l'absence de session, parce que la page de connexion vit dedans.
 */
async function fetchMessages(): Promise<InboxItem[]> {
  const res = await listSubmissions({ page: 1, pageSize: PER_CHANNEL_FETCH });
  return res.items.map((s) => ({
    key: `msg_${s.id}`,
    sourceId: s.id,
    unread: false,
    channel: "message" as const,
    detailHref: adminPath("fr", `contacts/messages/${s.id}`),
    receivedAt: s.submittedAt,
    subject: resolveSubmissionLabel(s.type, s.unifiedType),
    contactName: s.contactName || null,
    contactEmail: s.contactEmail || null,
    // subType (slug formation du devis express, granularité audit/chatbot…)
    // prime sur la société : c'est lui qui dit DE QUOI parle la demande.
    context: s.subType || s.companyName || null,
    statusLabel: SUBMISSION_STATUS_LABELS[s.status] ?? s.status,
    // Un message sans réponse et non traité attend quelque chose de nous.
    needsAction: s.replyCount === 0 && s.status !== "processed" && s.status !== "archived",
  }));
}

/**
 * @param peutVoirAppels — le rôle a-t-il le droit de lire les coordonnées des
 * prospects (`peutVoirLesAppels`, `features/admin-calendly/acces`) ?
 *
 * 🔴 TROISIÈME SURFACE DU MÊME JUMEAU — fermée le 2026-08-27.
 *
 * Le nom et l'ADRESSE E-MAIL de chaque prospect arrivaient ici sans aucun
 * contrôle de rôle, en même temps qu'on fermait la fiche de l'appel. Le
 * commentaire d'en-tête de ce fichier justifiait de réutiliser les fonctions de
 * liste parce qu'« elles portent déjà le contrôle de session » : c'est vrai des
 * trois autres canaux, et FAUX de celui-ci — `listRendezVous` ne contient ni
 * `auth` ni session. C'est cette phrase qui a permis de ne pas se poser la
 * question.
 *
 * On garde la LIGNE (le compteur et la chronologie restent justes) et on retire
 * les coordonnées : un rôle non habilité voit qu'un appel est arrivé, pas avec
 * qui.
 */
async function fetchAppels(peutVoirAppels: boolean): Promise<InboxItem[]> {
  const { rows } = await listRendezVous({ page: 1, pageSize: PER_CHANNEL_FETCH });
  return rows.map((r) => ({
    key: r.key,
    sourceId: r.sourceRecordId,
    unread: false,
    channel: "appel" as const,
    // Le lien est CONSERVÉ même sans habilitation, et c'est délibéré : la fiche
    // qu'il vise est gardée et rend un refus NOMMÉ (`AccesRefuse`), qui dit
    // quel rôle manque et pourquoi. Un lien mort ou absent laisserait croire à
    // un bogue ; un refus explicite renseigne. Ce qui ne doit pas fuiter, ce
    // sont les coordonnées ci-dessous — pas l'existence de la fiche, que la
    // ligne elle-même révèle déjà.
    detailHref: r.detailHref,
    // `startTime` est souvent nul (Calendly ne le transmet pas au navigateur) :
    // on retombe sur la date de capture pour que la ligne ait toujours une
    // place dans la chronologie au lieu de disparaître.
    receivedAt: r.createdAt,
    subject: r.title,
    contactName: peutVoirAppels ? r.contactName : null,
    contactEmail: peutVoirAppels ? r.contactEmail : null,
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
  const res = await listApplications({ page: 1, pageSize: PER_CHANNEL_FETCH });
  return res.items.map((a) => ({
    key: `job_${a.id}`,
    sourceId: a.id,
    unread: false,
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
  // Pas de `.catch(() => [])` ici : il transformerait une panne en canal vide,
  // exactement le masquage qu'on vient de corriger. L'échec doit remonter à
  // `listInbox`, qui l'expose via `failedChannels`.
  const rows = await prisma.podcastRequest.findMany({
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
  });
  return rows.map((p) => ({
    key: `pod_${p.id}`,
    sourceId: p.id,
    unread: false,
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
  /**
   * Admin courant — sert à résoudre le « non lu », qui est un état PAR PERSONNE.
   * Absent : tout est considéré lu, plutôt que d'afficher un faux « non lu »
   * qui ne s'effacerait jamais.
   */
  adminUserId?: string | null;
  /**
   * Le rôle courant a-t-il le droit de lire les coordonnées des prospects
   * (`peutVoirLesAppels`, `features/admin-calendly/acces`) ?
   *
   * 🔴 LE DÉFAUT EST `false`, ET C'EST LE SEUL DÉFAUT SÛR. Un appelant qui
   * oublie ce champ masque les coordonnées au lieu de les divulguer — l'erreur
   * se voit à l'écran et se corrige, là où une fuite par oubli ne se voit pas.
   * C'est exactement l'oubli qui a laissé ce canal ouvert jusqu'au 2026-08-27.
   */
  peutVoirAppels?: boolean;
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
   * Éléments en attente d'action, PAR canal — c'est ce que portent les badges
   * de la sidebar (décision Will 2026-07-29 : un badge doit compter ce qu'il
   * reste à faire, donc descendre à zéro, sinon il finit ignoré).
   */
  actionByChannel: Record<InboxChannel, number>;
  /** Non lus par l'admin courant, par canal. */
  unreadByChannel: Record<InboxChannel, number>;
  /**
   * Vrai si au moins un canal a atteint `PER_CHANNEL_FETCH` : la vue est alors
   * potentiellement tronquée. Affiché à l'écran plutôt que tu, pour ne pas
   * faire passer une troncature silencieuse pour une liste exhaustive.
   */
  truncated: boolean;
  /**
   * Canaux dont la lecture a ÉCHOUÉ (et non « qui sont vides »).
   *
   * Sans cette distinction, une panne se lit exactement comme une absence de
   * données : c'est ce qui a permis au bug du `pageSize: 200` de vivre un
   * déploiement entier derrière un paisible « Message 0 ». La page l'affiche.
   */
  failedChannels: InboxChannel[];
}

/** Ordre des lectures — doit rester aligné sur `settled` ci-dessous. */
const FETCH_ORDER: ReadonlyArray<InboxChannel> = ["appel", "message", "candidature", "podcast"];

export async function listInbox(filters: InboxFilters = {}): Promise<InboxResult> {
  // `allSettled` : un canal en panne (table absente, PII indéchiffrable) ne doit
  // pas vider la boîte entière — les autres restent lisibles. Mais l'échec est
  // désormais REMONTÉ, pas avalé (cf. `failedChannels`).
  const settled = await Promise.allSettled([
    fetchAppels(filters.peutVoirAppels === true),
    fetchMessages(),
    fetchCandidatures(),
    fetchPodcast(),
  ]);
  const failedChannels: InboxChannel[] = [];
  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      const channel = FETCH_ORDER[i];
      if (channel) failedChannels.push(channel);
      // Un canal muet est une panne, pas un détail : trace serveur explicite.
      console.error(`[admin-inbox] canal « ${channel} » illisible :`, r.reason);
    }
  });
  const perChannel = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  const truncated = perChannel.some((arr) => arr.length >= PER_CHANNEL_FETCH);
  let all = perChannel.flat();

  // Accusés de lecture de l'admin courant — une seule requête pour les 4 canaux.
  const readIds = await fetchReadIds(filters.adminUserId);
  for (const it of all) {
    it.unread = !readIds[ENTITY_BY_CHANNEL[it.channel]].has(it.sourceId);
  }

  const zero = (): Record<InboxChannel, number> => ({
    appel: 0,
    message: 0,
    candidature: 0,
    podcast: 0,
  });
  const countsByChannel = zero();
  const actionByChannel = zero();
  const unreadByChannel = zero();
  for (const it of all) {
    countsByChannel[it.channel] += 1;
    if (it.needsAction) actionByChannel[it.channel] += 1;
    if (it.unread) unreadByChannel[it.channel] += 1;
  }
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
    actionByChannel,
    unreadByChannel,
    truncated,
    failedChannels,
  };
}

export { PER_CHANNEL_FETCH };
