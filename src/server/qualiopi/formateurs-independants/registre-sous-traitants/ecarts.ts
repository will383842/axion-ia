/**
 * Qualiopi ind. 27 — le CONTRÔLE À PREUVES tracé (contrôle de chaque mission, revue
 * complète annuelle) et ses suites (règles : `ecarts-regles.ts`, seuils :
 * `controles.config.ts` et `reglages.ts`).
 *
 * - La liste cochée est FIGÉE sur la trace (`preuves`) ; le résultat se déduit d'elle,
 *   il ne se saisit pas.
 * - Écart MAJEUR : le sous-traitant est SUSPENDU (une suspension datée, motivée par les
 *   preuves manquantes) ; la garde de mission refuse ses nouvelles missions jusqu'à la
 *   levée, décision motivée prise en console (`leverSuspension`).
 * - Écart MINEUR : un plan de correction à J+`delaiCorrectionJours` ; l'alerte part à
 *   l'échéance ; la correction se date et se motive (`corrigerEcart`).
 * - Coupé (`formateurs.registre_sous_traitants`) : rien n'est lu ni écrit.
 * - Journal : codes, identifiants et compteurs ; JAMAIS un motif ni un libellé libre.
 *
 * Module neutre (ni `server-only`, ni Next).
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { parisDateISO } from "@/server/qualiopi/presence/time";

import { interrupteurAllume } from "../interrupteur-allume";

import { preuvesDuControle } from "./controles.config";
import { constaterPreuves, echeanceCorrection } from "./ecarts-regles";
import { lireReglagesInd27 } from "./reglages";
import type { ResultatControle } from "./regles";

export const ACTION_CONTROLE_PREUVES = "qualiopi.registre_sous_traitants.controle_preuves_trace";
export const ACTION_SUSPENSION_LEVEE = "qualiopi.registre_sous_traitants.suspension_levee";
export const ACTION_ECART_CORRIGE = "qualiopi.registre_sous_traitants.ecart_corrige";

const COUPE = "Le registre tenu par l'outil n'est pas encore ouvert (interrupteur coupé).";

export type IssueControlePreuves =
  | {
      readonly ok: true;
      readonly resultat: ResultatControle;
      readonly majeurs: number;
      readonly mineurs: number;
      readonly suspendu?: boolean;
    }
  | { readonly ok: false; readonly refus: string };

export type IssueGesteEcart =
  { readonly ok: true } | { readonly ok: false; readonly refus: string };

export async function tracerControlePreuves(input: {
  readonly trainerId: string;
  readonly code: string;
  /** Contrôle de mission : obligatoire ; revue complète : absente. */
  readonly missionId: string | null;
  readonly cochees: ReadonlyArray<string>;
  readonly motif: string | null;
  readonly faitAt: Date;
  readonly auteurId: string;
  readonly maintenant: Date;
}): Promise<IssueControlePreuves> {
  if (!(await interrupteurAllume("registre_sous_traitants"))) return { ok: false, refus: COUPE };
  const liste = preuvesDuControle(input.code);
  if (liste === null) return { ok: false, refus: "Ce contrôle ne se trace pas par preuves." };
  const parMission = input.code === "controle_mission";
  if (parMission && input.missionId === null) {
    return { ok: false, refus: "Le contrôle de mission exige la mission contrôlée." };
  }
  if (!parMission && input.missionId !== null) {
    return { ok: false, refus: "Seul le contrôle de mission porte une mission." };
  }
  if (
    Number.isNaN(input.faitAt.getTime()) ||
    parisDateISO(input.faitAt) > parisDateISO(input.maintenant)
  ) {
    return { ok: false, refus: "La date du contrôle ne peut pas être dans le futur." };
  }
  const registre = await prisma.registreSousTraitantIndependant.findUnique({
    where: { trainerId: input.trainerId },
    select: { id: true, statut: true },
  });
  if (registre === null) return { ok: false, refus: "Ce formateur n'est pas au registre." };
  if (input.missionId !== null) {
    // La mission doit être celle de CE formateur : jamais la trace d'un autre dossier.
    const mission = await prisma.missionFormateur.findFirst({
      where: { id: input.missionId, trainerId: input.trainerId },
      select: { id: true },
    });
    if (mission === null)
      return { ok: false, refus: "Cette mission n'est pas celle du formateur." };
  }
  const reglages = await lireReglagesInd27();
  const constat = constaterPreuves(liste, input.cochees);
  const motif = input.motif?.trim() ?? "";
  const suspendre = constat.majeurs.length > 0 && registre.statut !== "sorti";

  const suspendu = await prisma.$transaction(async (tx) => {
    const controle = await tx.controleSousTraitant.create({
      data: {
        registreId: registre.id,
        code: input.code,
        missionId: input.missionId,
        faitAt: input.faitAt,
        auteurId: input.auteurId,
        resultat: constat.resultat,
        motif: motif === "" ? null : motif,
        preuves: constat.preuves.map((p) => ({
          code: p.code,
          gravite: p.gravite,
          fournie: p.fournie,
        })),
      },
      select: { id: true },
    });
    const ecarts = [...constat.majeurs, ...constat.mineurs];
    if (ecarts.length > 0) {
      await tx.ecartSousTraitant.createMany({
        data: ecarts.map((p) => ({
          registreId: registre.id,
          controleId: controle.id,
          preuveCode: p.code,
          gravite: p.gravite,
          constateAt: input.maintenant,
          echeanceCorrectionAt:
            p.gravite === "mineur" ? echeanceCorrection(input.maintenant, reglages) : null,
        })),
      });
    }
    if (!suspendre) return false;
    const enCours = await tx.suspensionSousTraitant.findFirst({
      where: { registreId: registre.id, leveeAt: null },
      select: { id: true },
    });
    if (enCours !== null) return true;
    await tx.suspensionSousTraitant.create({
      data: {
        registreId: registre.id,
        controleId: controle.id,
        suspenduAt: input.maintenant,
        suspenduParId: input.auteurId,
        motif:
          `Écart majeur — preuve(s) manquante(s) : ${constat.majeurs.map((p) => p.libelle).join(" ; ")}` +
          (motif === "" ? "" : `. ${motif}`),
      },
      select: { id: true },
    });
    await tx.registreSousTraitantIndependant.update({
      where: { id: registre.id },
      data: { statut: "suspendu", statutDepuis: input.maintenant },
    });
    return true;
  });

  await journaliser(prisma, {
    action: ACTION_CONTROLE_PREUVES,
    targetType: "Trainer",
    targetId: input.trainerId,
    changes: {
      code: input.code,
      resultat: constat.resultat,
      missionId: input.missionId,
      majeurs: constat.majeurs.length,
      mineurs: constat.mineurs.length,
      suspendu,
    },
    session: { userId: input.auteurId },
  });
  return {
    ok: true,
    resultat: constat.resultat,
    majeurs: constat.majeurs.length,
    mineurs: constat.mineurs.length,
    ...(constat.majeurs.length > 0 ? { suspendu } : {}),
  };
}

