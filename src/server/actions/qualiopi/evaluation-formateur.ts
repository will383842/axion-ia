/**
 * L'évaluation des acquis, saisie par le FORMATEUR — indicateur 11.
 *
 * ## Le défaut que ce module ferme
 *
 * 🔴 `D4-1-C` (audit E2E 2026-08-20). L'évaluation des acquis est **l'acte
 * propre du formateur** : c'est lui qui observe, lui qui note. Elle n'existait
 * sur **aucun de ses écrans**.
 *
 * Le moteur, lui, était complet — modèle, calcul du score et du niveau, garde
 * chronologique, traçabilité de l'auteur. Mais la seule porte
 * (`createEvaluationAcquisAction`) exige une session **admin**, et le formateur
 * s'authentifie autrement. Il ne pouvait donc pas l'appeler.
 *
 * C'est, une fois de plus, le patron le plus fréquent de cet audit : l'outil est
 * écrit, le câblage manque.
 *
 * ## La ligne de partage, et elle n'est pas cosmétique
 *
 * 🔑 Le formateur **ÉVALUE** — il saisit la grille, note chaque compétence,
 * écrit ses observations. C'est un acte pédagogique.
 *
 * L'organisme **ATTESTE** — il émet la pièce qui vaut preuve. C'est un acte
 * engageant, gardé par `requireHabilitation("attester")`, et il le reste.
 *
 * Autrement dit : cette action produit la MATIÈRE de l'attestation, jamais
 * l'attestation. Le `reussite` calculé ici est une mesure, pas une décision —
 * la décision d'émettre reste à un rôle habilité, qui voit la mesure avant de
 * trancher.
 *
 * ## Habilitation
 *
 * Session formateur valide **et** appartenance à la session
 * (`estMembreDeSession` — la fonction partagée, pas une règle qui lui
 * ressemble). Principal ou co-formateur : évaluer est un acte COLLECTIF de la
 * session, contrairement à la signature de la lettre de mission qui nomme une
 * personne.
 *
 * ⚠️ Et l'inscription doit appartenir à CETTE session. Sans ce contrôle, un
 * formateur légitime sur la session A pourrait évaluer un stagiaire de la
 * session B en changeant un identifiant.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFormateurAction } from "@/server/formateur/guard";
import { estMembreDeSession } from "@/server/formateur/membre-de-session";
import { createEvaluation } from "@/server/qualiopi/evaluations/evaluations-service";

const schema = z.object({
  sessionId: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  type: z.enum(["initiale", "intermediaire", "finale"]),
  dateEvaluation: z.string().min(8),
  competences: z
    .array(
      z.object({
        libelle: z.string().trim().min(1).max(300),
        note: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        observations: z.string().trim().max(2000).optional(),
        objectifRef: z.string().trim().max(120).optional(),
      }),
    )
    .min(1)
    .max(50),
  recommandations: z.string().trim().max(2000).optional(),
});

export type EvaluationFormateurResultat = { ok: true; id: string } | { ok: false; message: string };

export async function enregistrerEvaluationFormateurAction(input: {
  sessionId: string;
  enrollmentId: string;
  type: "initiale" | "intermediaire" | "finale";
  dateEvaluation: string;
  competences: Array<{
    libelle: string;
    note?: 1 | 2 | 3;
    observations?: string;
    objectifRef?: string;
  }>;
  recommandations?: string;
}): Promise<EvaluationFormateurResultat> {
  const formateur = await requireFormateurAction();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Grille incomplète : chaque compétence doit porter un libellé." };
  }
  const v = parsed.data;

  if (!(await estMembreDeSession(v.sessionId, formateur.trainerId))) {
    return {
      ok: false,
      message: "Vous n'intervenez pas sur cette session : elle ne vous est pas ouverte.",
    };
  }

  // 🔴 L'inscription doit appartenir à CETTE session. Vérifier l'appartenance du
  // formateur à la session ne suffit pas : sans ce second contrôle, changer
  // `enrollmentId` évaluerait le stagiaire d'une session voisine.
  const inscription = await prisma.enrollment.findUnique({
    where: { id: v.enrollmentId },
    select: { sessionId: true },
  });
  if (inscription === null || inscription.sessionId !== v.sessionId) {
    // ⚠️ Même message dans les deux cas : le formateur n'a pas à apprendre qu'un
    // identifiant existe s'il désigne un stagiaire qui n'est pas le sien.
    return { ok: false, message: "Ce stagiaire n'est pas inscrit à cette session." };
  }

  try {
    const created = await createEvaluation({
      enrollmentId: v.enrollmentId,
      type: v.type,
      dateEvaluation: v.dateEvaluation,
      competences: v.competences as Array<{
        libelle: string;
        note?: 1 | 2 | 3;
        observations?: string;
        objectifRef?: string;
      }>,
      ...(v.recommandations !== undefined ? { recommandations: v.recommandations } : {}),
      // 🔑 `evalueParId` porte le TRAINER, pas un compte admin. La colonne est un
      // UUID sans relation, et son commentaire au schéma dit « Admin/formateur » :
      // c'est ce qui permet de prouver QUI a évalué quand plusieurs formateurs
      // interviennent — sans effet avec un formateur unique, déterminant dès
      // qu'ils sont deux.
      evalueParId: formateur.trainerId,
    });
    return { ok: true, id: created.id };
  } catch (err) {
    // Le service porte des gardes métier qui parlent : date antérieure au début
    // de session (indicateur 4), inscription introuvable. Leur message est utile
    // au formateur — le remplacer par un « erreur » opaque le laisserait sans
    // rien à corriger.
    return {
      ok: false,
      message: err instanceof Error ? err.message : "L'évaluation n'a pas pu être enregistrée.",
    };
  }
}
