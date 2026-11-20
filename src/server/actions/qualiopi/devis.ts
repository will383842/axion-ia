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
import type { Prisma } from "../../../../prisma/generated/client";
import { masquerLienSignaturePayload } from "@/server/email/masquer-lien-signature-payload";
import React from "react";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAdminWrite,
  requireHabilitation,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import { computeTotauxFacture, TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import {
  raisonEcheancierRefuse,
  TITRE_ECHEANCIER,
} from "@/server/qualiopi/devis/assistant/conditions-prix-unique";
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
import { emettreDevisSigne, transactionDevisSigne } from "@/server/partners-sync/producteurs/devis";
import { faireMonterLesFichesDesDevisSignes } from "@/features/dossier-client/devis-signe-fait-client";
import { bandeauPourLeRole } from "@/server/partners/client-attributions";
import { sirenDuClient } from "@/lib/siret";
import { DevisPdf, type DevisData } from "@/server/qualiopi/documents/templates/devis";
import {
  MSG_VERSION_REMPLACEE_ACCEPTEE,
  MSG_VERSION_REMPLACEE_SIGNEE_ENTRE_TEMPS,
  versionRemplaceeBloqueEmission,
  VersionRemplaceeSigneeEntreTempsError,
} from "@/server/qualiopi/devis/version-remplacee";
import { pasSigneParLeClient } from "@/server/qualiopi/devis/pas-signe-par-le-client";
import {
  SELECT_SIGNATURES_PIECE,
  signatureClientDuDevis,
} from "@/server/qualiopi/devis/signature-client-du-devis";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { offreDevisV1 } from "@/server/qualiopi/devis/offre-devis";
import { refusReglesFormules } from "@/server/qualiopi/devis/regles-commerciales";
import {
  CLE_SUJET_CHOISI,
  contenuEmailDevis,
  messageEntreeSchema,
  objetEntreeSchema,
} from "@/server/qualiopi/devis/contenu-email-devis";
import {
  donneesPdfDevis,
  lireContextePdfDevis,
  OffreDevisInvalideError,
} from "@/server/qualiopi/documents/donnees-pdf-devis";
import { publicUrl } from "@/lib/public-url";
import { resoudreMode } from "@/server/email/outbox-service";
import {
  marquerDevisEnvoye,
  prendreVerrouEnvoiDevis,
} from "@/server/qualiopi/devis/marquer-devis-envoye";
import {
  emailDevisEnAttente,
  GABARIT_DEVIS_ENVOI,
  MSG_EMAIL_EN_ATTENTE_MODIF,
} from "@/server/qualiopi/devis/email-devis-en-attente";
import { CLE_MARQUEUR } from "@/server/qualiopi/documents/signature/lien-a-l-envoi";
import {
  creerTokenDocument,
  revoquerTokensDocument,
} from "@/server/qualiopi/documents/signature/token-document";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import type { MotifRetenue } from "@/server/email/verdict-envoi";
import { genererConventionAction } from "@/server/actions/qualiopi/documents";

type ActionResult<T> = { data: T } | { error: string };

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
          ...(v.conditionsParticulieres
            ? { conditionsParticulieres: v.conditionsParticulieres }
            : {}),
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
const MSG_REGLE_CHANGEE =
  "La règle d'envoi a changé pendant l'envoi : l'e-mail n'est pas parti et le devis reste en brouillon. Réessayez.";
const MSG_GARE =
  "L'e-mail attend votre validation dans Emails, À valider. Le devis reste en brouillon et aucun lien de signature n'existe tant que l'e-mail n'est pas parti.";
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
 * 🔴 B2 (PR 3) — en mode « validation », AUCUN jeton n'est créé au clic : l'e-mail est garé sans
 * lien avec un marqueur, le devis reste « brouillon », et c'est l'approbation (`lien-a-l-envoi`)
 * qui crée le jeton et marque le devis « envoyé ». Le chemin ci-dessous décrit le mode « auto ».
 *
 * 🔴 B1 — « envoyé » ne s'écrit QUE si un courriel est réellement parti (enfilé). Ordre, dans
 * UNE transaction interactive :
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
export async function sendDevisAction(
  id: string,
  opts?: { sujet?: string; messagePersonnalise?: string },
): Promise<
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
  // Objet et message : valeurs non textuelles ou trop longues refusées ICI, avec une erreur claire.
  const optsParsed = z
    .object({ sujet: objetEntreeSchema, messagePersonnalise: messageEntreeSchema })
    .optional()
    .safeParse(opts);
  if (!optsParsed.success) {
    return { error: optsParsed.error.issues[0]?.message ?? "Objet ou message invalide." };
  }
  const optsOk = optsParsed.data;

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
        if (!(await prendreVerrouEnvoiDevis(tx, devisId)))
          throw new EnvoiDejaEnCours(MSG_VERROU, "verrou_pris");

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
            // Texte imprimé sur le PDF (devis classique) : sans lui, il disparaîtrait de la pièce envoyée.
            conditionsParticulieres: true,
            // Pièce de la version REMPLACÉE : son lien de signature doit mourir avec
            // elle (voir l'écriture plus bas).
            replacesDevis: { select: { statut: true, documentGenereId: true } },
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
                // Salutation « Bonjour Madame Dupont, » (B4) : champs saisis à part, jamais découpés.
                contactCivilite: true,
                contactPrenom: true,
                contactNomFamille: true,
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
        // (a bis) Révision : la version remplacée ne doit être ni signée par le client, ni
        // acceptée, ni transformée — relu ICI, avant tout effet externe (PDF, jeton, courriel).
        if (
          await versionRemplaceeBloqueEmission(tx, {
            replacesDevisId: devis.replacesDevisId,
            statutRemplace: devis.replacesDevis?.statut,
          })
        ) {
          throw new EnvoiRefuse(MSG_VERSION_REMPLACEE_ACCEPTEE, "version_remplacee_signee");
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
        // (b bis) D4/D6, côté serveur : pas de formules pour un particulier, indemnité de sortie
        // à zéro. Refus AVANT tout PDF, jeton ou courriel. Une offre illisible garde son message
        // dédié (`offre_invalide`, plus bas) : on ne la juge pas ici.
        if (aFormules) {
          const o = offreDevisV1.safeParse(devis.offre);
          if (o.success) {
            const msg = refusReglesFormules(o.data, devis.client.type);
            if (msg) throw new EnvoiRefuse(msg, "regle_formules");
          }
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
        // « À valider » ET « approuvé » (en cours d'envoi) : dans les deux cas un e-mail attend.
        const dejaGare = await emailDevisEnAttente(tx, devisId);
        if (dejaGare) throw new EnvoiRefuse(MSG_DEJA_GARE, "deja_gare");

        // Objet et message du fondateur relus ICI, avant tout effet externe (PDF, jeton, courriel).
        if (optsOk !== undefined) {
          const controle = contenuEmailDevis({
            devis,
            client: devis.client,
            ...(optsOk.messagePersonnalise !== undefined
              ? { message: optsOk.messagePersonnalise }
              : {}),
            ...(optsOk.sujet !== undefined ? { sujet: optsOk.sujet } : {}),
          });
          if (!controle.ok) throw new EnvoiRefuse(controle.error, "contenu_invalide");
        }

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
        // Échéancier de l'assistant : jamais un PDF dont les versements ≠ le total TTC imprimé.
        const raisonEcheancier = data.conditionsParticulieres?.startsWith(TITRE_ECHEANCIER)
          ? raisonEcheancierRefuse(
              data.conditionsParticulieres,
              computeTotauxFacture(
                data.lignes,
                data.regimeTva,
                data.tauxTvaStandardPercent ?? TAUX_TVA_STANDARD,
              ).totalTtcCents,
              data.regimeTva,
            )
          : null;
        if (raisonEcheancier !== null) {
          throw new EnvoiRefuse(raisonEcheancier, "echeancier_incoherent");
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

        // ── 4. Mode d'envoi, décidé AVANT tout jeton (B2, PR 3).
        //   - validation : l'e-mail est garé SANS lien ; la ligne porte un marqueur, le jeton naît
        //     à l'approbation (`lien-a-l-envoi`), et le devis reste « brouillon » jusque-là.
        //   - auto : chemin d'origine (jeton, enfilage, puis « envoye »).
        // `null` : la règle globale du gabarit, comme le faisait `enqueueEmail`.
        // Règle PROPRE AU CLIENT lue avec lui, comme le renvoi — et `clientId` passé plus bas à
        // `enqueueEmail` : les deux ENSEMBLE, sinon une règle du client déclenche `regle_changee`.
        const mode = await resoudreMode(GABARIT_DEVIS_ENVOI, devis.clientId);
        const parValidation = mode === "validation";

        // ── 4 bis. Lien de signature MAISON « bon pour accord » (jeton `/portail/signer/`).
        // Un devis sans lien de signature ne sert à rien : un échec refuse l'envoi.
        // ⚠️ DocuSeal n'émet plus rien (30/07/2026) : `docusealSubmissionId` et
        // `docusealEmbedUrl` restent en base pour les anciens devis, sans nouvelle écriture.
        let signatureUrl: string | undefined;
        if (!parValidation) {
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
        }

        // ── 5. Courriel : DERNIER effet externe, AVANT toute écriture. En validation : « parti »
        // = garé, rien d'autre. En auto : « parti » = enfilé ; tout le reste est un refus.
        const contenu = contenuEmailDevis({
          devis,
          client: devis.client,
          formules: data.formules,
          ...(optsOk?.messagePersonnalise !== undefined
            ? { message: optsOk.messagePersonnalise }
            : {}),
          ...(optsOk?.sujet !== undefined ? { sujet: optsOk.sujet } : {}),
          // Validation : ABSENT (aucun jeton n'existe).
          ...(signatureUrl !== undefined ? { signatureUrl } : {}),
        });
        if (!contenu.ok) throw new EnvoiRefuse(contenu.error, "contenu_invalide");
        const payloadCourriel = contenu.payload;
        const sujetEmail = contenu.sujet;
        // Marqueur : à l'approbation, c'est lui qui distingue l'objet CHOISI de l'étiquette de corbeille.
        if (sujetEmail !== undefined) payloadCourriel[CLE_SUJET_CHOISI] = sujetEmail;
        if (parValidation) {
          // Marqueur sans identité, sans URL, sans jeton : contrat v1 de `lien-a-l-envoi`.
          payloadCourriel[CLE_MARQUEUR] = {
            v: 1,
            nature: "devis-premier-envoi",
            documentGenereId: pieceId,
            partie: "client",
            devisId: devis.id,
            devisUpdatedAt: devis.updatedAt.toISOString(),
            pdfCle,
          };
        }
        let verdict: Awaited<ReturnType<typeof enqueueEmail>>;
        try {
          verdict = await enqueueEmail(GABARIT_DEVIS_ENVOI, contactEmail, "fr", payloadCourriel, {
            attachments: [{ filename: `${devis.numero}.pdf`, r2Key: pdfCle }],
            entityType: "Devis",
            entityId: devis.id,
            clientId: devis.clientId,
            // Objet choisi par le fondateur : lisible dans la corbeille (`sujet`) ET imposé à
            // l'envoi direct (`sujetForce`). Absent = l'objet du gabarit, comme avant.
            ...(sujetEmail !== undefined ? { sujet: sujetEmail, sujetForce: sujetEmail } : {}),
            ...(parValidation ? { exigerValidation: true } : {}),
          });
        } catch (err) {
          console.warn("[sendDevisAction] enqueueEmail a levé une exception", err);
          throw new EnvoiNonParti(MSG_FILE, "file_exception");
        }
        if (verdict.garePourValidation === true) {
          etat.courriel = { etat: "gare", outboxId: verdict.outboxId };
          // Auto : la règle a changé entre-temps. Garé n'est PAS parti : le `catch` refuse la
          // ligne, masque le lien et révoque le jeton ; le devis n'est pas marqué envoyé.
          if (!parValidation) throw new EnvoiNonParti(MSG_REGLE_CHANGEE, "regle_changee");
        } else if (verdict.enqueued === true && !parValidation) {
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

        // Validation : AUCUNE écriture sur le devis, le client ni la version remplacée. Tout se
        // fait à l'approbation, dans `lien-a-l-envoi`. La pièce PDF reste en base.
        if (parValidation) {
          return {
            enqueued: false,
            garePourValidation: true,
            devisExpire: null as string | null,
            gareSansLien: true,
          };
        }

        // ── 6. Écritures, toujours dans `tx` : envoye + statut client + expiration de la
        // version remplacée + « devis émis » vers Axion Partners (INT-T46-A), dans la MÊME
        // transaction. Une seule fonction, partagée avec l'approbation (`lien-a-l-envoi`).
        await marquerDevisEnvoye(tx, {
          devisId,
          clientId: devis.clientId,
          numero: devis.numero,
          // Un enregistrement du brouillon survenu pendant le PDF fait tomber l'écriture.
          updatedAt: devis.updatedAt,
          pdfCle,
          documentGenereId: pieceId,
          replacesDevisId: devis.replacesDevisId,
          replacesDevis: devis.replacesDevis,
        });

        return {
          enqueued: verdict.enqueued === true,
          garePourValidation: false,
          devisExpire: devis.replacesDevisId,
          gareSansLien: false,
        };
      },
      { maxWait: 5_000, timeout: 60_000 },
    );

    if (resultat.gareSansLien) {
      // Garé pour validation : le devis reste brouillon, aucun lien n'existe. Ni adresse ni URL.
      try {
        await logQualiopiActivity({
          action: "qualiopi.devis.send_gare",
          targetType: "Devis",
          targetId: devisId,
          changes: {
            statut: "brouillon",
            pdfGenere: true,
            documentGenereId: etat.documentGenereId,
            lienSignatureEmis: false,
            garePourValidation: true,
          },
          session,
        });
      } catch (e) {
        console.warn("[sendDevisAction] journal de l'e-mail garé échoué", e);
      }
      return {
        data: {
          id: devisId,
          emailEnvoye: false,
          signatureCreee: false,
          note: MSG_GARE,
          garePourValidation: true,
        },
      };
    }

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
        devisExpire: resultat.devisExpire,
      },
      session,
    });

    return {
      data: {
        id: devisId,
        emailEnvoye: resultat.enqueued,
        signatureCreee: true,
      },
    };
  } catch (err) {
    const refus = err instanceof EnvoiRefuse ? err : null;
    const signeeEntreTemps = err instanceof VersionRemplaceeSigneeEntreTempsError;
    const motif =
      refus !== null
        ? refus.motif
        : signeeEntreTemps && etat.courriel?.etat !== "enfile"
          ? "version_remplacee_signee_entre_temps"
          : etat.courriel !== null
            ? "apres_courriel"
            : "erreur_technique";
    const causeAlerte = signeeEntreTemps ? " Cause : version précédente signée entre-temps." : "";
    // Version remplacée signée entre-temps : la renvoyer redemanderait au client de signer.
    const consigneAlerte = signeeEntreTemps
      ? "ouvrir la version signée pour la contresigner"
      : "renvoyer le devis depuis sa fiche";

    // Rien n'est parti : le lien de signature de la pièce neuve est révoqué. S'il est enfilé,
    // le courriel (donc le lien) est déjà chez le client : on ne le révoque pas.
    const revoquerLien = async (): Promise<void> => {
      if (!etat.jetonCree || etat.documentGenereId === null) return;
      try {
        await revoquerTokensDocument({
          documentGenereId: etat.documentGenereId,
          motif: "Envoi annulé : rien n'est parti",
        });
      } catch (e) {
        console.warn("[sendDevisAction] révocation du lien après refus échouée", e);
        Sentry.captureException(e, { tags: { action: "sendDevisAction.revocation" } });
      }
    };
    // Courriel garé avec sa ligne : la révocation attend le résultat du refus de la ligne. Si un
    // administrateur l'a approuvée entre-temps (0 ligne refusée), l'e-mail part avec ce lien.
    const revocationApresRefus =
      etat.courriel?.etat === "gare" && etat.courriel.outboxId !== undefined;
    if (etat.courriel?.etat !== "enfile" && !revocationApresRefus) await revoquerLien();

    // Erreur APRÈS un courriel garé ou enfilé : le devis n'est pas « envoye » mais le client
    // peut recevoir un message. Garé : la ligne de corbeille est refusée (mise à jour, jamais
    // supprimée). Enfilé : on ne sait plus l'arrêter, on alerte.
    const courriel = etat.courriel;
    if (courriel !== null) {
      Sentry.captureException(err, { tags: { action: "sendDevisAction.apres_courriel" } });
      if (courriel.etat === "enfile") {
        // Message sans adresse, sans lien, sans jeton.
        Sentry.captureMessage(
          `Devis ${etat.numeroDevis} : courriel enfilé mais devis non marqué envoyé. Le lien de signature reçu par le client ne retrouvera pas le devis : ${consigneAlerte}.${causeAlerte}`,
          { level: "error", tags: { action: "sendDevisAction.apres_courriel_enfile" } },
        );
      }
      if (courriel.etat === "gare" && courriel.outboxId !== undefined) {
        try {
          // B2a — le lien de signature ne reste pas en clair dans la ligne refusée : on masque
          // dans la MÊME écriture que le refus. Si le masquage échoue, le refus passe quand même.
          let payloadMasque: Prisma.InputJsonValue | undefined;
          try {
            const ligne = await prisma.emailOutbox.findUnique({
              where: { id: courriel.outboxId },
              select: { template: true, payload: true },
            });
            if (ligne) {
              const masque = masquerLienSignaturePayload(ligne.template, ligne.payload);
              if (masque.modifie) payloadMasque = masque.payload as Prisma.InputJsonValue;
            }
          } catch (e) {
            console.warn("[sendDevisAction] masquage du lien de la corbeille échoué", e);
            Sentry.captureException(e, { tags: { action: "sendDevisAction.masquage_corbeille" } });
          }
          const refusee = await prisma.emailOutbox.updateMany({
            where: { id: courriel.outboxId, statut: "a_valider" },
            data: {
              statut: "refuse",
              refuseAt: new Date(),
              refuseMotif:
                refus?.motif === "regle_changee"
                  ? "Règle d'envoi changée pendant l'envoi : e-mail non parti"
                  : "Devis non marqué envoyé (erreur base)",
              ...(payloadMasque !== undefined ? { payload: payloadMasque } : {}),
            },
          });
          // Aucune ligne refusée : l'e-mail n'est plus « à valider » (validé entre-temps ?) et peut
          // partir. Alerte sans lien ni adresse.
          if (refusee.count === 0) {
            // Approuvée entre-temps : l'e-mail part avec ce lien, on ne le révoque pas.
            // Libellé fixe : ni numéro, ni adresse, ni URL, ni jeton, ni payload.
            Sentry.captureMessage(
              "Devis : la ligne de corbeille a été approuvée pendant l'envoi automatique, lien de signature conservé : vérifier Emails.",
              { level: "error", tags: { action: "sendDevisAction.refus_corbeille_aucune_ligne" } },
            );
          } else {
            await revoquerLien();
          }
        } catch (e) {
          console.warn("[sendDevisAction] refus de la ligne de corbeille échoué", e);
          Sentry.captureException(e, { tags: { action: "sendDevisAction.refus_corbeille" } });
          await revoquerLien();
        }
      } else {
        // Aucune adresse ni lien dans l'alerte : Telegram est un canal tiers.
        sendTelegram({
          tag: "AUTO",
          body: `🔴 Devis ${etat.numeroDevis} : le courriel est parti mais le devis n'a PAS été marqué envoyé. Le lien de signature reçu par le client ne retrouvera pas le devis : ${consigneAlerte}.${causeAlerte}`,
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
    if (signeeEntreTemps) {
      return {
        error:
          courriel?.etat === "enfile"
            ? `${MSG_VERSION_REMPLACEE_SIGNEE_ENTRE_TEMPS} L'e-mail est déjà parti : ne le renvoyez pas.`
            : MSG_VERSION_REMPLACEE_SIGNEE_ENTRE_TEMPS,
      };
    }
    if (courriel !== null) return { error: MSG_APRES_COURRIEL };
    throw err;
  }
}

const MSG_ACCEPTATION_SIGNEE_EN_LIGNE =
  "Le client a signé ce devis en ligne : contresignez-le pour le conclure.";

class AcceptationManuelleRefusee extends Error {}
class AcceptationStatutRefuse extends Error {}
class AcceptationVersionRemplacee extends Error {}
class AcceptationSigneeEnLigne extends Error {}

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
        select: {
          statut: true,
          offreSha256: true,
          formuleRetenue: true,
          ...SELECT_SIGNATURES_PIECE,
        },
      });
      // Garde de statut CÔTÉ SERVEUR : seul un devis envoyé (ou expiré, signature tardive) peut
      // être accepté. Un devis déjà accepté ou transformé en convention n'est jamais ré-accepté
      // (`acceptedAt` réécrit, statut ramené à `accepte`) : refus sans écriture ni émission.
      if (formules === null || (formules.statut !== "envoye" && formules.statut !== "expire")) {
        throw new AcceptationStatutRefuse();
      }
      // Version REMPLACÉE par une version émise : sa péremption n'est pas une simple échéance.
      const successeurEmis = await tx.devis.findFirst({
        where: { replacesDevisId: devisId, statut: { not: "brouillon" } },
        select: { id: true },
      });
      if (successeurEmis) throw new AcceptationVersionRemplacee();
      if (formules.offreSha256 != null && formules.formuleRetenue == null) {
        throw new AcceptationManuelleRefusee();
      }
      // Le client a signé en ligne et la contresignature manque : accepter à la main court-
      // circuiterait la contresignature (ni exemplaire contresigné ni confirmation de commande).
      // Un devis NON signé en ligne (papier, main propre) reste acceptable à la main.
      const signatures = signatureClientDuDevis(formules);
      if (signatures.clientASigne && !signatures.organismeASigne) {
        throw new AcceptationSigneeEnLigne();
      }
      // Écriture CONDITIONNELLE : si le client signe entre la lecture ci-dessus et cette écriture,
      // le devis ne doit pas passer « accepté » sans contresignature. Mêmes conditions que la garde.
      const { count } = await tx.devis.updateMany({
        where: {
          id: devisId,
          statut: { in: ["envoye", "expire"] },
          OR: [
            ...pasSigneParLeClient.OR,
            { documentGenere: { signatures: { some: { partie: "axionia", revokedAt: null } } } },
          ],
        },
        data: { statut: "accepte", acceptedAt: new Date() },
      });
      if (count === 0) {
        // Relire le statut pour rendre le bon message.
        const relu = await tx.devis.findUnique({
          where: { id: devisId },
          select: { statut: true },
        });
        if (relu === null || (relu.statut !== "envoye" && relu.statut !== "expire")) {
          throw new AcceptationStatutRefuse();
        }
        throw new AcceptationSigneeEnLigne();
      }
      await emettreDevisSigne(tx, devisId);
    });
  } catch (err) {
    if (err instanceof AcceptationStatutRefuse) {
      return {
        error: "Seul un devis envoyé (ou expiré) peut être accepté. Rechargez la page.",
      };
    }
    if (err instanceof AcceptationVersionRemplacee) {
      return { error: MSG_ACCEPTATION_REMPLACE };
    }
    if (err instanceof AcceptationSigneeEnLigne) {
      return { error: MSG_ACCEPTATION_SIGNEE_EN_LIGNE };
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

  // Garde de statut CÔTÉ SERVEUR : un refus n'est possible que depuis « envoyé » ou « expiré »,
  // et jamais si le client a signé (il ne reste qu'à contresigner).
  const lu = await prisma.devis.findUnique({
    where: { id: idParsed.data },
    select: { statut: true, documentGenereId: true, ...SELECT_SIGNATURES_PIECE },
  });
  if (!lu) return { error: "Devis introuvable" };
  // Un e-mail d'envoi de ce devis attend : même consigne que pour la modification.
  if (await emailDevisEnAttente(prisma, idParsed.data)) {
    return { error: MSG_EMAIL_EN_ATTENTE_MODIF };
  }
  if (signatureClientDuDevis(lu).clientASigne) {
    return { error: "Le client a signé ce devis : il ne peut pas être marqué refusé." };
  }
  if (lu.statut !== "envoye" && lu.statut !== "expire") {
    return { error: "Seul un devis envoyé (ou expiré) peut être refusé. Rechargez la page." };
  }
  // Même garde reposée DANS l'écriture : un client qui signe entre la lecture et l'écriture.
  const ecrit = await prisma.devis.updateMany({
    where: { id: idParsed.data, statut: { in: ["envoye", "expire"] }, ...pasSigneParLeClient },
    data: { statut: "refuse", declinedAt: new Date() },
  });
  if (ecrit.count === 0) {
    return { error: "Le devis a changé entre-temps (signature du client ?). Rechargez la page." };
  }
  const refuse = { documentGenereId: lu.documentGenereId };

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

const MSG_REVISION_SIGNEE =
  "Le client a déjà signé ce devis : contresignez-le ou refusez-le, il ne peut pas être corrigé.";

const MSG_REVISION_ACCEPTE =
  "Ce devis a été accepté : il ne peut plus être corrigé. Une modification après acceptation passe par un nouveau devis.";
const MSG_REVISION_SUCCESSEUR_EMIS =
  "Une version plus récente de ce devis a déjà été envoyée : corrigez celle-ci.";
const MSG_ACCEPTATION_REMPLACE =
  "Ce devis a été remplacé par une version plus récente : acceptez la version en cours.";

/** Statuts depuis lesquels une révision est autorisée (jamais un brouillon). */
const STATUTS_REVISABLES = ["envoye", "refuse", "expire"] as const;

/**
 * Crée une NOUVELLE version brouillon d'un devis émis (révision) — jamais
 * d'écrasement d'un devis envoyé/refusé/expiré. Un devis accepté ne se révise plus.
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
      conditionsParticulieres: true,
    },
  });
  if (!origine) return { error: "Devis introuvable" };
  if (origine.statut === "accepte" || origine.statut === "transforme_convention") {
    return { error: MSG_REVISION_ACCEPTE };
  }
  if (!(STATUTS_REVISABLES as readonly string[]).includes(origine.statut)) {
    return { error: "Seul un devis envoyé, refusé ou expiré peut être révisé." };
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
      // Verrou consultatif BLOQUANT (libéré en fin de transaction) : deux clics simultanés
      // s'alignent l'un derrière l'autre, le second retrouve la révision du premier.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"devis.revision:" + origine.id}))`;
      // Statut RELU ici, après le verrou (celui lu hors transaction peut être périmé) : un devis
      // accepté ne se corrige plus (refus avant tout numéro consommé).
      const statutActuel = await tx.devis.findUnique({
        where: { id: origine.id },
        select: { statut: true },
      });
      if (statutActuel === null) return { refus: "Devis introuvable" };
      if (statutActuel.statut === "accepte" || statutActuel.statut === "transforme_convention") {
        return { refus: MSG_REVISION_ACCEPTE };
      }
      // Le client a déjà signé : plus de correction (contresigner ou refuser). AVANT le brouillon
      // existant : un brouillon créé avant la signature ne doit pas être rendu après.
      const nonSigne = await tx.devis.count({
        where: { id: origine.id, ...pasSigneParLeClient },
      });
      if (nonSigne === 0) return { refus: MSG_REVISION_SIGNEE };
      // Une version plus récente déjà ÉMISE : c'est elle qu'on corrige.
      const successeurEmis = await tx.devis.findFirst({
        where: { replacesDevisId: origine.id, statut: { not: "brouillon" } },
        select: { id: true },
      });
      if (successeurEmis) return { refus: MSG_REVISION_SUCCESSEUR_EMIS };
      // Opération répétable : un brouillon de révision existe déjà → son identifiant, sans
      // nouveau numéro.
      const existante = await tx.devis.findFirst({
        where: { replacesDevisId: origine.id, statut: "brouillon" },
        select: { id: true, numero: true },
      });
      if (existante) return { ...existante, dejaExistante: true as const };
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
          ...(origine.conditionsParticulieres !== null
            ? { conditionsParticulieres: origine.conditionsParticulieres }
            : {}),
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
      return { ...devis, dejaExistante: false as const };
    }),
  );
  if ("refus" in created) return { error: created.refus };
  // Répétition d'un appel déjà traité : rien de neuf à journaliser.
  if (created.dejaExistante) return { data: { id: created.id, numero: created.numero } };

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
