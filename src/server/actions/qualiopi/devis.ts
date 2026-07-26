/**
 * Qualiopi — Server Actions CRM devis (T2).
 *
 * createDevisAction  : crée un devis brouillon (lignes, montant, numéro, TVA, validité).
 * sendDevisAction    : génère le PDF (fail-soft) + soumission DocuSeal « bon pour
 *                      accord » (best-effort) puis bascule statut → envoyé
 *                      (+ expire l'ancienne version si révision) + statut client.
 * acceptDevisAction  : bascule statut → accepté.
 * declineDevisAction : bascule statut → refusé.
 * reviseDevisAction  : crée une NOUVELLE version brouillon (replacesDevisId).
 *
 * TVA : régime lu dans la config (`regime_tva`), JAMAIS codé en dur.
 * Montants : TOUJOURS en CENTIMES (Int). Zéro valeur en dur.
 */

"use server";

import React from "react";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import { estimateOpcoCoverage } from "@/server/qualiopi/crm/devis";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import {
  isRegimeTva,
  mentionTva,
  REGIME_TVA_DEFAUT,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import {
  ACTIVITE_LABELS,
  normaliserLignesPourActivite,
} from "@/server/qualiopi/financements/facture-libre-pur";
import { DevisPdf, type DevisData } from "@/server/qualiopi/documents/templates/devis";
import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";
import { isDocusealConfigured, createContractSubmission } from "@/lib/docuseal";
import { enqueueEmail } from "@/server/queue/queues";

type ActionResult<T> = { data: T } | { error: string };

const eurHt = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const ligneSchema = z.object({
  designation: z.string().min(1).max(500),
  quantite: z.number().positive(),
  prixUnitaireHtCents: z.number().int().min(0),
  /** Taux de TVA de la ligne (%) — devis mixtes (formation 0 % + conseil 20 %). */
  tauxTvaPercent: z.number().min(0).max(100).optional(),
  /** Référence optionnelle à une offre du catalogue (tierId). */
  offreTierId: z.string().optional(),
});

const FINANCEMENTS = ["direct", "opco", "cpf", "france_travail"] as const;

/** Miroir de l'enum Prisma ActiviteFacturation (sélecteur du Hub). */
const ACTIVITES = ["formation", "un_a_un", "audit", "implementation", "site_web"] as const;

/** Libellés d'affichage du financement suggéré (PDF devis). */
const FINANCEMENT_LABELS: Record<(typeof FINANCEMENTS)[number], string> = {
  direct: "Financement direct (fonds propres)",
  opco: "OPCO",
  cpf: "CPF",
  france_travail: "France Travail",
};

const createDevisSchema = z.object({
  clientId: z.string().uuid(),
  lignes: z.array(ligneSchema).min(1),
  /** Activité facturée (pré-remplit régime TVA + mentions du Hub). */
  activite: z.enum(ACTIVITES).optional(),
  /** Référence client / n° de bon de commande (exigé ETI/grands comptes/OPCO). */
  refClient: z.string().min(1).max(120).optional(),
  financementSuggere: z.enum(FINANCEMENTS).optional(),
  /** Nombre de participants (requis si financementSuggere === "opco"). */
  nbParticipants: z.number().int().min(1).optional(),
  /** Durée en heures (requis si financementSuggere === "opco"). */
  dureeHeures: z.number().positive().optional(),
  /** Modalité OPCO (requis si financementSuggere === "opco"). */
  modaliteOpco: z.enum(["intra", "inter_presentiel", "inter_distanciel"]).optional(),
  /** Enveloppe restante OPCO en centimes (optionnel). */
  opcoEnveloppeRestanteCents: z.number().int().min(0).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée un devis brouillon.
 * - Numéro : AXI-DEV-<année>-NNN (count+1 zero-paddé 3).
 * - montantTotalHtCents = Σ lignes.quantite × lignes.prixUnitaireHtCents.
 * - mentionTva : dérivée du régime configuré (`null` si assujetti).
 * - dateValidite = maintenant + 30 jours.
 * - Si financementSuggere==="opco" et nbParticipants/dureeHeures/modaliteOpco fournis
 *   → estimateOpcoCoverage renseigne montantOpcoEstimeCents/resteAChargeCents.
 */
export async function createDevisAction(
  input: z.infer<typeof createDevisSchema>,
): Promise<ActionResult<{ id: string; numero: string }>> {
  // Stub-aware (build GH Actions) : aucune mutation au SSG.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
  const parsed = createDevisSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Calculer le total HT en centimes
  const montantTotalHtCents = v.lignes.reduce(
    (acc, l) => acc + Math.round(l.quantite * l.prixUnitaireHtCents),
    0,
  );

  const year = new Date().getFullYear();

  // Date de validité : +30 jours
  const dateValidite = new Date();
  dateValidite.setDate(dateValidite.getDate() + 30);

  // Estimation OPCO si applicable
  let montantOpcoEstimeCents: number | undefined;
  let resteAChargeCents: number | undefined;

  if (
    v.financementSuggere === "opco" &&
    v.nbParticipants !== undefined &&
    v.dureeHeures !== undefined &&
    v.modaliteOpco !== undefined
  ) {
    // OPCO du client (Lot 5) : oriente la résolution du barème central versionné.
    // Fail-soft : null → estimation Atlas par défaut (comportement historique).
    const client = await prisma.client
      .findUnique({ where: { id: v.clientId }, select: { opcoIdentifie: true } })
      .catch(() => null);
    const coverage = await estimateOpcoCoverage({
      nbParticipants: v.nbParticipants,
      dureeHeures: v.dureeHeures,
      modalite: v.modaliteOpco,
      montantHtCents: montantTotalHtCents,
      ...(v.opcoEnveloppeRestanteCents !== undefined
        ? { enveloppeRestanteCents: v.opcoEnveloppeRestanteCents }
        : {}),
      ...(client?.opcoIdentifie ? { opco: client.opcoIdentifie } : {}),
    });
    montantOpcoEstimeCents = coverage.montantPriseEnChargeCents;
    resteAChargeCents = coverage.resteAChargeCents;
  }

  // 🔴 Audit certification 2026-07-26 (F25) — le régime de TVA se LIT, il ne se
  // décrète pas ici.
  //
  // `mentionTva` était figé à l'exonération 261-4-4° à la création, quel que
  // soit `regime_tva`. La production est pourtant configurée en « assujetti », et
  // le PDF, lui, calcule bien la mention depuis le régime : l'écran du devis
  // affichait donc « Exonéré de TVA » pendant que le PDF facturait 20 %. Les deux
  // devis émis portent cette mention en base.
  //
  // L'exonération 261-4-4° exige l'attestation DREETS (Cerfa 3511) ; l'afficher
  // sans l'avoir engage l'organisme sur un régime qu'il ne détient pas — et un
  // devis accepté fait foi de l'offre.
  const regimeTvaCreation = await getQualiopiConfig("regime_tva");
  // `Devis.mentionTva` est NOT NULL et fige le régime de la pièce. `mentionTva()`
  // rend `null` pour « assujetti » — c'est correct pour un PDF, qui n'a alors
  // rien à afficher, mais pas pour une colonne d'archive : une chaîne vide
  // rendrait « assujetti » et « non renseigné » indiscernables plus tard.
  const mentionTvaCreation =
    mentionTva(isRegimeTva(regimeTvaCreation) ? regimeTvaCreation : REGIME_TVA_DEFAUT) ??
    LEGAL_MENTIONS.factureTvaAssujetti;

  // Allocation numéro séquentiel + insertion, avec retry sur collision (R7)
  const created = await withNumberRetry(async () => {
    const count = await prisma.devis.count();
    const numero = formatDocumentNumber("devis", year, count + 1);
    return prisma.devis.create({
      data: {
        numero,
        clientId: v.clientId,
        lignes: v.lignes as never,
        montantTotalHtCents,
        mentionTva: mentionTvaCreation,
        statut: "brouillon",
        dateValidite,
        ...(v.activite !== undefined ? { activite: v.activite } : {}),
        ...(v.refClient !== undefined ? { refClient: v.refClient } : {}),
        ...(v.financementSuggere !== undefined ? { financementSuggere: v.financementSuggere } : {}),
        ...(montantOpcoEstimeCents !== undefined ? { montantOpcoEstimeCents } : {}),
        ...(resteAChargeCents !== undefined ? { resteAChargeCents } : {}),
      },
      select: { id: true, numero: true },
    });
  });

  await logQualiopiActivity({
    action: "qualiopi.devis.create",
    targetType: "Devis",
    targetId: created.id,
    changes: {
      numero: created.numero,
      clientId: v.clientId,
      montantTotalHtCents,
      financementSuggere: v.financementSuggere,
    },
    session,
  });

  return { data: { id: created.id, numero: created.numero } };
}

/** Assemble l'adresse d'affichage : structurée si présente, sinon champ libre. */
function adresseClientDevis(client: {
  adresse: string | null;
  adresseRue: string | null;
  adresseCodePostal: string | null;
  adresseVille: string | null;
}): string | undefined {
  if (client.adresseRue && client.adresseVille) {
    return [
      client.adresseRue,
      [client.adresseCodePostal, client.adresseVille].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");
  }
  return client.adresse ?? undefined;
}

/**
 * Marque le devis comme envoyé (statut → envoye, sentAt = now).
 * Met aussi à jour le statut du client → devis_envoye.
 *
 * Avant la bascule :
 *   1. PDF (fail-soft) : rendu DevisPdf via generateDocument type "devis"
 *      (élément PRÉ-CONSTRUIT — le numéro visible est celui du Devis CRM, le
 *      numéro DocumentGenere ne sert qu'au registre). `fichierPdfUrl` stocke la
 *      CLÉ R2 stable `documents/{year}/devis/{numeroDocumentGenere}.pdf` — pas
 *      l'URL signée (expirée en 900 s).
 *   2. DocuSeal (best-effort) : soumission « bon pour accord » si configuré +
 *      template id + email de contact client (metadata kind="devis").
 *   3. Révision : si `replacesDevisId` non null, l'ancienne version passe
 *      `expire` dans la MÊME transaction que le passage à `envoye`.
 */
export async function sendDevisAction(
  id: string,
): Promise<ActionResult<{ id: string; emailEnvoye: boolean; note?: string }>> {
  // Stub-aware (build GH Actions) : aucune mutation au SSG.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const devis = await prisma.devis.findUnique({
    where: { id: idParsed.data },
    select: {
      id: true,
      numero: true,
      clientId: true,
      statut: true,
      lignes: true,
      activite: true,
      refClient: true,
      replacesDevisId: true,
      financementSuggere: true,
      montantTotalHtCents: true,
      montantOpcoEstimeCents: true,
      resteAChargeCents: true,
      dateValidite: true,
      client: {
        select: {
          raisonSociale: true,
          siret: true,
          adresse: true,
          adresseRue: true,
          adresseCodePostal: true,
          adresseVille: true,
          contactNom: true,
          contactEmail: true,
        },
      },
    },
  });
  if (!devis) return { error: "Devis introuvable" };
  // Garde de statut serveur : seul un BROUILLON s'envoie. Empêche un re-clic
  // depuis une UI périmée / 2e onglet de recréer une soumission DocuSeal (qui
  // écraserait docusealEmbedUrl et orphelinerait l'ancien lien) et de renvoyer
  // un 2e email au client. Le renvoi d'un devis déjà émis passe par
  // envoyerDevisEmailAction (email seul, pas de nouvelle soumission).
  if (devis.statut !== "brouillon") {
    return {
      error: `Seul un devis en brouillon peut être envoyé (statut actuel : ${devis.statut}).`,
    };
  }

  // ── 1. Génération du PDF (fail-soft : un rendu raté ne bloque pas l'envoi) ──
  let fichierPdfUrl: string | null = null;
  try {
    const identite = await getOrganismeIdentite();

    // Régime + taux (snapshot config) et normalisation TVA par activité.
    const regimeTvaConfig = await getQualiopiConfig("regime_tva");
    const regimeTva: RegimeTva = isRegimeTva(regimeTvaConfig) ? regimeTvaConfig : REGIME_TVA_DEFAUT;
    const tauxStandard =
      (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;

    const lignesBrutes = (Array.isArray(devis.lignes)
      ? devis.lignes
      : []) as unknown as LigneFacture[];
    const lignes =
      devis.activite !== null
        ? normaliserLignesPourActivite(lignesBrutes, devis.activite, regimeTva, tauxStandard)
        : lignesBrutes;

    const formatDate = (d: Date) => d.toLocaleDateString("fr-FR");
    const adresse = adresseClientDevis(devis.client);
    const financementLabel =
      devis.financementSuggere !== null
        ? (FINANCEMENT_LABELS[devis.financementSuggere as (typeof FINANCEMENTS)[number]] ??
          devis.financementSuggere)
        : undefined;

    const data: DevisData = {
      numero: devis.numero,
      dateEmission: formatDate(new Date()),
      dateValidite: formatDate(devis.dateValidite),
      identite,
      client: {
        raisonSociale: devis.client.raisonSociale,
        ...(devis.client.siret !== null ? { siret: devis.client.siret } : {}),
        ...(adresse !== undefined ? { adresse } : {}),
        ...(devis.client.contactEmail !== null ? { email: devis.client.contactEmail } : {}),
      },
      lignes,
      regimeTva,
      tauxTvaStandardPercent: tauxStandard,
      ...(devis.refClient !== null ? { refClient: devis.refClient } : {}),
      ...(devis.activite !== null ? { activiteLabel: ACTIVITE_LABELS[devis.activite] } : {}),
      ...(financementLabel !== undefined ? { financementSuggere: financementLabel } : {}),
      ...(devis.montantOpcoEstimeCents !== null
        ? { montantOpcoEstimeCents: devis.montantOpcoEstimeCents }
        : {}),
      ...(devis.resteAChargeCents !== null ? { resteAChargeCents: devis.resteAChargeCents } : {}),
    };

    const yearGeneration = new Date().getFullYear();
    const doc = await generateDocument({
      type: "devis",
      // Élément PRÉ-CONSTRUIT : le PDF affiche le numéro du Devis CRM.
      element: React.createElement(DevisPdf, { data }),
      identite,
      refs: { clientId: devis.clientId },
    });
    // Clé R2 stable (l'URL signée retournée expire en 900 s — on stocke la clé).
    fichierPdfUrl = `documents/${yearGeneration}/devis/${doc.numero}.pdf`;
  } catch (err) {
    console.warn("[sendDevisAction] génération PDF devis échouée (fail-soft)", err);
  }

  // ── 2. Signature électronique « bon pour accord » (best-effort) ──
  // On capture `embedUrl` (embed_src du 1er signataire = lien de signature du
  // CLIENT) pour le glisser dans l'email d'envoi (CTA « Signer en ligne »).
  let docusealSubmissionId: string | null = null;
  let docusealEmbedUrl: string | null = null;
  const docusealTemplateId =
    process.env["DOCUSEAL_DEVIS_TEMPLATE_ID"] || process.env["DOCUSEAL_QUOTE_TEMPLATE_ID"];
  const contactEmail = devis.client.contactEmail;
  if (isDocusealConfigured() && docusealTemplateId && contactEmail) {
    try {
      const result = await createContractSubmission({
        templateId: docusealTemplateId,
        client: {
          email: contactEmail,
          name: devis.client.contactNom ?? devis.client.raisonSociale,
        },
        fields: [
          { name: "devis_number", default_value: devis.numero },
          { name: "amount_ht", default_value: (devis.montantTotalHtCents / 100).toFixed(2) },
          { name: "valid_until", default_value: devis.dateValidite.toISOString().slice(0, 10) },
        ],
        sendEmail: false, // l'email est envoyé par NOUS (template Axion-IA + PJ PDF)
        metadata: { devisId: devis.id, kind: "devis" },
      });
      docusealSubmissionId = result.submissionId;
      docusealEmbedUrl = result.embedUrl || null;
    } catch (err) {
      console.warn("[sendDevisAction] soumission DocuSeal échouée (best-effort)", err);
    }
  }

  // ── 3. Transaction : envoye + statut client + expiration de la version remplacée ──
  await prisma.$transaction([
    prisma.devis.update({
      where: { id: idParsed.data },
      data: {
        statut: "envoye",
        sentAt: new Date(),
        ...(fichierPdfUrl !== null ? { fichierPdfUrl } : {}),
        ...(docusealSubmissionId !== null ? { docusealSubmissionId } : {}),
        ...(docusealEmbedUrl !== null ? { docusealEmbedUrl } : {}),
      },
    }),
    prisma.client.update({
      where: { id: devis.clientId },
      data: { statut: "devis_envoye" },
    }),
    // Révision : l'ancienne version passe `expire` — jamais d'écrasement.
    ...(devis.replacesDevisId !== null
      ? [
          prisma.devis.update({
            where: { id: devis.replacesDevisId },
            data: { statut: "expire" as const },
          }),
        ]
      : []),
  ]);

  // ── 4. Email au client (PDF joint + lien de signature) ──
  // Déclenché par le clic admin « Envoyer » — MANUEL, jamais un cron : conforme
  // à la règle « aucun email automatique ». On n'envoie que si l'on a un
  // destinataire ET le PDF (raison d'être de l'email = le document joint) ;
  // sinon on marque quand même « envoyé » et on remonte une note à l'admin.
  let emailEnvoye = false;
  let note: string | undefined;
  if (contactEmail && fichierPdfUrl !== null) {
    const { enqueued } = await enqueueEmail(
      "devis-envoi",
      contactEmail,
      "fr",
      {
        clientNom: devis.client.raisonSociale,
        numero: devis.numero,
        montantLabel: `${eurHt(devis.montantTotalHtCents)} HT`,
        dateValiditeLabel: devis.dateValidite.toLocaleDateString("fr-FR"),
        ...(docusealEmbedUrl !== null ? { signatureUrl: docusealEmbedUrl } : {}),
      },
      {
        attachments: [{ filename: `${devis.numero}.pdf`, r2Key: fichierPdfUrl }],
      },
    );
    emailEnvoye = enqueued;
    if (!enqueued)
      note =
        "File d'attente email indisponible : le devis est marqué envoyé, mais l'email n'a pas pu être expédié — réessayer plus tard.";
  } else if (!contactEmail) {
    note = "Aucun email de contact client : le devis est marqué envoyé, mais rien n'a été expédié.";
  } else {
    note = "PDF indisponible : le devis est marqué envoyé, mais l'email n'a pas pu être expédié.";
  }

  await logQualiopiActivity({
    action: "qualiopi.devis.send",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: {
      statut: "envoye",
      pdfGenere: fichierPdfUrl !== null,
      docusealSubmissionId,
      emailEnvoye,
      devisExpire: devis.replacesDevisId,
    },
    session,
  });

  return { data: { id: idParsed.data, emailEnvoye, ...(note !== undefined ? { note } : {}) } };
}

/**
 * Marque le devis comme accepté (statut → accepte, acceptedAt = now).
 */
export async function acceptDevisAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  await prisma.devis.update({
    where: { id: idParsed.data },
    data: { statut: "accepte", acceptedAt: new Date() },
  });

  await logQualiopiActivity({
    action: "qualiopi.devis.accept",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: { statut: "accepte" },
    session,
  });

  return { data: { id: idParsed.data } };
}

/**
 * Transforme un devis ACCEPTÉ en convention (statut → transforme_convention) — R11.
 *
 * Marque la fin du cycle commercial : le devis est transformé. La session de
 * formation se crée ensuite via createSessionAction en liant `devisId` (le Devis
 * ne porte pas de formationId → la formation/les dates sont choisies à la création
 * de session). Idempotent : un devis déjà transformé est laissé tel quel.
 */
export async function transformDevisToConventionAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const devis = await prisma.devis.findUnique({
    where: { id: idParsed.data },
    select: { id: true, statut: true },
  });
  if (!devis) return { error: "Devis introuvable" };
  if (devis.statut === "transforme_convention") return { data: { id: devis.id } };
  if (devis.statut !== "accepte") {
    return { error: "Seul un devis accepté peut être transformé en convention." };
  }

  await prisma.devis.update({
    where: { id: idParsed.data },
    data: { statut: "transforme_convention" },
  });

  await logQualiopiActivity({
    action: "qualiopi.devis.transform_convention",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: { statut: "transforme_convention" },
    session,
  });

  return { data: { id: idParsed.data } };
}

/**
 * Marque le devis comme refusé (statut → refuse, declinedAt = now).
 */
export async function declineDevisAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  await prisma.devis.update({
    where: { id: idParsed.data },
    data: { statut: "refuse", declinedAt: new Date() },
  });

  await logQualiopiActivity({
    action: "qualiopi.devis.decline",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: { statut: "refuse" },
    session,
  });

  return { data: { id: idParsed.data } };
}

