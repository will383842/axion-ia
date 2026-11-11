"use server";

/**
 * Brouillon de l'assistant de création de devis — créer, sauver, reprendre, lister, mettre à
 * l'écart (chantier assistant, fiche S06).
 *
 * Le brouillon ne crée AUCUN devis et ne calcule AUCUN montant : il garde la saisie
 * (`PayloadAssistantV1`, montants en chaînes) entre deux visites.
 *
 * Garde-fous :
 *   - `requireAdminWrite` d'abord ; brouillons PERSONNELS : toute lecture/écriture est bornée à
 *     `createdByAdminId` (le brouillon d'un autre admin est « introuvable », sans distinction
 *     avec un identifiant inexistant) ;
 *   - concurrence optimiste : `revision` + `sauvegardeId` (rejeu d'une sauvegarde déjà
 *     appliquée = succès, sans second incrément) ;
 *   - `payload.sync` est ÉCRIT PAR LE SERVEUR (jamais cru) ; `clientId` et `venteBrouillonId`
 *     sont revérifiés en base ;
 *   - AUCUN delete : la « mise à l'écart » change le statut ; aucun e-mail ; n'écrit jamais
 *     le statut d'un devis.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  lirePayload,
  type EtapeAssistant,
  type PayloadAssistantV1,
} from "@/server/qualiopi/devis/assistant/payload";

type ActionResult<T> = { data: T } | { error: string };
type StatutBrouillonAssistant = "en_cours" | "numerotation" | "lie_au_devis" | "a_l_ecart";

const INTROUVABLE = "Brouillon introuvable";
const BUILD = "Indisponible pendant le build";
const MSG_PERIME = "Ce brouillon a été modifié ailleurs (autre onglet) : rechargez la page.";

const enBuild = () => process.env["DATABASE_URL"]?.includes("stub.invalid") === true;

const uuid = z.string().uuid();

/** `sync` tel que le SERVEUR le connaît : lien du devis (colonne) + sa dernière mise à jour. */
function syncServeur(devisId: string | null, devisMajLe: string | null) {
  return { devisId, devisMajLe };
}

/** Vérifie en base le client et le brouillon de vente du payload ; retire ce qui n'est pas valide. */
async function verifierReferences(
  p: PayloadAssistantV1,
  adminId: string,
): Promise<{ ok: true; payload: PayloadAssistantV1 } | { ok: false; error: string }> {
  if (p.clientId) {
    const c = await prisma.client.findUnique({ where: { id: p.clientId }, select: { id: true } });
    if (!c) return { ok: false, error: "Client introuvable" };
  }
  let venteBrouillonId = p.venteBrouillonId;
  if (venteBrouillonId) {
    const v = await prisma.venteBrouillon.findFirst({
      where: { id: venteBrouillonId, createdByAdminId: adminId },
      select: { id: true },
    });
    if (!v) venteBrouillonId = null;
  }
  return { ok: true, payload: { ...p, venteBrouillonId } };
}

