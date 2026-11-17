/**
 * Qualiopi — Server Actions CRM devis (T2).
 *
 * createDevisAction  : crée un devis brouillon (lignes, montant, numéro, TVA, validité).
 * sendDevisAction    : verrou, PDF + lien de signature MAISON « bon pour accord » (jeton
 *                      `/portail/signer/`) + courriel, PUIS seulement bascule statut → envoyé
 *                      (+ expire l'ancienne version si révision) + statut client. Rien n'est écrit
 *                      « envoyé » si rien n'est parti (B1).
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
import { cloreVersionRemplacee } from "@/server/qualiopi/devis/version-remplacee";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import {
  nomPourSalutationDevis,
  payloadDevisEnvoi,
} from "@/server/qualiopi/devis/email-devis-envoi";
import {
  donneesPdfDevis,
  lireContextePdfDevis,
  OffreDevisInvalideError,
} from "@/server/qualiopi/documents/donnees-pdf-devis";
import { publicUrl } from "@/lib/public-url";
import {
  creerTokenDocument,
  revoquerTokensDocument,
} from "@/server/qualiopi/documents/signature/token-document";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import type { MotifRetenue } from "@/server/email/verdict-envoi";
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

/** Refus d'envoi : le message est celui affiché à l'admin ; `motif` (code court) va au journal. */
class EnvoiRefuse extends Error {
  constructor(
    message: string,
    readonly motif: string,
  ) {
    super(message);
  }
}
/** Le verrou d'envoi de ce devis est déjà pris (autre clic, autre onglet). */
class EnvoiDejaEnCours extends EnvoiRefuse {}
/** Le courriel n'est PAS parti (retenu, corbeille ou file indisponible, essai bloqué, exception). */
class EnvoiNonParti extends EnvoiRefuse {}

/** Gabarit du courriel d'envoi (lu par la garde « déjà garé » ET passé à la file : un seul point). */
const GABARIT_DEVIS_ENVOI = "devis-envoi" as const;

const MSG_RIEN_NE_PART = "Rien n'est parti ; le devis reste en brouillon.";
const MSG_PAS_EMAIL = `Ce client n'a pas d'adresse e-mail de contact. Ajoutez-la sur sa fiche, puis renvoyez le devis. ${MSG_RIEN_NE_PART}`;
/** Ajoutée aux refus d'un devis CLASSIQUE seulement : un devis à formules se signe en ligne. */
const MSG_MAIN_PROPRE =
  " Si vous remettez le devis en main propre, utilisez « Remis en main propre » sur la fiche du devis.";
const MSG_PDF_RATE = `Le PDF du devis n'a pas pu être créé. ${MSG_RIEN_NE_PART} Réessayez dans un instant.`;
const MSG_VERROU =
  "Cet envoi est déjà en cours. Patientez quelques secondes, puis rechargez la page.";
const MSG_DEJA_ENVOYE =
  "Ce devis a déjà été envoyé : rien n'a été renvoyé. Pour le transmettre de nouveau, utilisez « Renvoyer par email ».";
const MSG_DEJA_GARE =
  "Un e-mail de ce devis attend déjà dans Emails → À valider : validez-le ou refusez-le avant de renvoyer.";
const MSG_CORBEILLE =
  "La corbeille « E-mails à valider » est indisponible : rien n'est parti ; le devis reste en brouillon. Réessayez quand l'alerte est levée.";
const MSG_ESSAI =
  "Session d'essai : cette adresse n'est pas dans la liste des adresses d'essai. Rien n'est parti.";
const MSG_FILE =
  "La file d'envoi des e-mails est indisponible : rien n'est parti ; le devis reste en brouillon. Réessayez plus tard.";
const MSG_JETON = `Le lien de signature n'a pas pu être créé. ${MSG_RIEN_NE_PART} Réessayez dans un instant.`;
const MSG_APRES_COURRIEL =
  "L'e-mail est parti (ou attend validation), mais le devis n'a pas pu être marqué envoyé. Ne le renvoyez pas : prévenez le support technique.";

