"use server";

/**
 * Qualiopi — Server Action : création d'un parcours coaching 1-to-1 PAR L'ADMIN.
 *
 * 🔴 Principe verrouillé par Will (2026-08-05) : « les formateurs ne
 * construisent RIEN — Axion-IA construit puis AFFECTE un formateur ». Or la
 * seule création de séance existante vivait dans l'espace formateur
 * (`src/server/actions/formateur/coaching.actions.ts`, cookie formateur) :
 * l'admin ne pouvait PAS créer un parcours depuis la console. Cette action
 * inverse le sens : l'admin crée les séances, choisit le formateur, et
 * rattache le parcours au CRM (`clientId`/`devisId`, colonnes ajoutées par la
 * migration qualiopi_coaching_client_devis).
 *
 * Une CoachingSession = UNE séance : un parcours de N séances = N lignes
 * partageant slug/bénéficiaire/rattachements (même modèle que le chemin
 * formateur — aucun nouveau concept).
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { COACHING_INTERVENTIONS } from "@/server/formateur/coaching-options";

type ActionResult<T> = { data: T } | { error: string };

const seanceSchema = z.object({
  date: z.coerce.date(),
  /// Fin de créneau optionnelle (les séances legacy sans heure restent permises).
  dateFin: z.coerce.date().optional(),
});

const createCoachingParcoursSchema = z.object({
  trainerId: z.string().uuid(),
  interventionSlug: z.string().min(1).max(80),
  beneficiaireNom: z.string().min(1).max(200),
  beneficiaireEmail: z.string().email().max(254).optional(),
  beneficiaireEntreprise: z.string().max(250).optional(),
  clientId: z.string().uuid().optional(),
  devisId: z.string().uuid().optional(),
  estAfest: z.boolean().optional(),
  seances: z.array(seanceSchema).min(1).max(50),
});

export async function createCoachingParcoursAction(
  input: z.input<typeof createCoachingParcoursSchema>,
): Promise<ActionResult<{ ids: string[]; count: number }>> {
  const session = await requireAdminWrite();
  const parsed = createCoachingParcoursSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Slug : uniquement les prestations 1-to-1 du SSOT (pas de texte libre —
  // le chemin formateur acceptait n'importe quelle chaîne, pas celui-ci).
  if (!COACHING_INTERVENTIONS.some((i) => i.slug === v.interventionSlug)) {
    return { error: "Prestation 1-to-1 inconnue" };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: v.trainerId },
    select: { id: true, statut: true, nom: true },
  });
  if (!trainer) return { error: "Formateur introuvable" };
  if (trainer.statut !== "actif") {
    return { error: "Ce formateur n'est pas actif — affectez un formateur actif." };
  }

  if (v.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: v.clientId },
      select: { id: true },
    });
    if (!client) return { error: "Client introuvable" };
  }

  // Même garde que createSessionAction : un devis rattaché doit appartenir au
  // même client et être accepté (ou transformé) — pas de parcours sur un devis
  // encore brouillon/refusé.
  if (v.devisId) {
    const devis = await prisma.devis.findUnique({
      where: { id: v.devisId },
      select: { id: true, clientId: true, statut: true },
    });
    if (!devis) return { error: "Devis introuvable" };
    if (v.clientId && devis.clientId !== v.clientId) {
      return { error: "Le devis rattaché appartient à un autre client" };
    }
    if (devis.statut !== "accepte" && devis.statut !== "transforme_convention") {
      return { error: "Le devis rattaché doit être accepté avant de planifier le parcours" };
    }
  }

  for (const s of v.seances) {
    if (s.dateFin && s.dateFin.getTime() <= s.date.getTime()) {
      return { error: "Une séance a une fin antérieure ou égale à son début" };
    }
  }

  const ids: string[] = [];
  for (const s of v.seances) {
    const created = await prisma.coachingSession.create({
      data: {
        trainerId: v.trainerId,
        interventionSlug: v.interventionSlug,
        dateSeance: s.date,
        ...(s.dateFin ? { dateSeanceFin: s.dateFin } : {}),
        beneficiaireNom: v.beneficiaireNom,
        ...(v.beneficiaireEmail ? { beneficiaireEmail: v.beneficiaireEmail } : {}),
        ...(v.beneficiaireEntreprise ? { beneficiaireEntreprise: v.beneficiaireEntreprise } : {}),
        ...(v.clientId ? { clientId: v.clientId } : {}),
        ...(v.devisId ? { devisId: v.devisId } : {}),
        ...(v.estAfest !== undefined ? { estAfest: v.estAfest } : {}),
      },
      select: { id: true },
    });
    ids.push(created.id);
  }

  await logQualiopiActivity({
    action: "qualiopi.coaching.parcours_create",
    targetType: "CoachingSession",
    targetId: ids[0] ?? "",
    changes: {
      trainerId: v.trainerId,
      interventionSlug: v.interventionSlug,
      nbSeances: ids.length,
      clientId: v.clientId ?? null,
      devisId: v.devisId ?? null,
      estAfest: v.estAfest ?? false,
    },
    session,
  });

  return { data: { ids, count: ids.length } };
}
