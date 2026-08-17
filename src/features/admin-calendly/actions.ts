// Calendly admin Server Actions (Sprint Notif Infra 2026-05-26 / fix P1-6
// audit 2026-05-27).
//
// Permet à l'admin de :
//  - éditer manuellement un CalendlyEvent (inviteeName/Email/Phone/startTime/
//    status/notes) après capture Embed JS partielle (limitation Calendly Free)
//  - lier manuellement un CalendlyEvent à une Submission existante
//  - créer manuellement un CalendlyEvent (rattraper les events reçus uniquement
//    par mail Calendly natif sans passer par /appel)

"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncCalendlyEventToCrm } from "@/server/crm-sync";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";
import { adminPath } from "@/lib/admin-path";
import { enrichCalendlyEvent } from "@/server/calendly/enrich";
import { isCalendlyApiConfigured } from "@/server/calendly/api";

async function requireAdminWriteSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, role };
}

// ============================================================
// updateCalendlyEventAction — édition inline admin
// ============================================================

const updateCalendlyEventSchema = z.object({
  id: z.string().min(1).max(64),
  inviteeName: z.string().max(255).nullable().optional(),
  inviteeEmail: z.string().email().max(255).nullable().optional(),
  inviteePhone: z.string().max(40).nullable().optional(),
  startTime: z.string().datetime().nullable().optional(),
  endTime: z.string().datetime().nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  status: z.enum(["scheduled", "canceled", "completed", "no_show"]).optional(),
  notes: z.string().max(5000).nullable().optional(),
  linkedSubmissionId: z.string().uuid().nullable().optional(),
});

export type UpdateCalendlyEventState = { ok: true } | { ok: false; error: string };

export async function updateCalendlyEventAction(
  input: z.input<typeof updateCalendlyEventSchema>,
): Promise<UpdateCalendlyEventState> {
  try {
    await requireAdminWriteSession();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }
  const parsed = updateCalendlyEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const { id, startTime, endTime, ...rest } = parsed.data;

  const data: Record<string, unknown> = { ...rest };
  if (startTime !== undefined) data.startTime = startTime ? new Date(startTime) : null;
  if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;

  try {
    // L'état AVANT sert de garde : la synchro CRM ne doit partir que sur un
    // VRAI changement de statut, pas à chaque édition d'un champ quelconque
    // (chaque émission porte un event_id neuf — sans cette garde, rééditer
    // les notes dupliquerait l'événement dans la timeline CRM).
    const before = parsed.data.status
      ? await prisma.calendlyEvent.findUnique({ where: { id }, select: { status: true } })
      : null;

    const updated = await prisma.calendlyEvent.update({ where: { id }, data });

    // Synchro CRM (lot L2) — l'issue d'un RDV est une interaction de la
    // timeline : honoré (completed), non honoré (no_show), annulé (canceled).
    // « scheduled » n'émet rien : la prise du RDV a déjà été émise à la
    // capture. Sans adresse d'invité, pas de clé de personne → rien.
    const kindByStatus = {
      completed: "completed",
      no_show: "no_show",
      canceled: "canceled",
    } as const;
    const newStatus = parsed.data.status;
    if (
      newStatus &&
      newStatus !== before?.status &&
      newStatus in kindByStatus &&
      updated.inviteeEmail
    ) {
      await syncCalendlyEventToCrm({
        kind: kindByStatus[newStatus as keyof typeof kindByStatus],
        subjectRef: `site:calendly_event:${id}`,
        sourceSlug: "calendly",
        ...(updated.startTime ? { occurredAt: updated.startTime } : {}),
        person: {
          email: updated.inviteeEmail,
          fullName: updated.inviteeName ?? null,
          phone: updated.inviteePhone ?? null,
        },
        payload: {
          eventTypeName: updated.eventTypeName,
          source: "admin_status_change",
        },
      });
    }

    revalidatePath(adminPath("fr", "contacts/appels"));
    revalidatePath(adminPath("fr", `contacts/appels/${id}`));
    // Le badge « à traiter » de la sidebar doit tomber tout de suite, pas
    // dans 30 s : sinon le chiffre paraît faux juste après l'action.
    updateTag(INBOX_COUNTS_TAG);
    return { ok: true };
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "db_failed" };
  }
}

// ============================================================
// createManualCalendlyEventAction — rattrapage manuel d'un RDV
// ============================================================

const createManualSchema = z.object({
  eventTypeName: z.string().min(1).max(255),
  eventTypeSlug: z.string().min(1).max(100),
  inviteeName: z.string().max(255).optional(),
  inviteeEmail: z.string().email().max(255).optional(),
  inviteePhone: z.string().max(40).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
});

export type CreateManualCalendlyEventState =
  { ok: true; eventId: string } | { ok: false; error: string };

