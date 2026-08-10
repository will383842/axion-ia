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
  // `estAfest` RETIRÉ du schéma le 2026-08-10 : le 1-to-1 est du conseil
  // (décision Will 2026-07-17), plus aucun parcours ne se cadre en AFEST. Le
  // champ Prisma existe toujours (défaut false) mais n'est plus jamais écrit.
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

  // ⚠️ `statut` (TrainerStatut) = salarie/sous_traitant/dirigeant — la notion
  // d'activité est le booléen `actif`, pas le statut.
  const trainer = await prisma.trainer.findUnique({
    where: { id: v.trainerId },
    select: { id: true, actif: true, nom: true },
  });
  if (!trainer) return { error: "Formateur introuvable" };
  if (!trainer.actif) {
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
  let clientIdEffectif = v.clientId;
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
    // clientId omis : DÉRIVÉ du devis — sinon la garde d'appartenance était
    // contournable en n'envoyant que le devisId, et le parcours portait un
    // devis sans son client.
    clientIdEffectif = v.clientId ?? devis.clientId;
  }

  for (const s of v.seances) {
    if (s.dateFin && s.dateFin.getTime() <= s.date.getTime()) {
      return { error: "Une séance a une fin antérieure ou égale à son début" };
    }
  }

  // Transaction : un échec à la séance k sur N ne doit laisser AUCUNE séance
  // orpheline en base (l'admin re-soumettrait → doublons dans le calendrier
  // du formateur). 50 inserts max, aucun risque de timeout.
  let ids: string[];
  try {
    ids = await prisma.$transaction(async (tx) => {
      const crees: string[] = [];
      for (const s of v.seances) {
        const created = await tx.coachingSession.create({
          data: {
            trainerId: v.trainerId,
            interventionSlug: v.interventionSlug,
            dateSeance: s.date,
            ...(s.dateFin ? { dateSeanceFin: s.dateFin } : {}),
            beneficiaireNom: v.beneficiaireNom,
            ...(v.beneficiaireEmail ? { beneficiaireEmail: v.beneficiaireEmail } : {}),
            ...(v.beneficiaireEntreprise
              ? { beneficiaireEntreprise: v.beneficiaireEntreprise }
              : {}),
            ...(clientIdEffectif ? { clientId: clientIdEffectif } : {}),
            ...(v.devisId ? { devisId: v.devisId } : {}),
          },
          select: { id: true },
        });
        crees.push(created.id);
      }
      return crees;
    });
  } catch (err) {
    console.error(
      "[coaching-parcours] création du parcours échouée (aucune séance créée) :",
      err instanceof Error ? err.message : String(err),
    );
    return { error: "Création du parcours échouée — aucune séance n'a été créée, réessayez." };
  }

  await logQualiopiActivity({
    action: "qualiopi.coaching.parcours_create",
    targetType: "CoachingSession",
    targetId: ids[0] ?? "",
    changes: {
      trainerId: v.trainerId,
      interventionSlug: v.interventionSlug,
      nbSeances: ids.length,
      clientId: clientIdEffectif ?? null,
      devisId: v.devisId ?? null,
    },
    session,
  });

  return { data: { ids, count: ids.length } };
}
