// Qualiopi ind. 21 — versement des grilles d'évaluation des compétences pédagogiques
// d'un formateur indépendant, depuis sa fiche console.
//
// Acte ENGAGEANT (`habiliter_formateur`), jugé AVANT toute lecture. L'auteur est
// l'identité de la session, jamais une saisie. Ajout seul : rien ne se modifie ni ne se
// supprime (`evaluation-competences/ecriture.ts`, l'écrivain unique).
//
// Aucun interrupteur : sans ces grilles, aucun indépendant ne peut être activé (garde
// d'activation), l'écran doit donc pouvoir les recevoir.

"use server";

import { z } from "zod";

import { requireHabilitation } from "@/server/actions/qualiopi/_guards";
import {
  ACTE_EVALUATION,
  verserEvaluation,
  type DemandeVersement,
} from "@/server/qualiopi/formateurs-independants/evaluation-competences/ecriture";

type ActionResult = { data: { id: string } } | { error: string };

const note = z.number().int();
const schema = z.discriminatedUnion("nature", [
  z.object({
    nature: z.enum(["entretien", "mise_en_situation"]),
    trainerId: z.string().uuid(),
    notes: z.record(z.string().max(40), note),
    observation: z.string().max(4000).optional(),
  }),
  z.object({
    nature: z.literal("decision_habilitation"),
    trainerId: z.string().uuid(),
    formationId: z.string().uuid(),
    decision: z.string().max(40),
    motif: z.string().max(4000),
  }),
  z.object({
    nature: z.literal("formation_methode"),
    trainerId: z.string().uuid(),
    jour: z.string().max(20),
  }),
]);

export type VersementEvaluationInput = z.input<typeof schema>;

export async function verserEvaluationCompetencesAction(
  input: VersementEvaluationInput,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireHabilitation(ACTE_EVALUATION);
  } catch {
    return { error: "Cet acte engage l'organisme : à faire par un responsable habilité." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides." };
  const { trainerId, ...reste } = parsed.data;
  const r = await verserEvaluation({ trainerId, session, demande: reste as DemandeVersement });
  if (!r.ok) return { error: r.message };
  return { data: { id: r.id } };
}
