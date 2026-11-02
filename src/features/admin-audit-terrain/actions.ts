// Audit présentiel PR2 : création et révocation du jeton d'audit (aucun écran dans ce lot).
//
// Réservé au super_admin connecté. Server Action : Next contrôle l'origine de la requête (anti-CSRF).
// Le jeton est rendu UNE seule fois à l'appelant ; seule son empreinte SHA-256 est stockée.
// Aucune suppression : révoquer = statut « revoquee » + date de révocation.

"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import { ipVisiteurOuNull } from "@/lib/client-ip-core";
import { ecrireJournalActivite } from "@/server/content-gen/shared/activity-log-writer";
import {
  JETON_DUREE_DEFAUT_JOURS,
  JETON_DUREE_MAX_JOURS,
  composerJeton,
  empreinteJeton,
  genererSecret,
} from "@/server/audit-terrain/jeton";

export type ResultatJeton =
  | { ok: true; jeton: string; sessionId: string; expireLe: string }
  | { ok: false; erreur: "interdit" | "invalide" | "introuvable" };

const creerSchema = z
  .object({
    clientId: z.string().uuid(),
    auditMissionId: z.string().uuid().optional(),
    joursValidite: z.number().int().min(1).max(JETON_DUREE_MAX_JOURS).default(JETON_DUREE_DEFAUT_JOURS),
  })
  .strict();

async function exigerSuperAdmin(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  return id && role === "super_admin" ? id : null;
}

async function ipHachee(): Promise<string | null> {
  try {
    return hashIp(ipVisiteurOuNull(await headers()));
  } catch {
    return null;
  }
}

export async function creerJetonAudit(entree: unknown): Promise<ResultatJeton> {
  const adminId = await exigerSuperAdmin();
  if (!adminId) return { ok: false, erreur: "interdit" };
  const p = creerSchema.safeParse(entree);
  if (!p.success) return { ok: false, erreur: "invalide" };
  const { clientId, auditMissionId, joursValidite } = p.data;

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return { ok: false, erreur: "introuvable" };
  if (auditMissionId) {
    const mission = await prisma.auditMission.findFirst({ where: { id: auditMissionId, clientId }, select: { id: true } });
    if (!mission) return { ok: false, erreur: "introuvable" };
  }

  const id = randomUUID();
  const secret = genererSecret();
  const expireLe = new Date(Date.now() + joursValidite * 86_400_000);
  await prisma.auditTerrainSession.create({
    data: {
      id,
      clientId,
      auditMissionId: auditMissionId ?? null,
      statut: "ouverte",
      jetonEmpreinte: empreinteJeton(secret),
      jetonExpireLe: expireLe,
      creeParId: adminId,
    },
  });
  await ecrireJournalActivite(
    { adminUserId: adminId, ipAddress: await ipHachee(), userAgent: null },
    {
      action: "audit-terrain.jeton.cree",
      targetType: "audit_terrain_session",
      targetId: id,
      changes: { clientId, auditMissionId: auditMissionId ?? null, expireLe: expireLe.toISOString() },
    },
  );
  return { ok: true, jeton: composerJeton(id, secret), sessionId: id, expireLe: expireLe.toISOString() };
}

export async function revoquerJetonAudit(sessionId: unknown): Promise<{ ok: true; revoque: true } | { ok: false; erreur: "interdit" | "invalide" | "introuvable" }> {
  const adminId = await exigerSuperAdmin();
  if (!adminId) return { ok: false, erreur: "interdit" };
  const p = z.string().uuid().safeParse(sessionId);
  if (!p.success) return { ok: false, erreur: "invalide" };

  const ligne = await prisma.auditTerrainSession.findUnique({ where: { id: p.data }, select: { id: true, jetonRevoqueLe: true } });
  if (!ligne) return { ok: false, erreur: "introuvable" };
  if (ligne.jetonRevoqueLe === null) {
    await prisma.auditTerrainSession.update({
      where: { id: ligne.id },
      data: { jetonRevoqueLe: new Date(), statut: "revoquee" },
    });
    await ecrireJournalActivite(
      { adminUserId: adminId, ipAddress: await ipHachee(), userAgent: null },
      { action: "audit-terrain.jeton.revoque", targetType: "audit_terrain_session", targetId: ligne.id, changes: {} },
    );
  }
  return { ok: true, revoque: true };
}
