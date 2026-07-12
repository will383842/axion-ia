/**
 * Hub facturation — Server Actions des factures LIBRES multi-activités.
 *
 * Wrappers Zod + RBAC + audit autour de `financements/facture-libre.ts` :
 *   - émission d'une facture libre (5 activités, lignes libres, TVA/ligne) ;
 *   - conversion devis accepté → facture ;
 *   - avoir (total ou partiel) ;
 *   - encaissement manuel (virement/chèque/espèces, partiel accepté).
 *
 * Le retour d'émission expose `chorusProRequis` : client secteur public →
 * dépôt Chorus Pro OBLIGATOIRE (obligation en vigueur, hors réforme 2026).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  genererFactureLibre,
  genererAvoirFacture,
  enregistrerPaiementFacture,
} from "@/server/qualiopi/financements/facture-libre";
import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";

const ActiviteSchema = z.enum(["formation", "un_a_un", "audit", "implementation", "site_web"]);

const LigneSchema = z.object({
  designation: z.string().min(1).max(500),
  quantite: z.number().positive(),
  prixUnitaireHtCents: z.number().int(),
  tauxTvaPercent: z.number().min(0).max(30).optional(),
});

const GenererFactureLibreSchema = z.object({
  clientId: z.string().uuid(),
  activite: ActiviteSchema,
  lignes: z.array(LigneSchema).min(1).max(50),
  refClient: z.string().max(120).optional(),
  auditMissionId: z.string().uuid().optional(),
  periodePrestation: z.string().max(200).optional(),
});

export async function genererFactureLibreAction(
  rawInput: unknown,
): Promise<
  { data: { factureId: string; numero: string; chorusProRequis: boolean } } | { error: string }
> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = GenererFactureLibreSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  try {
    const result = await genererFactureLibre({
      clientId: input.clientId,
      activite: input.activite,
      lignes: input.lignes as LigneFacture[],
      ...(input.refClient !== undefined ? { refClient: input.refClient } : {}),
      ...(input.auditMissionId !== undefined ? { auditMissionId: input.auditMissionId } : {}),
      ...(input.periodePrestation !== undefined
        ? { periodePrestation: input.periodePrestation }
        : {}),
    });
    await logQualiopiActivity({
      action: "facturation.facture_libre.emettre",
      targetType: "FactureFormation",
      targetId: result.factureId,
      changes: { numero: result.numero, activite: input.activite, clientId: input.clientId },
      session,
    });
    return {
      data: {
        factureId: result.factureId,
        numero: result.numero,
        chorusProRequis: result.chorusProRequis,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Émission impossible." };
  }
}

const DepuisDevisSchema = z.object({ devisId: z.string().uuid() });

/**
 * Convertit un devis ACCEPTÉ en facture libre (lignes + client + activité +
 * réf. commande repris du devis). Le devis doit porter une activité — c'est
 * elle qui pilote le régime TVA de la facture.
 */
export async function genererFactureDepuisDevisAction(
  rawInput: unknown,
): Promise<
  { data: { factureId: string; numero: string; chorusProRequis: boolean } } | { error: string }
> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = DepuisDevisSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };

  const devis = await prisma.devis.findUnique({
    where: { id: parsed.data.devisId },
    select: {
      id: true,
      numero: true,
      statut: true,
      activite: true,
      refClient: true,
      clientId: true,
      lignes: true,
      facturesFormation: { where: { statut: { not: "annulee" } }, select: { id: true } },
    },
  });
  if (!devis) return { error: "Devis introuvable." };
  if (devis.statut !== "accepte" && devis.statut !== "transforme_convention") {
    return { error: "Seul un devis accepté se facture." };
  }
  if (devis.activite === null) {
    return { error: "Renseigner l'activité du devis avant facturation (pilote le régime TVA)." };
  }
  if (devis.facturesFormation.length > 0) {
    return { error: "Ce devis a déjà été facturé (émettre un avoir pour rectifier)." };
  }

  const lignesParsed = z.array(LigneSchema).safeParse(devis.lignes);
  if (!lignesParsed.success || lignesParsed.data.length === 0) {
    return { error: "Lignes du devis illisibles — corriger le devis." };
  }

  try {
    const result = await genererFactureLibre({
      clientId: devis.clientId,
      activite: devis.activite,
      lignes: lignesParsed.data as LigneFacture[],
      devisId: devis.id,
      ...(devis.refClient !== null ? { refClient: devis.refClient } : {}),
    });
    await logQualiopiActivity({
      action: "facturation.devis.facturer",
      targetType: "Devis",
      targetId: devis.id,
      changes: { devisNumero: devis.numero, factureNumero: result.numero },
      session,
    });
    return {
      data: {
        factureId: result.factureId,
        numero: result.numero,
        chorusProRequis: result.chorusProRequis,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Facturation impossible." };
  }
}

const GenererAvoirSchema = z.object({
  factureId: z.string().uuid(),
  /** Absent = avoir TOTAL. Sinon montant HT partiel en centimes. */
  montantPartielHtCents: z.number().int().positive().optional(),
  motif: z.string().min(5).max(500),
});

export async function genererAvoirAction(
  rawInput: unknown,
): Promise<{ data: { avoirId: string; numero: string } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = GenererAvoirSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide (motif : 5 caractères minimum)." };

  try {
    const result = await genererAvoirFacture({
      factureId: parsed.data.factureId,
      motif: parsed.data.motif,
      ...(parsed.data.montantPartielHtCents !== undefined
        ? { montantPartielHtCents: parsed.data.montantPartielHtCents }
        : {}),
    });
    await logQualiopiActivity({
      action: "facturation.avoir.emettre",
      targetType: "FactureFormation",
      targetId: parsed.data.factureId,
      changes: {
        avoirNumero: result.numero,
        motif: parsed.data.motif,
        montantPartielHtCents: parsed.data.montantPartielHtCents ?? null,
      },
      session,
    });
    return { data: { avoirId: result.avoirId, numero: result.numero } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Avoir impossible." };
  }
}

const EnregistrerPaiementSchema = z.object({
  factureId: z.string().uuid(),
  montantCents: z.number().int().positive(),
  paidAt: z.coerce.date(),
  mode: z.enum(["manual_wire", "manual_check", "manual_cash"]),
  reference: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export async function enregistrerPaiementFactureAction(
  rawInput: unknown,
): Promise<
  | { data: { paymentId: string; statut: "partiellement_payee" | "payee"; resteACents: number } }
  | { error: string }
> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = EnregistrerPaiementSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  try {
    const result = await enregistrerPaiementFacture({
      factureId: input.factureId,
      montantCents: input.montantCents,
      paidAt: input.paidAt,
      mode: input.mode,
      ...(input.reference !== undefined ? { reference: input.reference } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      recordedByAdminId: session.userId,
    });
    await logQualiopiActivity({
      action: "facturation.paiement.enregistrer",
      targetType: "FactureFormation",
      targetId: input.factureId,
      changes: {
        montantCents: input.montantCents,
        mode: input.mode,
        statut: result.statut,
        resteACents: result.resteACents,
      },
      session,
    });
    return { data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Encaissement impossible." };
  }
}
