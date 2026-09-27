// Détail d'un e-mail du journal — la ligne `email_logs` et, si elle existe, la
// COPIE de ce qui est parti (`email_log_contents`, 2026-09-27).
//
// Lecture seule. Stub-aware : au build (`DATABASE_URL` contient
// `stub.invalid`), aucune requête ne part — la page est `force-dynamic` de
// toute façon, mais un module de lecture ne doit pas dépendre de ce détail.

import { prisma } from "@/lib/prisma";
import type { EmailLogStatus, Locale } from "../../../prisma/generated/client";

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Durée de conservation des copies, en mois — celle de la purge de rétention. */
export const CONSERVATION_COPIES_MOIS = 12;

export interface CopieEmail {
  subject: string;
  html: string;
  text: string;
  attachmentNames: string[];
  secretsMasques: number;
  createdAt: Date;
}

export interface DetailEmail {
  id: string;
  template: string;
  recipient: string;
  locale: Locale;
  marketing: boolean;
  status: EmailLogStatus;
  attempts: number;
  error: string | null;
  bounceType: string | null;
  bounceReason: string | null;
  bouncedAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
  entityType: string | null;
  entityId: string | null;
  providerMessageId: string | null;
  copie: CopieEmail | null;
}

/**
 * Charge une ligne du journal et sa copie. `null` si l'identifiant n'est pas
 * un UUID (la colonne est `@db.Uuid` : Prisma lèverait), si la ligne n'existe
 * pas, ou au build.
 */
export async function chargerDetailEmail(id: string): Promise<DetailEmail | null> {
  if (estStub()) return null;
  if (!UUID.test(id)) return null;
  const ligne = await prisma.emailLog.findUnique({
    where: { id },
    select: {
      id: true,
      template: true,
      recipient: true,
      locale: true,
      marketing: true,
      status: true,
      attempts: true,
      error: true,
      bounceType: true,
      bounceReason: true,
      bouncedAt: true,
      sentAt: true,
      failedAt: true,
      dueAt: true,
      createdAt: true,
      entityType: true,
      entityId: true,
      providerMessageId: true,
      contenu: {
        select: {
          subject: true,
          html: true,
          text: true,
          attachmentNames: true,
          secretsMasques: true,
          createdAt: true,
        },
      },
    },
  });
  if (!ligne) return null;
  const { contenu, ...reste } = ligne;
  return { ...reste, copie: contenu ?? null };
}

/**
 * Date de la PLUS ANCIENNE copie conservée — c'est elle qui dit « envoi
 * antérieur au … » pour une ligne sans copie. Lue en base plutôt qu'écrite en
 * dur : la date de mise en service dépend du jour où cette PR atterrit, et une
 * constante tapée d'avance aurait menti.
 */
export async function datePremiereCopie(): Promise<Date | null> {
  if (estStub()) return null;
  const r = await prisma.emailLogContent.findFirst({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return r?.createdAt ?? null;
}

export type RaisonSansCopie =
  | { kind: "pas-parti"; phrase: string }
  | { kind: "purgee"; phrase: string }
  | { kind: "anterieure"; phrase: string }
  | { kind: "manquante"; phrase: string };

const jjmmaaaa = (d: Date): string =>
  d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

/**
 * Pourquoi cette ligne n'a pas de copie — dit à l'écran, jamais un vide.
 * Règle pure (testée) : l'ordre des cas compte.
 */
export function raisonSansCopie(
  e: Pick<DetailEmail, "status" | "sentAt" | "createdAt">,
  premiereCopie: Date | null,
  maintenant: Date = new Date(),
): RaisonSansCopie {
  if (e.status !== "sent" && e.status !== "bounced") {
    return {
      kind: "pas-parti",
      phrase:
        e.status === "failed"
          ? "Aucune copie : cet e-mail n'est jamais parti (échec d'envoi)."
          : e.status === "cancelled"
            ? "Aucune copie : cet envoi a été annulé avant de partir."
            : "Aucune copie pour l'instant : cet e-mail est encore en file.",
    };
  }
  const envoi = e.sentAt ?? e.createdAt;
  const limite = new Date(maintenant);
  limite.setUTCMonth(limite.getUTCMonth() - CONSERVATION_COPIES_MOIS);
  if (envoi < limite) {
    return {
      kind: "purgee",
      phrase: `Copie purgée : les copies sont conservées ${CONSERVATION_COPIES_MOIS} mois, puis supprimées.`,
    };
  }
  if (premiereCopie === null || envoi < premiereCopie) {
    return {
      kind: "anterieure",
      phrase:
        premiereCopie === null
          ? "Copie non conservée (envoi antérieur à la conservation des copies)."
          : `Copie non conservée (envoi antérieur au ${jjmmaaaa(premiereCopie)}).`,
    };
  }
  return {
    kind: "manquante",
    phrase:
      "Copie manquante : l'e-mail est parti, mais l'enregistrement de sa copie a échoué " +
      "(le détail est dans Sentry, worker « email »).",
  };
}
