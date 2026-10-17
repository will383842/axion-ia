/**
 * Qualiopi — Server Actions Veille (T12).
 *
 * creerVeilleAction     : enregistre une entrée de veille (off.23/24/25).
 * updateVeilleAction    : met à jour une entrée existante.
 * supprimerVeilleAction : supprime une entrée.
 *
 * 🔴 Chantier QNC, lot L10 — `qualiopi.veille.actif` à `actif` : la table est
 * en ajout seul. La modification et la suppression sont REFUSÉES et remplacées
 * par trois gestes tracés (`veille-tracee.ts`) :
 *   deciderVeilleAction  : une personne décide (décision + pièce modifiée) ;
 *   corrigerVeilleAction : correction motivée, par ajout (ni type ni date) ;
 *   archiverVeilleAction : remplace la suppression, motivé.
 * La création ne porte plus de décision : l'IA collecte et propose, une
 * personne décide. Interrupteur éteint : tout se comporte comme avant.
 *
 * Délègue au service registre (Agent A).
 */

"use server";

import { z } from "zod";
import {
  requireAdminWrite,
  requireAdminDelete,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import {
  creerVeille,
  updateVeille,
  supprimerVeille,
  getVeille,
} from "@/server/qualiopi/registres/veille-service";
import { prisma } from "@/lib/prisma";
import { veilleTraceeActive } from "@/server/qualiopi/veille/regle-veille";
import {
  RefusVeille,
  archiverVeille,
  corrigerVeille,
  creerVeilleTracee,
  deciderVeille,
} from "@/server/qualiopi/veille/veille-tracee";
import { contexteRequeteQualiopi } from "@/server/qualiopi/journal/contexte-requete";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const TYPES_VEILLE = ["legale", "metiers", "pedagogique", "handicap"] as const;

const creerVeilleSchema = z.object({
  type: z.enum(TYPES_VEILLE),
  source: z.string().min(1).max(300),
  titre: z.string().min(1).max(300),
  contenu: z.string().min(1),
  // Date de l'INFORMATION. Allumé (L10) : jamais après aujourd'hui (Paris) ; la
  // date de SAISIE, elle, est toujours celle du serveur (`created_at`).
  dateVeille: z.coerce.date(),
  impact: z.string().optional(),
  actionDecidee: z.string().optional(),
});

const updateVeilleSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(TYPES_VEILLE).optional(),
  source: z.string().min(1).max(300).optional(),
  titre: z.string().min(1).max(300).optional(),
  contenu: z.string().min(1).optional(),
  dateVeille: z.coerce.date().optional(),
  impact: z.string().optional(),
  actionDecidee: z.string().optional(),
});

