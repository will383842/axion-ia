"use server";

/**
 * Prospection — Server Actions de pilotage des campagnes (T6).
 * Pas de REST : tout via Server Actions (contrat codebase). RBAC + journal.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../prisma/generated/client";
import { requireProspectionAccess } from "./_auth";
import { createCampaignSchema } from "./campaign-schema";
import { enqueueProspectionOrchestrator } from "@/server/prospection/queue/queues";
import { adminPath } from "@/lib/admin-path";

function campaignsPath(): string {
  return adminPath("fr", "prospection/campagnes");
}

export async function createProspectionCampaign(raw: unknown): Promise<{ id: string }> {
  const session = await requireProspectionAccess("operate");
  const data = createCampaignSchema.parse(raw);

  const createData: Prisma.ProspectionCampaignCreateInput = {
    nom: data.nom,
    statut: "brouillon",
    departements: data.departements,
    secteurs: data.secteurs,
    nafCodes: data.nafCodes,
    tailles: data.tailles,
    typesOrganisation: data.typesOrganisation,
    enrichirContacts: data.enrichirContacts,
    enrichirPersonnes: data.enrichirPersonnes,
    priorite: data.priorite,
    createdBy: session.userId,
    ...(data.quotaMax !== undefined ? { quotaMax: data.quotaMax } : {}),
    ...(data.rythme !== undefined ? { rythme: data.rythme } : {}),
  };
  const campaign = await prisma.prospectionCampaign.create({ data: createData });
  revalidatePath(campaignsPath());
  return { id: campaign.id };
}

export async function launchProspectionCampaign(id: string): Promise<{ ok: true }> {
  const session = await requireProspectionAccess("operate");
  await prisma.prospectionCampaign.update({ where: { id }, data: { statut: "active" } });
  await enqueueProspectionOrchestrator(id);
  await prisma.prospectionEvent.create({
    data: { type: "campaign_started", campaignId: id, actorId: session.userId },
  });
  revalidatePath(campaignsPath());
  return { ok: true };
}

export async function pauseProspectionCampaign(id: string): Promise<{ ok: true }> {
  const session = await requireProspectionAccess("operate");
  await prisma.prospectionCampaign.update({ where: { id }, data: { statut: "en_pause" } });
  await prisma.prospectionEvent.create({
    data: { type: "paused", campaignId: id, actorId: session.userId },
  });
  revalidatePath(campaignsPath());
  return { ok: true };
}

export async function resumeProspectionCampaign(id: string): Promise<{ ok: true }> {
  const session = await requireProspectionAccess("operate");
  await prisma.prospectionCampaign.update({ where: { id }, data: { statut: "active" } });
  await enqueueProspectionOrchestrator(id);
  await prisma.prospectionEvent.create({
    data: { type: "resumed", campaignId: id, actorId: session.userId },
  });
  revalidatePath(campaignsPath());
  return { ok: true };
}
