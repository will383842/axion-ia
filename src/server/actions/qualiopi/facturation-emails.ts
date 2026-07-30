/**
 * Hub facturation — envoi MANUEL par email des devis et factures (PDF joint).
 *
 * Règle produit absolue : ces actions ne sont déclenchées QUE par un clic
 * admin — aucun cron, aucun envoi automatique. Le PDF n'est jamais mis dans
 * Redis : on passe la clé R2, le worker email télécharge puis attache.
 *
 * Journal des envois : ActivityLog (SSOT audit existant) via
 * logQualiopiActivity — actions `facturation.email.devis` /
 * `facturation.email.facture` avec destinataire + numéro + hash du PDF.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { publicUrl } from "@/lib/public-url";
import {
  creerTokenDocument,
  TokenDocumentError,
} from "@/server/qualiopi/documents/signature/token-document";

const eur = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const dateFr = (d: Date): string => d.toLocaleDateString("fr-FR");

const EnvoyerDevisSchema = z.object({
  devisId: z.string().uuid(),
  /** Destinataire explicite ; défaut = email de contact du client CRM. */
  to: z.string().email().optional(),
  messagePersonnalise: z.string().max(4000).optional(),
});

export async function envoyerDevisEmailAction(
  rawInput: unknown,
): Promise<
  | { data: { enqueued: boolean; garePourValidation: boolean; to: string; note?: string } }
  | { error: string }
> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = EnvoyerDevisSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  const devis = await prisma.devis.findUnique({
    where: { id: input.devisId },
    include: {
      client: {
        select: {
          raisonSociale: true,
          contactEmail: true,
          contactNom: true,
          // Voir devis.ts : la qualité porte l'opposabilité du pouvoir de signer.
          contactFonction: true,
        },
      },
    },
  });
  if (!devis) return { error: "Devis introuvable." };

  const to = input.to ?? devis.client.contactEmail ?? null;
  if (to === null) {
    return { error: "Aucun destinataire : renseigner un email (ou l'email de contact du client)." };
  }
  // Convention Hub : Devis.fichierPdfUrl contient la CLÉ R2 du PDF (posée par
  // sendDevisAction à la génération). Sans PDF, pas d'envoi — le document
  // joint est la raison d'être de cet email.
  if (devis.fichierPdfUrl === null || devis.fichierPdfUrl === "") {
    return { error: "PDF absent : envoyer le devis (génération du PDF) avant l'envoi par email." };
  }

  // ── Lien de signature : RÉÉMIS, jamais rejoué ──
  //
  // 🔴 On ne stocke que le HASH du jeton : le clair n'existe qu'une fois, au
  // moment de l'émission. Un renvoi ne peut donc pas « retrouver » le lien
  // précédent — il en émet un neuf, ce qui révoque l'ancien (index unique
  // partiel sur (pièce, partie)).
  //
  // ⚠️ Conséquence à connaître : renvoyer l'e-mail INVALIDE le lien déjà reçu
  // par le client. C'est le comportement voulu — deux liens vivants sur une même
  // pièce signifieraient qu'en révoquer un donne une fausse impression de
  // sécurité — mais cela veut dire qu'un renvoi « pour information » casse le
  // lien en cours. Le message de retour le dit à l'admin.
  //
  // ⚠️ Fail-soft : un devis doit pouvoir être renvoyé même si le lien échoue.
  // L'e-mail part alors SANS bouton de signature, et on le DIT.
  let signatureUrl: string | null = null;
  let signatureNote: string | null = null;
  if (devis.documentGenereId !== null && devis.statut === "envoye") {
    try {
      const { token } = await creerTokenDocument({
        documentGenereId: devis.documentGenereId,
        partie: "client",
        signataireNom: devis.client.contactNom ?? devis.client.raisonSociale,
        signataireEmail: to,
        signataireQualite: devis.client.contactFonction,
        borneMetier: devis.dateValidite,
      });
      signatureUrl = publicUrl(`/fr/portail/signer/${token}`).toString();
    } catch (err) {
      signatureNote =
        err instanceof TokenDocumentError
          ? `Lien de signature non émis (${err.motif}) : l'email part sans bouton « signer ».`
          : "Lien de signature non émis : l'email part sans bouton « signer ».";
      console.warn("[envoyerDevisEmailAction] émission du lien de signature échouée", err);
    }
  }

  const { enqueued, garePourValidation = false } = await enqueueEmail(
    "devis-envoi",
    to,
    "fr",
    {
      clientNom: devis.client.raisonSociale,
      numero: devis.numero,
      montantLabel: `${eur(devis.montantTotalHtCents)} HT`,
      dateValiditeLabel: dateFr(devis.dateValidite),
      ...(signatureUrl !== null ? { signatureUrl } : {}),
      ...(input.messagePersonnalise !== undefined
        ? { messagePersonnalise: input.messagePersonnalise }
        : {}),
    },
    {
      attachments: [{ filename: `${devis.numero}.pdf`, r2Key: devis.fichierPdfUrl }],
      // 🔴 Vérification E2E 2026-07-26. Sans `clientId`, aucune règle
      // d'automatisation PAR CLIENT ne peut jamais s'appliquer : le `where` de
      // `resoudreMode` se réduit aux règles globales. L'écran affichait donc des
      // réglages par client structurellement inertes.
      clientId: devis.clientId,
      sujet: `Devis ${devis.numero} — Axion-IA`,
    },
  );

  // 🔴 `enqueued: false` ne signifie PAS un échec : c'est aussi ce que renvoie
  // un email correctement GARÉ en corbeille de validation. Le traiter comme une
  // erreur affichait « File d'envoi indisponible — réessayer » sur un succès,
  // sautait la journalisation, et invitait l'admin à recliquer — chaque reclic
  // créant une ligne de plus en corbeille, sans déduplication.
  if (!enqueued && !garePourValidation) {
    return { error: "File d'envoi indisponible — réessayer." };
  }

  await logQualiopiActivity({
    action: "facturation.email.devis",
    targetType: "Devis",
    targetId: devis.id,
    // ⚠️ Le LIEN n'est jamais journalisé : il vaut signature. Seul le fait
    // qu'il ait été réémis l'est.
    changes: { to, numero: devis.numero, lienSignatureReemis: signatureUrl !== null },
    session,
  });
  return {
    data: {
      enqueued,
      garePourValidation,
      to,
      ...(signatureNote !== null ? { note: signatureNote } : {}),
    },
  };
}

