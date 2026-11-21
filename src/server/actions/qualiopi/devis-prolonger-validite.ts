"use server";

/**
 * Prolonger la validité d'un devis ENVOYÉ ou EXPIRÉ (jamais signé par le client).
 *
 * Ce que fait l'action : poser une nouvelle `dateValidite` (23 h 59 min 59 s, heure de Paris),
 * au plus 90 jours après aujourd'hui, et remettre le devis à « envoyé » s'il était « expiré ».
 *
 * Ce qu'elle ne fait PAS : aucun e-mail, aucun jeton, aucun PDF. Le PDF scellé garde sa date
 * d'origine ; le lien déjà envoyé garde son échéance (le renvoi par e-mail en donne un nouveau).
 *
 * Preuve : `dateValidite` n'est pas dans le sceau. La prolongation n'est donc prouvée que par le
 * journal, écrit DANS la même transaction (ADR 0060 : `donneesJournalQualiopi`, pas le journal
 * « au mieux »). Le statut `envoye` est posé en littéral (règle E0 du cliquet des écrivains) et
 * `emettreDevisEmis` est appelé sur la même transaction : la clé `devis.emis:<id>` évite tout doublon.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { donneesJournalQualiopi, requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { emettreDevisEmis } from "@/server/partners-sync/producteurs/devis";
import {
  formatDateParis,
  devisAEstimationTiersFigee,
} from "@/components/admin/qualiopi/devis-validite";
import {
  finDeJourneeParis,
  JOUR_MS,
  lireJourIso,
  minuitParisUtc,
} from "@/server/qualiopi/devis/date-validite";
import { emailDevisEnAttente } from "@/server/qualiopi/devis/email-devis-en-attente";
import { pasSigneParLeClient } from "@/server/qualiopi/devis/pas-signe-par-le-client";
import { prendreVerrouEnvoiDevis } from "@/server/qualiopi/devis/marquer-devis-envoye";
import {
  SELECT_SIGNATURES_PIECE,
  signatureClientDuDevis,
} from "@/server/qualiopi/devis/signature-client-du-devis";

type ActionResult<T> = { data: T } | { error: string };

const VALIDITE_MAX_JOURS = 90;

const entreeSchema = z.object({
  devisId: z.string().uuid(),
  nouvelleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

class CourseDevisPerdue extends Error {}
/** Refus levé DANS la transaction (annule tout) ; son message est rendu tel quel. */
class RefusDansTransaction extends Error {}

const MSG_VERSION_PLUS_RECENTE =
  "Une version plus récente de ce devis a déjà été envoyée : c'est elle qu'il faut prolonger.";
const MSG_VERROU =
  "Un envoi de ce devis est déjà en cours : réessayez dans un instant. Rien n'a été émis ni envoyé.";
const MSG_EMAIL_ATTENTE =
  "Un e-mail de ce devis attend dans Emails → À valider : validez-le ou refusez-le avant de prolonger.";

/** Chaîne brute imprimée sur le PDF scellé (`metadata.renderData.data.dateValidite`), ou null. */
function dateImprimeeSurPdf(metadata: unknown): string | null {
  const v = (metadata as { renderData?: { data?: { dateValidite?: unknown } } } | null)?.renderData
    ?.data?.dateValidite;
  return typeof v === "string" ? v : null;
}