export async function creerBrouillonAssistantAction(i: {
  payload: unknown;
  devisId?: string;
}): Promise<ActionResult<{ id: string; revision: number }>> {
  if (enBuild()) return { error: BUILD };
  const session = await requireAdminWrite();
  const adminId = session.userId;

  const lu = lirePayload(i?.payload);
  if (!lu.ok) return { error: lu.error };
  let devisId: string | null = null;
  if (i.devisId !== undefined) {
    const d = uuid.safeParse(i.devisId);
    if (!d.success) return { error: "Données invalides" };
    devisId = d.data;
  }

  let devisMajLe: string | null = null;
  let clientIdDuDevis: string | null = null;
  if (devisId) {
    // Rejeu sûr : un brouillon déjà lié à ce devis est renvoyé tel quel (contrainte unique).
    const deja = await prisma.devisAssistantBrouillon.findUnique({
      where: { devisId },
      select: { id: true, revision: true, createdByAdminId: true },
    });
    if (deja) {
      if (deja.createdByAdminId !== adminId) return { error: INTROUVABLE };
      return { data: { id: deja.id, revision: deja.revision } };
    }
    const devis = await prisma.devis.findUnique({
      where: { id: devisId },
      select: { id: true, updatedAt: true, clientId: true, statut: true },
    });
    if (!devis) return { error: "Devis introuvable" };
    if (devis.statut !== "brouillon") {
      return { error: "Seul un devis en brouillon peut être repris dans l'assistant." };
    }
    // Le client est celui du devis : le payload ne peut ni le contredire ni le remplacer.
    if (lu.payload.clientId !== null && lu.payload.clientId !== devis.clientId) {
      return { error: "Le client du brouillon ne correspond pas à celui du devis." };
    }
    clientIdDuDevis = devis.clientId;
    devisMajLe = devis.updatedAt.toISOString();
  }

  const refs = await verifierReferences(
    clientIdDuDevis ? { ...lu.payload, clientId: clientIdDuDevis } : lu.payload,
    adminId,
  );
  if (!refs.ok) return { error: refs.error };
  const payload: PayloadAssistantV1 = { ...refs.payload, sync: syncServeur(devisId, devisMajLe) };

  let cree: { id: string; revision: number };
  try {
    cree = await prisma.devisAssistantBrouillon.create({
      data: {
        createdByAdminId: adminId,
        clientId: payload.clientId,
        devisId,
        venteBrouillonId: payload.venteBrouillonId,
        etape: payload.etape,
        statut: devisId ? "lie_au_devis" : "en_cours",
        payload: payload as never,
      },
      select: { id: true, revision: true },
    });
  } catch (err) {
    // Double clic / deux onglets : l'index unique `devis_id` a refusé le second — on relit
    // le brouillon gagnant et on le renvoie (même règle de propriété que le rejeu).
    if (devisId && (err as { code?: string })?.code === "P2002") {
      const existant = await prisma.devisAssistantBrouillon.findUnique({
        where: { devisId },
        select: { id: true, revision: true, createdByAdminId: true },
      });
      if (existant) {
        if (existant.createdByAdminId !== adminId) return { error: INTROUVABLE };
        return { data: { id: existant.id, revision: existant.revision } };
      }
    }
    throw err;
  }

  await logQualiopiActivity({
    action: "qualiopi.devis_assistant.brouillon_cree",
    targetType: "DevisAssistantBrouillon",
    targetId: cree.id,
    changes: { devisId },
    session,
  });
  return { data: { id: cree.id, revision: cree.revision } };
}

