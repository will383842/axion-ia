"use server";

/**
 * Qualiopi 1-to-1 / AFEST — Server Actions admin (console coaching).
 *
 * Génération des documents AFEST (protocole, attestation en heures) + cadrage
 * AFEST d'un parcours. RBAC admin (requireAdminWrite). Enforcement des exigences
 * certificateur (tuteur, habilitation formateur) GATED par flags SiteSetting :
 * tant que le flag est `false`, aucune contrainte (ADR Phase 0 §7).
 */

import React from "react";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../prisma/generated/client";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { genererProtocoleAfest } from "@/server/qualiopi/coaching-afest/protocole-1to1";
import { genererAttestation1to1 } from "@/server/qualiopi/coaching-afest/attestation-1to1";
import { genererEmargement1to1 } from "@/server/qualiopi/coaching-afest/emargement-1to1";
import { genererFactureCoaching } from "@/server/qualiopi/coaching-afest/facturation-1to1";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { PositionnementPdf } from "@/server/qualiopi/documents/templates/positionnement";
import { SatisfactionPdf } from "@/server/qualiopi/documents/templates/satisfaction";
import { coachingInterventionLabel } from "@/server/formateur/coaching-options";

export interface AfestActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly documentId?: string | null;
  readonly numero?: string;
  readonly resultat?: "complete" | "partielle" | "aucune";
}

function refresh(revalidate?: string) {
  if (revalidate) revalidatePath(revalidate);
}

/**
 * Vérifie les pré-requis AFEST GATED d'un parcours avant émission d'un document.
 * Retourne un message d'erreur si un flag actif n'est pas satisfait, sinon null.
 * Aucun blocage tant que les flags sont à false (ADR Phase 0 §7).
 *
 * - `afest_tuteur_obligatoire` → tuteur entreprise renseigné.
 * - `afest_formateur_habilitation_requise` → Trainer.afestHabiliteAt présent.
 * - `afest_perimetre_certifie` → exige une cartographie d'activité remplie
 *   (≥1 tâche) et, pour l'attestation, ≥1 séance avec alternance tracée
 *   (mise en situation + phase réflexive non vides).
 */
async function checkAfestEnforcement(
  coachingSessionId: string,
  kind: "protocole" | "attestation",
): Promise<string | null> {
  const [tuteurRequis, habilitationRequise, perimetreCertifie] = await Promise.all([
    getQualiopiConfig("afest_tuteur_obligatoire"),
    getQualiopiConfig("afest_formateur_habilitation_requise"),
    getQualiopiConfig("afest_perimetre_certifie"),
  ]);
  if (!tuteurRequis && !habilitationRequise && !perimetreCertifie) return null;

  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingSessionId },
    select: {
      tuteurEntrepriseNom: true,
      trainer: { select: { afestHabiliteAt: true } },
      cartographie: { select: { taches: true } },
      comptesRendus: {
        select: { misesEnSituation: true, phasesReflexives: true, presenceSigneeAt: true },
      },
    },
  });
  if (!cs) return "Parcours introuvable.";

  if (tuteurRequis && !cs.tuteurEntrepriseNom) {
    return "Tuteur entreprise obligatoire (exigence AFEST activée) — renseignez-le avant de générer le document.";
  }
  if (habilitationRequise && cs.trainer.afestHabiliteAt == null) {
    return "Le formateur n'a pas d'habilitation AFEST tracée (exigence activée).";
  }
  if (perimetreCertifie) {
    const taches = cs.cartographie?.taches;
    if (!Array.isArray(taches) || taches.length === 0) {
      return "Cartographie de l'activité incomplète : au moins une tâche doit être identifiée (analyse préalable AFEST, D.6313-3-1 §1).";
    }
    if (kind === "attestation") {
      const hasContent = (arr: unknown, key: string): boolean =>
        Array.isArray(arr) &&
        arr.some((x) => {
          if (x == null || typeof x !== "object") return false;
          const v = (x as Record<string, unknown>)[key];
          return typeof v === "string" && v.trim().length > 0;
        });
      const alternanceTracee = cs.comptesRendus.some(
        (cr) =>
          hasContent(cr.misesEnSituation, "cas") && hasContent(cr.phasesReflexives, "situation"),
      );
      if (!alternanceTracee) {
        return "Aucune alternance tracée (mise en situation + phase réflexive) sur les comptes-rendus — requis pour attester un parcours AFEST.";
      }
      // Présence signée par séance (preuve d'audit) — requise en périmètre certifié.
      if (cs.comptesRendus.length === 0) {
        return "Aucune séance enregistrée — impossible d'attester la présence.";
      }
      const toutesSignees = cs.comptesRendus.every((cr) => cr.presenceSigneeAt != null);
      if (!toutesSignees) {
        return "Présence non signée sur une ou plusieurs séances — signez l'émargement de chaque séance avant d'attester (preuve d'audit AFEST).";
      }
    }
  }
  return null;
}

