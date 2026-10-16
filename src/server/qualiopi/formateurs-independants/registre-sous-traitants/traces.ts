/**
 * Qualiopi ind. 27 — TRACER un contrôle fait sur un sous-traitant indépendant : quoi
 * (un code de `controles.config.ts`), quand, qui, avec quel résultat et pourquoi.
 *
 * - Ajout seul : un contrôle ne se corrige pas, on en trace un nouveau.
 * - Un résultat non conforme ou à revoir exige un motif.
 * - Coupé (`formateurs.registre_sous_traitants`) : rien n'est tracé.
 * - Journal : le code et le résultat ; JAMAIS le motif (texte libre).
 *
 * Module neutre (ni `server-only`, ni Next).
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { parisDateISO } from "@/server/qualiopi/presence/time";

import { interrupteurAllume } from "../interrupteur-allume";

import { estCodeControle } from "./controles.config";
import type { ResultatControle } from "./regles";

export const ACTION_CONTROLE_TRACE = "qualiopi.registre_sous_traitants.controle_trace";

export type ResultatTrace = { readonly ok: true } | { readonly ok: false; readonly refus: string };

export async function tracerControle(input: {
  readonly trainerId: string;
  readonly code: string;
  readonly resultat: ResultatControle;
  readonly motif: string | null;
  readonly faitAt: Date;
  readonly auteurId: string;
  readonly maintenant: Date;
}): Promise<ResultatTrace> {
  if (!(await interrupteurAllume("registre_sous_traitants"))) {
    return {
      ok: false,
      refus: "Le registre tenu par l'outil n'est pas encore ouvert (interrupteur coupé).",
    };
  }
  if (!estCodeControle(input.code)) return { ok: false, refus: "Contrôle inconnu." };
  const motif = input.motif?.trim() ?? "";
  if (input.resultat !== "conforme" && motif === "") {
    return { ok: false, refus: "Un contrôle non conforme ou à revoir exige un motif." };
  }
  // Comparé au JOUR de Paris : un contrôle d'aujourd'hui n'est jamais « dans le futur ».
  if (
    Number.isNaN(input.faitAt.getTime()) ||
    parisDateISO(input.faitAt) > parisDateISO(input.maintenant)
  ) {
    return { ok: false, refus: "La date du contrôle ne peut pas être dans le futur." };
  }
  const registre = await prisma.registreSousTraitantIndependant.findUnique({
    where: { trainerId: input.trainerId },
    select: { id: true },
  });
  if (registre === null) return { ok: false, refus: "Ce formateur n'est pas au registre." };
  await prisma.controleSousTraitant.create({
    data: {
      registreId: registre.id,
      code: input.code,
      faitAt: input.faitAt,
      auteurId: input.auteurId,
      resultat: input.resultat,
      motif: motif === "" ? null : motif,
    },
    select: { id: true },
  });
  await journaliser(prisma, {
    action: ACTION_CONTROLE_TRACE,
    targetType: "Trainer",
    targetId: input.trainerId,
    changes: { code: input.code, resultat: input.resultat },
    session: { userId: input.auteurId },
  });
  return { ok: true };
}
