/**
 * Hub facturation — PRÉPARATION de l'e-mail d'envoi d'une facture (PDF joint).
 * Service PUR : aucun `"use server"`, aucun `next/headers`, aucune garde
 * d'accès, aucun journal.
 *
 * ## Pourquoi ce module existe (2026-09-15)
 *
 * Ce corps vivait dans `envoyerFactureEmailAction` (`actions/qualiopi/
 * facturation-emails.ts`), derrière le bouton « Envoyer par email » de la fiche
 * facture. La facture d'une session réalisée est désormais générée
 * automatiquement le lendemain de sa fin, et son e-mail préparé dans la foulée
 * par le cron du worker (`facture-auto-session.ts`), qui tourne HORS de Next.
 * Même extraction, même raison que `facture-formation-emission.ts` : UN chemin,
 * deux enveloppes. Le code est déplacé tel quel ; le comportement du bouton est
 * épinglé par `facturation-emails-facture.spec.ts`, écrit et passé au vert
 * AVANT le déplacement.
 *
 * ## 🛑 `exigerValidation` — ordre permanent de Will
 *
 * Rien ne part à un client sans sa validation. Le gabarit `facture-envoi` est
 * en mode `validation` par défaut (`outbox-policy.ts`), MAIS une règle
 * d'automatisation par client peut le passer en `auto`. Sur le chemin du
 * bouton, c'est un choix humain déjà exprimé : on ne le contredit pas. Sur le
 * chemin automatique, personne n'a rien exprimé — l'appelant passe
 * `exigerValidation: true`, et `enqueueEmail` gare l'e-mail quoi que disent les
 * règles.
 */

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { documentPdfKey } from "@/lib/r2-storage";
import { resteDuNetCents } from "@/server/qualiopi/crm/clients";

const eur = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const dateFr = (d: Date): string => d.toLocaleDateString("fr-FR");

export interface PreparerEnvoiFactureInput {
  factureId: string;
  /** Destinataire explicite ; défaut = email de contact du client CRM. */
  to?: string | undefined;
  messagePersonnalise?: string | undefined;
}

export interface EnvoiFacturePrepare {
  enqueued: boolean;
  garePourValidation: boolean;
  to: string;
  numero: string;
  estAvoir: boolean;
  pdfHash: string;
}

/**
 * Met l'e-mail `facture-envoi` en file (ou le gare en validation), PDF joint.
 *
 * ⚠️ L'entrée est supposée VALIDÉE par l'appelant.
 *
 * @param options.exigerValidation  force le garage en « E-mails à valider »,
 *   quelles que soient les règles d'automatisation. Obligatoire sur tout chemin
 *   automatique.
 */
export async function preparerEnvoiFactureEmail(
  input: PreparerEnvoiFactureInput,
  options?: { exigerValidation?: boolean },
): Promise<{ data: EnvoiFacturePrepare } | { error: string }> {
  const facture = await prisma.factureFormation.findUnique({
    where: { id: input.factureId },
    include: {
      client: { select: { raisonSociale: true, contactEmail: true } },
      // Nécessaires au RESTE DÛ NET (voir plus bas) : sans eux, l'e-mail
      // réclamerait le TTC total d'une facture déjà partiellement réglée.
      payments: { select: { amountCents: true, status: true } },
      avoirs: { select: { montantHtCents: true, montantTtcCents: true, statut: true } },
    },
  });
  if (!facture) return { error: "Facture introuvable." };
  if (facture.statut === "brouillon") {
    return { error: "Une facture en brouillon ne s'envoie pas — l'émettre d'abord." };
  }
  if (facture.documentId === null) {
    return { error: "PDF absent : générer le PDF de la facture avant l'envoi." };
  }

  const doc = await prisma.documentGenere.findUnique({
    where: { id: facture.documentId },
    select: { type: true, numero: true, hashSha256: true, createdAt: true },
  });
  if (doc === null) return { error: "Document PDF introuvable." };
  // Clé R2 stable (cf. documents-service/storeAndSignPdf).
  // 🔴 L'année était lue dans le NUMÉRO (`AXI-XXX-YYYY-NNN`) — troisième variante
  // maison de la même clé, et la seule qui ne consultait pas `createdAt`, sur
  // lequel l'écriture partitionne réellement. Une pièce renumérotée ou reprise
  // aurait pointé sur un dossier inexistant, et la facture serait partie sans sa
  // pièce jointe.
  const r2Key = documentPdfKey(doc);

  const to = input.to ?? facture.client?.contactEmail ?? null;
  if (to === null) {
    return { error: "Aucun destinataire : renseigner un email (ou l'email de contact du client)." };
  }

  const estAvoir = facture.avoirDeId !== null;

  // ── Montant réclamé = RESTE DÛ NET, jamais le TTC total ───────────────────
  //
  // 🔴 L'e-mail annonçait le TTC total de la facture. Un client ayant versé son
  // acompte — le cas NORMAL en formation, le mode `acompte_solde` étant le
  // défaut — recevait donc une relance au montant plein, acompte compris. Il en
  // conclut qu'on a perdu son virement ; au mieux il rappelle, au pire il paie
  // deux fois. Même défaut sur une facture partiellement avoirée.
  //
  // La formule vient de `resteDuNetCents` (SSOT de l'encours client, déjà
  // utilisée par la fiche 360°, la fiche facture et la balance âgée) : TTC
  // (repli HT) + avoirs non annulés (négatifs en base) − encaissements
  // `succeeded`. NE PAS la réécrire ici : c'est exactement ainsi que deux
  // montants divergent d'un écran à l'autre.
  //
  // Un AVOIR garde son montant propre : il ne se « reste-dû » pas, il crédite.
  const montantDu = estAvoir
    ? (facture.montantTtcCents ?? facture.montantHtCents)
    : resteDuNetCents({
        statut: facture.statut,
        avoirDeId: facture.avoirDeId,
        montantHtCents: facture.montantHtCents,
        montantTtcCents: facture.montantTtcCents,
        payments: facture.payments,
        avoirs: facture.avoirs,
      });
  const { enqueued, garePourValidation = false } = await enqueueEmail(
    "facture-envoi",
    to,
    "fr",
    {
      clientNom: facture.client?.raisonSociale ?? facture.destinataireNom,
      numero: facture.numero,
      montantLabel: `${eur(montantDu)} TTC`,
      ...(facture.echeanceAt !== null && !estAvoir
        ? { dateEcheanceLabel: dateFr(facture.echeanceAt) }
        : {}),
      estAvoir,
      ...(input.messagePersonnalise !== undefined
        ? { messagePersonnalise: input.messagePersonnalise }
        : {}),
    },
    {
      attachments: [{ filename: `${facture.numero}.pdf`, r2Key }],
      // Voir le commentaire de l'envoi de devis : sans `clientId`, les règles
      // par client sont inertes ; et `enqueued: false` peut signifier « garé ».
      ...(facture.clientId !== null ? { clientId: facture.clientId } : {}),
      sujet: `${estAvoir ? "Avoir" : "Facture"} ${facture.numero} — Axion-IA`,
      // 🛑 Présent SEULEMENT quand l'appelant l'exige : le bouton n'ajoute rien,
      // et son appel reste octet pour octet celui d'avant l'extraction.
      ...(options?.exigerValidation === true ? { exigerValidation: true } : {}),
    },
  );
  if (!enqueued && !garePourValidation) {
    return { error: "File d'envoi indisponible — réessayer." };
  }

  return {
    data: {
      enqueued,
      garePourValidation,
      to,
      numero: facture.numero,
      estAvoir,
      pdfHash: doc.hashSha256,
    },
  };
}
