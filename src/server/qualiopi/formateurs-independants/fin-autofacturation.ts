/**
 * Formateurs indépendants — F46 « Fin de l'autofacturation » (lot E, M14).
 *
 * Le formateur révoque par écrit le mandat qui nous permet d'établir ses factures ; la
 * console enregistre la date de révocation (`updateTrainerFacturationAction`). Ce module
 * lui confirme la demande : à compter d'un mois après (préavis du contrat), il nous
 * adressera ses propres factures.
 *
 * 🔑 Aucun calcul d'argent : une date d'annonce, rien d'autre. Le mandat lui-même est
 * lu par l'émission des autofactures (`mandatEnVigueur`), inchangée.
 *
 * 🔴 ÉTEINT : interrupteur `formateurs.fin_collaboration` coupé = rien n'est lu ni
 * envoyé ; un salarié ou un dirigeant n'a pas de mandat d'autofacturation. Ne lève
 * jamais : la révocation est déjà enregistrée.
 */

import { prisma } from "@/lib/prisma";

import { envoyer } from "./envois";
import { interrupteurAllume } from "./interrupteur-allume";

/** Préavis du contrat : un mois après la révocation écrite. */
export function dateFinAutofacturation(revoqueAt: Date): Date {
  const d = new Date(revoqueAt.getTime());
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

const JOUR_FR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

export async function annoncerFinAutofacturation(p: {
  readonly trainerId: string;
  readonly revoqueAt: Date;
}): Promise<"coupe" | "hors_perimetre" | "envoi" | "erreur"> {
  try {
    if (!(await interrupteurAllume("fin_collaboration"))) return "coupe";
    const t = await prisma.trainer.findUnique({
      where: { id: p.trainerId },
      select: { statut: true, prenom: true, email: true },
    });
    if (t === null || t.statut !== "sous_traitant") return "hors_perimetre";
    const jour = p.revoqueAt.toISOString().slice(0, 10).replace(/-/g, "");
    await envoyer({
      gabarit: "formateur-fin-autofacturation",
      destinataire: t.email,
      entityType: "Trainer",
      entityId: p.trainerId,
      jobId: `fi-fin-autofacturation-${p.trainerId}-${jour}`,
      payload: {
        prenom: t.prenom,
        valeurs: { "date, un mois après": JOUR_FR.format(dateFinAutofacturation(p.revoqueAt)) },
      },
    });
    return "envoi";
  } catch {
    return "erreur";
  }
}
