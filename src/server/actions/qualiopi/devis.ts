/**
 * Qualiopi — Server Actions CRM devis (T2).
 *
 * createDevisAction  : crée un devis brouillon (lignes, montant, numéro, TVA, validité).
 * sendDevisAction    : génère le PDF (fail-soft) + lien de signature MAISON « bon pour
 *                      accord » (jeton `/portail/signer/`, best-effort) puis bascule statut → envoyé
 *                      (+ expire l'ancienne version si révision) + statut client.
 * acceptDevisAction  : bascule statut → accepté.
 * declineDevisAction : bascule statut → refusé.
 * reviseDevisAction  : crée une NOUVELLE version brouillon (replacesDevisId).
 *
 * TVA : régime lu dans la config (`regime_tva`), JAMAIS codé en dur.
 * Montants : TOUJOURS en CENTIMES (Int). Zéro valeur en dur.
 */

"use server";

import { proposerPlansApresAcceptation } from "@/server/qualiopi/devis/proposer-plans";
import * as Sentry from "@sentry/nextjs";
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
import {
  entreeDevisClassiqueSchema,
  estimationOpcoDevis,
  mentionTvaDevisClassique,
  totalHtClassiqueCents,
} from "@/server/qualiopi/devis/champs-classiques";
import {
  lierDevisAuProjet,
  projetOuvrableDuClient,
  recopierLienProjet,
} from "@/server/qualiopi/crm/devis-projet";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import {
  emettreDevisEmis,
  emettreDevisSigne,
  transactionDevisSigne,
} from "@/server/partners-sync/producteurs/devis";
import { faireMonterLesFichesDesDevisSignes } from "@/features/dossier-client/devis-signe-fait-client";
import { bandeauPourLeRole } from "@/server/partners/client-attributions";
import { sirenDuClient } from "@/lib/siret";
import { DevisPdf, type DevisData } from "@/server/qualiopi/documents/templates/devis";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { payloadDevisEnvoi } from "@/server/qualiopi/devis/email-devis-envoi";
import type { VueFormules } from "@/server/qualiopi/devis/vue-formules";
import {
  donneesPdfDevis,
  lireContextePdfDevis,
  OffreDevisInvalideError,
} from "@/server/qualiopi/documents/donnees-pdf-devis";
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

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * INT-T07-A (REQ-INT-014) : le bandeau d'attribution d'Axion Partners pour le client choisi, AVANT
 * l'envoi du devis (décision D3 de Williams). Le rôle est jugé ici, au serveur, avant tout appel :
 * seul un rôle qui crée un devis reçoit le texte. Le SIREN est relu en base, jamais reçu du
 * navigateur. Seul le TEXTE du bandeau sort : il n'entre ni dans le devis, ni dans un document, ni
 * dans le journal. Une panne de Partners ne bloque jamais le devis (échec ouvert).
 */