export async function createManualCalendlyEventAction(
  input: z.input<typeof createManualSchema>,
): Promise<CreateManualCalendlyEventState> {
  try {
    await requireAdminWriteSession();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }
  const parsed = createManualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const data = parsed.data;

  try {
    const event = await prisma.calendlyEvent.create({
      data: {
        eventTypeName: data.eventTypeName,
        eventTypeSlug: data.eventTypeSlug,
        status: "scheduled",
        source: "manual_import",
        ...(data.inviteeName ? { inviteeName: data.inviteeName } : {}),
        ...(data.inviteeEmail ? { inviteeEmail: data.inviteeEmail } : {}),
        ...(data.inviteePhone ? { inviteePhone: data.inviteePhone } : {}),
        ...(data.startTime ? { startTime: new Date(data.startTime) } : {}),
        ...(data.endTime ? { endTime: new Date(data.endTime) } : {}),
        ...(data.location ? { location: data.location } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
        rawPayload: { _manual: true, _source: "admin-ui" },
      },
      select: { id: true },
    });
    // Synchro CRM (lot L2) — une saisie manuelle est un rendez-vous comme un
    // autre : le CRM n'a pas à savoir par quelle porte il est entré.
    if (data.inviteeEmail) {
      await syncCalendlyEventToCrm({
        kind: "booked",
        subjectRef: `site:calendly_event:${event.id}`,
        sourceSlug: "calendly",
        ...(data.startTime ? { occurredAt: new Date(data.startTime) } : {}),
        person: {
          email: data.inviteeEmail,
          fullName: data.inviteeName ?? null,
          phone: data.inviteePhone ?? null,
        },
        payload: { eventTypeName: data.eventTypeName, source: "manual_import" },
      });
    }

    revalidatePath(adminPath("fr", "contacts/appels"));
    return { ok: true, eventId: event.id };
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "db_failed" };
  }
}

// ============================================================
// enrichCalendlyEventAction — récupération des données côté Calendly
// ============================================================
//
// Rattrapage manuel pour les réservations captées AVANT la pose du token, ou
// re-synchro après une annulation faite côté Calendly. Le travail réel est
// dans `src/server/calendly/enrich.ts` ; ici on ne fait qu'authentifier,
// traduire les motifs d'échec en français et revalider les pages.

const enrichSchema = z.object({ id: z.string().min(1).max(64) });

export type EnrichCalendlyEventState = { ok: true; message: string } | { ok: false; error: string };

/** Motifs techniques → phrases actionnables (l'admin n'a pas à lire le code). */
const ENRICH_ERROR_LABELS: Record<string, string> = {
  not_configured:
    "Aucun jeton Calendly configuré. Ajoutez la variable CALENDLY_API_TOKEN pour activer la récupération automatique.",
  no_invitee_uri:
    "Cette réservation ne porte pas d'identifiant Calendly : elle a été saisie à la main, ou captée avant la mise en place du stockage des identifiants. Complétez-la manuellement.",
  bad_uri: "L'identifiant Calendly enregistré est inexploitable. Complétez la fiche manuellement.",
  forbidden:
    "Calendly a refusé le jeton (401/403) : jeton expiré, révoqué, ou plan Calendly sans accès à l'API.",
  not_found: "Calendly ne connaît plus cette réservation (supprimée de leur côté).",
  http_error: "Calendly a renvoyé une erreur. Réessayez dans quelques minutes.",
  network_error: "Calendly est injoignable (délai dépassé). Réessayez dans quelques minutes.",
  not_found_local: "Réservation introuvable.",
  db_read_failed: "Lecture en base impossible.",
  db_write_failed: "Écriture en base impossible.",
};

export async function enrichCalendlyEventAction(
  input: z.input<typeof enrichSchema>,
): Promise<EnrichCalendlyEventState> {
  try {
    await requireAdminWriteSession();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }
  const parsed = enrichSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Identifiant invalide" };

  if (!isCalendlyApiConfigured()) {
    return { ok: false, error: ENRICH_ERROR_LABELS["not_configured"] as string };
  }

  const res = await enrichCalendlyEvent(parsed.data.id);
  if (!res.ok) {
    return { ok: false, error: ENRICH_ERROR_LABELS[res.reason] ?? `Échec (${res.reason})` };
  }

  revalidatePath(adminPath("fr", "contacts/appels"));
  revalidatePath(adminPath("fr", `contacts/appels/${parsed.data.id}`));
  // Le badge « à traiter » de la sidebar doit tomber tout de suite, pas
  // dans 30 s : sinon le chiffre paraît faux juste après l'action.
  updateTag(INBOX_COUNTS_TAG);

  // Zéro champ mis à jour n'est pas un échec : c'est le cas normal quand la
  // fiche est déjà complète. Le dire explicitement évite de relancer en boucle.
  return {
    ok: true,
    message:
      res.updatedFields.length === 0
        ? "Aucun champ à mettre à jour : la fiche est déjà à jour."
        : `${res.updatedFields.length} champ(s) mis à jour : ${res.updatedFields.join(", ")}.`,
  };
}
