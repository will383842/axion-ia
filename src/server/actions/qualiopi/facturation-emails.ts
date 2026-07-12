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
): Promise<{ data: { enqueued: boolean; to: string } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = EnvoyerDevisSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  const devis = await prisma.devis.findUnique({
    where: { id: input.devisId },
    include: { client: { select: { raisonSociale: true, contactEmail: true } } },
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

  const { enqueued } = await enqueueEmail(
    "devis-envoi",
    to,
    "fr",
    {
      clientNom: devis.client.raisonSociale,
      numero: devis.numero,
      montantLabel: `${eur(devis.montantTotalHtCents)} HT`,
      dateValiditeLabel: dateFr(devis.dateValidite),
      ...(input.messagePersonnalise !== undefined
        ? { messagePersonnalise: input.messagePersonnalise }
        : {}),
    },
    {
      attachments: [{ filename: `${devis.numero}.pdf`, r2Key: devis.fichierPdfUrl }],
    },
  );
  if (!enqueued) return { error: "File d'envoi indisponible — réessayer." };

  await logQualiopiActivity({
    action: "facturation.email.devis",
    targetType: "Devis",
    targetId: devis.id,
    changes: { to, numero: devis.numero },
    session,
  });
  return { data: { enqueued, to } };
}

const EnvoyerFactureSchema = z.object({
  factureId: z.string().uuid(),
  to: z.string().email().optional(),
  messagePersonnalise: z.string().max(4000).optional(),
});

export async function envoyerFactureEmailAction(
  rawInput: unknown,
): Promise<{ data: { enqueued: boolean; to: string } } | { error: string }> {
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
  const { enqueued } = await enqueueEmail(
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
    },
  );
  if (!enqueued) return { error: "File d'envoi indisponible — réessayer." };

  await logQualiopiActivity({
    action: "facturation.email.facture",
    targetType: "FactureFormation",
    targetId: facture.id,
    changes: { to, numero: facture.numero, estAvoir, pdfHash: doc.hashSha256 },
    session,
  });
  return { data: { enqueued, to } };
}
