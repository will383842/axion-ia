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
import { ecrireJournalActivite } from "@/server/audit-terrain/journal";
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
    joursValidite: z
      .number()
      .int()
      .min(1)
      .max(JETON_DUREE_MAX_JOURS)
      .default(JETON_DUREE_DEFAUT_JOURS),
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
    const mission = await prisma.auditMission.findFirst({
      where: { id: auditMissionId, clientId },
      select: { id: true },
    });
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
      changes: {
        clientId,
        auditMissionId: auditMissionId ?? null,
        expireLe: expireLe.toISOString(),
      },
    },
  );
  return {
    ok: true,
    jeton: composerJeton(id, secret),
    sessionId: id,
    expireLe: expireLe.toISOString(),
  };
}

export async function revoquerJetonAudit(
  sessionId: unknown,
): Promise<
  { ok: true; revoque: true } | { ok: false; erreur: "interdit" | "invalide" | "introuvable" }
> {
  const adminId = await exigerSuperAdmin();
  if (!adminId) return { ok: false, erreur: "interdit" };
  const p = z.string().uuid().safeParse(sessionId);
  if (!p.success) return { ok: false, erreur: "invalide" };

  const ligne = await prisma.auditTerrainSession.findUnique({
    where: { id: p.data },
    select: { id: true, jetonRevoqueLe: true },
  });
  if (!ligne) return { ok: false, erreur: "introuvable" };
  if (ligne.jetonRevoqueLe === null) {
    await prisma.auditTerrainSession.update({
      where: { id: ligne.id },
      data: { jetonRevoqueLe: new Date(), statut: "revoquee" },
    });
    await ecrireJournalActivite(
      { adminUserId: adminId, ipAddress: await ipHachee(), userAgent: null },
      {
        action: "audit-terrain.jeton.revoque",
        targetType: "audit_terrain_session",
        targetId: ligne.id,
        changes: {},
      },
    );
  }
  return { ok: true, revoque: true };
}

const regenererSchema = z
  .object({
    sessionId: z.string().uuid(),
    joursValidite: z
      .number()
      .int()
      .min(1)
      .max(JETON_DUREE_MAX_JOURS)
      .default(JETON_DUREE_DEFAUT_JOURS),
  })
  .strict();

/**
 * Rotation : nouveau jeton pour une session EXISTANTE (PC changé, jeton perdu). Même sessionId, même
 * client, mêmes données déjà reçues (rien n'est supprimé ni dupliqué) ; l'ancien jeton est refusé (401)
 * car son empreinte est remplacée ; la session redevient « ouverte » si elle avait été révoquée ; la
 * durée repart de maintenant (J+2 par défaut, 10 jours au plus). Une session « close » n'est pas rouverte.
 */
export async function regenererJetonAudit(entree: unknown): Promise<ResultatJeton> {
  const adminId = await exigerSuperAdmin();
  if (!adminId) return { ok: false, erreur: "interdit" };
  const p = regenererSchema.safeParse(entree);
  if (!p.success) return { ok: false, erreur: "invalide" };
  const { sessionId, joursValidite } = p.data;

  const ligne = await prisma.auditTerrainSession.findUnique({
    where: { id: sessionId },
    select: { id: true, statut: true, jetonEmpreinte: true },
  });
  if (!ligne) return { ok: false, erreur: "introuvable" };
  if (ligne.statut !== "ouverte" && ligne.statut !== "revoquee") {
    return { ok: false, erreur: "invalide" };
  }

  const secret = genererSecret();
  const expireLe = new Date(Date.now() + joursValidite * 86_400_000);
  const { count } = await prisma.auditTerrainSession.updateMany({
    // Garde de concurrence : on ne remplace que l'empreinte qu'on vient de lire.
    where: { id: sessionId, jetonEmpreinte: ligne.jetonEmpreinte },
    data: {
      jetonEmpreinte: empreinteJeton(secret),
      jetonExpireLe: expireLe,
      jetonRevoqueLe: null,
      statut: "ouverte",
    },
  });
  if (count !== 1) return { ok: false, erreur: "introuvable" };
  await ecrireJournalActivite(
    { adminUserId: adminId, ipAddress: await ipHachee(), userAgent: null },
    {
      action: "audit-terrain.jeton.regenere",
      targetType: "audit_terrain_session",
      targetId: sessionId,
      // Début de l'ancienne empreinte (non réversible) pour dater la rotation ; jamais un secret.
      changes: {
        ancienneEmpreinte: ligne.jetonEmpreinte.slice(0, 8),
        expireLe: expireLe.toISOString(),
      },
    },
  );
  return {
    ok: true,
    jeton: composerJeton(sessionId, secret),
    sessionId,
    expireLe: expireLe.toISOString(),
  };
}

/**
 * PR3 : Will valide le brouillon du rapport (a_relire → valide). Rien ne part au client.
 * Seule la DERNIÈRE version d'une session peut être validée ; un rapport déjà validé reste tel quel.
 */
export async function validerRapportAudit(
  rapportId: unknown,
  clientId: unknown,
): Promise<
  | { ok: true; valide: true }
  | { ok: false; erreur: "interdit" | "invalide" | "introuvable" | "ancienne_version" }
> {
  const adminId = await exigerSuperAdmin();
  if (!adminId) return { ok: false, erreur: "interdit" };
  const p = z.string().uuid().safeParse(rapportId);
  const c = z.string().uuid().safeParse(clientId);
  if (!p.success || !c.success) return { ok: false, erreur: "invalide" };

  const ligne = await prisma.auditTerrainRapport.findUnique({
    where: { id: p.data },
    select: {
      id: true,
      sessionId: true,
      version: true,
      statut: true,
      session: { select: { clientId: true } },
    },
  });
  // Le rapport doit appartenir au client de la fiche d'où part l'action.
  if (!ligne || ligne.session.clientId !== c.data) return { ok: false, erreur: "introuvable" };
  if (ligne.statut === "valide") return { ok: true, valide: true };
  const plusRecent = await prisma.auditTerrainRapport.findFirst({
    where: { sessionId: ligne.sessionId, version: { gt: ligne.version } },
    select: { id: true },
  });
  if (plusRecent) return { ok: false, erreur: "ancienne_version" };

  // Condition d'état dans l'écriture : un double clic ou une version dépassée entre-temps ne passe qu'une fois.
  const { count } = await prisma.auditTerrainRapport.updateMany({
    where: { id: ligne.id, statut: "a_relire" },
    data: { statut: "valide", valideParId: adminId, valideLe: new Date() },
  });
  if (count !== 1) return { ok: false, erreur: "ancienne_version" };
  await ecrireJournalActivite(
    { adminUserId: adminId, ipAddress: await ipHachee(), userAgent: null },
    {
      action: "audit-terrain.rapport.valide",
      targetType: "audit_terrain_rapport",
      targetId: ligne.id,
      changes: { version: ligne.version },
    },
  );
  return { ok: true, valide: true };
}
