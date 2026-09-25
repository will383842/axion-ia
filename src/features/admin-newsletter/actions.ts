// Server Actions admin /newsletter (M9 Tier 3 section 1, refondu au lot L3).
//
// Newsletter subscribers : pas de creation manuelle (les inscriptions passent
// par le formulaire du guide). Admin peut :
//  - lister avec filtres (status, locale, source, search, dateRange)
//  - desabonner manuellement — par le MEME chemin que le lien public (lot L3)
//  - effacer (RGPD) — par les fonctions de l'effacement public (lot L3)
//  - envoyer / renvoyer le guide (lot L3, idempotent, journalise)
//  - exporter les confirmes au format MailWizz et la liste de suppression
//  - voir stats par status × locale
//
// ⚠️ Fichier `"use server"` : n'exporter QUE des fonctions async (et des types).
// La logique vit dans `server/newsletter/*` et `server/guide-ia/envoi-console.ts`.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { desabonnerAbonne } from "@/server/newsletter/desabonner";
import { effacerAbonneDepuisConsole } from "@/server/newsletter/effacer";
import { exporterAbonnesMailwizz, exporterListeSuppression } from "@/server/newsletter/exports";
import {
  envoyerGuideAAbonne,
  renvoyerGuide,
  LIBELLE_ISSUE_CONSOLE,
  type ResultatEnvoiConsole,
} from "@/server/guide-ia/envoi-console";
import type { NewsletterStatus, Locale } from "../../../prisma/generated/client";

async function requireAdminWrite() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin") throw new Error("forbidden");
  return { userId: session.user.id, role };
}
async function requireAdminRead() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

// ============================================================
// list / stats
// ============================================================

const listSchema = z.object({
  status: z.enum(["pending", "confirmed", "unsubscribed", "bounced", "all"]).default("all"),
  locale: z.enum(["fr", "en", "all"]).default("all"),
  source: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});
export type ListSubscribersInput = z.infer<typeof listSchema>;

export interface SubscriberListItem {
  id: string;
  email: string;
  locale: Locale;
  status: NewsletterStatus;
  source: string | null;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
}

export async function listSubscribersAction(input: Partial<ListSubscribersInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.locale !== "all") where.locale = parsed.locale;
  if (parsed.source) where.source = parsed.source;
  if (parsed.dateFrom || parsed.dateTo) {
    const range: { gte?: Date; lte?: Date } = {};
    if (parsed.dateFrom) range.gte = new Date(parsed.dateFrom);
    if (parsed.dateTo) {
      const to = new Date(parsed.dateTo);
      to.setUTCHours(23, 59, 59, 999);
      range.lte = to;
    }
    where.createdAt = range;
  }
  if (parsed.search && parsed.search.length >= 2) {
    where.email = { contains: parsed.search, mode: "insensitive" };
  }

  const [total, items] = await Promise.all([
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        email: true,
        locale: true,
        status: true,
        source: true,
        confirmedAt: true,
        unsubscribedAt: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    items,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}

export async function getNewsletterStatsAction() {
  await requireAdminRead();
  // counts par status (per locale)
  const counts = await prisma.newsletterSubscriber.groupBy({
    by: ["status", "locale"],
    _count: { _all: true },
  });
  // Initialise une grille
  const grid: Record<string, Record<string, number>> = {
    pending: { fr: 0, en: 0 },
    confirmed: { fr: 0, en: 0 },
    unsubscribed: { fr: 0, en: 0 },
    bounced: { fr: 0, en: 0 },
  };
  for (const row of counts) {
    if (grid[row.status]) {
      grid[row.status]![row.locale] = row._count._all;
    }
  }
  return grid;
}

// ============================================================
// force unsubscribe (admin)
// ============================================================

const unsubSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type UnsubscribeState = { ok: true } | { ok: false; error: string };

export async function forceUnsubscribeAction(
  _prev: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = unsubSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "ID invalide." };

  const abonne = await prisma.newsletterSubscriber.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      email: true,
      locale: true,
      status: true,
      consentFormRef: true,
      consentVersion: true,
    },
  });
  if (!abonne) return { ok: false, error: "Abonné introuvable (déjà effacé ?)." };
  if (abonne.status === "unsubscribed") return { ok: true };

  // 🔴 Lot L3 (2026-09-24) — le MÊME chemin que le lien public : statut,
  // opposition au CRM (`newsletter_optout`), preuve `optout` au registre,
  // Telegram. Avant, ce bouton ne faisait que le statut et le journal : le CRM
  // et le registre de preuve n'apprenaient jamais la désinscription.
  // `false` : un autre geste (second clic, lien public) l'a désabonné entre la
  // lecture ci-dessus et l'écriture — rien n'a été émis, rien à journaliser.
  const fait = await desabonnerAbonne(
    {
      id: abonne.id,
      email: abonne.email,
      locale: abonne.locale,
      consentFormRef: abonne.consentFormRef,
      consentVersion: abonne.consentVersion,
    },
    "admin-console",
  );
  if (!fait) return { ok: true };

  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "newsletter.force_unsubscribe",
      targetType: "newsletter_subscriber",
      targetId: parsed.data.id,
      ipAddress: await getClientIp(),
      ...(parsed.data.reason ? { changes: { reason: parsed.data.reason } } : {}),
    },
  });
  revalidatePath(adminPath("fr", "newsletter"));
  return { ok: true };
}