/** Statuts depuis lesquels une révision est autorisée (jamais un brouillon). */
const STATUTS_REVISABLES = ["envoye", "accepte", "refuse", "expire"] as const;

/**
 * Crée une NOUVELLE version brouillon d'un devis émis (révision) — jamais
 * d'écrasement d'un devis envoyé/accepté/refusé/expiré.
 *
 * - Nouveau numéro AXI-DEV-YYYY-NNN (même pattern que createDevisAction).
 * - Copie clientId/lignes/activite/refClient/financementSuggere/mentionTva/
 *   montants ; `replacesDevisId` pointe la version remplacée.
 * - L'ancienne version passera `expire` à l'ENVOI de la nouvelle
 *   (cf. sendDevisAction), pas à la création du brouillon.
 */
export async function reviseDevisAction(
  devisId: string,
): Promise<ActionResult<{ id: string; numero: string }>> {
  // Stub-aware (build GH Actions) : aucune mutation au SSG.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(devisId);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  const origine = await prisma.devis.findUnique({
    where: { id: idParsed.data },
    select: {
      id: true,
      numero: true,
      statut: true,
      clientId: true,
      lignes: true,
      activite: true,
      refClient: true,
      financementSuggere: true,
      mentionTva: true,
      montantTotalHtCents: true,
      montantOpcoEstimeCents: true,
      resteAChargeCents: true,
    },
  });
  if (!origine) return { error: "Devis introuvable" };
  if (!(STATUTS_REVISABLES as readonly string[]).includes(origine.statut)) {
    return { error: "Seul un devis envoyé, accepté, refusé ou expiré peut être révisé." };
  }

  const year = new Date().getFullYear();

  // Date de validité : +30 jours (comme à la création).
  const dateValidite = new Date();
  dateValidite.setDate(dateValidite.getDate() + 30);

  // Allocation numéro séquentiel + insertion, avec retry sur collision (R7)
  const created = await withNumberRetry(async () => {
    const count = await prisma.devis.count();
    const numero = formatDocumentNumber("devis", year, count + 1);
    return prisma.devis.create({
      data: {
        numero,
        clientId: origine.clientId,
        lignes: origine.lignes as never,
        montantTotalHtCents: origine.montantTotalHtCents,
        mentionTva: origine.mentionTva,
        statut: "brouillon",
        dateValidite,
        replacesDevisId: origine.id,
        ...(origine.activite !== null ? { activite: origine.activite } : {}),
        ...(origine.refClient !== null ? { refClient: origine.refClient } : {}),
        ...(origine.financementSuggere !== null
          ? { financementSuggere: origine.financementSuggere }
          : {}),
        ...(origine.montantOpcoEstimeCents !== null
          ? { montantOpcoEstimeCents: origine.montantOpcoEstimeCents }
          : {}),
        ...(origine.resteAChargeCents !== null
          ? { resteAChargeCents: origine.resteAChargeCents }
          : {}),
      },
      select: { id: true, numero: true },
    });
  });

  await logQualiopiActivity({
    action: "qualiopi.devis.revise",
    targetType: "Devis",
    targetId: created.id,
    changes: {
      numero: created.numero,
      replacesDevisId: origine.id,
      replacesNumero: origine.numero,
    },
    session,
  });

  return { data: { id: created.id, numero: created.numero } };
}
