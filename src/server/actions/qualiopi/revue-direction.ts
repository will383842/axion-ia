/**
 * Qualiopi — Server Actions Revue de direction (T12 + LOT 4).
 *
 * creerRevueDirectionAction     : crée la revue annuelle avec snapshot indicateurs.
 * updateRevueDirectionAction    : met à jour une revue existante.
 * reporterEnRevueDirectionAction: reporte un constat/verbatim dans le plan
 *                                 d'actions de la revue de l'année courante
 *                                 (créée en brouillon si absente) — LOT 4.
 *
 * off.32 — indicateur 32 (NC majeure). Snapshot indicateurs capturé à la création.
 */

"use server";

import { z } from "zod";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerRevue,
  updateRevue,
  reporterConstatRevue,
  getRevueParId,
} from "@/server/qualiopi/registres/revue-direction-service";
import {
  evaluerCouvertureOff32,
  normaliserPlanActions,
} from "@/server/qualiopi/revues/plan-actions";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les TROIS statuts d'une revue de direction, et rien d'autre.
 *
 * 🔴 2026-08-23. C'était `z.string().max(20).optional()` : n'importe quelle
 * chaîne de vingt caractères passait. L'écran n'a jamais proposé que ces trois
 * valeurs, mais l'action, elle, ne les imposait pas — et le spec de l'action
 * écrivait lui-même `statut: "finalisee"`, un statut qui n'existe nulle part
 * ailleurs : ni à l'écran, ni dans le libellé des exports, ni dans la règle de
 * couverture (`statut: "validee"`). Une revue « finalisée » ne couvrait rien,
 * et personne n'était prévenu.
 */
const STATUTS_REVUE = ["brouillon", "validee", "archivee"] as const;
const statutRevueSchema = z.enum(STATUTS_REVUE);

const creerRevueDirectionSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
  dateRevue: z.coerce.date(),
  participants: z.array(z.unknown()).optional(),
  decisions: z.array(z.unknown()).optional(),
  planActions: z.array(z.unknown()).optional(),
  statut: statutRevueSchema.optional(),
});

