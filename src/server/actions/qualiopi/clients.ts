/**
 * Qualiopi — Server Actions CRM clients (T2).
 *
 * createClientAction : crée un client prospect avec numérotation AXI-CLI-NNN.
 * updateClientAction : met à jour les champs éditoriaux.
 * Guards RBAC write + audit ActivityLog.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { inferOpcoFromNaf } from "@/server/qualiopi/crm/naf-opco";
import { NUMBERING_PREFIX, SEQ_PAD_WIDTH } from "@/server/qualiopi/numbering/formats";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const COMPANY_SIZES = ["TPE", "PME", "ETI", "GRANDE_ENTREPRISE"] as const;
const CLIENT_STATUTS = [
  "prospect",
  "devis_envoye",
  "client_actif",
  "client_inactif",
  "perdu",
] as const;

const createClientSchema = z.object({
  raisonSociale: z.string().min(1).max(250),
  siret: z.string().max(14).optional(),
  nafCode: z.string().max(6).optional(),
  conventionCollective: z.string().max(200).optional(),
  secteur: z.string().max(200).optional(),
  taille: z.enum(COMPANY_SIZES).optional(),
  adresse: z.string().optional(),
  contactNom: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactTelephone: z.string().max(40).optional(),
  contactFonction: z.string().max(150).optional(),
  /** OPCO saisi manuellement. Si absent, inféré depuis nafCode. */
  opcoIdentifie: z.string().max(60).optional(),
  opcoNumeroAdherent: z.string().max(80).optional(),
  opcoEnveloppeAnnuelleCents: z.number().int().min(0).optional(),
  source: z.string().max(120).optional(),
  contexteIa: z.string().optional(),
  notes: z.string().optional(),
});

