// Banc @formateurs — Qualiopi ind. 21 : verse, pour un indépendant du banc, ce que la
// garde d'activation exige désormais (entretien, mise en situation, décision « habilité »
// sur une formation, formation à la méthode suivie) et, pour la règle PROVISOIRE, le CV
// validé et le contrôle du registre vert sur le SIRET de la fiche.
//
// Écrit en base directement (fixture de banc, hors `src/**`) : l'écran de la console est
// couvert par les tests unitaires de `evaluation-competences/`. La formation de la
// décision n'est jamais effacée : la table est en AJOUT SEUL (clé `Restrict`), et la base
// du banc est jetée à la fin du run.

import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../../prisma/generated/client/index.js";

import {
  BLOCS_MISE_EN_SITUATION,
  CRITERES_ENTRETIEN,
  VERSION_CONFIGURATION_EVALUATION,
} from "@/server/qualiopi/formateurs-independants/evaluation-competences/configuration";

type Db = Pick<
  PrismaClient,
  | "offreSite"
  | "formation"
  | "evaluationCompetenceFormateur"
  | "trainerDocument"
  | "verificationRegistreSousTraitance"
>;

const notes = (codes: ReadonlyArray<{ code: string }>) =>
  Object.fromEntries(codes.map((c) => [c.code, 5]));

/** Une formation propre à la décision du banc, jamais effacée. */
async function formationDeLaDecision(db: Db): Promise<string> {
  const cle = randomUUID().slice(0, 8);
  const offre = await db.offreSite.create({
    data: {
      code: `BANC-Q21-${cle}`,
      titreFr: "Offre du banc d'essai (ind. 21)",
      slug: `banc-offre-q21-${cle}`,
      formatPedagogique: "collectif_1jour",
      publicViseFr: "Équipes administratives (banc).",
      dureeHeuresMin: 7,
      dureeHeuresMax: 7,
      tarifType: "sur_devis",
      promessePrincipaleFr: "Offre fictive du banc @formateurs.",
      anglePedagogiqueFr: "Banc d'essai.",
    },
    select: { id: true },
  });
  const f = await db.formation.create({
    data: {
      numero: `BANC-Q21-${cle}`,
      titre: "Formation du banc d'essai (ind. 21)",
      slug: `banc-formation-q21-${cle}`,
      offreSiteId: offre.id,
      dureeHeures: 7,
      statut: "actif",
    },
    select: { id: true },
  });
  return f.id;
}

/**
 * Verse les trois grilles et la formation à la méthode. `formationId` absent : une
 * formation dédiée est créée. `provisoire` : ajoute le CV validé et le contrôle du
 * registre vert sur `siret` (la règle provisoire les exige ; la règle complète les lit
 * ailleurs, dans le dossier).
 */
export async function verserCompetencesDuBanc(
  db: Db,
  trainerId: string,
  auteurId: string,
  options: { formationId?: string; provisoire?: { siret: string } } = {},
): Promise<{ formationId: string }> {
  const formationId = options.formationId ?? (await formationDeLaDecision(db));
  const commun = {
    trainerId,
    version: VERSION_CONFIGURATION_EVALUATION,
    auteurId,
    auteurRole: "admin",
  };
  const entretien = await db.evaluationCompetenceFormateur.create({
    data: { ...commun, nature: "entretien", notes: notes(CRITERES_ENTRETIEN) },
    select: { id: true },
  });
  const mes = await db.evaluationCompetenceFormateur.create({
    data: { ...commun, nature: "mise_en_situation", notes: notes(BLOCS_MISE_EN_SITUATION) },
    select: { id: true },
  });
  await db.evaluationCompetenceFormateur.create({
    data: {
      ...commun,
      nature: "decision_habilitation",
      formationId,
      decision: "habilite",
      motif: "Banc d'essai : seuils atteints.",
      entretienId: entretien.id,
      miseEnSituationId: mes.id,
    },
  });
  await db.evaluationCompetenceFormateur.create({
    data: {
      ...commun,
      nature: "formation_methode",
      dateSuivie: new Date(Date.now() - 86_400_000),
    },
  });
  if (options.provisoire) {
    await db.trainerDocument.create({
      data: {
        trainerId,
        type: "cv",
        fichierUrl: "r2://banc/cv.pdf",
        dateEmission: new Date(Date.now() - 30 * 86_400_000),
        statutValidation: "valide",
      },
    });
    await db.verificationRegistreSousTraitance.create({
      data: {
        trainerId,
        verifieAt: new Date(Date.now() - 3_600_000),
        verdict: "vert",
        source: "registre_entreprises+liste_of",
        siret: options.provisoire.siret,
      },
    });
  }
  return { formationId };
}