const updateRevueDirectionSchema = z.object({
  id: z.string().uuid(),
  dateRevue: z.coerce.date().optional(),
  participants: z.array(z.unknown()).optional(),
  decisions: z.array(z.unknown()).optional(),
  planActions: z.array(z.unknown()).optional(),
  statut: statutRevueSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Garde de validation — « validee » est un acte qui verdit une NC majeure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne le message de refus si l'état donné ne peut pas être déclaré
 * « validée », `null` s'il le peut.
 *
 * Le verdict est délégué à `evaluerCouvertureOff32` — le SEUL prédicat de
 * couverture d'off.32. Un prédicat recopié ici diverge : ce dépôt l'a payé
 * quatre fois. Les preuves rendues par le prédicat servent directement de
 * message d'erreur, donc l'écran de saisie et la matrice de conformité disent
 * littéralement la même chose sur la même revue.
 */
function refuserValidation(etat: {
  annee: number;
  participants: unknown;
  decisions: unknown;
  planActions: unknown;
}): string | null {
  const verdict = evaluerCouvertureOff32(etat, new Date());
  if (verdict.couvert) return null;
  return (
    "Cette revue ne peut pas être déclarée « validée » : elle ne prouve pas " +
    "l'indicateur 32 (NC majeure). " +
    verdict.manques.join(" · ")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée la revue de direction d'une année.
 * Génère automatiquement un snapshot des indicateurs via le service.
 * Lève si une revue existe déjà pour l'année (contrainte @unique sur `annee`).
 */
export async function creerRevueDirectionAction(input: {
  annee: number;
  dateRevue: Date;
  participants?: unknown[];
  decisions?: unknown[];
  planActions?: unknown[];
  statut?: string;
}): Promise<ActionResult<{ id: string; annee: number }>> {
  const session = await requireAdminWrite();
  const parsed = creerRevueDirectionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Même garde qu'à la mise à jour : on ne CRÉE pas non plus une revue déjà
  // « validée » qui ne prouverait rien. L'écran de création ne propose pas le
  // statut — mais l'action, elle, l'accepte, et c'est par là qu'un script ou un
  // seed verdirait un super-indicateur sans que personne ne l'ait décidé.
  if (v.statut === "validee") {
    const refus = refuserValidation({
      annee: v.annee,
      participants: v.participants ?? [],
      decisions: v.decisions ?? [],
      planActions: v.planActions ?? [],
    });
    if (refus !== null) return { error: refus };
  }

  let revue: { id: string; annee: number };
  try {
    revue = await creerRevue(v.annee, {
      dateRevue: v.dateRevue,
      ...(v.participants !== undefined ? { participants: v.participants } : {}),
      ...(v.decisions !== undefined ? { decisions: v.decisions } : {}),
      // Le plan d'actions est NORMALISÉ avant écriture : ce qui entre en base a la
      // forme que le moteur de conformité relit (responsable · échéance · statut ·
      // clôture). Sans cela, chaque écran écrirait sa propre forme et le suivi ne
      // serait mesurable nulle part.
      ...(v.planActions !== undefined ? { planActions: normaliserPlanActions(v.planActions) } : {}),
      ...(v.statut !== undefined ? { statut: v.statut } : {}),
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") return { error: `Une revue de direction existe déjà pour ${v.annee}` };
    return { error: "Erreur lors de la création de la revue de direction" };
  }

  await logQualiopiActivity({
    action: "qualiopi.revue_direction.create",
    targetType: "RevueDirection",
    targetId: revue.id,
    changes: { annee: v.annee, dateRevue: v.dateRevue, statut: v.statut },
    session,
  });

  return { data: { id: revue.id, annee: revue.annee } };
}

/**
 * Met à jour une revue de direction existante (participants, décisions, plan, statut).
 *
 * ⚠️ Passer une revue en « validee » **verdit un super-indicateur** (32, NC
 * majeure). Ce geste est donc opposé à l'état RÉSULTANT de la revue — ce que la
 * mise à jour apporte, complété par ce qui est déjà en base pour les champs
 * qu'elle ne renvoie pas. Une revue sans participants, sans décisions ou dont le
 * plan d'actions ne porte ni responsable ni échéance ne peut pas être validée :
 * l'erreur nomme précisément ce qui manque, au moment du clic, plutôt que de
 * laisser l'écart se découvrir le jour J sur un tableau vert.
 */
export async function updateRevueDirectionAction(input: {
  id: string;
  dateRevue?: Date;
  participants?: unknown[];
  decisions?: unknown[];
  planActions?: unknown[];
  statut?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateRevueDirectionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  const planActions =
    fields.planActions !== undefined ? normaliserPlanActions(fields.planActions) : undefined;

  if (fields.statut === "validee") {
    const stockee = await getRevueParId(id);
    const refus = refuserValidation({
      annee: stockee?.annee ?? new Date().getFullYear(),
      participants: fields.participants ?? stockee?.participants ?? [],
      decisions: fields.decisions ?? stockee?.decisions ?? [],
      planActions: planActions ?? stockee?.planActions ?? [],
    });
    if (refus !== null) return { error: refus };
  }

  await updateRevue(id, {
    ...(fields.dateRevue !== undefined ? { dateRevue: fields.dateRevue } : {}),
    ...(fields.participants !== undefined ? { participants: fields.participants } : {}),
    ...(fields.decisions !== undefined ? { decisions: fields.decisions } : {}),
    ...(planActions !== undefined ? { planActions } : {}),
    ...(fields.statut !== undefined ? { statut: fields.statut } : {}),
  });

  await logQualiopiActivity({
    action: "qualiopi.revue_direction.update",
    targetType: "RevueDirection",
    targetId: id,
    changes: { statut: fields.statut },
    session,
  });

  return { data: { id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// reporterEnRevueDirectionAction (LOT 4)
// ─────────────────────────────────────────────────────────────────────────────

const reporterEnRevueDirectionSchema = z.object({
  texte: z.string().min(1).max(4000),
  source: z.string().min(1).max(300),
});

/**
 * Reporte un constat (verbatim satisfaction, écart, décision à instruire) dans
 * le plan d'actions de la revue de direction de l'ANNÉE COURANTE. La revue est
 * créée en brouillon (avec snapshot indicateurs) si elle n'existe pas encore.
 */
export async function reporterEnRevueDirectionAction(input: {
  texte: string;
  source: string;
}): Promise<ActionResult<{ id: string; annee: number; creee: boolean }>> {
  const session = await requireAdminWrite();
  const parsed = reporterEnRevueDirectionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const annee = new Date().getFullYear();

  let resultat: { id: string; annee: number; creee: boolean };
  try {
    resultat = await reporterConstatRevue(annee, { texte: v.texte, source: v.source });
  } catch {
    return { error: "Erreur lors du report en revue de direction" };
  }

  await logQualiopiActivity({
    action: "qualiopi.revue_direction.reporter_constat",
    targetType: "RevueDirection",
    targetId: resultat.id,
    changes: { annee, source: v.source, texte: v.texte.slice(0, 500), creee: resultat.creee },
    session,
  });

  return { data: resultat };
}