const MOTIFS_RETENUE: Record<MotifRetenue, string> = {
  rebond_dur: "adresse injoignable (rebond)",
  desabonne: "désabonnement",
  oppose: "opposition",
  ecarte_effacement: "adresse écartée à la suite d'une demande d'effacement",
};

/**
 * Marque le devis comme envoyé (statut → envoye, sentAt = now).
 * Fait passer le client de prospect à devis_envoye (jamais un statut plus avancé).
 *
 * 🔴 B1 — « envoyé » ne s'écrit QUE si un courriel est réellement parti (enfilé) ou garé
 * pour validation. Ordre, dans UNE transaction interactive :
 *   1. verrou consultatif non bloquant (deux clics simultanés : le second est refusé) ;
 *   2. relecture du devis DANS la transaction + gardes (déjà envoyé, formules, total,
 *      e-mail du client, courriel déjà garé) ;
 *   3. PDF (generateDocument) — un échec refuse l'envoi, pour TOUS les devis ;
 *   4. lien de signature « bon pour accord » — un échec refuse aussi l'envoi ;
 *   5. enqueueEmail, DERNIER effet externe, AVANT toute écriture : retenu, corbeille ou
 *      file indisponible, essai bloqué ou exception = refus ;
 *   6. écriture « envoye » gardée (`updateMany` sur le statut brouillon, `count === 1`),
 *      statut client, expiration de la version remplacée, révocation de ses jetons.
 * Hors transaction (catch) : si rien n'est parti, le jeton de la pièce neuve est révoqué ;
 * si une erreur survient APRÈS un courriel garé, sa ligne de corbeille passe à « refuse »
 * (jamais supprimée). La pièce numérotée déjà produite reste telle quelle.
 *
 * `fichierPdfUrl` stocke la CLÉ R2 stable `documents/{year}/devis/{numeroDocumentGenere}.pdf`
 * — pas l'URL signée (expirée en 900 s). Révision : si `replacesDevisId` n'est pas null,
 * l'ancienne version passe `expire` dans la MÊME transaction.
 */
export async function sendDevisAction(id: string): Promise<
  ActionResult<{
    id: string;
    emailEnvoye: boolean;
    signatureCreee: boolean;
    note?: string;
    /** `true` : l'e-mail attend dans Emails → À valider (il n'est pas encore parti). */
    garePourValidation?: boolean;
  }>