const sauverSchema = z.object({
  id: uuid,
  attenduRevision: z.number().int().min(0),
  sauvegardeId: uuid,
  etape: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export async function sauverBrouillonAssistantAction(i: {
  id: string;
  attenduRevision: number;
  sauvegardeId: string;
  payload: unknown;
  etape: EtapeAssistant;
}): Promise<
  ActionResult<{ revision: number }> | { error: string; conflit: true; revisionActuelle: number }
> {
  if (enBuild()) return { error: BUILD };
  const session = await requireAdminWrite();
  const adminId = session.userId;

  const e = sauverSchema.safeParse(i);
  if (!e.success) return { error: "Données invalides" };
  const { id, attenduRevision, sauvegardeId, etape } = e.data;
  const lu = lirePayload(i.payload);
  if (!lu.ok) return { error: lu.error };

  const actuel = await prisma.devisAssistantBrouillon.findFirst({
    where: { id, createdByAdminId: adminId },
    select: { id: true, devisId: true, payload: true, statut: true },
  });
  if (!actuel) return { error: INTROUVABLE };

  const refs = await verifierReferences(lu.payload, adminId);
  if (!refs.ok) return { error: refs.error };

  // `sync` : le lien vient de la colonne, la date de la dernière synchronisation de la base.
  const ancien = lirePayload(actuel.payload);
  const devisMajLe = ancien.ok && actuel.devisId ? ancien.payload.sync.devisMajLe : null;
  const payload: PayloadAssistantV1 = {
    ...refs.payload,
    etape,
    sync: syncServeur(actuel.devisId, devisMajLe),
  };

  const { count } = await prisma.devisAssistantBrouillon.updateMany({
    where: {
      id,
      createdByAdminId: adminId,
      revision: attenduRevision,
      statut: { not: "a_l_ecart" },
    },
    data: {
      payload: payload as never,
      etape,
      clientId: payload.clientId,
      venteBrouillonId: payload.venteBrouillonId,
      revision: { increment: 1 },
      derniereSauvegardeId: sauvegardeId,
    },
  });
  if (count === 1) return { data: { revision: attenduRevision + 1 } };

  const apres = await prisma.devisAssistantBrouillon.findFirst({
    where: { id, createdByAdminId: adminId },
    select: { id: true, revision: true, derniereSauvegardeId: true, statut: true },
  });
  if (!apres) return { error: INTROUVABLE };
  // Rejeu d'une sauvegarde déjà appliquée : succès, la révision n'est pas incrémentée à nouveau.
  if (apres.derniereSauvegardeId === sauvegardeId) return { data: { revision: apres.revision } };
  if (apres.statut === "a_l_ecart") return { error: "Ce brouillon a été mis à l'écart." };
  return { error: MSG_PERIME, conflit: true, revisionActuelle: apres.revision };
}

export async function reprendreBrouillonAssistantAction(id: string): Promise<
  ActionResult<{
    payload: PayloadAssistantV1;
    revision: number;
    etape: EtapeAssistant;
    statut: StatutBrouillonAssistant;
    devisId: string | null;
    majLe: string;
  }>
> {
  if (enBuild()) return { error: BUILD };
  const session = await requireAdminWrite();
  const ident = uuid.safeParse(id);
  if (!ident.success) return { error: INTROUVABLE };

  const row = await prisma.devisAssistantBrouillon.findFirst({
    where: { id: ident.data, createdByAdminId: session.userId },
    select: {
      id: true,
      payload: true,
      revision: true,
      etape: true,
      statut: true,
      devisId: true,
      updatedAt: true,
    },
  });
  if (!row) return { error: INTROUVABLE };
  const lu = lirePayload(row.payload);
  if (!lu.ok) return { error: lu.error };
  const etape = (row.etape >= 1 && row.etape <= 4 ? row.etape : 1) as EtapeAssistant;
  return {
    data: {
      // Le lien du devis est celui de la colonne, pas celui que le texte du brouillon prétend.
      payload: { ...lu.payload, sync: syncServeur(row.devisId, lu.payload.sync.devisMajLe) },
      revision: row.revision,
      etape,
      statut: row.statut as StatutBrouillonAssistant,
      devisId: row.devisId,
      majLe: row.updatedAt.toISOString(),
    },
  };
}

export async function listerMesBrouillonsAssistantAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      etape: number;
      clientLibelle: string | null;
      devisNumero: string | null;
      majLe: string;
    }>
  >
> {
  if (enBuild()) return { error: BUILD };
  const session = await requireAdminWrite();
  const rows = await prisma.devisAssistantBrouillon.findMany({
    where: { createdByAdminId: session.userId, statut: { not: "a_l_ecart" } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      etape: true,
      updatedAt: true,
      client: { select: { raisonSociale: true } },
      devis: { select: { numero: true } },
    },
  });
  return {
    data: rows.map((r) => ({
      id: r.id,
      etape: r.etape,
      clientLibelle: r.client?.raisonSociale ?? null,
      devisNumero: r.devis?.numero ?? null,
      majLe: r.updatedAt.toISOString(),
    })),
  };
}

const ecartSchema = z.object({ id: uuid, attenduRevision: z.number().int().min(0) });

/** Mise à l'écart : le statut change, RIEN n'est supprimé (aucune donnée client détruite). */
export async function mettreAEcartBrouillonAssistantAction(i: {
  id: string;
  attenduRevision: number;
}): Promise<ActionResult<{ id: string }>> {
  if (enBuild()) return { error: BUILD };
  const session = await requireAdminWrite();
  const adminId = session.userId;
  const e = ecartSchema.safeParse(i);
  if (!e.success) return { error: "Données invalides" };

  const row = await prisma.devisAssistantBrouillon.findFirst({
    where: { id: e.data.id, createdByAdminId: adminId },
    select: { id: true, statut: true },
  });
  if (!row) return { error: INTROUVABLE };
  if (row.statut === "a_l_ecart") return { data: { id: row.id } };
  if (row.statut === "lie_au_devis") {
    return {
      error:
        "Ce brouillon est lié à un devis : il ne peut pas être mis à l'écart. Supprimez ou traitez le devis depuis la liste des devis.",
    };
  }
  if (row.statut === "numerotation") {
    return { error: "Numérotation en cours : réessayez dans un instant." };
  }

  const { count } = await prisma.devisAssistantBrouillon.updateMany({
    where: {
      id: e.data.id,
      createdByAdminId: adminId,
      revision: e.data.attenduRevision,
      statut: { notIn: ["numerotation", "lie_au_devis"] },
    },
    data: { statut: "a_l_ecart", revision: { increment: 1 } },
  });
  if (count === 0) return { error: MSG_PERIME };

  await logQualiopiActivity({
    action: "qualiopi.devis_assistant.brouillon_mis_a_l_ecart",
    targetType: "DevisAssistantBrouillon",
    targetId: e.data.id,
    changes: {},
    session,
  });
  return { data: { id: e.data.id } };
}
