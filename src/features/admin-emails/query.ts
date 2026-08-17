/**
 * Lecture du journal des e-mails envoyés.
 *
 * ── Pourquoi ce module n'existait pas ─────────────────────────────────────
 * La table `email_logs` est écrite depuis le début par le worker d'envoi, et
 * indexée sur template, statut, destinataire et date — donc manifestement
 * pensée pour être lue. Elle ne l'a jamais été : aucune page, aucun composant,
 * aucune requête. Les 61 gabarits qui partent en automatique (convocations,
 * liens d'accès, confirmations, relances de paiement, rapports du simulateur)
 * n'étaient visibles nulle part.
 *
 * ⚠️ À ne pas confondre avec `email_outbox`, qui n'est PAS un journal d'envois
 * mais une corbeille de validation : seuls 5 gabarits y transitent, et elle est
 * vide dès qu'ils sont traités.
 *
 * ── Ce que ce journal ne contient pas ─────────────────────────────────────
 * Le CONTENU. Ni sujet, ni HTML, ni variables. On sait qu'un e-mail est parti,
 * à qui, quand et avec quel résultat — pas ce qu'il disait. La page le dit à
 * l'écran plutôt que de laisser croire à un archivage complet.
 */

import { prisma } from "@/lib/prisma";
import type { EmailLogStatus } from "../../../prisma/generated/client";

/** Fenêtres proposées dans l'entête. */
export const FENETRES_EMAILS = [
  { jours: 7, libelle: "7 jours" },
  { jours: 30, libelle: "30 jours" },
  { jours: 90, libelle: "90 jours" },
  { jours: 0, libelle: "Tout" },
] as const;

export const FENETRE_EMAILS_DEFAUT = 30;

/** Lignes par page. Au-delà, la lecture n'a plus de valeur d'inspection. */
export const PAR_PAGE = 50;

const STATUTS: readonly EmailLogStatus[] = ["sent", "failed", "pending"];

export type FiltresEmails = {
  jours: number;
  statut: EmailLogStatus | null;
  gabarit: string | null;
  destinataire: string | null;
  page: number;
};

export type LigneEmail = {
  id: string;
  template: string;
  recipient: string;
  status: EmailLogStatus;
  attempts: number;
  error: string | null;
  entityType: string | null;
  entityId: string | null;
  providerMessageId: string | null;
  sentAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
};

export type ChargementEmails = {
  lignes: LigneEmail[];
  total: number;
  page: number;
  pages: number;
  /** Répartition par statut sur la fenêtre, tous filtres de statut ignorés. */
  parStatut: { envoyes: number; echecs: number; enAttente: number };
  /** Gabarits présents sur la fenêtre, pour alimenter le filtre. */
  gabarits: Array<{ nom: string; envois: number }>;
};

/** Normalise la fenêtre reçue de l'URL. `0` = pas de borne de date. */
export function lireFenetreEmails(brut: string | undefined): number {
  const n = Number(brut);
  return FENETRES_EMAILS.some((f) => f.jours === n) ? n : FENETRE_EMAILS_DEFAUT;
}

/**
 * Normalise le statut reçu de l'URL.
 *
 * Liste fermée : une valeur libre passerait telle quelle dans le `where` et
 * rendrait une page vide — impossible de distinguer « aucun e-mail » de
 * « filtre erroné ».
 */
export function lireStatutEmail(brut: string | undefined): EmailLogStatus | null {
  return brut && (STATUTS as readonly string[]).includes(brut) ? (brut as EmailLogStatus) : null;
}

/** Numéro de page, borné : une valeur absurde ne doit pas coûter une requête. */
export function lirePage(brut: string | undefined): number {
  const n = Number(brut);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : 1;
}

export async function chargerEmails(filtres: FiltresEmails): Promise<ChargementEmails> {
  const vide: ChargementEmails = {
    lignes: [],
    total: 0,
    page: 1,
    pages: 1,
    parStatut: { envoyes: 0, echecs: 0, enAttente: 0 },
    gabarits: [],
  };

  const depuis = new Date();
  depuis.setUTCDate(depuis.getUTCDate() - filtres.jours);
  const fenetre = filtres.jours > 0 ? { createdAt: { gte: depuis } } : {};

  // Le destinataire est une colonne `citext` : la comparaison est déjà
  // insensible à la casse côté Postgres, pas besoin de `mode: "insensitive"`.
  const recherche = filtres.destinataire?.trim();
  const where = {
    ...fenetre,
    ...(filtres.statut ? { status: filtres.statut } : {}),
    ...(filtres.gabarit ? { template: filtres.gabarit } : {}),
    ...(recherche ? { recipient: { contains: recherche } } : {}),
  };

  // Chaque lecture est isolée : au build (base stub, ADR 0026) elles rendent du
  // vide et la page doit s'afficher plutôt qu'échouer.
  try {
    const [total, lignes, parStatutBrut, gabaritsBruts] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filtres.page - 1) * PAR_PAGE,
        take: PAR_PAGE,
        select: {
          id: true,
          template: true,
          recipient: true,
          status: true,
          attempts: true,
          error: true,
          entityType: true,
          entityId: true,
          providerMessageId: true,
          sentAt: true,
          failedAt: true,
          createdAt: true,
        },
      }),
      // Compteurs de tête : calculés SANS le filtre de statut, sinon ils
      // afficheraient toujours « 0 échec » dès qu'on filtre sur les envois.
      prisma.emailLog.groupBy({
        by: ["status"],
        where: { ...fenetre, ...(filtres.gabarit ? { template: filtres.gabarit } : {}) },
        _count: { _all: true },
      }),
      prisma.emailLog.groupBy({
        by: ["template"],
        where: fenetre,
        _count: { _all: true },
        orderBy: { _count: { template: "desc" } },
      }),
    ]);

    const compte = (s: EmailLogStatus): number =>
      parStatutBrut.find((r) => r.status === s)?._count._all ?? 0;

    return {
      lignes,
      total,
      page: filtres.page,
      pages: Math.max(1, Math.ceil(total / PAR_PAGE)),
      parStatut: {
        envoyes: compte("sent"),
        echecs: compte("failed"),
        enAttente: compte("pending"),
      },
      gabarits: gabaritsBruts.map((g) => ({ nom: g.template, envois: g._count._all })),
    };
  } catch {
    return vide;
  }
}