const updateClientSchema = z.object({
  id: z.string().uuid(),
  raisonSociale: z.string().min(1).max(250).optional(),
  siret: z.string().max(14).optional(),
  nafCode: z.string().max(6).optional(),
  conventionCollective: z.string().max(200).optional(),
  secteur: z.string().max(200).optional(),
  taille: z.enum(COMPANY_SIZES).optional(),
  adresse: z.string().optional(),
  contactNom: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactTelephone: z.string().max(40).optional(),
  contactFonction: z.string().max(150).optional(),
  opcoIdentifie: z.string().max(60).optional(),
  opcoNumeroAdherent: z.string().max(80).optional(),
  opcoEnveloppeAnnuelleCents: z.number().int().min(0).optional(),
  statut: z.enum(CLIENT_STATUTS).optional(),
  source: z.string().max(120).optional(),
  contexteIa: z.string().optional(),
  notes: z.string().optional(),
  besoinsIdentifies: z.unknown().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée un client prospect.
 * - Numéro alloué séquentiellement : AXI-CLI-NNN (count+1 zero-paddé 3).
 * - opcoIdentifie inféré via inferOpcoFromNaf si non fourni.
 * - Statut initial : prospect.
 */
export async function createClientAction(
  input: z.infer<typeof createClientSchema>,
): Promise<ActionResult<{ id: string; numero: string }>> {
  const session = await requireAdminWrite();
  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Allouer le numéro séquentiel
  const count = await prisma.client.count();
  const seq = count + 1;
  const numero = `${NUMBERING_PREFIX.client}-${String(seq).padStart(SEQ_PAD_WIDTH, "0")}`;

  // Inférer l'OPCO si non fourni manuellement
  const opcoIdentifie = v.opcoIdentifie ?? inferOpcoFromNaf(v.nafCode ?? null);

  const created = await prisma.client.create({
    data: {
      numero,
      raisonSociale: v.raisonSociale,
      statut: "prospect",
      ...(v.siret !== undefined ? { siret: v.siret } : {}),
      ...(v.nafCode !== undefined ? { nafCode: v.nafCode } : {}),
      ...(v.conventionCollective !== undefined
        ? { conventionCollective: v.conventionCollective }
        : {}),
      ...(v.secteur !== undefined ? { secteur: v.secteur } : {}),
      ...(v.taille !== undefined ? { taille: v.taille } : {}),
      ...(v.adresse !== undefined ? { adresse: v.adresse } : {}),
      ...(v.contactNom !== undefined ? { contactNom: v.contactNom } : {}),
      ...(v.contactEmail !== undefined ? { contactEmail: v.contactEmail } : {}),
      ...(v.contactTelephone !== undefined ? { contactTelephone: v.contactTelephone } : {}),
      ...(v.contactFonction !== undefined ? { contactFonction: v.contactFonction } : {}),
      ...(opcoIdentifie !== null ? { opcoIdentifie } : {}),
      ...(v.opcoNumeroAdherent !== undefined ? { opcoNumeroAdherent: v.opcoNumeroAdherent } : {}),
      ...(v.opcoEnveloppeAnnuelleCents !== undefined
        ? { opcoEnveloppeAnnuelleCents: v.opcoEnveloppeAnnuelleCents }
        : {}),
      ...(v.source !== undefined ? { source: v.source } : {}),
      ...(v.contexteIa !== undefined ? { contexteIa: v.contexteIa } : {}),
      ...(v.notes !== undefined ? { notes: v.notes } : {}),
    },
    select: { id: true, numero: true },
  });

  await logQualiopiActivity({
    action: "qualiopi.client.create",
    targetType: "Client",
    targetId: created.id,
    changes: { numero, raisonSociale: v.raisonSociale, opcoIdentifie },
    session,
  });

  return { data: { id: created.id, numero: created.numero } };
}

/**
 * Met à jour les champs éditoriaux d'un client existant
 * (notes, contexteIa, statut, coordonnées, OPCO, etc.).
 */
export async function updateClientAction(
  input: z.infer<typeof updateClientSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateClientSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  await prisma.client.update({
    where: { id },
    data: {
      ...(fields.raisonSociale !== undefined ? { raisonSociale: fields.raisonSociale } : {}),
      ...(fields.siret !== undefined ? { siret: fields.siret } : {}),
      ...(fields.nafCode !== undefined ? { nafCode: fields.nafCode } : {}),
      ...(fields.conventionCollective !== undefined
        ? { conventionCollective: fields.conventionCollective }
        : {}),
      ...(fields.secteur !== undefined ? { secteur: fields.secteur } : {}),
      ...(fields.taille !== undefined ? { taille: fields.taille } : {}),
      ...(fields.adresse !== undefined ? { adresse: fields.adresse } : {}),
      ...(fields.contactNom !== undefined ? { contactNom: fields.contactNom } : {}),
      ...(fields.contactEmail !== undefined ? { contactEmail: fields.contactEmail } : {}),
      ...(fields.contactTelephone !== undefined
        ? { contactTelephone: fields.contactTelephone }
        : {}),
      ...(fields.contactFonction !== undefined ? { contactFonction: fields.contactFonction } : {}),
      ...(fields.opcoIdentifie !== undefined ? { opcoIdentifie: fields.opcoIdentifie } : {}),
      ...(fields.opcoNumeroAdherent !== undefined
        ? { opcoNumeroAdherent: fields.opcoNumeroAdherent }
        : {}),
      ...(fields.opcoEnveloppeAnnuelleCents !== undefined
        ? { opcoEnveloppeAnnuelleCents: fields.opcoEnveloppeAnnuelleCents }
        : {}),
      ...(fields.statut !== undefined ? { statut: fields.statut } : {}),
      ...(fields.source !== undefined ? { source: fields.source } : {}),
      ...(fields.contexteIa !== undefined ? { contexteIa: fields.contexteIa } : {}),
      ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
      ...(fields.besoinsIdentifies !== undefined
        ? { besoinsIdentifies: fields.besoinsIdentifies as never }
        : {}),
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.client.update",
    targetType: "Client",
    targetId: id,
    changes: fields,
    session,
  });

  return { data: { id } };
}