const supprimerVeilleSchema = z.object({
  id: z.string().uuid(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre une nouvelle entrée de veille dans le registre.
 */
export async function creerVeilleAction(input: {
  type: (typeof TYPES_VEILLE)[number];
  source: string;
  titre: string;
  contenu: string;
  dateVeille: Date;
  impact?: string;
  actionDecidee?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = creerVeilleSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  if (await veilleTraceeActive()) {
    if ((v.actionDecidee ?? "").trim() !== "") return { error: REFUS_DECISION_A_LA_CREATION };
    return ecrireTracee(() =>
      creerVeilleTracee(
        prisma,
        {
          type: v.type,
          source: v.source,
          titre: v.titre,
          contenu: v.contenu,
          ...(v.impact !== undefined ? { impact: v.impact } : {}),
          dateVeille: v.dateVeille,
          auteurId: session.userId,
        },
        { contexte: contexteRequeteQualiopi },
      ),
    );
  }

  let veille: { id: string };
  try {
    veille = await creerVeille({
      type: v.type,
      source: v.source,
      titre: v.titre,
      contenu: v.contenu,
      dateVeille: v.dateVeille,
      ...(v.impact !== undefined ? { impact: v.impact } : {}),
      ...(v.actionDecidee !== undefined ? { actionDecidee: v.actionDecidee } : {}),
      creeParId: session.userId,
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement de la veille" };
  }

  await logQualiopiActivity({
    action: "qualiopi.veille.create",
    targetType: "Veille",
    targetId: veille.id,
    changes: { type: v.type, titre: v.titre, dateVeille: v.dateVeille },
    session,
  });

  return { data: { id: veille.id } };
}

/**
 * Met à jour une entrée de veille existante.
 */
export async function updateVeilleAction(input: {
  id: string;
  type?: (typeof TYPES_VEILLE)[number];
  source?: string;
  titre?: string;
  contenu?: string;
  dateVeille?: Date;
  impact?: string;
  actionDecidee?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  if (await veilleTraceeActive()) return { error: REFUS_MODIFICATION };
  const parsed = updateVeilleSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  const existe = await getVeille(id);
  if (existe === null) return { error: "Entrée de veille introuvable" };

  try {
    await updateVeille(id, {
      ...(fields.type !== undefined ? { type: fields.type } : {}),
      ...(fields.source !== undefined ? { source: fields.source } : {}),
      ...(fields.titre !== undefined ? { titre: fields.titre } : {}),
      ...(fields.contenu !== undefined ? { contenu: fields.contenu } : {}),
      ...(fields.dateVeille !== undefined ? { dateVeille: fields.dateVeille } : {}),
      ...(fields.impact !== undefined ? { impact: fields.impact } : {}),
      ...(fields.actionDecidee !== undefined ? { actionDecidee: fields.actionDecidee } : {}),
    });
  } catch {
    return { error: "Entrée de veille introuvable ou erreur de mise à jour" };
  }

  await logQualiopiActivity({
    action: "qualiopi.veille.update",
    targetType: "Veille",
    targetId: id,
    changes: fields,
    session,
  });

  return { data: { id } };
}

/**
 * Supprime définitivement une entrée de veille.
 */
export async function supprimerVeilleAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminDelete();
  if (await veilleTraceeActive()) return { error: REFUS_SUPPRESSION };
  const parsed = supprimerVeilleSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  const existe = await getVeille(id);
  if (existe === null) return { error: "Entrée de veille introuvable" };

  try {
    await supprimerVeille(id);
  } catch {
    return { error: "Entrée de veille introuvable ou erreur de suppression" };
  }

  await logQualiopiActivity({
    action: "qualiopi.veille.delete",
    targetType: "Veille",
    targetId: id,
    changes: null,
    session,
  });

  return { data: { id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chantier QNC, lot L10 — veille tracée (interrupteur `qualiopi.veille.actif`)
// ─────────────────────────────────────────────────────────────────────────────

const REFUS_DECISION_A_LA_CREATION =
  "La décision ne se saisit pas avec la proposition : enregistrez l'entrée, puis une personne la décide (bouton « Décider »).";
const REFUS_MODIFICATION =
  "Une entrée de veille ne se modifie plus : corrigez-la par ajout (bouton « Corriger », avec un motif). L'entrée d'origine reste lisible, archivée.";
const REFUS_SUPPRESSION =
  "Une entrée de veille ne se supprime plus : archivez-la avec un motif. Rien ne s'efface du registre.";
const REFUS_ETEINT =
  "Ce geste appartient à la veille tracée, qui n'est pas encore allumée (qualiopi.veille.actif).";

/** Une écriture tracée : son refus métier remonte tel quel, toute autre erreur est dite sobrement. */
async function ecrireTracee(
  ecrire: () => Promise<{ id: string }>,
): Promise<ActionResult<{ id: string }>> {
  try {
    return { data: await ecrire() };
  } catch (err) {
    if (err instanceof RefusVeille) return { error: err.message };
    return { error: "Erreur lors de l'enregistrement de la veille : rien n'a été écrit." };
  }
}

const deciderVeilleSchema = z.object({
  id: z.string().uuid(),
  decision: z.string().min(1).max(4000),
  pieceModifiee: z.string().min(1).max(300),
});

/** Une personne décide de la suite d'une veille, et nomme la pièce modifiée (ou « aucune »). */
export async function deciderVeilleAction(input: {
  id: string;
  decision: string;
  pieceModifiee: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  if (!(await veilleTraceeActive())) return { error: REFUS_ETEINT };
  const parsed = deciderVeilleSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;
  return ecrireTracee(() =>
    deciderVeille(
      prisma,
      {
        veilleId: v.id,
        decision: v.decision,
        pieceModifiee: v.pieceModifiee,
        auteurId: session.userId,
      },
      { contexte: contexteRequeteQualiopi },
    ),
  );
}

// ⚠️ Ni `type` ni `dateVeille` : une correction ne les change jamais, et le
// formulaire ne les renvoie plus. `.strict()` refuse qu'on les glisse quand même.
const corrigerVeilleSchema = z
  .object({
    id: z.string().uuid(),
    source: z.string().max(300).optional(),
    titre: z.string().max(300).optional(),
    contenu: z.string().optional(),
    impact: z.string().optional(),
    motif: z.string().min(1).max(2000),
  })
  .strict();

/** Corrige une veille par ajout, avec son motif. */
export async function corrigerVeilleAction(input: {
  id: string;
  source?: string;
  titre?: string;
  contenu?: string;
  impact?: string;
  motif: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  if (!(await veilleTraceeActive())) return { error: REFUS_ETEINT };
  const parsed = corrigerVeilleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Données invalides — une correction ne change ni le type ni la date de l'information.",
    };
  }
  const { id, ...v } = parsed.data;
  return ecrireTracee(() =>
    corrigerVeille(
      prisma,
      {
        veilleId: id,
        ...(v.source !== undefined ? { source: v.source } : {}),
        ...(v.titre !== undefined ? { titre: v.titre } : {}),
        ...(v.contenu !== undefined ? { contenu: v.contenu } : {}),
        ...(v.impact !== undefined ? { impact: v.impact } : {}),
        motif: v.motif,
        auteurId: session.userId,
      },
      { contexte: contexteRequeteQualiopi },
    ),
  );
}

const archiverVeilleSchema = z.object({
  id: z.string().uuid(),
  motif: z.string().min(1).max(2000),
});

/** Archive une veille (remplace la suppression). La ligne reste au registre. */
export async function archiverVeilleAction(input: {
  id: string;
  motif: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  if (!(await veilleTraceeActive())) return { error: REFUS_ETEINT };
  const parsed = archiverVeilleSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  return ecrireTracee(() =>
    archiverVeille(
      prisma,
      { veilleId: parsed.data.id, motif: parsed.data.motif, auteurId: session.userId },
      { contexte: contexteRequeteQualiopi },
    ),
  );
}