export async function prolongerValiditeDevisAction(
  input: z.input<typeof entreeSchema>,
): Promise<ActionResult<{ nouvelleDateLisible: string; rouvert: boolean }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant la construction du site." };
  }
  let session;
  try {
    session = await requireHabilitation("conclure_devis");
  } catch {
    return { error: "Vos droits ne permettent pas de prolonger un devis." };
  }

  const p = entreeSchema.safeParse(input);
  if (!p.success) return { error: "Date invalide." };
  const { devisId } = p.data;
  const jour = lireJourIso(p.data.nouvelleDate);
  if (!jour) return { error: "Date invalide." };

  const aujourdhui = minuitParisUtc(new Date());
  const jours = (Date.UTC(jour.y, jour.mo - 1, jour.d) - aujourdhui) / JOUR_MS;
  if (jours < 1 || jours > VALIDITE_MAX_JOURS) {
    const limite = new Date(aujourdhui + VALIDITE_MAX_JOURS * JOUR_MS);
    const jj = String(limite.getUTCDate()).padStart(2, "0");
    const mm = String(limite.getUTCMonth() + 1).padStart(2, "0");
    return {
      error: `Choisissez une date entre demain et le ${jj}/${mm}/${limite.getUTCFullYear()} (${VALIDITE_MAX_JOURS} jours au plus).`,
    };
  }

  const lu = await prisma.devis.findUnique({
    where: { id: devisId },
    select: {
      statut: true,
      numero: true,
      dateValidite: true,
      documentGenereId: true,
      offreSha256: true,
      financementSuggere: true,
      montantOpcoEstimeCents: true,
      documentGenere: {
        select: {
          ...SELECT_SIGNATURES_PIECE.documentGenere.select,
          hashSha256: true,
          metadata: true,
        },
      },
    },
  });
  if (!lu) return { error: "Ce devis est introuvable." };
  if (lu.statut !== "envoye" && lu.statut !== "expire") {
    return { error: "Seul un devis envoyé ou expiré peut être prolongé." };
  }
  if (signatureClientDuDevis(lu).clientASigne) {
    return {
      error:
        "Le client a déjà signé ce devis : contresignez-le, sa date de validité n'a plus d'effet.",
    };
  }
  const successeur = await prisma.devis.findFirst({
    where: { replacesDevisId: devisId, statut: { not: "brouillon" } },
    select: { id: true },
  });
  if (successeur) return { error: MSG_VERSION_PLUS_RECENTE };
  if (lu.documentGenere?.annuleeAt) {
    return { error: "La pièce de ce devis a été annulée : utilisez « Corriger et renvoyer »." };
  }
  if (devisAEstimationTiersFigee(lu)) {
    return {
      error:
        "Ce devis porte une estimation de règlement par un tiers liée à sa date : pour changer la date, utilisez « Corriger et renvoyer ».",
    };
  }
  const nouvelle = finDeJourneeParis(jour.y, jour.mo, jour.d);
  if (nouvelle.getTime() <= lu.dateValidite.getTime()) {
    return {
      error: `La nouvelle date doit être postérieure à la date de validité actuelle (${formatDateParis(lu.dateValidite)}).`,
    };
  }

  const statutLu = lu.statut; // rétréci à « envoye » | « expire » par les gardes ci-dessus
  const rouvert = statutLu === "expire";
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Verrou d'envoi (même clé que l'envoi et le renvoi), tenu jusqu'à la fin de la transaction.
      if (!(await prendreVerrouEnvoiDevis(tx, devisId))) throw new RefusDansTransaction(MSG_VERROU);
      // 2. E-mail en attente, lu DANS la transaction, sous le verrou.
      if (await emailDevisEnAttente(tx, devisId)) throw new RefusDansTransaction(MSG_EMAIL_ATTENTE);
      // 3. Écriture (statut LU dans le `where`, `statut` littéral dans `data`).
      const { count } = await tx.devis.updateMany({
        where: {
          id: devisId,
          // Statut LU (pas une liste) : le journal (`statutAvant`, `rouvert`) dit toujours vrai.
          statut: statutLu,
          dateValidite: lu.dateValidite,
          ...pasSigneParLeClient,
        },
        // `statut` TOUJOURS littéral (règle E0 du cliquet des écrivains).
        data: { dateValidite: nouvelle, statut: "envoye" },
      });
      if (count === 0) throw new CourseDevisPerdue();
      // 4. Re-lecture APRÈS l'écriture : l'écriture a pris le verrou de la ligne ; si l'envoi de la
      // version suivante tenait ce verrou, il est validé maintenant et cette lecture le voit.
      // Avant l'écriture, cette lecture ne prouverait rien. Trouvée : tout est annulé.
      const suivante = await tx.devis.findFirst({
        where: { replacesDevisId: devisId, statut: { not: "brouillon" } },
        select: { id: true },
      });
      if (suivante) throw new RefusDansTransaction(MSG_VERSION_PLUS_RECENTE);
      await emettreDevisEmis(tx, devisId);
      await tx.activityLog.create({
        data: await donneesJournalQualiopi({
          action: "qualiopi.devis.prolonger_validite",
          targetType: "Devis",
          targetId: devisId,
          changes: {
            numero: lu.numero,
            documentGenereId: lu.documentGenereId,
            documentHashSha256: lu.documentGenere?.hashSha256 ?? null,
            ancienneDate: lu.dateValidite.toISOString(),
            nouvelleDate: nouvelle.toISOString(),
            dateImprimeeSurPdf: dateImprimeeSurPdf(lu.documentGenere?.metadata),
            statutAvant: lu.statut,
            rouvert,
          },
          session,
        }),
      });
    });
  } catch (err) {
    if (err instanceof RefusDansTransaction) return { error: err.message };
    if (err instanceof CourseDevisPerdue) {
      return {
        error:
          "Le devis a changé entre-temps (signature du client, autre onglet ?). Rechargez la page.",
      };
    }
    throw err;
  }

  return { data: { nouvelleDateLisible: formatDateParis(nouvelle), rouvert } };
}