> {
  // Stub-aware (build GH Actions) : aucune mutation au SSG.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "Identifiant invalide" };
  const devisId = idParsed.data;

  // État visible depuis le `catch` : ce qui a déjà été produit, donc ce qu'il faut défaire.
  // (Objet : TypeScript ne suit pas les affectations faites dans le rappel de la transaction.)
  const etat: {
    documentGenereId: string | null;
    fichierPdfUrl: string | null;
    jetonCree: boolean;
    courriel: { etat: "gare"; outboxId: string | undefined } | { etat: "enfile" } | null;
    numeroDevis: string;
  } = {
    documentGenereId: null,
    fichierPdfUrl: null,
    jetonCree: false,
    courriel: null,
    numeroDevis: "",
  };

  try {
    const resultat = await prisma.$transaction(
      async (tx) => {
        // ── 1. Verrou consultatif non bloquant : un 2e envoi simultané est refusé sans attendre.
        const [verrou] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext(${"devis.envoi:" + devisId})) AS locked
        `;
        if (!verrou?.locked) throw new EnvoiDejaEnCours(MSG_VERROU, "verrou_pris");

        // ── 2. Relecture DANS la transaction, puis gardes dans l'ordre.
        const devis = await tx.devis.findUnique({
          where: { id: devisId },
          select: {
            id: true,
            numero: true,
            clientId: true,
            statut: true,
            // Version lue : l'écriture finale exige qu'elle n'ait pas bougé pendant le PDF.
            updatedAt: true,
            lignes: true,
            activite: true,
            refClient: true,
            replacesDevisId: true,
            // Devis à formules : l'envoi est refusé tant que la signature des formules n'existe pas.
            offre: true,
            // Avec `offre` : un devis CLASSIQUE n'a ni offre ni empreinte (message de refus).
            offreSha256: true,
            // Pièce de la version REMPLACÉE : son lien de signature doit mourir avec
            // elle (voir l'écriture plus bas).
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
                // 🔴 Repris comme QUALITÉ figée du signataire (opposabilité du POUVOIR de
                // signer au moment de l'engagement).
                contactFonction: true,
              },
            },
          },
        });
        if (!devis) throw new EnvoiRefuse("Devis introuvable", "introuvable");
        etat.numeroDevis = devis.numero;

        // (a) Seul un BROUILLON s'envoie. Le renvoi d'un devis déjà émis passe par
        // envoyerDevisEmailAction (e-mail seul, pas de nouveau lien).
        if (devis.statut === "envoye") throw new EnvoiRefuse(MSG_DEJA_ENVOYE, "deja_envoye");
        if (devis.statut !== "brouillon") {
          throw new EnvoiRefuse(
            `Seul un devis en brouillon peut être envoyé (statut actuel : ${devis.statut}).`,
            "statut_non_brouillon",
          );
        }
        // (b) Devis à formules : l'interrupteur `qualiopi.devis_formules.actif` doit être allumé.
        // Éteint, le PDF ignorerait l'offre et le client recevrait un devis classique vide.
        const aFormules = devis.offre !== null && devis.offre !== undefined;
        if (aFormules && !(await formulesActives())) {
          throw new EnvoiRefuse(
            "Ce devis à formules ne peut pas être envoyé tant que les devis à formules sont désactivés dans la configuration. Gardez-le en brouillon.",
            "formules_eteintes",
          );
        }
        // (c) Un devis CLASSIQUE à 0,00 € ne part pas en signature (le garde du formulaire ne
        // protège rien : l'action est appelable depuis un onglet resté ouvert). Un devis à
        // formules n'a pas de total de lignes : ses formules sont contrôlées plus bas.
        if (!aFormules && devis.montantTotalHtCents <= 0) {
          throw new EnvoiRefuse(
            "Devis à 0,00 € HT : chiffrez les lignes avant l'envoi (une offre sans prix ferme ne pré-remplit aucun montant).",
            "total_nul",
          );
        }
        // (d) TOUS les devis : sans e-mail de contact, ni courriel ni lien de signature.
        const contactEmail = devis.client.contactEmail;
        const classique = devis.offre === null && devis.offreSha256 === null;
        if (!contactEmail) {
          throw new EnvoiRefuse(
            classique ? MSG_PAS_EMAIL + MSG_MAIN_PROPRE : MSG_PAS_EMAIL,
            "pas_email",
          );
        }
        // (e) Un courriel de ce devis attend déjà dans la corbeille : pas de doublon.
        const dejaGare = await tx.emailOutbox.findFirst({
          where: {
            template: GABARIT_DEVIS_ENVOI,
            entityType: "Devis",
            entityId: devisId,
            statut: "a_valider",
          },
          select: { id: true },
        });
        if (dejaGare) throw new EnvoiRefuse(MSG_DEJA_GARE, "deja_gare");

        // Données du PDF : même fonction pure que l'aperçu du brouillon.
        let data: DevisData;
        try {
          const contexte = await lireContextePdfDevis();
          data = donneesPdfDevis(devis, contexte, new Date());
        } catch (err) {
          // Offre illisible : le message dit QUOI corriger, pas « PDF non créé ».
          if (err instanceof OffreDevisInvalideError) {
            throw new EnvoiRefuse(err.message, "offre_invalide");
          }
          console.warn("[sendDevisAction] données du PDF devis non construites", err);
          throw new EnvoiRefuse(MSG_PDF_RATE, "pdf_rate");
        }
        if (aFormules) {
          // Interrupteur allumé et offre présente : le PDF DOIT porter les formules.
          if (data.formules === undefined) {
            throw new EnvoiRefuse(
              "Les formules du devis n'ont pas pu être construites : envoi refusé.",
              "formules_absentes",
            );
          }
          // Remise 100 % — une formule dont le TOTAL est <= 0 est refusée si l'abonnement n'a
          // aucune période, OU si UNE SEULE période a une mensualité nette <= 0 : le client
          // choisit sa période, une période à 0 €/mois est un engagement ferme à zéro euro.
          const formuleVide = data.formules.formules.some((f) => {
            if (f.totalHtCents > 0) return false;
            const periodes = f.abonnement?.periodes ?? [];
            return periodes.length === 0 || periodes.some((p) => p.mensuelNetHtCents <= 0);
          });
          if (formuleVide) {
            throw new EnvoiRefuse(
              "Une formule du devis est à 0,00 € HT sans mensualité (ou avec une période à 0 €/mois) : chiffrez-la avant l'envoi.",
              "formule_vide",
            );
          }
        }

        // ── 3. PDF — un échec refuse l'envoi (tous les devis). La pièce numérotée déjà
        // produite reste telle quelle : rien n'est effacé.
        let pdfCle: string;
        let pieceId: string;
        try {
          const yearGeneration = new Date().getFullYear();
          const doc = await generateDocument({
            type: "devis",
            // Élément PRÉ-CONSTRUIT : le PDF affiche le numéro du Devis CRM.
            element: React.createElement(DevisPdf, { data }),
            identite: data.identite,
            refs: { clientId: devis.clientId },
          });
          if (!doc.id) throw new Error("pièce sans identifiant");
          // Clé R2 stable (l'URL signée retournée expire en 900 s — on stocke la clé).
          pdfCle = `documents/${yearGeneration}/devis/${doc.numero}.pdf`;
          pieceId = doc.id;
          etat.fichierPdfUrl = pdfCle;
          etat.documentGenereId = pieceId;
        } catch (err) {
          console.warn("[sendDevisAction] génération PDF devis échouée", err);
          throw new EnvoiRefuse(MSG_PDF_RATE, "pdf_rate");
        }

        // ── 4. Lien de signature MAISON « bon pour accord » (jeton `/portail/signer/`).
        // Un devis sans lien de signature ne sert à rien : un échec refuse l'envoi.
        // ⚠️ DocuSeal n'émet plus rien (30/07/2026) : `docusealSubmissionId` et
        // `docusealEmbedUrl` restent en base pour les anciens devis, sans nouvelle écriture.
        let signatureUrl: string;
        try {
          const { token } = await creerTokenDocument({
            documentGenereId: pieceId,
            // Le client est la partie qui reçoit le lien — l'organisme contresigne depuis la
            // console, authentifié, et n'a donc jamais de jeton.
            partie: "client",
            // 🔴 Identité résolue depuis la FICHE CLIENT, côté serveur, et figée.
            signataireNom: devis.client.contactNom ?? devis.client.raisonSociale,
            signataireEmail: contactEmail,
            signataireQualite: devis.client.contactFonction,
            // La date de validité borne le lien : tenir une offre ferme au-delà n'aurait aucun sens.
            borneMetier: devis.dateValidite,
          });
          signatureUrl = publicUrl(`/fr/portail/signer/${token}`).toString();
        } catch (err) {
          // Aucune donnée client dans le journal : le détail reste dans les logs serveur.
          console.warn("[sendDevisAction] émission du lien de signature échouée", err);
          throw new EnvoiRefuse(MSG_JETON, "jeton_rate");
        }
        etat.jetonCree = true;

        // ── 5. Courriel : DERNIER effet externe, AVANT toute écriture. « Parti » = enfilé ou
        // garé pour validation ; tout le reste est un refus.
        let verdict: Awaited<ReturnType<typeof enqueueEmail>>;
        try {
          verdict = await enqueueEmail(
            GABARIT_DEVIS_ENVOI,
            contactEmail,
            "fr",
            payloadDevisEnvoi({
              clientNom: nomPourSalutationDevis(devis.client),
              numero: devis.numero,
              montantTotalHtCents: devis.montantTotalHtCents,
              montantLabel: `${eurHt(devis.montantTotalHtCents)} HT`,
              dateValiditeLabel: devis.dateValidite.toLocaleDateString("fr-FR"),
              formules: data.formules,
              signatureUrl,
            }),
            {
              attachments: [{ filename: `${devis.numero}.pdf`, r2Key: pdfCle }],
              entityType: "Devis",
              entityId: devis.id,
            },
          );
        } catch (err) {
          console.warn("[sendDevisAction] enqueueEmail a levé une exception", err);
          throw new EnvoiNonParti(MSG_FILE, "file_exception");
        }
        if (verdict.garePourValidation === true) {
          etat.courriel = { etat: "gare", outboxId: verdict.outboxId };
        } else if (verdict.enqueued === true) {
          etat.courriel = { etat: "enfile" };
        } else if (verdict.retenu !== undefined) {
          throw new EnvoiNonParti(
            `L'adresse du client est bloquée (${MOTIFS_RETENUE[verdict.retenu]}). ${MSG_RIEN_NE_PART} Corrigez l'adresse sur la fiche client.` +
              (classique ? MSG_MAIN_PROPRE : ""),
            "retenu",
          );
        } else if (verdict.corbeilleIndisponible === true) {
          throw new EnvoiNonParti(MSG_CORBEILLE, "corbeille_indisponible");
        } else if (verdict.essaiBloque === true) {
          throw new EnvoiNonParti(MSG_ESSAI, "essai_bloque");
        } else {
          throw new EnvoiNonParti(MSG_FILE, "file_absente");
        }

        // ── 6. Écritures, toujours dans `tx` : envoye + statut client + expiration de la
        // version remplacée. « Devis émis » vers Axion Partners dans la MÊME transaction
        // (INT-T46-A ; canal fermé : rien n'est lu, écritures atomiques à l'identique).
        const marque = await tx.devis.updateMany({
          // `updatedAt` : un enregistrement du brouillon survenu pendant le PDF fait tomber
          // l'écriture à `count: 0` (le client aurait reçu un PDF et un montant périmés).
          where: { id: devisId, statut: "brouillon", updatedAt: devis.updatedAt },
          data: {
            statut: "envoye",
            sentAt: new Date(),
            fichierPdfUrl: pdfCle,
            // 🔴 Rattachement à la pièce numérotée : c'est lui qui permet à la signature de
            // désigner CE devis-ci (`accepterDevisSurSignature` ne retrouverait rien sinon).
            documentGenereId: pieceId,
          },
        });
        if (marque.count !== 1) {
          throw new Error(`devis non passé à « envoye » (${marque.count} ligne modifiée)`);
        }
        // Écriture GARDÉE : seul un PROSPECT (ou un prospect « perdu » qui reçoit un nouveau
        // devis) devient « devis envoyé » ; un client plus avancé n'est jamais rétrogradé.
        await tx.client.updateMany({
          where: { id: devis.clientId, statut: { in: ["prospect", "perdu"] } },
          data: { statut: "devis_envoye" },
        });
        // Révision : l'ancienne version passe `expire` et son lien de signature est révoqué,
        // dans la MÊME transaction (code partagé avec la remise en main propre).
        await cloreVersionRemplacee(tx, {
          replacesDevisId: devis.replacesDevisId,
          documentGenereIdRemplace: devis.replacesDevis?.documentGenereId,
          numero: devis.numero,
        });
        await emettreDevisEmis(tx, devisId);

        return {
          enqueued: verdict.enqueued === true,
          garePourValidation: verdict.garePourValidation === true,
          devisExpire: devis.replacesDevisId,
        };
      },
      { maxWait: 5_000, timeout: 60_000 },
    );

    // Un courriel garé n'est pas encore parti : la note le dit (inchangée).
    const note = resultat.garePourValidation
      ? "Devis marqué envoyé. L'email attend votre validation dans Emails → À valider ; il partira une fois approuvé."
      : undefined;

    await logQualiopiActivity({
      action: "qualiopi.devis.send",
      targetType: "Devis",
      targetId: devisId,
      changes: {
        statut: "envoye",
        pdfGenere: true,
        documentGenereId: etat.documentGenereId,
        // ⚠️ Le LIEN lui-même n'est jamais journalisé : il vaut signature.
        lienSignatureEmis: true,
        emailEnvoye: resultat.enqueued,
        garePourValidation: resultat.garePourValidation,
        devisExpire: resultat.devisExpire,
      },
      session,
    });

    return {
      data: {
        id: devisId,
        emailEnvoye: resultat.enqueued,
        signatureCreee: true,
        ...(note !== undefined ? { note } : {}),
        ...(resultat.garePourValidation ? { garePourValidation: true } : {}),
      },
    };
  } catch (err) {
    const refus = err instanceof EnvoiRefuse ? err : null;
    const motif =
      refus !== null ? refus.motif : etat.courriel !== null ? "apres_courriel" : "erreur_technique";

    // Rien n'est parti : le lien de signature de la pièce neuve est révoqué. S'il est enfilé,
    // le courriel (donc le lien) est déjà chez le client : on ne le révoque pas.
    if (etat.jetonCree && etat.documentGenereId !== null && etat.courriel?.etat !== "enfile") {
      try {
        await revoquerTokensDocument({
          documentGenereId: etat.documentGenereId,
          motif: "Envoi annulé : rien n'est parti",
        });
      } catch (e) {
        console.warn("[sendDevisAction] révocation du lien après refus échouée", e);
        Sentry.captureException(e, { tags: { action: "sendDevisAction.revocation" } });
      }
    }

    // Erreur APRÈS un courriel garé ou enfilé : le devis n'est pas « envoye » mais le client
    // peut recevoir un message. Garé : la ligne de corbeille est refusée (mise à jour, jamais
    // supprimée). Enfilé : on ne sait plus l'arrêter, on alerte.
    const courriel = etat.courriel;
    if (courriel !== null) {
      Sentry.captureException(err, { tags: { action: "sendDevisAction.apres_courriel" } });
      if (courriel.etat === "enfile") {
        // Message sans adresse, sans lien, sans jeton.
        Sentry.captureMessage(
          `Devis ${etat.numeroDevis} : courriel enfilé mais devis non marqué envoyé. Le lien de signature reçu par le client ne retrouvera pas le devis : renvoyer le devis depuis sa fiche.`,
          { level: "error", tags: { action: "sendDevisAction.apres_courriel_enfile" } },
        );
      }
      if (courriel.etat === "gare" && courriel.outboxId !== undefined) {
        try {
          await prisma.emailOutbox.update({
            where: { id: courriel.outboxId },
            data: {
              statut: "refuse",
              refuseAt: new Date(),
              refuseMotif: "Devis non marqué envoyé (erreur base)",
            },
          });
        } catch (e) {
          console.warn("[sendDevisAction] refus de la ligne de corbeille échoué", e);
          Sentry.captureException(e, { tags: { action: "sendDevisAction.refus_corbeille" } });
        }
      } else {
        // Aucune adresse ni lien dans l'alerte : Telegram est un canal tiers.
        sendTelegram({
          tag: "AUTO",
          body: `🔴 Devis ${etat.numeroDevis} : le courriel est parti mais le devis n'a PAS été marqué envoyé. Le lien de signature reçu par le client ne retrouvera pas le devis : renvoyer le devis depuis sa fiche.`,
        }).catch(() => {});
      }
    }

    if (motif !== "introuvable") {
      try {
        await logQualiopiActivity({
          action: "qualiopi.devis.send_refuse",
          targetType: "Devis",
          targetId: devisId,
          // Le MOTIF seulement : ni adresse, ni lien.
          changes: { motif },
          session,
        });
      } catch (e) {
        console.warn("[sendDevisAction] journal du refus échoué", e);
      }
    }

    if (refus !== null) return { error: refus.message };
    if (courriel !== null) return { error: MSG_APRES_COURRIEL };
    throw err;
  }
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
