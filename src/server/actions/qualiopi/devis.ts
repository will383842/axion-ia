/**
 * Qualiopi — Server Actions CRM devis (T2).
 *
 * createDevisAction  : crée un devis brouillon (lignes, montant, numéro, TVA, validité).
 * sendDevisAction    : bascule statut → envoyé + met à jour statut client.
 * acceptDevisAction  : bascule statut → accepté.
 * declineDevisAction : bascule statut → refusé.
 *
 * TVA : exonéré 261-4-4° CGI → mentionTva = LEGAL_MENTIONS.factureExonerationTva.
 * Montants : TOUJOURS en CENTIMES (Int). Zéro valeur en dur.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import { estimateOpcoCoverage } from "@/server/qualiopi/crm/devis";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const ligneSchema = z.object({
  designation: z.string().min(1).max(500),
  quantite: z.number().positive(),
  prixUnitaireHtCents: z.number().int().min(0),
  /** Référence optionnelle à une offre du catalogue (tierId). */
  offreTierId: z.string().optional(),
});

const FINANCEMENTS = ["direct", "opco", "cpf", "france_travail"] as const;

const createDevisSchema = z.object({
  clientId: z.string().uuid(),
  lignes: z.array(ligneSchema).min(1),
  financementSuggere: z.enum(FINANCEMENTS).optional(),
  /** Nombre de participants (requis si financementSuggere === "opco"). */
  nbParticipants: z.number().int().min(1).optional(),
  /** Durée en heures (requis si financementSuggere === "opco"). */
  dureeHeures: z.number().positive().optional(),
  /** Modalité OPCO (requis si financementSuggere === "opco"). */
  modaliteOpco: z.enum(["intra", "inter_presentiel", "inter_distanciel"]).optional(),
  /** Enveloppe restante OPCO en centimes (optionnel). */
  opcoEnveloppeRestanteCents: z.number().int().min(0).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée un devis brouillon.
 * - Numéro : AXI-DEV-<année>-NNN (count+1 zero-paddé 3).
 * - montantTotalHtCents = Σ lignes.quantite × lignes.prixUnitaireHtCents.
 * - mentionTva = LEGAL_MENTIONS.factureExonerationTva.
 * - dateValidite = maintenant + 30 jours.
 * - Si financementSuggere==="opco" et nbParticipants/dureeHeures/modaliteOpco fournis
 *   → estimateOpcoCoverage renseigne montantOpcoEstimeCents/resteAChargeCents.
 */
export async function createDevisAction(
  input: z.infer<typeof createDevisSchema>,
): Promise<ActionResult<{ id: string; numero: string }>> {
  const session = await requireAdminWrite();
  const parsed = createDevisSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Calculer le total HT en centimes
  const montantTotalHtCents = v.lignes.reduce(
    (acc, l) => acc + Math.round(l.quantite * l.prixUnitaireHtCents),
    0,
  );

  // Allouer le numéro séquentiel
  const year = new Date().getFullYear();
  const count = await prisma.devis.count();
  const numero = formatDocumentNumber("devis", year, count + 1);

  // Date de validité : +30 jours
  const dateValidite = new Date();
  dateValidite.setDate(dateValidite.getDate() + 30);

  // Estimation OPCO si applicable
  let montantOpcoEstimeCents: number | undefined;
  let resteAChargeCents: number | undefined;

  if (
    v.financementSuggere === "opco" &&
    v.nbParticipants !== undefined &&
    v.dureeHeures !== undefined &&
    v.modaliteOpco !== undefined
  ) {
    const coverage = await estimateOpcoCoverage({
      nbParticipants: v.nbParticipants,
      dureeHeures: v.dureeHeures,
      modalite: v.modaliteOpco,
      montantHtCents: montantTotalHtCents,
      ...(v.opcoEnveloppeRestanteCents !== undefined
        ? { enveloppeRestanteCents: v.opcoEnveloppeRestanteCents }
        : {}),
    });
    montantOpcoEstimeCents = coverage.montantPriseEnChargeCents;
    resteAChargeCents = coverage.resteAChargeCents;
  }

  const created = await prisma.devis.create({
    data: {
      numero,
      clientId: v.clientId,
      lignes: v.lignes as never,
      montantTotalHtCents,
      mentionTva: LEGAL_MENTIONS.factureExonerationTva,
      statut: "brouillon",
      dateValidite,
      ...(v.financementSuggere !== undefined ? { financementSuggere: v.financementSuggere } : {}),
      ...(montantOpcoEstimeCents !== undefined ? { montantOpcoEstimeCents } : {}),
      ...(resteAChargeCents !== undefined ? { resteAChargeCents } : {}),
    },
    select: { id: true, numero: true },
  });

  await logQualiopiActivity({
    action: "qualiopi.devis.create",
    targetType: "Devis",
    targetId: created.id,
    changes: {
      numero,
      clientId: v.clientId,
      montantTotalHtCents,
      financementSuggere: v.financementSuggere,
    },
    session,
  });

  return { data: { id: created.id, numero: created.numero } };
}

/**
 * Marque le devis comme envoyé (statut → envoye, sentAt = now).
 * Met aussi à jour le statut du client → devis_envoye.
 */
export async function sendDevisAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const devis = await prisma.devis.findUnique({
    where: { id: idParsed.data },
    select: { id: true, clientId: true, statut: true },
  });
  if (!devis) return { error: "Devis introuvable" };
  if (devis.statut === "transforme_convention")
    return { error: "Devis déjà transformé en convention" };

  await prisma.$transaction([
    prisma.devis.update({
      where: { id: idParsed.data },
      data: { statut: "envoye", sentAt: new Date() },
    }),
    prisma.client.update({
      where: { id: devis.clientId },
      data: { statut: "devis_envoye" },
    }),
  ]);

  await logQualiopiActivity({
    action: "qualiopi.devis.send",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: { statut: "envoye" },
    session,
  });

  return { data: { id: idParsed.data } };
}

/**
 * Marque le devis comme accepté (statut → accepte, acceptedAt = now).
 */
export async function acceptDevisAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  await prisma.devis.update({
    where: { id: idParsed.data },
    data: { statut: "accepte", acceptedAt: new Date() },
  });

  await logQualiopiActivity({
    action: "qualiopi.devis.accept",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: { statut: "accepte" },
    session,
  });

  return { data: { id: idParsed.data } };
}

