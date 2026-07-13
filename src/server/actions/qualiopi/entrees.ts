/**
 * Qualiopi — Server Action « convertir une entrée en client » (Lot 3).
 *
 * Pont appel Calendly / message contact → CRM Qualiopi. La conversion reste
 * un geste HUMAIN (1 clic depuis /qualiopi/entrees, champs pré-remplis mais
 * modifiables) — aucune automatisation totale, c'est voulu.
 *
 * Réutilise `createClientAction` (numérotation AXI-CLI-NNN + inférence OPCO
 * par NAF + statut prospect + log qualiopi.client.create) — AUCUNE duplication
 * de la logique de création. Dédup : si un client au même email existe déjà
 * (match citext, cf. `findClientByEmail`), on renvoie son id avec
 * `dejaExistant: true` au lieu de créer un doublon.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { adminPath } from "@/lib/admin-path";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { createClientAction } from "@/server/actions/qualiopi/clients";
import { findClientByEmail } from "@/server/qualiopi/crm/entrees";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schéma Zod
// ─────────────────────────────────────────────────────────────────────────────

const convertirEntreeSchema = z.object({
  /** Origine de l'entrée : appel Calendly ou message /contact. */
  source: z.enum(["calendly", "submission"]),
  /** id CalendlyEvent (cuid) ou Submission (uuid). */
  entreeId: z.string().min(1).max(64),
  // Champs pré-remplis depuis l'entrée, modifiables par Will avant création.
  raisonSociale: z.string().min(1).max(250),
  contactNom: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactTelephone: z.string().max(40).optional(),
  siret: z.string().max(14).optional(),
  nafCode: z.string().max(6).optional(),
  notes: z.string().optional(),
});

export type ConvertirEntreeInput = z.infer<typeof convertirEntreeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convertit une entrée (CalendlyEvent | Submission) en client CRM.
 *
 * - Si un client au même email existe déjà → `{ dejaExistant: true }` + son id
 *   (pas de doublon créé).
 * - Sinon création via `createClientAction` (même numérotation, même OPCO
 *   inféré, statut prospect) avec `source` tracée.
 * - Audit : ActivityLog `qualiopi.crm.convertir_entree` dans les deux cas.
 */
export async function convertirEntreeEnClientAction(
  input: ConvertirEntreeInput,
): Promise<ActionResult<{ id: string; numero: string; dejaExistant: boolean }>> {
  const session = await requireAdminWrite();
  const parsed = convertirEntreeSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Dédup — le statut « converti » se DÉRIVE par correspondance email (citext),
  // aucun champ de liaison en base (pas de migration, décision Lot 3).
  if (v.contactEmail) {
    const existant = await findClientByEmail(v.contactEmail);
    if (existant) {
      await logQualiopiActivity({
        action: "qualiopi.crm.convertir_entree",
        targetType: "Client",
        targetId: existant.id,
        changes: {
          source: v.source,
          entreeId: v.entreeId,
          numero: existant.numero,
          dejaExistant: true,
        },
        session,
      });
      return { data: { id: existant.id, numero: existant.numero, dejaExistant: true } };
    }
  }

  const created = await createClientAction({
    raisonSociale: v.raisonSociale,
    ...(v.contactNom !== undefined ? { contactNom: v.contactNom } : {}),
    ...(v.contactEmail !== undefined ? { contactEmail: v.contactEmail } : {}),
    ...(v.contactTelephone !== undefined ? { contactTelephone: v.contactTelephone } : {}),
    ...(v.siret !== undefined ? { siret: v.siret } : {}),
    ...(v.nafCode !== undefined ? { nafCode: v.nafCode } : {}),
    ...(v.notes !== undefined ? { notes: v.notes } : {}),
    source: v.source === "calendly" ? "appel_calendly" : "formulaire_contact",
  });
  if ("error" in created) return created;

  await logQualiopiActivity({
    action: "qualiopi.crm.convertir_entree",
    targetType: "Client",
    targetId: created.data.id,
    changes: {
      source: v.source,
      entreeId: v.entreeId,
      numero: created.data.numero,
      dejaExistant: false,
    },
    session,
  });

  revalidatePath(adminPath("fr", "qualiopi/entrees"));
  revalidatePath(adminPath("fr", "qualiopi/clients"));

  return { data: { id: created.data.id, numero: created.data.numero, dejaExistant: false } };
}