// ─── Cadrage AFEST d'un parcours ─────────────────────────────────────────────

const cadrageSchema = z.object({
  coachingSessionId: z.string().uuid(),
  estAfest: z.boolean(),
  heuresPrevuesConvention: z.number().min(0).max(2000).optional(),
  tuteurEntrepriseNom: z.string().trim().max(200).optional(),
  tuteurEntrepriseEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  objectifsPedagogiques: z
    .array(z.object({ libelle: z.string().trim().min(1).max(300) }))
    .optional(),
  revalidate: z.string().optional(),
});

export async function setAfestCadrageAction(
  input: z.input<typeof cadrageSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = cadrageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };
  const d = parsed.data;

  const data: Prisma.CoachingSessionUpdateInput = { estAfest: d.estAfest };
  if (d.heuresPrevuesConvention !== undefined)
    data.heuresPrevuesConvention = d.heuresPrevuesConvention;
  if (d.tuteurEntrepriseNom !== undefined) data.tuteurEntrepriseNom = d.tuteurEntrepriseNom || null;
  if (d.tuteurEntrepriseEmail !== undefined)
    data.tuteurEntrepriseEmail = d.tuteurEntrepriseEmail || null;
  if (d.objectifsPedagogiques !== undefined)
    data.objectifsPedagogiques = d.objectifsPedagogiques as unknown as Prisma.InputJsonValue;

  await prisma.coachingSession.update({ where: { id: d.coachingSessionId }, data });
  await logQualiopiActivity({
    action: "qualiopi.coaching.afest.cadrage",
    targetType: "CoachingSession",
    targetId: d.coachingSessionId,
    changes: { estAfest: d.estAfest },
    session,
  });
  refresh(d.revalidate);
  return { ok: true };
}

// ─── Génération Protocole AFEST ──────────────────────────────────────────────

const genSchema = z.object({
  coachingSessionId: z.string().uuid(),
  revalidate: z.string().optional(),
});

export async function genererProtocoleAfestAction(
  input: z.input<typeof genSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };

  const blocked = await checkAfestEnforcement(parsed.data.coachingSessionId, "protocole");
  if (blocked) return { ok: false, error: blocked };

  try {
    const res = await genererProtocoleAfest(parsed.data.coachingSessionId);
    if (!res) return { ok: false, error: "Génération indisponible." };
    await logQualiopiActivity({
      action: "qualiopi.coaching.protocole_afest.generate",
      targetType: "CoachingSession",
      targetId: parsed.data.coachingSessionId,
      changes: res,
      session,
    });
    refresh(parsed.data.revalidate);
    return { ok: true, documentId: res.documentId, numero: res.numero };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}

// ─── Génération Attestation 1-to-1 ───────────────────────────────────────────

const attestSchema = z.object({
  coachingSessionId: z.string().uuid(),
  force: z.boolean().optional(),
  revalidate: z.string().optional(),
});

