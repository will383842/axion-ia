// Formateurs indépendants — « Présentation faite le … » (lot L12i, E12c).
//
// Acte ENGAGEANT (`remunerer_formateur`) : il écrit des honoraires dus. Deux
// temps, comme tout geste d'argent du chantier :
//   - sans `confirmer=oui` : l'APERÇU (montants, mention de TVA, échéance, ou le
//     motif du refus), rien n'est écrit ;
//   - avec `confirmer=oui` : l'écriture, sous verrous, dans une transaction.
//
// 🔴 Livré ÉTEINT : interrupteur `formateurs.presentation_payee` absent ou coupé
// = refus, sans rien lire d'autre. La présentation reste alors payée par le
// chemin « facture reçue » existant, exactement comme avant L12i.

"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { lireContratCadreSigne } from "@/server/qualiopi/formateurs-independants/contrat-cadre-en-vigueur";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { LIBELLE_REFUS_PRESENTATION } from "@/server/qualiopi/formateurs-independants/paiement/presentation-methode";
import {
  ecrirePresentationMethode,
  lireVerdictPresentation,
} from "@/server/qualiopi/formateurs-independants/paiement/presentation-methode-base";
import { DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION } from "@/server/qualiopi/remuneration/verrou-remuneration";

type ActionResult<T> = { data: T } | { error: string };

const schema = z.object({
  trainerId: z.string().uuid(),
  jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confirmer: z.literal("oui").optional(),
});

export type ResultatPresentation =
  | {
      readonly etape: "apercu";
      readonly totalHtCents: number;
      readonly tvaCents: number;
      readonly totalTtcCents: number;
      readonly mentionTva: string;
      readonly echeance: string;
    }
  | { readonly etape: "ecrite"; readonly statementId: string; readonly totalTtcCents: number };

const MESSAGES_SCHEMA: Record<string, string> = {
  introuvable: "Formateur introuvable.",
  contract_non_fait:
    "Le paiement par mission n'est pas encore ouvert en base (relevé mensuel unique par mois).",
  schema_hors_mission_absent:
    "La base n'accepte pas encore une ligne d'honoraires sans session : présentation non enregistrée.",
  releve_hors_mission_existant:
    "Un relevé hors mission existe déjà ce mois-ci pour ce formateur : vérifiez-le avant toute nouvelle écriture.",
};

function messageRefus(motif: string): string {
  return (
    (LIBELLE_REFUS_PRESENTATION as Record<string, string>)[motif] ??
    MESSAGES_SCHEMA[motif] ??
    "Présentation refusée."
  );
}

export async function enregistrerPresentationMethodeAction(
  input: z.input<typeof schema>,
): Promise<ActionResult<ResultatPresentation>> {
  let userId: string;
  try {
    userId = (await requireHabilitation("remunerer_formateur")).userId;
  } catch {
    return { error: "Cet acte engage l'organisme : à faire par un responsable habilité." };
  }
  if (!(await interrupteurAllume("presentation_payee"))) {
    return { error: "La présentation de la méthode payée n'est pas encore ouverte." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides." };
  const v = parsed.data;

  const contrat = await lireContratCadreSigne(v.trainerId);
  const demande = {
    trainerId: v.trainerId,
    jour: v.jour,
    contratSigneLe: contrat?.signeLe ?? null,
    maintenant: new Date(),
    userId,
  };

  if (v.confirmer !== "oui") {
    const verdict = await lireVerdictPresentation(prisma, demande);
    if (verdict === null) return { error: messageRefus("introuvable") };
    if (!verdict.ok) return { error: messageRefus(verdict.motif) };
    return {
      data: {
        etape: "apercu",
        totalHtCents: verdict.calcul.totalHtCents,
        tvaCents: verdict.calcul.tvaCents,
        totalTtcCents: verdict.calcul.totalTtcCents,
        mentionTva: verdict.calcul.mentionTva,
        echeance: verdict.calcul.echeance,
      },
    };
  }

  try {
    const r = await prisma.$transaction(
      (tx) => ecrirePresentationMethode(tx, demande),
      DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION,
    );
    if (r.issue === "refuse") return { error: messageRefus(r.motif) };
    return {
      data: { etape: "ecrite", statementId: r.statementId, totalTtcCents: r.totalTtcCents },
    };
  } catch (err) {
    // L'index unique « une présentation par formateur » : un double clic qui aurait
    // franchi les verrous est refusé ici, jamais payé deux fois.
    if ((err as { code?: unknown })?.code === "P2002") return { error: messageRefus("deja_payee") };
    Sentry.captureException(err, { tags: { action: "enregistrerPresentationMethode" } });
    return { error: "La présentation n'a pas été enregistrée (erreur technique)." };
  }
}