export async function lireBandeauAttributionAction(clientId: string): Promise<string | null> {
  const session = await requireAdminWrite();
  if (!z.string().uuid().safeParse(clientId).success) return null;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { siren: true, siret: true },
  });
  // Le SIREN se lit aussi dans le SIRET (règle unique `sirenDuClient`, lot A9).
  return bandeauPourLeRole(session.role, client === null ? null : sirenDuClient(client));
}

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
  input: z.infer<typeof entreeDevisClassiqueSchema>,
): Promise<ActionResult<{ id: string; numero: string }>> {
  // Stub-aware (build GH Actions) : aucune mutation au SSG.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
  const parsed = entreeDevisClassiqueSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;
  if (v.projetId !== undefined && !(await projetOuvrableDuClient(prisma, v.projetId, v.clientId))) {
    return { error: "Ce projet n'appartient pas à ce client (ou a été fusionné)." };
  }

  // Calculer le total HT en centimes
  const montantTotalHtCents = totalHtClassiqueCents(v.lignes);

  const year = new Date().getFullYear();

  // Date de validité : +30 jours
  const dateValidite = new Date();
  dateValidite.setDate(dateValidite.getDate() + 30);

  // Estimation OPCO si applicable (extraction pure : champs-classiques.ts)
  const {
    montantOpcoEstimeCents,
    opcoEstimationOrigine,
    opcoEstimationAvertissement,
    resteAChargeCents,
  } = await estimationOpcoDevis(v, montantTotalHtCents, dateValidite);

  // 🔴 Audit certification 2026-07-26 (F25) — le régime de TVA se LIT (cf. champs-classiques.ts).
  const mentionTvaCreation = await mentionTvaDevisClassique();

  // Allocation numéro séquentiel + insertion, avec retry sur collision (R7).
  // Chantier visio (PR 7) : le devis et son lien au projet dans UNE transaction,
  // À L'INTÉRIEUR de `withNumberRetry` — une collision de numéro annule les
  // deux, et la reprise repart de zéro (aucun lien orphelin).
  const created = await withNumberRetry(() =>
    prisma.$transaction(async (tx) => {
      // F63 — le comptage ignorait l'année alors que le numéro l'estampille :
      // le 1er janvier, la séquence aurait repris au rang global au lieu de 001.
      // 🔴 V20 — borne haute, pas cardinalité. Le `startsWith` posé par F63
      // corrigeait le DÉNOMINATEUR (compter la bonne année) mais pas la MÉCANIQUE :
      // un devis supprimé faisait toujours reculer le compteur, et
      // `withNumberRetry` rejouait le même `count()` — cinq fois le même numéro.
      const numero = await nextNumero("devis", year, (prefixe) =>
        tx.devis.findMany({
          where: { numero: { startsWith: prefixe } },
          select: { numero: true },
        }),
      );
      const devis = await tx.devis.create({
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
          ...(v.financementSuggere !== undefined
            ? { financementSuggere: v.financementSuggere }
            : {}),
          ...(montantOpcoEstimeCents !== undefined ? { montantOpcoEstimeCents } : {}),
          ...(opcoEstimationOrigine !== undefined ? { opcoEstimationOrigine } : {}),
          ...(opcoEstimationAvertissement !== undefined ? { opcoEstimationAvertissement } : {}),
          ...(resteAChargeCents !== undefined ? { resteAChargeCents } : {}),
        },
        select: { id: true, numero: true },
      });
      if (v.projetId !== undefined) {
        await lierDevisAuProjet(tx, {
          devisId: devis.id,
          projetId: v.projetId,
          clientId: v.clientId,
          lieParId: session.userId,
        });
      }
      return devis;
    }),
  );

  await logQualiopiActivity({
    action: "qualiopi.devis.create",
    targetType: "Devis",
    targetId: created.id,
    changes: {
      numero: created.numero,
      clientId: v.clientId,
      montantTotalHtCents,
      financementSuggere: v.financementSuggere,
      ...(v.projetId !== undefined ? { projetId: v.projetId } : {}),
    },
    session,
  });

  return { data: { id: created.id, numero: created.numero } };
}