export async function genererAttestation1to1Action(
  input: z.input<typeof attestSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = attestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };

  const blocked = await checkAfestEnforcement(parsed.data.coachingSessionId, "attestation");
  if (blocked) return { ok: false, error: blocked };

  try {
    const res = await genererAttestation1to1(parsed.data.coachingSessionId, {
      ...(parsed.data.force !== undefined ? { force: parsed.data.force } : {}),
    });
    await logQualiopiActivity({
      action: `qualiopi.coaching.attestation.${res.resultat}`,
      targetType: "CoachingSession",
      targetId: parsed.data.coachingSessionId,
      changes: res,
      session,
    });
    refresh(parsed.data.revalidate);
    return { ok: true, resultat: res.resultat, documentId: res.documentId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}

// ─── Émargement 1-to-1 (feuille de présence signée) ──────────────────────────

export async function genererEmargement1to1Action(
  input: z.input<typeof genSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  try {
    const res = await genererEmargement1to1(parsed.data.coachingSessionId);
    if (!res) return { ok: false, error: "Génération indisponible." };
    await logQualiopiActivity({
      action: "qualiopi.coaching.emargement.generate",
      targetType: "CoachingSession",
      targetId: parsed.data.coachingSessionId,
      changes: res,
      session,
    });
    refresh(parsed.data.revalidate);
    return { ok: true, documentId: res.documentId, numero: res.numero };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}

// ─── Signature de présence d'une séance ──────────────────────────────────────

const signSchema = z.object({
  compteRenduId: z.string().uuid(),
  beneficiairePresent: z.boolean().optional(),
  beneficiaireSigne: z.boolean().optional(),
  formateurSigne: z.boolean().optional(),
  tuteurSigne: z.boolean().optional(),
  revalidate: z.string().optional(),
});

export async function signerSeance1to1Action(
  input: z.input<typeof signSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  const d = parsed.data;
  const now = new Date();
  const data: Prisma.CompteRenduSeanceUpdateInput = { presenceSigneeAt: now };
  if (d.beneficiairePresent !== undefined) data.beneficiairePresent = d.beneficiairePresent;
  if (d.beneficiaireSigne) data.beneficiaireSigneAt = now;
  if (d.formateurSigne) data.formateurSigneAt = now;
  if (d.tuteurSigne) data.tuteurSigneAt = now;
  await prisma.compteRenduSeance.update({ where: { id: d.compteRenduId }, data });
  await logQualiopiActivity({
    action: "qualiopi.coaching.seance.signee",
    targetType: "CompteRenduSeance",
    targetId: d.compteRenduId,
    changes: { presenceSigneeAt: now },
    session,
  });
  refresh(d.revalidate);
  return { ok: true };
}

// ─── Facture coaching (CoachingContract) ─────────────────────────────────────

const factureSchema = z.object({
  coachingContractId: z.string().uuid(),
  revalidate: z.string().optional(),
});

export async function genererFactureCoachingAction(
  input: z.input<typeof factureSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = factureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  try {
    const res = await genererFactureCoaching(parsed.data.coachingContractId);
    await logQualiopiActivity({
      action: "qualiopi.coaching.facture.generate",
      targetType: "CoachingContract",
      targetId: parsed.data.coachingContractId,
      changes: { factureId: res.factureId, numero: res.numero },
      session,
    });
    refresh(parsed.data.revalidate);
    return { ok: true, documentId: res.documentId, numero: res.numero };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de facturation." };
  }
}

// ─── Positionnement + satisfaction 1-to-1 (réutilisent les templates) ─────────

async function genererDocCoaching(
  coachingSessionId: string,
  type: "positionnement" | "satisfaction",
  session: Awaited<ReturnType<typeof requireAdminWrite>>,
): Promise<AfestActionResult> {
  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingSessionId },
    select: { interventionSlug: true, dateSeance: true },
  });
  if (!cs) return { ok: false, error: "Parcours introuvable." };
  const identite = await getOrganismeIdentite();
  const docData = {
    intituleFormation: coachingInterventionLabel(cs.interventionSlug),
    dateSession: new Date(cs.dateSeance).toLocaleDateString("fr-FR"),
  };
  const res = await generateDocument({
    type,
    buildElement: (numero) =>
      type === "positionnement"
        ? React.createElement(PositionnementPdf, { data: { numero, ...docData }, identite })
        : React.createElement(SatisfactionPdf, { data: { numero, ...docData }, identite }),
    refs: { coachingSessionId },
  });
  await logQualiopiActivity({
    action: `qualiopi.coaching.${type}.generate`,
    targetType: "CoachingSession",
    targetId: coachingSessionId,
    changes: { documentId: res.id, numero: res.numero },
    session,
  });
  return { ok: true, documentId: res.id, numero: res.numero };
}

export async function genererPositionnement1to1Action(
  input: z.input<typeof genSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  try {
    const res = await genererDocCoaching(parsed.data.coachingSessionId, "positionnement", session);
    refresh(parsed.data.revalidate);
    return res;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}

export async function genererSatisfaction1to1Action(
  input: z.input<typeof genSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  try {
    const res = await genererDocCoaching(parsed.data.coachingSessionId, "satisfaction", session);
    refresh(parsed.data.revalidate);
    return res;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}