// ============================================================
// eraseSubscriber — droit a l'effacement RGPD (Sprint 24 / D1)
// ============================================================
//
// Lot L3 : abonné + demandes du guide supprimés, traces d'e-mail
// pseudonymisées, effacement demandé au CRM (`server/newsletter/effacer.ts`).
// Conserve la trace activity_log avec l'empreinte de l'adresse (sans
// réintroduire la donnée). Reservé super_admin uniquement.

const eraseSubscriberSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(3).max(500),
});
export type EraseSubscriberState = { ok: true } | { ok: false; error: string };

export async function eraseSubscriberAction(
  _prev: EraseSubscriberState,
  formData: FormData,
): Promise<EraseSubscriberState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Permission insuffisante." };
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin") {
    return { ok: false, error: "Effacement RGPD réservé super_admin." };
  }
  const parsed = eraseSubscriberSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  // 🔴 Lot L3 (2026-09-24) — les fonctions de l'effacement PUBLIC : l'abonné,
  // ses demandes du guide, ses traces d'e-mail, et le CRM. Une fiche absente
  // se dit, elle ne fait plus tomber l'écran.
  const issue = await effacerAbonneDepuisConsole({
    abonneId: parsed.data.id,
    motif: parsed.data.reason,
    adminUserId: session.user.id,
    ip: await getClientIp(),
  });
  if (!issue.ok) return { ok: false, error: "Abonné introuvable (déjà effacé ?)." };

  revalidatePath(adminPath("fr", "newsletter"));
  return { ok: true };
}

// ============================================================
// export CSV — format MailWizz (lot L3)
// ============================================================
//
// Inscrits ÉLIGIBLES seulement (ni opposés, ni en rebond dur, ni en rebonds
// temporaires répétés), colonnes
// EMAIL, LOCALE, SOURCE, OPTIN_AT, OPTIN_VERSION, UNSUB_URL, GUIDE. Les filtres
// de l'écran (langue, provenance, dates, recherche) s'appliquent : le fichier
// est ce que l'écran montre. Un filtre de statut autre que « confirmé » est
// REFUSÉ, jamais ignoré en silence.

export async function exportSubscribersCsvAction(
  input: Partial<ListSubscribersInput> = {},
): Promise<{ filename: string; csv: string; tronque: boolean }> {
  // RGPD — export réservé super_admin/admin, tracé.
  const session = await requireAdminWrite();
  const parsed = listSchema.parse({ ...input, pageSize: 200, page: 1 });
  if (parsed.status !== "all" && parsed.status !== "confirmed") {
    throw new Error("forbidden_status");
  }

  const resultat = await exporterAbonnesMailwizz(
    {
      locale: parsed.locale,
      ...(parsed.source ? { source: parsed.source } : {}),
      ...(parsed.search ? { search: parsed.search } : {}),
      ...(parsed.dateFrom ? { dateFrom: parsed.dateFrom } : {}),
      ...(parsed.dateTo ? { dateTo: parsed.dateTo } : {}),
    },
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com",
  );

  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "newsletter.exported",
      targetType: "newsletter_subscriber",
      changes: {
        format: "mailwizz",
        filters: {
          status: "confirmed",
          locale: parsed.locale,
          source: parsed.source ?? null,
          // La recherche peut contenir un morceau d'adresse : on trace qu'elle
          // existait, pas ce qu'elle contenait.
          search: parsed.search ? "oui" : null,
          dateFrom: parsed.dateFrom ?? null,
          dateTo: parsed.dateTo ?? null,
        },
        lignes: resultat.lignes,
        ecartes: resultat.ecartes,
        tronque: resultat.tronque,
      },
      ipAddress: await getClientIp(),
    },
  });

  // Un fichier INCOMPLET le dit jusque dans son nom : c'est ce que l'écran
  // montre à qui le télécharge.
  const filename = `axion-ia-lettre-mailwizz-${new Date().toISOString().slice(0, 10)}${
    resultat.tronque ? "-INCOMPLET" : ""
  }.csv`;
  return { filename, csv: resultat.csv, tronque: resultat.tronque };
}