/**
 * Transforme un devis ACCEPTÉ en convention (statut → transforme_convention) — R11.
 *
 * Marque la fin du cycle commercial : le devis est transformé. La session de
 * formation se crée ensuite via createSessionAction en liant `devisId` (le Devis
 * ne porte pas de formationId → la formation/les dates sont choisies à la création
 * de session). Idempotent : un devis déjà transformé est laissé tel quel.
 */
export async function transformDevisToConventionAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const devis = await prisma.devis.findUnique({
    where: { id: idParsed.data },
    select: { id: true, statut: true },
  });
  if (!devis) return { error: "Devis introuvable" };
  if (devis.statut === "transforme_convention") return { data: { id: devis.id } };
  if (devis.statut !== "accepte") {
    return { error: "Seul un devis accepté peut être transformé en convention." };
  }

  await prisma.devis.update({
    where: { id: idParsed.data },
    data: { statut: "transforme_convention" },
  });

  await logQualiopiActivity({
    action: "qualiopi.devis.transform_convention",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: { statut: "transforme_convention" },
    session,
  });

  return { data: { id: idParsed.data } };
}

/**
 * Marque le devis comme refusé (statut → refuse, declinedAt = now).
 */
export async function declineDevisAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  await prisma.devis.update({
    where: { id: idParsed.data },
    data: { statut: "refuse", declinedAt: new Date() },
  });

  await logQualiopiActivity({
    action: "qualiopi.devis.decline",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: { statut: "refuse" },
    session,
  });

  return { data: { id: idParsed.data } };
}
