/**
 * Qualiopi — Server Actions du brouillon « Nouvelle vente » (wizard admin).
 *
 * Le brouillon (`VenteBrouillon`) porte l'état du wizard entre deux visites,
 * et RIEN d'autre : dès qu'une entité réelle existe (client, devis, session),
 * il ne garde que sa référence. Minimisation RGPD active à l'écriture : quand
 * `clientId` est posé, les champs de contact libres du payload (nom, e-mail,
 * téléphone) sont SUPPRIMÉS — la fiche Client est leur seul lieu de vie.
 *
 * Purge : `retentionUntil` posé à la création (défaut 90 j, env
 * VENTE_BROUILLON_RETENTION_DAYS), lu par le cron retention-purge. Le brouillon
 * CONVERTI est supprimé explicitement par le wizard à la création de la session.
 *
 * Brouillons PERSONNELS : toutes les lectures/écritures sont bornées à
 * `createdByAdminId` — un brouillon peut contenir des saisies non validées,
 * il n'a pas à circuler entre comptes.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Rétention
// ─────────────────────────────────────────────────────────────────────────────

const RETENTION_JOURS_DEFAUT = 90;

/** Pattern readMonths (retention-purge-worker) : refuse < 1 → défaut. */
function lireJoursRetention(): number {
  const raw = process.env["VENTE_BROUILLON_RETENTION_DAYS"];
  if (!raw) return RETENTION_JOURS_DEFAUT;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return RETENTION_JOURS_DEFAUT;
  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimisation du payload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Champs de contact LIBRES tolérés dans le payload tant que le Client n'existe
 * pas. Dès que `clientId` est posé, ils sont retirés à l'écriture.
 */
const CHAMPS_CONTACT_LIBRES = ["contactNom", "contactEmail", "contactTelephone"] as const;

function contientContactLibre(payload: Record<string, unknown>): boolean {
  return CHAMPS_CONTACT_LIBRES.some((k) => k in payload);
}

function minimiserPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const copie = { ...payload };
  for (const k of CHAMPS_CONTACT_LIBRES) delete copie[k];
  return copie;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const updateSchema = z.object({
  id: z.string().uuid(),
  etape: z.number().int().min(1).max(4).optional(),
  payload: z.record(z.unknown()).optional(),
  clientId: z.string().uuid().optional(),
  devisId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/** Crée un brouillon vide, propriété de l'admin courant, avec sa date de purge. */
export async function createVenteBrouillonAction(): Promise<
  ActionResult<{ id: string; retentionUntil: Date }>
> {
  const session = await requireAdminWrite();

  const retentionUntil = new Date();
  retentionUntil.setDate(retentionUntil.getDate() + lireJoursRetention());

  const created = await prisma.venteBrouillon.create({
    data: {
      etape: 1,
      payload: {},
      createdByAdminId: session.userId,
      retentionUntil,
    },
    select: { id: true, retentionUntil: true },
  });

  await logQualiopiActivity({
    action: "qualiopi.vente_brouillon.create",
    targetType: "VenteBrouillon",
    targetId: created.id,
    changes: { retentionUntil },
    session,
  });

  return { data: { id: created.id, retentionUntil: created.retentionUntil ?? retentionUntil } };
}

/** Lit un brouillon de l'admin courant (les brouillons sont personnels). */
export async function getVenteBrouillonAction(id: string): Promise<
  ActionResult<{
    id: string;
    etape: number;
    payload: Record<string, unknown>;
    clientId: string | null;
    devisId: string | null;
    sessionId: string | null;
    updatedAt: Date;
  }>
> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const row = await prisma.venteBrouillon.findUnique({
    where: { id: idParsed.data },
    select: {
      id: true,
      etape: true,
      payload: true,
      clientId: true,
      devisId: true,
      sessionId: true,
      createdByAdminId: true,
      updatedAt: true,
    },
  });
  // Même message pour « absent » et « pas à vous » : ne pas confirmer
  // l'existence d'un brouillon d'un autre compte.
  if (!row || row.createdByAdminId !== session.userId) return { error: "Brouillon introuvable" };

  return {
    data: {
      id: row.id,
      etape: row.etape,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      clientId: row.clientId,
      devisId: row.devisId,
      sessionId: row.sessionId,
      updatedAt: row.updatedAt,
    },
  };
}

/** Brouillons de l'admin courant, du plus récemment touché au plus ancien. */
export async function listMesBrouillonsAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      etape: number;
      clientId: string | null;
      clientRaisonSociale: string | null;
      updatedAt: Date;
    }>
  >
> {
  const session = await requireAdminWrite();

  const rows = await prisma.venteBrouillon.findMany({
    where: { createdByAdminId: session.userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      etape: true,
      clientId: true,
      updatedAt: true,
      client: { select: { raisonSociale: true } },
    },
  });

  return {
    data: rows.map((r) => ({
      id: r.id,
      etape: r.etape,
      clientId: r.clientId,
      clientRaisonSociale: r.client?.raisonSociale ?? null,
      updatedAt: r.updatedAt,
    })),
  };
}

/**
 * Met à jour un brouillon (étape courante, payload, références d'entités).
 *
 * MINIMISATION : dès que `clientId` est posé (par cet appel ou déjà en base),
 * les champs de contact libres sont supprimés du payload écrit — y compris du
 * payload EXISTANT si l'appel ne fournit que `clientId`.
 */
export async function updateVenteBrouillonAction(
  input: z.infer<typeof updateSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const existant = await prisma.venteBrouillon.findUnique({
    where: { id: v.id },
    select: { createdByAdminId: true, clientId: true, payload: true },
  });
  if (!existant || existant.createdByAdminId !== session.userId) {
    return { error: "Brouillon introuvable" };
  }

  const clientEffectif = v.clientId ?? existant.clientId;

  // Payload à écrire : celui fourni, sinon l'existant SI la minimisation
  // l'exige (clientId posé + contacts libres encore présents).
  let payloadAEcrire: Record<string, unknown> | undefined = v.payload;
  if (clientEffectif !== null && clientEffectif !== undefined) {
    const base = v.payload ?? ((existant.payload ?? {}) as Record<string, unknown>);
    if (v.payload !== undefined || contientContactLibre(base)) {
      payloadAEcrire = minimiserPayload(base);
    }
  }

  await prisma.venteBrouillon.update({
    where: { id: v.id },
    data: {
      ...(v.etape !== undefined ? { etape: v.etape } : {}),
      ...(payloadAEcrire !== undefined ? { payload: payloadAEcrire as never } : {}),
      ...(v.clientId !== undefined ? { clientId: v.clientId } : {}),
      ...(v.devisId !== undefined ? { devisId: v.devisId } : {}),
      ...(v.sessionId !== undefined ? { sessionId: v.sessionId } : {}),
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.vente_brouillon.update",
    targetType: "VenteBrouillon",
    targetId: v.id,
    // Jamais le payload dans l'audit (il peut porter des contacts libres) :
    // seules les références et l'étape sont tracées.
    changes: {
      ...(v.etape !== undefined ? { etape: v.etape } : {}),
      ...(v.clientId !== undefined ? { clientId: v.clientId } : {}),
      ...(v.devisId !== undefined ? { devisId: v.devisId } : {}),
      ...(v.sessionId !== undefined ? { sessionId: v.sessionId } : {}),
      payloadMinimise: clientEffectif !== null && clientEffectif !== undefined,
    },
    session,
  });

  return { data: { id: v.id } };
}

/**
 * Supprime un brouillon. Appelée par l'admin (abandon) ET par le wizard à la
 * conversion : la session créée, le brouillon n'a plus de raison d'exister.
 */
export async function supprimerVenteBrouillonAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const existant = await prisma.venteBrouillon.findUnique({
    where: { id: idParsed.data },
    select: { createdByAdminId: true, sessionId: true },
  });
  if (!existant || existant.createdByAdminId !== session.userId) {
    return { error: "Brouillon introuvable" };
  }

  await prisma.venteBrouillon.delete({ where: { id: idParsed.data } });

  await logQualiopiActivity({
    action: "qualiopi.vente_brouillon.delete",
    targetType: "VenteBrouillon",
    targetId: idParsed.data,
    changes: { convertiEnSession: existant.sessionId !== null },
    session,
  });

  return { data: { id: idParsed.data } };
}
