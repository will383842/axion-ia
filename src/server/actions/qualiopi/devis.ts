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
import {
  requireAdminWrite,
  requireHabilitation,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
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
import { publicUrl } from "@/lib/public-url";
import {
  creerTokenDocument,
  revoquerTokensDocument,
  TokenDocumentError,
} from "@/server/qualiopi/documents/signature/token-document";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import { genererConventionAction } from "@/server/actions/qualiopi/documents";

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
  /**
   * Référence à une offre du catalogue par son `tier_id` pricing.ts.
   * Ne vaut QUE pour les offres legacy qui en ont un ; les offres du catalogue
   * V2 ont `tier_id = NULL` et ne sont identifiables que par `offreCode`.
   */
  offreTierId: z.string().max(80).optional(),
  /**
   * Code AXI-OFF-NNN de l'offre catalogue — la référence qui vaut pour TOUTES
   * les offres. Sans cette clé, Zod la STRIPPERAIT en silence (l'objet n'est pas
   * `.strict()`) : la ligne serait persistée sans sa référence, sans erreur.
   *
   * Les lignes émises avant ce correctif rangeaient ce code dans `offreTierId`
   * (le <select> émettait `tierId ?? code`), à côté de vrais tierId pour les
   * offres legacy : la colonne est donc MIXTE. Aucune n'est réécrite — un devis
   * émis est une pièce immuable. Tout futur reporting qui joint
   * `lignes->>'offreTierId'` sur `offres_site.tier_id` doit tolérer les deux.
   */
  offreCode: z.string().max(40).optional(),
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
 * - Numéro : AXI-DEV-<année>-NNN (borne haute de la série + 1).
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
    // F63 — le comptage ignorait l'année alors que le numéro l'estampille :
    // le 1er janvier, la séquence aurait repris au rang global au lieu de 001.
    // 🔴 V20 — borne haute, pas cardinalité. Le `startsWith` posé par F63
    // corrigeait le DÉNOMINATEUR (compter la bonne année) mais pas la MÉCANIQUE :
    // un devis supprimé faisait toujours reculer le compteur, et
    // `withNumberRetry` rejouait le même `count()` — cinq fois le même numéro.
    const numero = await nextNumero("devis", year, (prefixe) =>
      prisma.devis.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
    );
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
): Promise<
  ActionResult<{ id: string; emailEnvoye: boolean; signatureCreee: boolean; note?: string }>