/** Liste de suppression : empreintes SHA-256, motif, date. Aucune adresse. */
export async function exportSuppressionCsvAction(): Promise<{
  filename: string;
  csv: string;
  tronque: boolean;
}> {
  const session = await requireAdminWrite();
  const resultat = await exporterListeSuppression();
  await prisma.activityLog.create({
    data: {
      adminUserId: session.userId,
      action: "newsletter.suppression.exported",
      targetType: "newsletter_subscriber",
      changes: { lignes: resultat.lignes, tronque: resultat.tronque },
      ipAddress: await getClientIp(),
    },
  });
  const filename = `axion-ia-lettre-suppression-${new Date().toISOString().slice(0, 10)}${
    resultat.tronque ? "-INCOMPLET" : ""
  }.csv`;
  return { filename, csv: resultat.csv, tronque: resultat.tronque };
}

// ============================================================
// Envoyer / renvoyer le guide (lot L3)
// ============================================================

export type EnvoiGuideState =
  { ok: true; resultat: ResultatEnvoiConsole; message: string } | { ok: false; error: string };

const envoiSchema = z.object({
  id: z.string().uuid(),
  reprise: z.enum(["on"]).optional(),
});

async function lireEnvoi(
  formData: FormData,
): Promise<{ userId: string; id: string; reprise: boolean } | EnvoiGuideState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = envoiSchema.safeParse({
    id: formData.get("id"),
    reprise: formData.get("reprise") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "Identifiant invalide." };
  return { userId: session.userId, id: parsed.data.id, reprise: parsed.data.reprise === "on" };
}

function etatEnvoi(resultat: ResultatEnvoiConsole): EnvoiGuideState {
  const message = LIBELLE_ISSUE_CONSOLE[resultat];
  // « Parti » ou « retenu pour relecture » : le geste a abouti. Le reste est
  // dit comme un refus — l'administrateur doit savoir que RIEN n'est parti.
  return resultat === "en-file" || resultat === "en-validation"
    ? { ok: true, resultat, message }
    : { ok: false, error: message };
}

/** « Envoyer le guide », depuis la fiche d'un abonné. */
export async function envoyerGuideAAbonneAction(
  _prev: EnvoiGuideState,
  formData: FormData,
): Promise<EnvoiGuideState> {
  const e = await lireEnvoi(formData);
  if ("ok" in e) return e;
  const issue = await envoyerGuideAAbonne(e.id, {
    adminUserId: e.userId,
    reprise: e.reprise,
    ip: await getClientIp(),
  });
  revalidatePath(adminPath("fr", `newsletter/${e.id}`));
  revalidatePath(adminPath("fr", "newsletter/demandes-guide"));
  return etatEnvoi(issue.resultat);
}

/** « Renvoyer le guide », depuis l'écran des demandes. */
export async function renvoyerGuideAction(
  _prev: EnvoiGuideState,
  formData: FormData,
): Promise<EnvoiGuideState> {
  const e = await lireEnvoi(formData);
  if ("ok" in e) return e;
  const issue = await renvoyerGuide(e.id, {
    adminUserId: e.userId,
    reprise: e.reprise,
    ip: await getClientIp(),
  });
  revalidatePath(adminPath("fr", "newsletter/demandes-guide"));
  return etatEnvoi(issue.resultat);
}