/**
 * Lève la suspension en cours, par décision MOTIVÉE (qui, quand, pourquoi). Les écarts
 * majeurs ouverts sont clos par la même décision. La ligne redevient active si la fiche
 * l'est ; une fiche désactivée reste suspendue (la synchronisation en décide).
 */
export async function leverSuspension(input: {
  readonly trainerId: string;
  readonly motif: string;
  readonly auteurId: string;
  readonly maintenant: Date;
}): Promise<IssueGesteEcart> {
  if (!(await interrupteurAllume("registre_sous_traitants"))) return { ok: false, refus: COUPE };
  const motif = input.motif.trim();
  if (motif === "") return { ok: false, refus: "La levée d'une suspension exige un motif." };
  const registre = await prisma.registreSousTraitantIndependant.findUnique({
    where: { trainerId: input.trainerId },
    select: {
      id: true,
      statut: true,
      trainer: { select: { actif: true, finCollaborationAt: true } },
    },
  });
  if (registre === null) return { ok: false, refus: "Ce formateur n'est pas au registre." };
  const leve = await prisma.$transaction(async (tx) => {
    const enCours = await tx.suspensionSousTraitant.findFirst({
      where: { registreId: registre.id, leveeAt: null },
      select: { id: true },
    });
    if (enCours === null) return false;
    await tx.suspensionSousTraitant.update({
      where: { id: enCours.id },
      data: { leveeAt: input.maintenant, leveeParId: input.auteurId, motifLevee: motif },
    });
    await tx.ecartSousTraitant.updateMany({
      where: { registreId: registre.id, gravite: "majeur", corrigeAt: null },
      data: { corrigeAt: input.maintenant, corrigeParId: input.auteurId, motifCorrection: motif },
    });
    if (
      registre.statut === "suspendu" &&
      registre.trainer.actif &&
      registre.trainer.finCollaborationAt === null
    ) {
      await tx.registreSousTraitantIndependant.update({
        where: { id: registre.id },
        data: { statut: "actif", statutDepuis: input.maintenant },
      });
    }
    return true;
  });
  if (!leve) return { ok: false, refus: "Aucune suspension en cours pour ce sous-traitant." };
  await journaliser(prisma, {
    action: ACTION_SUSPENSION_LEVEE,
    targetType: "Trainer",
    targetId: input.trainerId,
    changes: { registreId: registre.id },
    session: { userId: input.auteurId },
  });
  return { ok: true };
}

/** Clôt le plan de correction d'un écart MINEUR, par une correction datée et motivée. */
export async function corrigerEcart(input: {
  readonly ecartId: string;
  readonly motif: string;
  readonly auteurId: string;
  readonly maintenant: Date;
}): Promise<IssueGesteEcart> {
  if (!(await interrupteurAllume("registre_sous_traitants"))) return { ok: false, refus: COUPE };
  const motif = input.motif.trim();
  if (motif === "") return { ok: false, refus: "Une correction exige un motif." };
  const issue = await prisma.$transaction(
    async (tx): Promise<IssueGesteEcart & { trainerId?: string }> => {
      const e = await tx.ecartSousTraitant.findUnique({
        where: { id: input.ecartId },
        select: {
          id: true,
          gravite: true,
          corrigeAt: true,
          registre: { select: { trainerId: true } },
        },
      });
      if (e === null) return { ok: false, refus: "Écart introuvable." };
      if (e.gravite !== "mineur") {
        return { ok: false, refus: "Un écart majeur se clôt par la levée de la suspension." };
      }
      if (e.corrigeAt !== null) return { ok: false, refus: "Cet écart est déjà corrigé." };
      await tx.ecartSousTraitant.update({
        where: { id: e.id },
        data: { corrigeAt: input.maintenant, corrigeParId: input.auteurId, motifCorrection: motif },
      });
      return { ok: true, trainerId: e.registre.trainerId };
    },
  );
  if (!issue.ok) return issue;
  await journaliser(prisma, {
    action: ACTION_ECART_CORRIGE,
    targetType: "Trainer",
    targetId: issue.trainerId ?? null,
    changes: { ecartId: input.ecartId },
    session: { userId: input.auteurId },
  });
  return { ok: true };
}
