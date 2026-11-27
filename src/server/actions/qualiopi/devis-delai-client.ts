"use server";

/**
 * « Le client demande un délai » : pas de rappel de relance avant la date choisie.
 *
 * Le journal EST l'état du délai : il est écrit dans la transaction, jamais par
 * le journal « au mieux » (qui avale les erreurs). Aucun e-mail, aucune file : rien ne part vers le client.
 *
 * Aucun verrou : deux clics ou deux onglets écrivent deux entrées, la plus récente gagne ; un
 * changement de statut pendant l'écriture est sans effet (tous les signaux exigent `envoye`).
 *
 * Droits : `requireAdminWrite`, comme « Reporter 7 j » du hub et « Préparer une relance » : le
 * délai n'engage l'organisme envers personne.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { donneesJournalQualiopi, requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { lireJourIso, minuitParisUtc } from "@/server/qualiopi/devis/date-validite";
import {
  ACTION_DELAI_CLIENT_DEMANDE,
  ACTION_DELAI_CLIENT_LEVE,
  CODES_ALERTES_SUSPENDUES_PAR_DELAI,
  bornesDelaiClient,
  debutDeJourneeParis,
  delaisClientActifs,
} from "@/server/qualiopi/devis/delai-client";
import { pasSigneParLeClient } from "@/server/qualiopi/devis/pas-signe-par-le-client";

type ActionResult<T> = { data: T } | { error: string };

const entreeSchema = z.object({
  devisId: z.string().uuid(),
  jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const leverSchema = z.object({ devisId: z.string().uuid() });

/** `AAAA-MM-JJ` → `JJ/MM/AAAA`. */
function lisible(jour: string): string {
  const [y, m, d] = jour.split("-");
  return `${d}/${m}/${y}`;
}

export async function demanderDelaiClientAction(input: {
  devisId: string;
  jour: string;
}): Promise<ActionResult<{ jourLisible: string }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant la construction du site." };
  }
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { error: "Vos droits ne permettent pas d'enregistrer un délai." };
  }

  const p = entreeSchema.safeParse(input);
  if (!p.success) return { error: "Date invalide." };
  const { devisId, jour: jourTexte } = p.data;
  const jour = lireJourIso(jourTexte);
  if (!jour) return { error: "Date invalide." };

  const maintenant = new Date();
  const lu = await prisma.devis.findUnique({
    where: { id: devisId },
    select: { statut: true, numero: true, dateValidite: true },
  });
  if (!lu) return { error: "Ce devis est introuvable." };
  if (lu.statut !== "envoye" || lu.dateValidite.getTime() < maintenant.getTime()) {
    return { error: "Seul un devis envoyé et encore valable peut recevoir un délai." };
  }

  const nonSigne = await prisma.devis.count({ where: { id: devisId, ...pasSigneParLeClient } });
  if (nonSigne === 0) {
    return {
      error:
        "Le client a déjà signé ce devis : il reste à le contresigner, aucun délai n'est utile.",
    };
  }

  const bornes = bornesDelaiClient(maintenant, lu.dateValidite);
  if (!bornes) {
    return {
      error:
        "La validité de ce devis se termine aujourd'hui : prolongez-la d'abord pour accorder un délai.",
    };
  }
  if (jourTexte < bornes.min || jourTexte > bornes.max) {
    const jourValidite = new Date(minuitParisUtc(lu.dateValidite)).toISOString().slice(0, 10);
    const suite =
      bornes.max === jourValidite
        ? ` (la validité du devis s'arrête le ${lisible(jourValidite)})`
        : "";
    return {
      error: `Choisissez une date entre le ${lisible(bornes.min)} et le ${lisible(bornes.max)}${suite}.`,
    };
  }

  const finDelai = debutDeJourneeParis(jour.y, jour.mo, jour.d);
  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.alerteSysteme.updateMany({
        where: {
          code: { in: [...CODES_ALERTES_SUSPENDUES_PAR_DELAI] },
          cibleId: devisId,
          resolue: false,
        },
        data: { resolue: true, resolueAt: maintenant },
      });
      await tx.activityLog.create({
        data: await donneesJournalQualiopi({
          action: ACTION_DELAI_CLIENT_DEMANDE,
          targetType: "Devis",
          targetId: devisId,
          changes: {
            numero: lu.numero,
            jour: jourTexte,
            finDelai: finDelai.toISOString(),
            dateValidite: lu.dateValidite.toISOString(),
            alertesRefermees: count,
          },
          session,
        }),
      });
    });
  } catch (err) {
    console.error("[devis-delai-client] enregistrement impossible", err);
    return { error: "Le délai n'a pas pu être enregistré. Réessayez." };
  }

  return { data: { jourLisible: lisible(jourTexte) } };
}

export async function leverDelaiClientAction(input: {
  devisId: string;
}): Promise<ActionResult<{ leve: true }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant la construction du site." };
  }
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { error: "Vos droits ne permettent pas de lever un délai." };
  }
  const p = leverSchema.safeParse(input);
  if (!p.success) return { error: "Devis invalide." };
  const { devisId } = p.data;

  // Sans `.catch` : ici une erreur de lecture doit se voir.
  const actifs = await delaisClientActifs(prisma, new Date(), [devisId]);
  const fin = actifs.get(devisId);
  if (!fin) return { error: "Aucun délai en cours pour ce devis." };

  try {
    await prisma.activityLog.create({
      data: await donneesJournalQualiopi({
        action: ACTION_DELAI_CLIENT_LEVE,
        targetType: "Devis",
        targetId: devisId,
        changes: { finDelaiAvant: fin.toISOString() },
        session,
      }),
    });
  } catch (err) {
    console.error("[devis-delai-client] levée impossible", err);
    return { error: "Le délai n'a pas pu être levé. Réessayez." };
  }
  return { data: { leve: true } };
}