> {
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
      // Pièce de la version REMPLACÉE : son lien de signature doit mourir avec
      // elle (voir la transaction plus bas).
      replacesDevis: { select: { documentGenereId: true } },
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
          // 🔴 Repris comme QUALITÉ figée du signataire. Ce n'est pas
          // décoratif : `signataireQualite` porte l'opposabilité du POUVOIR de
          // signer — savoir que « Camille Durand » était directrice des
          // ressources humaines au moment de l'engagement est ce qui permet, des
          // années plus tard, de soutenir qu'elle pouvait engager la structure.
          contactFonction: true,
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
  // Un devis à 0,00 € ne doit pas partir en signature.
  //
  // Le garde côté formulaire ne protège rien : cette action est appelable depuis
  // un onglet resté ouvert, et `ligneSchema` accepte volontairement un PU à 0
  // (lignes offertes). C'est ICI que le montant total doit être vérifié — au-delà,
  // le PDF est rendu, DocuSeal ouvre une signature et le client reçoit une offre
  // ferme à zéro euro. `ligneSchema.min(0)` reste inchangé.
  if (devis.montantTotalHtCents <= 0) {
    return {
      error:
        "Devis à 0,00 € HT : chiffrez les lignes avant l'envoi (une offre sans prix ferme ne pré-remplit aucun montant).",
    };
  }

  // ── 1. Génération du PDF (fail-soft : un rendu raté ne bloque pas l'envoi) ──
  let fichierPdfUrl: string | null = null;
  /**
   * Pièce NUMÉROTÉE produite par `generateDocument`.
   *
   * 🔴 Son `id` était produit puis JETÉ à chaque envoi — seul `numero` servait,
   * pour composer une clé R2. C'est pourtant lui que la signature référence :
   * sans lui, il n'y a rien à signer, seulement un PDF posé sur un bucket.
   */
  let documentGenereId: string | null = null;
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
    documentGenereId = doc.id;
  } catch (err) {
    console.warn("[sendDevisAction] génération PDF devis échouée (fail-soft)", err);
  }

  // ── 2. Signature électronique « bon pour accord » — CANAL MAISON ──
  //
  // 🔴 Bascule du 2026-07-30, décidée avec Will. Ce bloc créait une soumission
  // DocuSeal sur un template PERMANENT à trois champs (`devis_number`,
  // `amount_ht`, `valid_until`), pendant que le client recevait en pièce jointe
  // le PDF DÉTAILLÉ — lignes, quantités, prix unitaires, TVA, totaux. Le client
  // lisait donc un document et en signait un autre. Un bon pour accord qui ne
  // désigne pas son objet est juridiquement fragile.
  //
  // La correction prévue au plan (§III.3) — un template ÉPHÉMÈRE par pièce via
  // `POST /api/templates/pdf` — est IMPOSSIBLE sur l'instance de production.
  // Vérifié contre le conteneur RÉEL, pas contre la doc, comme l'exige l'en-tête
  // de `src/lib/docuseal.ts` : `config/routes.rb` (v2.5.3) déclare
  // `resources :templates, only: %i[update show index destroy]`, et l'appel réel
  // répond 404 là où `GET /api/templates/2` répond 200 avec le même jeton. Ces
  // endpoints sont réservés aux offres Pro.
  //
  // Le lien maison fait signer LE PDF RÉEL, celui dont l'empreinte est scellée
  // dans `document_hash_sha256`. Une seule source de vérité.
  //
  // ⚠️ Le circuit DocuSeal n'est PAS rebranché ailleurs : `docusealSubmissionId`
  // et `docusealEmbedUrl` restent en base pour l'unique devis signé par cette
  // voie avant la bascule, et ne reçoivent plus d'écriture.
  let signatureUrl: string | null = null;
  const contactEmail = devis.client.contactEmail;
  /**
   * Un lien était-il attendu ? Distingue « pas de destinataire ni de pièce »
   * (silence normal) de « attendu mais en panne » (à signaler).
   *
   * ⚠️ `documentGenereId` en fait partie : si le rendu du PDF a échoué en
   * fail-soft, il n'y a aucune pièce à signer, et annoncer un lien de signature
   * serait faux.
   */
  const signatureAttendue = documentGenereId !== null && !!contactEmail;
  /** Motif d'échec — tracé au registre et remonté à l'admin. */
  let signatureErreur: string | null = null;
  // 🔴 F4, et la leçon reste valable sur le canal maison : une panne de
  // signature doit REMONTER. Jusqu'au 2026-07-26, l'échec était avalé par un
  // `console.warn` muet — le devis partait « envoyé », l'admin lisait « + lien
  // de signature » en vert, et aucune soumission n'existait. C'est la seule
  // protection contre une rechute muette, quel que soit le canal.
  if (documentGenereId !== null && contactEmail) {
    try {
      const { token } = await creerTokenDocument({
        documentGenereId,
        // Le SSOT donne le circuit ; on ne réécrit pas la liste ici. Le client
        // est la partie qui reçoit le lien — l'organisme contresigne depuis la
        // console, authentifié, et n'a donc jamais de jeton.
        partie: "client",
        // 🔴 Identité résolue depuis la FICHE CLIENT, côté serveur, et figée.
        // C'est ce qui permet au signataire non authentifié de rester conforme à
        // la doctrine du canal maison : au moment de signer, le service relit
        // cette identité en base, jamais dans le formulaire.
        signataireNom: devis.client.contactNom ?? devis.client.raisonSociale,
        signataireEmail: contactEmail,
        signataireQualite: devis.client.contactFonction,
        // La date de validité borne le lien : tenir une offre ferme au-delà
        // n'aurait aucun sens commercial.
        borneMetier: devis.dateValidite,
      });
      signatureUrl = publicUrl(`/fr/portail/signer/${token}`).toString();
    } catch (err) {
      // Aucune donnée client dans le motif : Telegram est un canal tiers. Le
      // détail complet reste dans les logs serveur.
      signatureErreur =
        err instanceof TokenDocumentError ? err.motif : "erreur technique signature";
      console.warn("[sendDevisAction] émission du lien de signature échouée (best-effort)", err);
      // `.catch()` obligatoire : une panne Telegram ne doit jamais faire échouer
      // l'envoi d'un devis.
      sendTelegram({
        tag: "AUTO",
        body: `⚠️ Devis ${devis.numero} : lien de signature NON créé (${signatureErreur}). Le devis part sans « bon pour accord » signable en ligne.`,
      }).catch(() => {});
    }
  }
  const signatureCreee = signatureUrl !== null;

  // ── 3. Transaction : envoye + statut client + expiration de la version remplacée ──
  await prisma.$transaction([
    prisma.devis.update({
      where: { id: idParsed.data },
      data: {
        statut: "envoye",
        sentAt: new Date(),
        ...(fichierPdfUrl !== null ? { fichierPdfUrl } : {}),
        // 🔴 Rattachement à la pièce numérotée : c'est lui qui permet à la
        // signature de désigner CE devis-ci. Sans cette ligne, le jeton pointe
        // vers une pièce que le devis ne connaît pas, et `accepterDevisSurSignature`
        // ne retrouverait rien à basculer.
        ...(documentGenereId !== null ? { documentGenereId } : {}),
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
    // 🔴 …et son lien de signature est RÉVOQUÉ, dans la MÊME transaction.
    //
    // Sans cela, le client détiendrait deux liens vivants : l'ancien, sur un
    // devis désormais `expire`, et le nouveau. Rien ne l'empêcherait de signer
    // la version périmée — celle dont on vient de corriger le prix — et la
    // signature serait parfaitement valide, chaînée, opposable. C'est exactement
    // le genre de « bon pour accord » qu'une révision existe pour éviter.
    //
    // ⚠️ La révocation du jeton ne touche AUCUNE signature déjà apposée : elle
    // ferme le lien, elle n'efface pas une preuve.
    ...(devis.replacesDevis?.documentGenereId != null
      ? [
          prisma.documentSignatureToken.updateMany({
            where: { documentGenereId: devis.replacesDevis.documentGenereId, revokedAt: null },
            data: {
              revokedAt: new Date(),
              revokedMotif: `Devis révisé — remplacé par ${devis.numero}`,
            },
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
    const { enqueued, garePourValidation = false } = await enqueueEmail(
      "devis-envoi",
      contactEmail,
      "fr",
      {
        clientNom: devis.client.raisonSociale,
        numero: devis.numero,
        montantLabel: `${eurHt(devis.montantTotalHtCents)} HT`,
        dateValiditeLabel: devis.dateValidite.toLocaleDateString("fr-FR"),
        ...(signatureUrl !== null ? { signatureUrl } : {}),
      },
      {
        attachments: [{ filename: `${devis.numero}.pdf`, r2Key: fichierPdfUrl }],
      },
    );
    emailEnvoye = enqueued;
    // 🔴 Vérification E2E 2026-07-26. Un email garé pour validation n'est PAS
    // enfilé — `enqueued` est donc faux. Sans distinguer les deux cas, l'admin
    // lisait « file d'attente indisponible, réessayer » alors que l'email
    // l'attendait sagement dans la corbeille de validation : le message
    // l'envoyait diagnostiquer une panne inexistante, et réessayer aurait garé
    // un doublon.
    if (garePourValidation) {
      note =
        "Devis marqué envoyé. L'email attend votre validation dans Emails → À valider ; il partira une fois approuvé.";
    } else if (!enqueued) {
      note =
        "File d'attente email indisponible : le devis est marqué envoyé, mais l'email n'a pas pu être expédié — réessayer plus tard.";
    }
  } else if (!contactEmail) {
    note = "Aucun email de contact client : le devis est marqué envoyé, mais rien n'a été expédié.";
  } else {
    note = "PDF indisponible : le devis est marqué envoyé, mais l'email n'a pas pu être expédié.";
  }

  // 🔴 F4 — la signature électronique était attendue et n'a pas été créée :
  // l'email est parti SANS bouton « signer ». On le DIT, au lieu d'annoncer
  // « + lien de signature » en vert comme avant. Le devis reste « envoyé »
  // (fail-soft assumé) : c'est l'admin qui arbitre la suite.
  if (signatureAttendue && !signatureCreee) {
    const detail = signatureErreur !== null ? ` (${signatureErreur})` : "";
    const prefixe = note !== undefined ? `${note} ` : "Devis marqué envoyé. ";
    note = `${prefixe}⚠️ Le lien de signature n'a PAS pu être créé${detail} : le client ne peut pas signer en ligne. Lui faire retourner le PDF signé, ou réviser le devis pour réessayer.`;
  }

  await logQualiopiActivity({
    action: "qualiopi.devis.send",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: {
      statut: "envoye",
      pdfGenere: fichierPdfUrl !== null,
      documentGenereId,
      // ⚠️ Le LIEN lui-même n'est jamais journalisé : il vaut signature. Seul
      // le fait qu'il ait été émis l'est.
      lienSignatureEmis: signatureCreee,
      // Motif d'échec tracé au registre : le journal affichait
      // `"docusealSubmissionId": null` sans jamais dire pourquoi, et les logs du
      // conteneur partent au premier redémarrage.
      signatureErreur,
      emailEnvoye,
      devisExpire: devis.replacesDevisId,
    },
    session,
  });

  return {
    data: {
      id: idParsed.data,
      emailEnvoye,
      signatureCreee,
      ...(note !== undefined ? { note } : {}),
    },
  };
}

/**
 * Marque le devis comme accepté (statut → accepte, acceptedAt = now).
 */
export async function acceptDevisAction(id: string): Promise<ActionResult<{ id: string }>> {
  // Acte ENGAGEANT : accepter un devis conclut le contrat au nom de l'organisme.
  const session = await requireHabilitation("conclure_devis");
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
  // Acte ENGAGEANT : transformer un devis en convention cloture le cycle contractuel.
  const session = await requireHabilitation("conclure_devis");
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

  // 🔴 Constat F7, audit de certification 2026-07-26.
  //
  // Cette action ne « transformait » rien : elle basculait le statut du devis à
  // `transforme_convention` et s'arrêtait là. AUCUNE convention n'était générée.
  // Le devis affichait donc « transformé en convention » alors qu'aucune pièce
  // n'existait — et c'est précisément la pièce que l'auditrice réclame ensuite.
  // Un état faux dans la piste d'audit est pire qu'un état manquant : il fait
  // croire que l'obligation est remplie et fait chercher un document qui
  // n'existe pas (L6353-1, indicateur 9).
  //
  // Une convention ne peut pas être produite depuis un devis seul : elle porte
  // des dates, une modalité, un effectif et un formateur — c'est-à-dire une
  // SESSION. On exige donc qu'une session soit rattachée à ce devis, et on
  // génère la convention pour elle. Le statut ne bascule QUE si le document a
  // réellement été produit.
  const sessionLiee = await prisma.trainingSession.findFirst({
    where: { devisId: idParsed.data },
    select: { id: true, numero: true },
    orderBy: { createdAt: "asc" },
  });

  if (!sessionLiee) {
    return {
      error:
        "Aucune session n'est rattachée à ce devis. Créez la session de formation depuis ce devis, puis relancez la transformation : une convention porte des dates, une modalité et un effectif, qu'un devis seul ne fournit pas.",
    };
  }

  const convention = await genererConventionAction({ sessionId: sessionLiee.id });
  if ("error" in convention) {
    // On ne bascule PAS le statut : mieux vaut un devis « accepté » sur lequel on
    // peut réessayer qu'un devis qui se déclare transformé sans sa convention.
    return {
      error: `La convention n'a pas pu être générée pour la session ${sessionLiee.numero} — ${convention.error}. Le devis reste « accepté ».`,
    };
  }

  await prisma.devis.update({
    where: { id: idParsed.data },
    data: { statut: "transforme_convention" },
  });

  await logQualiopiActivity({
    action: "qualiopi.devis.transform_convention",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: {
      statut: "transforme_convention",
      sessionId: sessionLiee.id,
      conventionNumero: convention.data.numero,
    },
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

  const refuse = await prisma.devis.update({
    where: { id: idParsed.data },
    data: { statut: "refuse", declinedAt: new Date() },
    select: { documentGenereId: true },
  });

  // 🔴 Le lien de signature MEURT avec le devis refusé.
  //
  // Sans cela, le client garde un lien vivant sur un devis retiré, et rien
  // n'empêche sa signature de s'inscrire — chaînée, scellée, irrévocable
  // autrement que par révocation explicite — sur une pièce que l'organisme
  // vient de refuser. `signerDevisParJetonAction` refuse désormais aussi sur le
  // statut ; ce sont DEUX gardes, et ce n'est pas redondant : celle-ci ferme la
  // porte, celle-là refuse d'ouvrir. Fermer seulement l'une des deux laisserait
  // la fenêtre entre le refus et la prochaine tentative.
  //
  // ⚠️ Révoquer un JETON ne touche aucune signature déjà apposée : cela ferme un
  // accès, cela n'efface pas une preuve.
  let liensRevoques = 0;
  if (refuse.documentGenereId !== null) {
    liensRevoques = await revoquerTokensDocument({
      documentGenereId: refuse.documentGenereId,
      motif: "Devis refusé",
      parAdminId: session.userId,
    });
  }

  await logQualiopiActivity({
    action: "qualiopi.devis.decline",
    targetType: "Devis",
    targetId: idParsed.data,
    changes: { statut: "refuse", liensSignatureRevoques: liensRevoques },
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
    // F63 — le comptage ignorait l'année alors que le numéro l'estampille :
    // le 1er janvier, la séquence aurait repris au rang global au lieu de 001.
    // 🔴 V20 — même série que la création : même mécanique obligatoirement.
    const numero = await nextNumero("devis", year, (prefixe) =>
      prisma.devis.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
    );
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