/**
 * Marque le devis comme envoyé (statut → envoye, sentAt = now).
 * Fait passer le client de prospect à devis_envoye (jamais un statut plus avancé).
 *
 * Avant la bascule :
 *   1. PDF (fail-soft) : rendu DevisPdf via generateDocument type "devis"
 *      (élément PRÉ-CONSTRUIT — le numéro visible est celui du Devis CRM, le
 *      numéro DocumentGenere ne sert qu'au registre). `fichierPdfUrl` stocke la
 *      CLÉ R2 stable `documents/{year}/devis/{numeroDocumentGenere}.pdf` — pas
 *      l'URL signée (expirée en 900 s).
 *   2. Signature MAISON (best-effort) : jeton `/portail/signer/` « bon pour accord »
 *      si la pièce est générée et le client a un e-mail de contact (DocuSeal
 *      n'émet plus rien depuis le 30/07/2026).
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
      // Devis à formules : l'envoi est refusé tant que la signature des formules n'existe pas.
      offre: true,
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
          // 🔴 2026-08-25, cahier D4-3 — sans `type`, le devis d'un particulier
          // s'intitulait « Raison sociale : Prenom Nom » et lui opposait une
          // clause sur « toutes conditions d'achat du client », qu'il n'a pas.
          type: true,
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
  // depuis une UI périmée / 2e onglet de réémettre un lien de signature (qui
  // révoquerait le précédent et orphelinerait le lien déjà reçu) et de renvoyer
  // un 2e email au client. Le renvoi d'un devis déjà émis passe par
  // envoyerDevisEmailAction (email seul, pas de nouveau lien).
  if (devis.statut !== "brouillon") {
    return {
      error: `Seul un devis en brouillon peut être envoyé (statut actuel : ${devis.statut}).`,
    };
  }
  // Devis à formules : l'interrupteur `qualiopi.devis_formules.actif` doit être allumé. Éteint,
  // le PDF ignorerait l'offre et le client recevrait un devis classique vide : échec FERMÉ.
  const aFormules = devis.offre !== null && devis.offre !== undefined;
  if (aFormules && !(await formulesActives())) {
    return {
      error:
        "Ce devis à formules ne peut pas être envoyé tant que les devis à formules sont désactivés dans la configuration. Gardez-le en brouillon.",
    };
  }
  // Un devis CLASSIQUE à 0,00 € ne doit pas partir en signature.
  //
  // Le garde côté formulaire ne protège rien : cette action est appelable depuis
  // un onglet resté ouvert, et `ligneSchema` accepte volontairement un PU à 0
  // (lignes offertes). C'est ICI que le montant total doit être vérifié — au-delà,
  // le PDF est rendu, un lien de signature est émis et le client reçoit une offre
  // ferme à zéro euro. `ligneSchema.min(0)` reste inchangé.
  // Un devis à formules n'a pas de total de lignes : son montant se détermine au choix du
  // client, il est contrôlé sur les formules plus bas.
  if (!aFormules && devis.montantTotalHtCents <= 0) {
    return {
      error:
        "Devis à 0,00 € HT : chiffrez les lignes avant l'envoi (une offre sans prix ferme ne pré-remplit aucun montant).",
    };
  }

  // Devis à formules : sans e-mail de contact, pas de lien de signature, donc pas de choix de
  // formule possible. Refus avant tout rendu.
  if (aFormules && !devis.client.contactEmail) {
    return {
      error:
        "Aucun email de contact client : un devis à formules ne peut pas être envoyé sans lien de signature (le client y choisit sa formule).",
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
  /** Formules du PDF envoyé (devis à formules) : l'e-mail décrit exactement ce PDF. */
  let formulesEnvoyees: VueFormules | undefined;
  try {
    // Données du PDF : même fonction pure que l'aperçu du brouillon.
    const contexte = await lireContextePdfDevis();
    const identite = contexte.identite;
    const data: DevisData = donneesPdfDevis(devis, contexte, new Date());
    formulesEnvoyees = data.formules;

    if (aFormules) {
      // Interrupteur allumé et offre présente : le PDF DOIT porter les formules.
      if (data.formules === undefined) {
        return { error: "Les formules du devis n'ont pas pu être construites : envoi refusé." };
      }
      // Remise 100 % — règle : une formule dont le TOTAL est <= 0 est refusée si l'abonnement
      // n'a aucune période, OU si UNE SEULE période a une mensualité nette <= 0. Le client
      // choisit sa période : une période à 0 €/mois (ex. [{1 mois, remise 100 %}, {12 mois, 0}])
      // est un engagement ferme à zéro euro, même si une autre période est payante.
      const formuleVide = data.formules.formules.some((f) => {
        if (f.totalHtCents > 0) return false;
        const periodes = f.abonnement?.periodes ?? [];
        return periodes.length === 0 || periodes.some((p) => p.mensuelNetHtCents <= 0);
      });
      if (formuleVide) {
        return {
          error:
            "Une formule du devis est à 0,00 € HT sans mensualité (ou avec une période à 0 €/mois) : chiffrez-la avant l'envoi.",
        };
      }
    }

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
    console.warn("[sendDevisAction] génération PDF devis échouée", err);
    // Offre illisible : le message dit QUOI corriger, pas « PDF non généré ».
    if (err instanceof OffreDevisInvalideError) return { error: err.message };
    // Devis à formules : sans PDF, pas de pièce ni de lien de signature à envoyer. Le devis
    // reste en brouillon, rien n'est écrit, aucun e-mail ne part. (Devis classique : fail-soft.)
    if (aFormules) {
      return {
        error:
          "Le PDF du devis à formules n'a pas pu être généré : envoi annulé, le devis reste en brouillon.",
      };
    }
  }
  if (aFormules && documentGenereId === null) {
    return {
      error: "Aucune pièce à signer n'a été produite : envoi annulé, le devis reste en brouillon.",
    };
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
  // ⚠️ DocuSeal n'émet plus rien : `docusealSubmissionId` et `docusealEmbedUrl` restent en
  // base pour les anciens devis (le webhook ne les traite que si la soumission reçue est
  // celle enregistrée sur le devis) et ne reçoivent plus d'écriture.
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
  // Devis à formules : le choix de la formule passe PAR ce lien. Jamais « envoyé » sans lien
  // (ni destinataire) : refus avant la transaction, aucun e-mail.
  if (aFormules && !signatureCreee) {
    return {
      error: `Le lien de signature n'a pas pu être créé${
        signatureErreur !== null ? ` (${signatureErreur})` : ""
      } : un devis à formules ne peut pas être envoyé sans lien (le client y choisit sa formule). Le devis reste en brouillon.`,
    };
  }

  // ── 3. Transaction : envoye + statut client + expiration de la version remplacée ──
  // INT-T46-A : une transaction INTERACTIVE (et non plus un tableau), pour que le fait
  // « devis émis » s'écrive dans la MÊME transaction que l'envoi. Canal fermé, l'émission rend
  // null sans rien lire : les écritures restent atomiques, à l'identique.
  await prisma.$transaction(async (tx) => {
    await tx.devis.update({
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
    });
    // Écriture GARDÉE : seul un PROSPECT (ou un prospect « perdu » qui reçoit un nouveau devis) devient « devis envoyé ». Un client actif (ou inactif)
    // à qui l'on envoie un nouveau devis garde son statut — il ne doit jamais être
    // rétrogradé. 0 ligne modifiée est le cas normal d'un client déjà plus avancé : ni erreur ni note.
    await tx.client.updateMany({
      where: { id: devis.clientId, statut: { in: ["prospect", "perdu"] } },
      data: { statut: "devis_envoye" },
    });
    // Révision : l'ancienne version passe `expire` — jamais d'écrasement.
    if (devis.replacesDevisId !== null) {
      await tx.devis.update({
        where: { id: devis.replacesDevisId },
        data: { statut: "expire" as const },
      });
    }
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
    if (devis.replacesDevis?.documentGenereId != null) {
      await tx.documentSignatureToken.updateMany({
        where: { documentGenereId: devis.replacesDevis.documentGenereId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedMotif: `Devis révisé — remplacé par ${devis.numero}`,
        },
      });
    }
    // INT-T46-A : « devis émis » vers Axion Partners, une fois par devis (clé devis.emis:<id>).
    await emettreDevisEmis(tx, idParsed.data);
  });

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
      payloadDevisEnvoi({
        clientNom: devis.client.raisonSociale,
        numero: devis.numero,
        montantTotalHtCents: devis.montantTotalHtCents,
        montantLabel: `${eurHt(devis.montantTotalHtCents)} HT`,
        dateValiditeLabel: devis.dateValidite.toLocaleDateString("fr-FR"),
        formules: formulesEnvoyees,
        signatureUrl,
      }),
      {
        attachments: [{ filename: `${devis.numero}.pdf`, r2Key: fichierPdfUrl }],
        entityType: "Devis",
        entityId: devis.id,
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
    note = `${prefixe}⚠️ Le lien de signature n'a PAS pu être créé${detail} : le client ne peut pas signer en ligne. ${aFormules ? "Réviser le devis pour réessayer." : "Lui faire retourner le PDF signé, ou réviser le devis pour réessayer."}`;
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
      // `"docusealSubmissionId": null` (ancien canal) sans jamais dire pourquoi, et les logs du
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

class AcceptationManuelleRefusee extends Error {}
class AcceptationStatutRefuse extends Error {}

/**
 * Marque le devis comme accepté (statut → accepte, acceptedAt = now).
 */
export async function acceptDevisAction(id: string): Promise<ActionResult<{ id: string }>> {
  // Acte ENGAGEANT : accepter un devis conclut le contrat au nom de l'organisme.
  const session = await requireHabilitation("conclure_devis");
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };

  // INT-T04 (REQ-INT-007) : l'acceptation et l'événement `devis.signe` dans UNE transaction.
  const devisId = idParsed.data;
  try {
    await transactionDevisSigne(prisma, async (tx) => {
      // Devis À FORMULES (lot 4) : sans formule retenue il n'y a ni lignes ni total à facturer.
      // Une acceptation manuelle ne porte aucun choix scellé : elle est refusée, la signature du
      // client puis la contresignature d'Axion-IA sont la seule voie.
      const formules = await tx.devis.findUnique({
        where: { id: devisId },
        select: { statut: true, offreSha256: true, formuleRetenue: true },
      });
      // Garde de statut CÔTÉ SERVEUR : seul un devis envoyé (ou expiré, signature tardive) peut
      // être accepté. Un devis déjà accepté ou transformé en convention n'est jamais ré-accepté
      // (`acceptedAt` réécrit, statut ramené à `accepte`) : refus sans écriture ni émission.
      if (formules === null || (formules.statut !== "envoye" && formules.statut !== "expire")) {
        throw new AcceptationStatutRefuse();
      }
      if (formules.offreSha256 != null && formules.formuleRetenue == null) {
        throw new AcceptationManuelleRefusee();
      }
      await tx.devis.update({
        where: { id: devisId },
        data: { statut: "accepte", acceptedAt: new Date() },
      });
      await emettreDevisSigne(tx, devisId);
    });
  } catch (err) {
    if (err instanceof AcceptationStatutRefuse) {
      return {
        error: "Seul un devis envoyé (ou expiré) peut être accepté. Rechargez la page.",
      };
    }
    if (err instanceof AcceptationManuelleRefusee) {
      return {
        error:
          "Ce devis propose des formules : il ne peut être accepté que par la signature du client suivie de votre contresignature.",
      };
    }
    throw err;
  }
  // Un prospect passe en client lorsqu'un devis est signé (Will, 04/11/2026) : APRÈS le COMMIT,
  // hors transaction (B1) ; une erreur ne touche jamais l'acceptation.
  try {
    await faireMonterLesFichesDesDevisSignes(prisma, [devisId], {
      origine: "console",
      adminUserId: session.userId,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "devis_signe_fait_client" } });
  }
  // Devis à formules : plans récurrents PROPOSÉS en `pause` (lot 5), après le COMMIT, fail-soft.
  const echecPlans = await proposerPlansApresAcceptation(devisId, "console");
  if (typeof echecPlans === "string") {
    // Jamais ignoré : l'acceptation reste valable, mais l'alerte « plans non proposés » de la
    // fiche devis permet la reprise ; on journalise le code pour la trace.
    Sentry.captureMessage("devis_formules: plans non proposés après acceptation console", {
      level: "warning",
      tags: { action: "devis_plan_recurrent", origine: "console", code: echecPlans },
      extra: { devisId },
    });
  }

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
      opcoEstimationOrigine: true,
      opcoEstimationAvertissement: true,
      resteAChargeCents: true,
      // Devis à formules : la révision reste éditable par /modifier, donc garde son offre.
      offre: true,
      offreSha256: true,
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

  // Allocation numéro séquentiel + insertion, avec retry sur collision (R7).
  // Chantier visio (PR 7) : la révision reste dans le projet de la version
  // qu'elle remplace — lien recopié dans la MÊME transaction. L'ancienne
  // version n'est pas touchée ici (elle passe `expire` à l'envoi).
  const created = await withNumberRetry(() =>
    prisma.$transaction(async (tx) => {
      // F63 — le comptage ignorait l'année alors que le numéro l'estampille :
      // le 1er janvier, la séquence aurait repris au rang global au lieu de 001.
      // 🔴 V20 — même série que la création : même mécanique obligatoirement.
      const numero = await nextNumero("devis", year, (prefixe) =>
        tx.devis.findMany({
          where: { numero: { startsWith: prefixe } },
          select: { numero: true },
        }),
      );
      const devis = await tx.devis.create({
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
          ...(origine.opcoEstimationOrigine !== null
            ? { opcoEstimationOrigine: origine.opcoEstimationOrigine }
            : {}),
          ...(origine.opcoEstimationAvertissement !== null
            ? { opcoEstimationAvertissement: origine.opcoEstimationAvertissement }
            : {}),
          ...(origine.resteAChargeCents !== null
            ? { resteAChargeCents: origine.resteAChargeCents }
            : {}),
          ...(origine.offre !== null && origine.offre !== undefined
            ? { offre: origine.offre as never }
            : {}),
          ...(origine.offreSha256 !== null && origine.offreSha256 !== undefined
            ? { offreSha256: origine.offreSha256 }
            : {}),
        },
        select: { id: true, numero: true },
      });
      await recopierLienProjet(tx, {
        ancienDevisId: origine.id,
        nouveauDevisId: devis.id,
        lieParId: session.userId,
      });
      return devis;
    }),
  );

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