const EnvoyerFactureSchema = z.object({
  factureId: z.string().uuid(),
  to: z.string().email().optional(),
  messagePersonnalise: z.string().max(4000).optional(),
});

export async function envoyerFactureEmailAction(
  rawInput: unknown,
): Promise<
  { data: { enqueued: boolean; garePourValidation: boolean; to: string } } | { error: string }
> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = EnvoyerFactureSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  const facture = await prisma.factureFormation.findUnique({
    where: { id: input.factureId },
    include: { client: { select: { raisonSociale: true, contactEmail: true } } },
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
    select: { type: true, numero: true, hashSha256: true },
  });
  if (doc === null) return { error: "Document PDF introuvable." };
  // Clé R2 stable (cf. documents-service/storeAndSignPdf) :
  // documents/{year}/{type}/{numero}.pdf — l'année vient du numéro AXI-XXX-YYYY-NNN.
  const year = doc.numero.split("-")[2] ?? String(new Date().getFullYear());
  const r2Key = `documents/${year}/${doc.type}/${doc.numero}.pdf`;

  const to = input.to ?? facture.client?.contactEmail ?? null;
  if (to === null) {
    return { error: "Aucun destinataire : renseigner un email (ou l'email de contact du client)." };
  }

  const estAvoir = facture.avoirDeId !== null;
  const montantDu = facture.montantTtcCents ?? facture.montantHtCents;
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
    },
  );
  if (!enqueued && !garePourValidation) {
    return { error: "File d'envoi indisponible — réessayer." };
  }

  await logQualiopiActivity({
    action: "facturation.email.facture",
    targetType: "FactureFormation",
    targetId: facture.id,
    changes: { to, numero: facture.numero, estAvoir, pdfHash: doc.hashSha256 },
    session,
  });
  return { data: { enqueued, garePourValidation, to } };
}
