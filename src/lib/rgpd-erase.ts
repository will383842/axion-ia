/**
 * RGPD art. 17 (droit à l'effacement) — Helpers d'anonymisation par email.
 *
 * Sprint Correctif S+1 (2026-05-16) — P0-S1-2.
 *
 * Doctrine :
 * - Submission : anonymisation in-place (PII → vide / hash) pour préserver
 *   l'audit trail business (compta, RGPD art. 30) sans données identifiantes.
 *   Les lignes ne sont PAS supprimées (legal hold pour la facturation +
 *   l'historique anti-fraude).
 * - NewsletterSubscriber : suppression hard (consent retiré, pas d'historique
 *   à conserver).
 * - KB bookmarks : géré par `src/lib/knowledge/rgpd-export.ts` → `eraseKbDataForEmail`.
 * - Journaux d'e-mail (`email_logs`) : PSEUDONYMISATION de l'adresse, la ligne
 *   est conservée. C'est la preuve que le bénéficiaire a été informé — pièce
 *   exigée par Qualiopi (critère 2) et couverte par l'art. 17(3)(b) et (e).
 *   Ce qui compte pour un auditeur est « CE DOSSIER a reçu sa convocation le
 *   JJ/MM », pas l'adresse : la preuve survit, l'identifiant disparaît.
 * - Corbeille d'envoi (`email_outbox`) : SUPPRESSION. Un message NON ENVOYÉ ne
 *   prouve rien, et rien ne justifie de conserver sa charge utile — laquelle
 *   porte le nom, la formation, les dates et les liens personnels.
 *
 * Tous les appels génèrent un ActivityLog `gdpr.erase.<table>` (forensique).
 */

import { createHash } from "node:crypto";
import type {
  CibleEffacement,
  MotifEffacement,
  Prisma,
  PrismaClient,
} from "../../prisma/generated/client";
import { Prisma as PrismaRuntime } from "../../prisma/generated/client";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { chargeClientAvant, emettreFaitClient } from "@/server/partners-sync/producteurs/client";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { CONSENT_FORM_REFS } from "@/lib/consents";
import { CONSERVATION_VISIO } from "@/content/visio-annonce-textes";
import {
  type AncresDossier,
  echeancesAvecFusions,
  finConservationDossier,
  finConservationPreuve,
  finConservationRencontreOrpheline,
  plusAns,
} from "@/server/visio/conservation";
import { ETATS_ENREGISTREMENT_ACTIFS } from "@/server/visio/etats";
import { planifierDans } from "@/server/visio/prise-d-etape";

export const ERASED_PLACEHOLDER = "[erased-rgpd-art17]";

function hashEmail(email: string): string {
  const salt = process.env.IP_HASH_SALT ?? "axion-ia-rgpd-erase";
  return createHash("sha256").update(`${salt}::${email}`).digest("hex").slice(0, 16);
}

export interface EraseSubmissionsResult {
  readonly anonymized: number;
}

export interface EraseNewsletterResult {
  readonly deleted: number;
  /** Demandes du guide IA supprimées (lot L2, 2026-09-24). */
  readonly guideDeleted: number;
}

/**
 * Anonymise toutes les Submission ayant `contactEmail = email`.
 *
 * Remplace : contactName, contactRole, contactPhone, address, internalNotes,
 * ipAddress, userAgent, referer, details. Conserve : id, type, status,
 * companyName (data business non personnelle), sector, employeesCount,
 * submittedAt + relations bookings/contracts pour l'audit comptable.
 *
 * `contactEmail` est remplacé par un hash déterministe pour permettre la
 * dédup et empêcher un nouveau profilage croisé.
 */
export async function eraseSubmissionsForEmail(email: string): Promise<EraseSubmissionsResult> {
  const hashedEmail = `erased:${hashEmail(email)}@erased.local`;
  // 🔴 On interroge l'EMPREINTE, jamais `contactEmail`. Cette colonne est
  // chiffrée avec un IV aléatoire : l'égalité SQL qui se trouvait ici
  // n'anonymisait JAMAIS aucune ligne, tout en renvoyant « succès ».
  // Le repli sur `contactEmail` couvre les lignes en clair (chatbot,
  // candidatures, podcast) et celles antérieures au remplissage rétroactif.
  const lookupHash = hashEmailForLookup(email);
  const result = await prisma.submission.updateMany({
    where: {
      OR: [...(lookupHash ? [{ contactEmailHash: lookupHash }] : []), { contactEmail: email }],
    },
    data: {
      contactName: ERASED_PLACEHOLDER,
      contactRole: null,
      contactEmail: hashedEmail,
      // Remise à NULL : sans cela, une seconde demande d'effacement — ou un
      // export ultérieur — retrouverait encore la ligne anonymisée.
      contactEmailHash: null,
      contactPhone: null,
      address: null,
      internalNotes: null,
      ipAddress: null,
      userAgent: null,
      referer: null,
      details: {},
    },
  });
  return { anonymized: result.count };
}

/**
 * Supprime les RÉPONSES que la personne a envoyées par e-mail à son invitation
 * d'apporteur, relevées dans la boîte Zoho (`submission_inbound_replies`,
 * 2026-09-27) : objet et extrait de SES messages.
 *
 * Suppression hard : la ligne ne prouve rien (le message lui-même vit dans la
 * boîte Zoho, hors de ce système), et l'anonymisation in-place de la fiche ne
 * la toucherait pas — elle survivrait, rattachée à une fiche « effacée ».
 *
 * 🔑 Par l'EMPREINTE DE L'EXPÉDITEUR, jamais par la fiche : cette fonction
 * tourne EN MÊME TEMPS que `eraseSubmissionsForEmail`, qui remet
 * `contactEmailHash` à NULL — une jointure sur la fiche pourrait ne plus rien
 * trouver. L'empreinte de l'expéditeur, elle, est posée à l'enregistrement et
 * ne bouge pas (le relevé n'enregistre qu'un expéditeur dont l'empreinte est
 * celle de la fiche).
 */
export async function eraseReponsesEntrantesForEmail(
  email: string,
): Promise<{ readonly supprimees: number }> {
  const empreinte = hashEmailForLookup(email);
  if (!empreinte) return { supprimees: 0 };
  const r = await prisma.submissionInboundReply.deleteMany({
    where: { fromEmailHash: empreinte },
  });
  return { supprimees: r.count };
}

/**
 * Supprime hard le NewsletterSubscriber ayant `email`. Si consent retiré,
 * aucune raison de conserver la ligne (pas d'audit business).
 */
export async function eraseNewsletterForEmail(email: string): Promise<EraseNewsletterResult> {
  const result = await prisma.newsletterSubscriber.deleteMany({ where: { email } });
  // Lot L2 (2026-09-24) — les demandes du guide IA suivent la lettre : même
  // point de collecte, même personne. Suppression hard : la demande n'est la
  // preuve de rien (le consentement à la lettre, lui, vit dans le registre de
  // preuve, sous empreinte). Par l'adresse ET par l'empreinte, pour qu'une
  // différence de casse ne laisse pas une ligne derrière.
  const empreinte = hashEmailForLookup(email);
  const guide = await prisma.guideRequest.deleteMany({
    where: { OR: [{ email }, ...(empreinte ? [{ emailKey: empreinte }] : [])] },
  });
  return { deleted: result.count, guideDeleted: guide.count };
}

export interface EraseSignatureTokensResult {
  /** Jetons encore vivants qui ont été révoqués. */
  readonly revoques: number;
  /** Jetons dont l'adresse en clair a été pseudonymisée. */
  readonly pseudonymises: number;
}

/**
 * Traite les JETONS d'invitation à signer — pas les signatures elles-mêmes.
 *
 * ## La distinction, qui est tout le sujet
 *
 * `DocumentSignature.signataireEmail` est **scellé** dans le tuple haché
 * (`COLONNES_SCELLEES_DOCUMENT`) : l'écraser ferait rendre `empreinte_invalide`
 * à la vérification de chaîne, c'est-à-dire, dans un dossier présenté à un
 * contrôle, le verdict « ces pièces ont été modifiées après coup » sur des
 * pièces intactes. Ce dépôt a déjà payé ce défaut exact côté émargement. On n'y
 * touche pas — c'est une exception déclarée, pas un oubli.
 *
 * Le JETON, lui, ne prouve rien. C'est un artefact d'émission éphémère
 * (`expiresAt`), sans tuple haché : `tokenHash` est l'empreinte du jeton, pas
 * d'un tuple de preuve. Une fois la pièce signée, l'identité vit — scellée —
 * dans `DocumentSignature`. L'adresse en clair conservée ici n'ajoute rien à la
 * valeur probante : c'est un reliquat d'envoi.
 *
 * ## Pourquoi révoquer AVANT de pseudonymiser
 *
 * Un lien de signature encore valide survivant à l'effacement permettrait de
 * signer au nom d'une personne « supprimée » — **et de resceller son adresse en
 * clair dans un `DocumentSignature` neuf**, ce qui annulerait l'effacement
 * qu'on vient de faire. Même raisonnement que la révocation des jetons
 * d'émargement dans `portail/rgpd-service.ts`.
 *
 * ## Pourquoi effacer AUSSI `destinataireEmailSha256`
 *
 * Ce n'est pas un pseudonyme suffisant : c'est un `sha256Hex(email)` **nu, non
 * salé**. L'espace des adresses plausibles est petit et des tables précalculées
 * existent — le laisser reviendrait à conserver l'adresse sous un déguisement.
 * C'est exactement pourquoi `hashEmailForLookup` est un HMAC clé, et pourquoi
 * `eraseSubmissionsForEmail` efface déjà `contactEmailHash`.
 */
export async function eraseSignatureTokensForEmail(
  email: string,
): Promise<EraseSignatureTokensResult> {
  const revocation = await prisma.documentSignatureToken.updateMany({
    where: { signataireEmail: email, revokedAt: null, usedAt: null },
    data: { revokedAt: new Date(), revokedMotif: "Effacement RGPD (art. 17)" },
  });

  const pseudonymisation = await prisma.documentSignatureToken.updateMany({
    where: { signataireEmail: email },
    data: {
      signataireEmail: `erased:${hashEmail(email)}@erased.local`,
      destinataireEmailSha256: null,
    },
  });

  return { revoques: revocation.count, pseudonymises: pseudonymisation.count };
}

export interface EraseEmailTracesResult {
  /** Lignes de `email_logs` dont l'adresse a été pseudonymisée. */
  readonly logsPseudonymises: number;
  /** Lignes de `email_outbox` supprimées (messages non envoyés). */
  readonly outboxSupprimes: number;
  /** Copies d'e-mails envoyés (`email_log_contents`) supprimées. */
  readonly copiesSupprimees: number;
}

/**
 * 🔴 `D5-5-01` (2026-08-24) — LES DEUX TABLES D'E-MAIL ÉCHAPPAIENT À L'EFFACEMENT.
 *
 * `email_logs.recipient` et `email_outbox.recipient` portent l'adresse **en
 * clair** (`@db.Citext`), et `email_outbox.payload` porte la charge utile
 * complète du message : nom, intitulé de formation, dates, liens personnels.
 * Ni l'une ni l'autre n'était touchée par la route d'effacement — et elles ne
 * figuraient pas davantage parmi les exceptions de rétention déclarées.
 *
 * 🔑 C'est le défaut exact de `D5-5-03`, une table plus loin : les candidatures
 * étaient hors de portée, et le courriel de confirmation ÉNUMÉRAIT ce qui avait
 * été effacé. Le commentaire écrit alors vaut mot pour mot ici — « une liste qui
 * se donne pour exhaustive et qui omet le CV est pire qu'une absence de liste ».
 * La personne recevait « vos données identifiantes ont été effacées » pendant
 * que son adresse et le contenu de ses messages survivaient.
 *
 * ## Pourquoi les deux tables ne se traitent PAS pareil
 *
 * `email_logs` est une PREUVE. Qualiopi exige de démontrer que le bénéficiaire a
 * été informé (convocation, convention, attestation) ; l'art. 17(3)(b) et (e) du
 * RGPD couvre cette conservation. Mais la preuve utile est « ce DOSSIER a reçu
 * sa convocation le JJ/MM » — le rattachement se fait par `entityType`/`entityId`,
 * pas par l'adresse. On pseudonymise donc l'adresse et on garde la ligne : un
 * auditeur peut toujours vérifier qu'un envoi a eu lieu, plus à qui.
 *
 * `email_outbox` ne prouve RIEN : ce sont des messages en attente ou garés en
 * corbeille de validation, jamais partis. Aucune base légale ne justifie de
 * conserver la charge utile d'un courrier qu'on n'a pas envoyé. Suppression.
 *
 * ⚠️ `bounceReason` est vidé au passage : c'est du texte libre renvoyé par le
 * transporteur, qui contient l'adresse et parfois davantage.
 */
export async function eraseEmailTracesForEmail(email: string): Promise<EraseEmailTracesResult> {
  // Même forme que `eraseSubmissionsForEmail` : `erased:<empreinte>@erased.local`.
  // Une SEULE écriture de ce format dans le module — un format recopié diverge.
  const pseudonyme = `erased:${hashEmail(email)}@erased.local`;

  // 2026-09-27 — LA COPIE DES E-MAILS ENVOYÉS, D'ABORD, et hors du
  // `Promise.all` : elle se retrouve par l'adresse de sa ligne de journal, que
  // la pseudonymisation ci-dessous va réécrire. Lancées ensemble, la
  // suppression pourrait ne plus rien trouver.
  //
  // Supprimée, pas pseudonymisée : la PREUVE d'envoi est la ligne du journal
  // (qui reste) ; la copie porte le CONTENU — nom, formation, dates, montants —
  // et rien ne justifie de le garder pour une personne qui a demandé l'oubli.
  //
  // Deux requêtes plutôt qu'un filtre de relation : les identifiants d'abord,
  // la suppression ensuite — une personne n'a que quelques envois.
  const sesEnvois = await prisma.emailLog.findMany({
    where: { recipient: email },
    select: { id: true },
  });
  const copies =
    sesEnvois.length > 0
      ? await prisma.emailLogContent.deleteMany({
          where: { emailLogId: { in: sesEnvois.map((l) => l.id) } },
        })
      : { count: 0 };

  const [logs, outbox] = await Promise.all([
    prisma.emailLog.updateMany({
      where: { recipient: email },
      data: { recipient: pseudonyme, bounceReason: null },
    }),
    prisma.emailOutbox.deleteMany({ where: { recipient: email } }),
  ]);

  return {
    logsPseudonymises: logs.count,
    outboxSupprimes: outbox.count,
    copiesSupprimees: copies.count,
  };
}

export interface EraseCrmOutboxResult {
  /** Lignes de `crm_sync_outbox` supprimées (tous statuts). */
  readonly supprimees: number;
}

/**
 * Lot L6 (relecture du 2026-09-25) — `crm_sync_outbox` GARDAIT L'ADRESSE EN CLAIR.
 *
 * La charge (`payload`) est le corps exact envoyé au CRM, « PII déchiffrées au
 * moment de la construction » : adresse, nom, téléphone. L'effacement ne la
 * touchait pas. On SUPPRIME les lignes de la personne, quel que soit leur
 * statut :
 *   · `sent` — le CRM les a reçues ; leur effacement côté CRM passe par
 *     `propagateGdprToCrm` (appel direct, pas cette table) ;
 *   · `pending` / `failed` — les garder ferait REPARTIR ses données vers le CRM
 *     après l'effacement, au prochain balayage : c'est le pire des cas ;
 *   · `gave_up` — ne repartira plus, mais la charge porte toujours l'adresse.
 *
 * 🔑 Comment on les retrouve : la table n'a PAS de colonne d'empreinte. Chaque
 * événement porte en revanche `person.person_key` (= `hashEmailForLookup`,
 * normalisé : insensible à la casse), posé par tous les producteurs
 * (`crm-sync/index.ts`). On cherche donc DANS LA CHARGE, par ce chemin JSON —
 * et, en second filet, par `person.email` tel que saisi (comparaison JSON,
 * sensible à la casse), pour une ligne dont la clé aurait manqué.
 *
 * ⚠️ Recherche non indexée (filtre `jsonb` sur toute la table). Acceptable :
 * l'effacement est un geste rare, et la purge garde la table courte (lignes
 * `sent` à 30 jours, `newsletter/retention.ts`).
 */
export async function eraseCrmOutboxForEmail(email: string): Promise<EraseCrmOutboxResult> {
  const empreinte = hashEmailForLookup(email);
  // L'adresse telle que saisie ET sa forme normalisée : le filtre JSON est
  // sensible à la casse, contrairement aux colonnes `citext`.
  const formes = [...new Set([email, email.trim().toLowerCase()])];
  const r = await prisma.crmSyncOutbox.deleteMany({
    where: {
      OR: [
        ...(empreinte ? [{ payload: { path: ["person", "person_key"], equals: empreinte } }] : []),
        ...formes.map((f) => ({ payload: { path: ["person", "email"], equals: f } })),
      ],
    },
  });
  return { supprimees: r.count };
}

export interface EraseChatResult {
  /** Conversations chatbot supprimées (messages cascade). */
  readonly conversationsDeleted: number;
  /** Escalades dont l'email a été anonymisé. */
  readonly escalationsAnonymized: number;
}

/**
 * Efface les données chatbot (`chat_*`) liées à une personne (RGPD art. 17).
 *
 * Doctrine chatbot (≠ Submission) : pas de legal-hold business sur le contenu
 * conversationnel → **hard-delete** des conversations rattachées aux leads
 * (Submissions) de cette personne ; `chat_messages` (contenu = PII) part en
 * cascade via la FK `ON DELETE CASCADE`. Le lead lui-même reste dans Submission
 * (anonymisé par `eraseSubmissionsForEmail`) pour l'audit comptable.
 *
 * Les `chat_escalations` portant l'email en clair sont anonymisées (email hashé,
 * contexte libre vidé) — l'escalade reste pour l'analyse des trous de KB.
 *
 * ⚠️ À appeler AVANT `eraseSubmissionsForEmail` (qui hashe le `contactEmail`),
 * sinon le rattachement conversation↔lead par email serait déjà rompu.
 */
export async function eraseChatDataForEmail(email: string): Promise<EraseChatResult> {
  const hashedEmail = `erased:${hashEmail(email)}@erased.local`;

  // Ancres pour rattacher une conversation à la personne :
  //  - leads (Submission) de cet email → conversations via submissionId (backlink) ;
  //  - escalades de cet email → conversation référencée (conversation_id).
  // Empreinte : `contactEmail` est chiffré avec un IV aléatoire, l'égalité SQL
  // ne peut jamais correspondre (cf. `lib/security/email-hash.ts`).
  const lookupHash = hashEmailForLookup(email);
  const subs = await prisma.submission.findMany({
    where: {
      OR: [...(lookupHash ? [{ contactEmailHash: lookupHash }] : []), { contactEmail: email }],
    },
    select: { id: true },
  });
  const subIds = subs.map((s) => s.id);

  const escs = await prisma.chatEscalation.findMany({
    where: { contactEmail: email, conversationId: { not: null } },
    select: { conversationId: true },
  });
  const escConvIds = escs.map((e) => e.conversationId).filter((id): id is string => id !== null);

  const orClauses: Array<Record<string, unknown>> = [];
  if (subIds.length > 0) orClauses.push({ submissionId: { in: subIds } });
  if (escConvIds.length > 0) orClauses.push({ id: { in: escConvIds } });

  let conversationsDeleted = 0;
  if (orClauses.length > 0) {
    const del = await prisma.chatConversation.deleteMany({ where: { OR: orClauses } });
    conversationsDeleted = del.count;
  }

  const esc = await prisma.chatEscalation.updateMany({
    where: { contactEmail: email },
    data: { contactEmail: hashedEmail, contexte: null },
  });

  return { conversationsDeleted, escalationsAnonymized: esc.count };
}

// ─────────────────────────────────────────────────────────────────────────────
// LES TROIS DERNIÈRES TABLES DE L'INVENTAIRE (2026-08-25)
//
// Le cliquet `rgpd-aucune-table-n-echappe-en-silence.spec.ts` en portait trois
// « à instruire », chacune bloquée sur une décision. Elles sont tranchées ici,
// et la raison de chaque arbitrage est écrite au-dessus de son effaceur.
//
// 🔑 LA CLÉ QUI A DÉBLOQUÉ LES TROIS : cette route est **déclenchée par une
// DEMANDE** (adresse + jeton HMAC + confirmation littérale), pas par une purge
// automatique. Or les blocages écrits dans le cliquet supposaient tous une
// purge : « aucune date de fin de relation, donc les 5 ans sont incalculables »
// ne s'oppose qu'à un traitement périodique. **Une personne qui exerce son
// droit n'a besoin d'aucune échéance** — la seule question est de savoir si une
// obligation légale justifie de garder, au sens de l'art. 17(3).
//
// Et la purge automatique, elle, a été écartée par le propriétaire en
// connaissance de cause (« garder 5 ans sans purger ») : le blocage portait
// donc sur une voie qui ne sera pas prise.
// ─────────────────────────────────────────────────────────────────────────────

export interface EraseClientsResult {
  /** Fiches dont les coordonnées de contact ont été pseudonymisées. */
  readonly anonymises: number;
  /** Fiches gardées intactes parce qu'une pièce comptable les retient. */
  readonly retenusObligationComptable: number;
}

/**
 * `Client` — les coordonnées du CONTACT, pas la fiche de l'entreprise.
 *
 * ## Ce qui est effacé, et ce qui ne l'est pas
 *
 * Une fiche `Client` mélange deux natures de données. La **personne morale**
 * (raison sociale, SIRET, adresse de l'établissement, code NAF) n'est pas une
 * donnée à caractère personnel : l'art. 17 ne porte pas dessus. Le **contact**
 * — nom, adresse électronique, téléphone, fonction — en est une, et c'est lui
 * qu'on efface.
 *
 * ⚠️ **Sauf pour un `particulier`.** Quand `type === "particulier"`, la
 * « raison sociale » EST le nom de la personne : elle est alors pseudonymisée
 * comme le reste. C'est le piège du champ dont le sens dépend d'une colonne
 * voisine — ce dépôt l'a déjà payé sur la facture qui appelait « OPCO » un
 * client qui n'en était pas un.
 *
 * ## La rétention opposable, et sa borne
 *
 * Une fiche rattachée à une **facture** est retenue : l'art. L.123-22 du code
 * de commerce impose dix ans aux pièces justificatives comptables, et
 * l'art. 17(3)(b) du RGPD réserve explicitement ce cas. **On le DÉCLARE au lieu
 * de le taire** : le compte rendu distingue les fiches effacées de celles
 * retenues, parce qu'une réponse qui annonce un effacement total alors qu'une
 * ligne survit est précisément le défaut que cette famille de correctifs
 * corrige depuis quatre occurrences.
 *
 * 🔑 Le critère est la **pièce comptable émise**, pas le statut commercial. Un
 * `prospect` sans facture ne retient rien ; un `perdu` qui a été facturé une
 * fois, si. Raisonner sur `statut` aurait laissé filer le second.
 */
export async function eraseClientsForEmail(email: string): Promise<EraseClientsResult> {
  const hashedEmail = `erased:${hashEmail(email)}@erased.local`;

  const fiches = await prisma.client.findMany({
    where: { contactEmail: email },
    select: { id: true, type: true, _count: { select: { facturesFormation: true } } },
  });
  if (fiches.length === 0) return { anonymises: 0, retenusObligationComptable: 0 };

  const retenus = fiches.filter((c) => c._count.facturesFormation > 0);
  const effacables = fiches.filter((c) => c._count.facturesFormation === 0);

  let anonymises = 0;
  for (const fiche of effacables) {
    // INT-T03 (émission unique) : l'effacement écrit `raisonSociale`, une colonne que surveille
    // le cliquet des écrivains, donc il passe par `emettreFaitClient`, dans la même transaction.
    // Aucun champ effacé n'est transmis : la charge d'un particulier porte déjà une raison
    // sociale nulle, et les contacts n'y sont pas. L'émission le CONSTATE (charges égales) et
    // n'écrit aucun fait.
    await prisma.$transaction(async (tx) => {
      const avant = await chargeClientAvant(tx, fiche.id);
      await tx.client.update({
        where: { id: fiche.id },
        data: {
          contactEmail: hashedEmail,
          contactNom: null,
          contactTelephone: null,
          contactFonction: null,
          // Champs de saisie libre : ils portent régulièrement le nom et le
          // contexte de la personne. On ne peut pas les trier, donc on les vide.
          notes: null,
          contexteIa: null,
          // Le nom de la personne physique se cache dans la « raison sociale ».
          ...(fiche.type === "particulier" ? { raisonSociale: "Personne effacée" } : {}),
        },
      });
      await emettreFaitClient(tx, fiche.id, { avant });
    });
    anonymises += 1;
  }

  return { anonymises, retenusObligationComptable: retenus.length };
}

export interface EraseDocumentRecipientsResult {
  /** Destinataires pseudonymisés et désactivés. */
  readonly anonymises: number;
  /** Accusés de téléchargement PRÉSERVÉS (preuve de diffusion Qualiopi). */
  readonly telechargementsPreserves: number;
}

/**
 * `DocumentRecipient` — pseudonymiser SANS supprimer, et c'est tout l'arbitrage.
 *
 * ## L'effet de bord qui bloquait
 *
 * Un `deleteMany` emporterait en cascade `RessourceTelechargement`, l'accusé de
 * lecture des supports. Or cette trace peut valoir **preuve de diffusion** dans
 * un dossier Qualiopi : elle établit qu'un document a été mis à disposition et
 * consulté. La détruire pour honorer un droit à l'effacement reviendrait à
 * détruire la preuve d'un autre engagement.
 *
 * ## La sortie : l'anonymisation n'est pas un demi-effacement
 *
 * Le RGPD ne réclame pas la destruction de la LIGNE, il réclame que la personne
 * ne soit plus identifiable. En écrasant l'adresse et le nom, l'accusé de
 * téléchargement survit **rattaché à personne** : il prouve encore qu'une
 * diffusion a eu lieu, sans plus désigner quiconque.
 *
 * On coupe aussi l'accès : `actif: false`, et les liens magiques encore vivants
 * sont supprimés. Un lien passwordless survivant à l'effacement rouvrirait
 * l'espace ressources au nom d'une personne effacée — même raisonnement que la
 * révocation des jetons de signature plus haut dans ce fichier.
 */
export async function eraseDocumentRecipientsForEmail(
  email: string,
): Promise<EraseDocumentRecipientsResult> {
  const hashedEmail = `erased:${hashEmail(email)}@erased.local`;

  const destinataires = await prisma.documentRecipient.findMany({
    where: { email },
    select: { id: true, _count: { select: { telechargements: true } } },
  });
  if (destinataires.length === 0) return { anonymises: 0, telechargementsPreserves: 0 };

  const ids = destinataires.map((d) => d.id);
  const telechargementsPreserves = destinataires.reduce((n, d) => n + d._count.telechargements, 0);

  // Les liens d'accès d'abord : révoquer avant de pseudonymiser.
  await prisma.ressourcesMagicLink.deleteMany({ where: { recipientId: { in: ids } } });

  const maj = await prisma.documentRecipient.updateMany({
    where: { id: { in: ids } },
    data: { email: hashedEmail, nom: null, actif: false },
  });

  return { anonymises: maj.count, telechargementsPreserves };
}

export interface EraseCoachingSignaturesResult {
  readonly anonymises: number;
}

/**
 * `CoachingSeanceSignature` — la table dont la vraie question était « pourquoi
 * existe-t-elle encore ».
 *
 * ## Pourquoi l'argument du tuple scellé ne s'applique PAS ici
 *
 * Les signatures de documents et d'émargement sont exclues de l'effacement
 * parce que l'adresse est scellée dans un tuple haché : l'écraser ferait rendre
 * `empreinte_invalide` à la vérification de chaîne, c'est-à-dire, dans un
 * dossier présenté à un contrôle, le verdict « ces pièces ont été modifiées
 * après coup » sur des pièces intactes.
 *
 * Cette table porte bien un `prevHash`/`selfHash` — **mais plus aucun code ne
 * les recalcule.** Mesuré le 2026-08-25 : plus une ligne de `src/` ne lit ni
 * n'écrit `coachingSeanceSignature`, le module AFEST 1-to-1 ayant été retiré le
 * 2026-08-10 ; et la table compte **zéro ligne en production**. Une chaîne que
 * personne ne vérifie ne prouve rien : elle ne peut donc pas être opposée à une
 * demande d'effacement.
 *
 * 🔑 **Une table morte qui porte de la donnée personnelle en clair est le pire
 * des deux mondes** — aucune valeur d'usage, tout le risque. L'effacement est
 * ici un no-op en pratique, et il existe pour que la liste soit VRAIE : c'est
 * l'exhaustivité qui est le sujet de cette famille de correctifs, pas le volume.
 *
 * ⚠️ La question « faut-il retirer la table du schéma » reste ouverte et n'est
 * pas tranchée ici : supprimer un modèle est irréversible et se décide à froid.
 */
export async function eraseCoachingSignaturesForEmail(
  email: string,
): Promise<EraseCoachingSignaturesResult> {
  const hashedEmail = `erased:${hashEmail(email)}@erased.local`;

  const maj = await prisma.coachingSeanceSignature.updateMany({
    where: { signataireEmail: email },
    data: { signataireEmail: hashedEmail, signataireNom: "Personne effacée" },
  });

  return { anonymises: maj.count };
}

export interface EraseCalendlyResult {
  readonly anonymized: number;
}

/**
 * Anonymise les réservations d'appel d'une personne (art. 17).
 *
 * ## Le défaut que cette fonction ferme
 *
 * Mesuré le 2026-08-27. `calendly_events` porte `inviteeName`, `inviteeEmail`
 * (en clair, indexé), `inviteePhone`, `location`, `notes` et `rawPayload` — qui
 * contient les réponses libres du formulaire Calendly. La table n'apparaissait
 * dans AUCUN des trois mécanismes : ni effacement, ni export, ni purge. Une
 * personne qui exerçait son droit à l'effacement recevait une confirmation, et
 * ses données de rendez-vous survivaient intactes.
 *
 * Contrairement aux candidatures ou aux demandes de podcast — dont l'adresse est
 * chiffrée avec un IV aléatoire et exige un module dédié — `inviteeEmail` est en
 * clair. L'omission n'avait aucune excuse technique.
 *
 * ## 🔴 POURQUOI ON ANONYMISE ET POURQUOI ON NE SUPPRIME PAS
 *
 * Un `DELETE` serait **recréé au passage suivant**. `discoverNewCalendlyEvents`
 * balaie une fenêtre de [-2 h, +60 j] et dédoublonne sur `eventUri` : effacer la
 * ligne, c'est la voir revenir dans la minute, avec les données en clair
 * reprises chez Calendly. C'est pour cela que `eventUri` est le seul champ
 * conservé tel quel — il est notre clé de dédoublonnage, et il n'identifie
 * personne.
 *
 * ## 🔴 ET POURQUOI `rawPayload` DOIT ÊTRE ÉCRASÉ DANS LA MÊME INSTRUCTION
 *
 * C'est le piège de ce lot, et il est invisible à la lecture des colonnes.
 * `enrichCalendlyEvent` ne réécrit PAS les champs déjà remplis — `setIfEmpty`
 * n'écrit que sur `null`, donc les colonnes anonymisées seraient respectées.
 * Mais il **remplace `rawPayload` en entier** à chaque passage, et le nom,
 * l'adresse et le téléphone reviennent de Calendly, en clair. Le cron `refresh`
 * repasse toutes les 10 minutes sur toute ligne encore `scheduled`. Et le
 * commentaire de `enrich.ts` dit explicitement que `rawPayload` est absent du
 * journal des champs modifiés : **le retour de la donnée ne produit ni trace,
 * ni alerte.**
 *
 * Une anonymisation qui ne traite que les colonnes serait donc défaite en dix
 * minutes, en silence. Deux verrous, tous deux nécessaires :
 *
 *   1. cette instruction écrase `rawPayload` par un marqueur `_erasedAt` ;
 *   2. `refreshUpcomingCalendlyEvents` EXCLUT les lignes qui le portent
 *      (`refresh.ts`) — sans quoi le marqueur serait écrasé au passage suivant.
 *
 * Les deux vivent dans le même lot, et le test `l-effacement-resiste-au-cron`
 * rougit si l'un des deux disparaît.
 *
 * ⚠️ `_ipHash` est abandonné avec le reste, à dessein : c'est une empreinte de
 * l'adresse IP de la personne, donc une donnée dérivée d'elle. Il servait au
 * dédoublonnage anti-abus de `client-event` sur une fenêtre de 60 SECONDES —
 * fenêtre depuis longtemps close pour toute ligne assez ancienne pour faire
 * l'objet d'une demande d'effacement.
 */
export async function eraseCalendlyEventsForEmail(email: string): Promise<EraseCalendlyResult> {
  const hashedEmail = `erased:${hashEmail(email)}@erased.local`;

  /**
   * 🔴 ON NE CHERCHE **PAS** L'ADRESSE DANS LA CHARGE BRUTE. Révoqué le
   * 2026-08-31, le jour même où ce chemin avait été élargi.
   *
   * L'élargissement (`WHERE position(lower($email) in lower(raw_payload::text))`)
   * visait une réservation captée mais jamais enrichie, dont la colonne serait
   * nulle pendant que le JSON porterait l'adresse. **Ce cas n'existe pas, et il
   * ne peut pas exister** — mesuré sur les 18 lignes de production :
   *   · colonne nulle ET adresse dans le payload → **0 ligne** ;
   *   · les 5 captures navigateur ne contiennent aucune arobase (le
   *     `postMessage` de Calendly ne transporte que deux URI, jamais de PII) ;
   *   · une ligne enrichie par l'API a toujours sa colonne remplie.
   *
   * ⚠️ Ce que l'élargissement ouvrait, en revanche, était réel : `rawPayload`
   * contient `event_guests`, les personnes que le prospect ajoute lui-même au
   * rendez-vous. Un invité s'authentifie légitimement (le jeton part à SA
   * propre adresse) et obtenait alors l'anonymisation de TOUTE la ligne — donc
   * la destruction de la réservation d'autrui. Symétriquement à l'export, qui
   * lui livrait la fiche du prospect, liens d'annulation compris.
   *
   * 🔑 Le filtre par colonne est donc le bon, et il l'était depuis le début :
   * `inviteeEmail` désigne le TITULAIRE de la réservation, jamais ses invités.
   * Verrou : `src/lib/__tests__/un-invite-ne-voit-pas-la-fiche-du-prospect.spec.ts`.
   */

  // La note du suivi après l'appel (2026-09-27) est une appréciation écrite
  // SUR la personne : elle part avec le reste. AVANT l'anonymisation
  // ci-dessous, qui remplace l'adresse par laquelle on retrouve la ligne. Le
  // constat (a eu lieu / absent) reste, comme le statut du rendez-vous.
  await prisma.rendezVousSuivi.updateMany({
    where: { calendlyEvent: { inviteeEmail: email } },
    // 2026-09-28 — la note /20 d'un échange apporteur part avec sa phrase.
    data: { note: null, noteSur20: null },
  });
  // 2026-09-29 (chantier visio, PR 4) — l'ÉQUIVALENT pour `rencontre_suivis`,
  // le suivi de la rencontre du dossier client (autorité, écrit par la même
  // fonction `enregistrerSuivi()`) : il n'y a RIEN à y vider. Cette table n'a
  // pas de note libre, à dessein — une appréciation sur la personne y devient
  // un FAIT `saisie_manuelle`, effacé par `effacerCibleParAdresses` avec les
  // autres faits dont elle est sujet. Elle ne porte que l'issue, la suite et
  // leur date (annotation `rgpd: technique`), et part avec sa rencontre.

  // UNE SEULE instruction, donc atomique : la ligne perd ses coordonnées ET
  // sort de la fenêtre du cron au même instant. En deux temps, un passage de
  // `refresh` glissé entre les deux réécrirait la charge brute.
  const result = await prisma.calendlyEvent.updateMany({
    where: { inviteeEmail: email },
    data: {
      inviteeName: ERASED_PLACEHOLDER,
      inviteeEmail: hashedEmail,
      inviteePhone: null,
      location: null,
      notes: null,
      // Provenance : elle décrit le parcours d'une personne identifiée.
      pageUrl: null,
      utmSource: null,
      utmCampaign: null,
      utmMedium: null,
      utmContent: null,
      referrer: null,
      // Les liens d'annulation et de report sont des URL-CAPACITÉS nominatives :
      // elles permettent d'agir sur le rendez-vous de la personne sans aucune
      // authentification. Elles partent avec le reste.
      cancelUrl: null,
      rescheduleUrl: null,
      // Le marqueur qui tient le cron à distance — voir le bloc ci-dessus.
      rawPayload: { _erasedAt: new Date().toISOString() } as never,
    },
  });

  return { anonymized: result.count };
}

// ═════════════════════════════════════════════════════════════════════════════
// DOSSIER CLIENT ET ENREGISTREMENT DES VISIOS (chantier visio, 2026-09-29)
//
// ADR 0056 ; plan §3.15. Ce module est le SEUL à poser le drapeau de session
// `axion.effacement_rgpd` (garde `tests/unit/ci/seul-rgpd-erase-pose-le-drapeau-d-effacement.spec.ts`).
// Sans lui, le trigger `faits_contenu_immuable` refuse de vider un énoncé ou
// une citation, et `enregistrement_consentements_ajout_seul` de toucher une
// preuve d'accord. Le drapeau est posé en `SET LOCAL` : il meurt avec la
// transaction et ne peut pas fuir sur la connexion suivante du pool (vérifié
// sur une vraie base par `scripts/ci/gate-d-visio.ts`).
//
// Tout appelant — conservation, pilote, « Réextraire », retrait d'accord —
// passe par les fonctions ci-dessous ; aucun ne pose le drapeau lui-même.
// ═════════════════════════════════════════════════════════════════════════════

/** Texte mis à la place d'un nom effacé dans le dossier client. */
export const PERSONNE_EFFACEE = "Personne effacée";

/** Ce dont `executerSousDrapeauEffacement` a besoin : un client qui ouvre une transaction. */
export type OuvreurDeTransaction = Pick<PrismaClient, "$transaction">;

/**
 * Exécute `fn` dans UNE transaction où le drapeau d'effacement est posé.
 *
 * `SET LOCAL` : la valeur disparaît au COMMIT comme au ROLLBACK. Une simple
 * `SET` survivrait sur la connexion rendue au pool, et la requête suivante —
 * n'importe laquelle, de n'importe quel écran — pourrait réécrire un fait.
 */
export async function executerSousDrapeauEffacement<R>(
  client: OuvreurDeTransaction,
  fn: (tx: Prisma.TransactionClient) => Promise<R>,
): Promise<R> {
  return client.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL axion.effacement_rgpd = 'on'");
      return fn(tx);
    },
    { timeout: 60_000 },
  );
}

/** Colonnes de CONTENU d'un fait vidées par un effacement (le journal reste). */
const FAIT_CONTENU_VIDE = {
  enonce: "",
  expressionTemporelle: null,
  texteCourt: null,
  citation: null,
  confirmationCitation: null,
  ambiguite: null,
} as const;

// Les données d'effacement ci-dessous sont écrites UNE fois et reprises par
// l'effacement (`effacerCibleParAdresses`) comme par le rejeu après
// restauration (`rejouerEffacements`) : si l'art. 17 vide un champ de plus, le
// rejeu le vide aussi. Verrouillé par
// `src/lib/__tests__/le-rejeu-reprend-les-regles-de-l-effacement.spec.ts`.

/** Participation d'une personne effacée : nom pseudonymisé, voix et adresse oubliées. */
const PARTICIPANT_PSEUDONYMISE = {
  nomAffiche: PERSONNE_EFFACEE,
  emailHash: null,
  etiquetteVoix: null,
} as const;

/** Fiche personne effacée : nom pseudonymisé, fonction et téléphone vidés. */
const CONTACT_PSEUDONYMISE = { nom: PERSONNE_EFFACEE, fonction: null, telephone: null } as const;

/** Compte rendu partagé avec d'autres voix : vidé, une réécriture sans elle est proposée. */
const COMPTE_RENDU_A_REGENERER = {
  statut: "a_regenerer",
  contenu: "",
  verification: null,
} as const;

/** Case pré-remplie qui portait ses propos : vidée. */
const PRE_REMPLISSAGE_VIDE = { valeurProposee: "", valeurRetenue: null } as const;

/** Question qu'on lui a adressée : vidée, jamais supprimée (un fait peut la citer). */
const QUESTION_VIDEE = { texte: "", reponse: null } as const;

/**
 * Rencontres où les participations `siens` étaient la SEULE voix côté client :
 * tous les participants `client` en font partie (et il y en a au moins un).
 * Le compte rendu de ces rencontres est supprimé, pas vidé.
 */
async function rencontresOuSeuleVoixClient(
  db: Pick<Prisma.TransactionClient, "rencontreParticipant">,
  rencontreIds: readonly string[],
  siens: ReadonlySet<string>,
): Promise<string[]> {
  const cotesClient = await db.rencontreParticipant.findMany({
    where: { rencontreId: { in: [...rencontreIds] }, role: "client" },
    select: { id: true, rencontreId: true },
  });
  return rencontreIds.filter((rid) => {
    const cote = cotesClient.filter((p) => p.rencontreId === rid);
    return cote.length > 0 && cote.every((p) => siens.has(p.id));
  });
}

/**
 * Ce qui suit une personne effacée sans être journalisé ligne à ligne : les
 * questions qu'on lui a adressées (vidées), le corps pré-rempli de ses e-mails
 * de suivi (vidé avant que le lien ne parte), ses e-mails de suivi et ses rôles
 * dans les projets (supprimés). Rend le nombre de questions vidées.
 */
async function effacerCeQuiSuitLesPersonnes(
  tx: Prisma.TransactionClient,
  contactIds: readonly string[],
): Promise<number> {
  const ids = [...contactIds];
  const questionnaires = await tx.questionnaireCadrage.findMany({
    where: { contactDestinataireId: { in: ids } },
    select: { id: true },
  });
  const questions = await tx.questionnaireQuestion.updateMany({
    where: { questionnaireId: { in: questionnaires.map((q) => q.id) } },
    data: QUESTION_VIDEE,
  });
  const emailsSuivi = await tx.emailSuivi.findMany({
    where: { contactId: { in: ids } },
    select: { id: true },
  });
  await tx.preRemplissage.updateMany({
    where: { cible: "email_suivi", cibleId: { in: emailsSuivi.map((e) => e.id) } },
    data: PRE_REMPLISSAGE_VIDE,
  });
  await tx.emailSuivi.deleteMany({ where: { contactId: { in: ids } } });
  await tx.projetContact.deleteMany({ where: { contactId: { in: ids } } });
  return questions.count;
}

/** Nom pseudonymisé dans ses participations et dans sa fiche. Rend le nombre de fiches. */
async function pseudonymiserPersonnes(
  tx: Prisma.TransactionClient,
  participantIds: readonly string[],
  contactIds: readonly string[],
): Promise<number> {
  await tx.rencontreParticipant.updateMany({
    where: { id: { in: [...participantIds] } },
    data: PARTICIPANT_PSEUDONYMISE,
  });
  const personnes = await tx.clientContact.updateMany({
    where: { id: { in: [...contactIds] } },
    data: CONTACT_PSEUDONYMISE,
  });
  return personnes.count;
}

/** Périmètre d'une suppression du pilote. */
interface PerimetrePilote {
  /** Fiches inscrites dans `clients_test_interne`. */
  readonly clientIds: readonly string[];
  readonly rencontreIds: readonly string[];
  readonly projetIds: readonly string[];
  readonly contactIds: readonly string[];
  /** ADR 0063 — documents de projet journalisés `pilote` (rejeu) ; ceux des projets ci-dessus partent aussi. */
  readonly documentIds: readonly string[];
}

/**
 * Supprime les données du pilote dans l'ordre imposé par les clés : les faits
 * d'abord (ils retiennent les questions de questionnaire ; un fait de projet
 * porte toujours le client du projet, CHECK `faits_projet_exige_client`), puis
 * les preuves d'accord (sous le drapeau), les questionnaires, les rencontres
 * (le reste suit en cascade), les documents des projets (ADR 0063 : octets puis
 * lignes, sous le drapeau — `projets` est RESTRICT envers eux), les projets,
 * les personnes. Reprise telle quelle par `purgerPilote` et par `rejouerEffacements`.
 */
async function supprimerDonneesPilote(
  tx: Prisma.TransactionClient,
  p: PerimetrePilote,
): Promise<{
  readonly faits: number;
  readonly preuvesAccord: number;
  readonly documentIds: readonly string[];
}> {
  const faits = await tx.fait.deleteMany({
    where: {
      OR: [{ clientId: { in: [...p.clientIds] } }, { rencontreId: { in: [...p.rencontreIds] } }],
    },
  });
  const preuves = await tx.enregistrementConsentement.deleteMany({
    where: { rencontreId: { in: [...p.rencontreIds] } },
  });
  await tx.questionnaireCadrage.deleteMany({ where: { clientId: { in: [...p.clientIds] } } });
  await tx.rencontre.deleteMany({ where: { id: { in: [...p.rencontreIds] } } });
  // ADR 0063 — les documents des projets du pilote. Les triggers de
  // `documents_projet*` refusent toute suppression SAUF sous le drapeau
  // d'effacement, posé par l'appelant (`executerSousDrapeauEffacement`).
  const documents = await tx.documentProjet.findMany({
    where: {
      OR: [{ projetId: { in: [...p.projetIds] } }, { id: { in: [...p.documentIds] } }],
    },
    select: { id: true },
  });
  const documentIds = documents.map((d) => d.id);
  await tx.documentProjetContenu.deleteMany({ where: { documentId: { in: documentIds } } });
  await tx.documentProjet.deleteMany({ where: { id: { in: documentIds } } });
  await tx.projet.deleteMany({ where: { id: { in: [...p.projetIds] } } });
  await tx.clientContact.deleteMany({ where: { id: { in: [...p.contactIds] } } });
  return { faits: faits.count, preuvesAccord: preuves.count, documentIds };
}

async function journaliserEffacements(
  tx: Prisma.TransactionClient,
  tableCible: CibleEffacement,
  ids: readonly string[],
  motif: MotifEffacement,
): Promise<void> {
  if (ids.length === 0) return;
  await tx.effacementJournal.createMany({
    data: ids.map((ligneId) => ({ tableCible, ligneId, motif })),
  });
}

async function journaliserFaitsEffaces(
  tx: Prisma.TransactionClient,
  faitIds: readonly string[],
  parAdminId: string | null,
): Promise<void> {
  if (faitIds.length === 0) return;
  await tx.faitEvenement.createMany({
    data: faitIds.map((faitId) => ({ faitId, action: "efface" as const, parAdminId })),
  });
}

/**
 * VIDE des faits — l'aide UNIQUE de l'effacement ciblé (art. 17) et du retrait
 * de l'accord (B2) : contenu vidé et statut `efface`, journal du fait et
 * journal d'effacement, cases pré-remplies depuis eux vidées, et LIENS des
 * autres faits vers eux retirés (relation, résolution, remplacement,
 * doublon) — sinon un fait restant continuerait de désigner un fait effacé.
 */
async function viderFaits(
  tx: Prisma.TransactionClient,
  faitIds: readonly string[],
  parAdminId: string | null,
  motif: MotifEffacement,
): Promise<void> {
  if (faitIds.length === 0) return;
  const ids = [...faitIds];
  await tx.fait.updateMany({
    where: { id: { in: ids } },
    data: { ...FAIT_CONTENU_VIDE, statut: "efface" },
  });
  await journaliserFaitsEffaces(tx, ids, parAdminId);
  await journaliserEffacements(tx, "faits", ids, motif);
  await tx.preRemplissage.updateMany({
    where: { faitId: { in: ids } },
    data: PRE_REMPLISSAGE_VIDE,
  });
  await tx.fait.updateMany({
    where: { relationAvecFaitId: { in: ids } },
    data: { relationAvecFaitId: null, relation: null },
  });
  await tx.fait.updateMany({
    where: { resoluParFaitId: { in: ids } },
    data: { resoluParFaitId: null },
  });
  await tx.fait.updateMany({
    where: { remplaceParId: { in: ids } },
    data: { remplaceParId: null },
  });
  await tx.fait.updateMany({
    where: { doublonDeFaitId: { in: ids } },
    data: { doublonDeFaitId: null },
  });
}

/**
 * Passe des comptes rendus à `a_regenerer` (contenu et vérification vidés : le
 * bloc chiffré contient les phrases effacées), les journalise, et PROGRAMME
 * leur réécriture (P5 relit les faits restants, jamais la transcription).
 * L'aide UNIQUE de l'effacement ciblé et du retrait de l'accord.
 */
async function mettreARegenerer(
  tx: Prisma.TransactionClient,
  comptesRendus: ReadonlyArray<{ readonly id: string; readonly rencontreId: string }>,
  motif: MotifEffacement,
): Promise<void> {
  if (comptesRendus.length === 0) return;
  const ids = comptesRendus.map((c) => c.id);
  await tx.compteRendu.updateMany({
    where: { id: { in: ids } },
    data: COMPTE_RENDU_A_REGENERER,
  });
  await journaliserEffacements(tx, "comptes_rendus", ids, motif);
  await programmerReecritures(tx, comptesRendus);
}

// Un `type` et non une `interface` : le résultat est versé tel quel dans le
// journal d'activité (colonne JSON), qui exige un type sans signature fermée.
export type EffacementCibleResultat = {
  /** Personnes du dossier (`client_contacts`) pseudonymisées. */
  readonly personnes: number;
  /** Segments de SA voix supprimés. */
  readonly segments: number;
  /** Faits dont elle est sujet ou locutrice, contenu vidé (statut `efface`). */
  readonly faits: number;
  /** Comptes rendus vidés (`a_regenerer`) : une réécriture sans elle est proposée. */
  readonly comptesRendusARegenerer: number;
  /** Comptes rendus supprimés : elle était la seule interlocutrice côté client. */
  readonly comptesRendusSupprimes: number;
  /** Questions de questionnaire reçues, texte et réponse vidés (la ligne reste). */
  readonly questions: number;
};

const EFFACEMENT_VIDE: EffacementCibleResultat = {
  personnes: 0,
  segments: 0,
  faits: 0,
  comptesRendusARegenerer: 0,
  comptesRendusSupprimes: 0,
  questions: 0,
};

/**
 * EFFACEMENT CIBLÉ (art. 17) d'une personne dans le dossier client, par
 * TOUTES ses adresses (plan §3.15, ADR 0056 §6).
 *
 * Ce qui part : ses segments de voix, le contenu des faits dont elle est
 * sujet ou locutrice (y compris ceux repris du formulaire Calendly), les
 * questions qu'on lui a adressées (texte et réponse vidés, la ligne reste :
 * un fait peut la citer comme source), ses e-mails de suivi (le lien ; le
 * message lui-même est traité avec `email_outbox`), ses rôles dans les
 * projets, ses adresses ; son nom est remplacé dans la fiche et dans les
 * participations.
 *
 * Les comptes rendus des rencontres où elle a parlé ou été citée passent
 * `a_regenerer` — contenu vidé, car le bloc chiffré contient ses phrases —
 * sauf si elle y était la SEULE interlocutrice côté client : ils sont alors
 * supprimés.
 *
 * La personne est retrouvée par ses fiches personne (`client_contact_adresses`)
 * ET par ses participations (`rencontre_participants.email_hash`), même sans
 * fiche personne : un rendez-vous resté « à classer » (A4, aucun rattachement
 * automatique) porte son empreinte d'adresse mais `contact_id` NULL. L'export
 * la retrouve ainsi (`rgpd-dossier-client.ts`) ; l'effacement doit la
 * retrouver pareil, sinon il confirmerait un effacement qui n'a rien effacé.
 *
 * Ses segments de voix : ceux qui lui sont attribués (`participantId`) ; et,
 * dans une rencontre où elle était la SEULE voix côté client, aussi les
 * segments de la piste client pas encore attribués (ils ne peuvent être que
 * les siens).
 *
 * Ce qui RESTE, et pourquoi : les preuves d'accord
 * (`enregistrement_consentements`) — art. 17(3)(e), elles établissent que
 * l'enregistrement était licite ; les journaux (sans donnée personnelle) ;
 * la fiche de l'entreprise.
 *
 * ANGLES MORTS DÉCLARÉS (aucune garde ne les couvre) :
 *   · dans une rencontre PARTAGÉE avec d'autres voix côté client, un segment
 *     de la piste client pas encore attribué (voix non validée) reste : on ne
 *     sait pas qui parle. Il reste chiffré et part avec la purge des segments
 *     (ADR 0056) ; la réécriture d'un compte rendu `a_regenerer` ne doit pas
 *     s'en servir (à tenir dans la PR du circuit, PR 6) ;
 *   · un texte libre saisi par Will qui NOMMERAIT la personne (titre de
 *     projet, motif d'un journal) n'est pas réécrit : l'effaceur ne peut pas
 *     savoir quel nom y figure. Un titre de projet, Will le corrige à la
 *     main ; le motif d'un journal, lui, ne se réécrit PAS (trigger
 *     `visio_journal_ajout_seul`, ajout seul sans exception, même sous le
 *     drapeau) : il reste tel quel.
 */
export async function effacerCibleParAdresses(
  emails: readonly string[],
  options: { readonly parAdminId?: string | null; readonly motif?: MotifEffacement } = {},
): Promise<EffacementCibleResultat> {
  const motif = options.motif ?? "art17_cible";
  const parAdminId = options.parAdminId ?? null;
  const empreintes = [
    ...new Set(emails.map((e) => hashEmailForLookup(e)).filter((h): h is string => !!h)),
  ];
  if (empreintes.length === 0) return EFFACEMENT_VIDE;

  // La personne, puis TOUTES ses adresses (une adresse pro, une perso…).
  const trouvees = await prisma.clientContactAdresse.findMany({
    where: { emailHash: { in: empreintes } },
    select: { contactId: true },
  });
  const contactIds = [...new Set(trouvees.map((a) => a.contactId))];
  const toutes =
    contactIds.length === 0
      ? []
      : await prisma.clientContactAdresse.findMany({
          where: { contactId: { in: contactIds } },
          select: { emailHash: true },
        });
  const toutesEmpreintes = [...new Set([...empreintes, ...toutes.map((a) => a.emailHash)])];
  // Sans fiche personne, elle peut encore exister par ses seules
  // participations (rendez-vous « à classer ») : on ne sort à vide que si
  // AUCUNE des deux voies ne la trouve.
  if (contactIds.length === 0) {
    const participationsSansFiche = await prisma.rencontreParticipant.findMany({
      where: { emailHash: { in: toutesEmpreintes } },
      select: { id: true },
    });
    if (participationsSansFiche.length === 0) return EFFACEMENT_VIDE;
  }

  const resultat = await executerSousDrapeauEffacement(prisma, async (tx) => {
    const participants = await tx.rencontreParticipant.findMany({
      where: {
        OR: [{ emailHash: { in: toutesEmpreintes } }, { contactId: { in: contactIds } }],
      },
      select: { id: true, rencontreId: true },
    });
    const participantIds = participants.map((p) => p.id);

    // 1. Sa voix : les segments qui lui sont attribués.
    const segmentsAttribues = await tx.transcriptionSegment.findMany({
      where: { participantId: { in: participantIds } },
      select: { transcriptionId: true, ordre: true },
    });
    await tx.transcriptionSegment.deleteMany({ where: { participantId: { in: participantIds } } });

    // 2. Les faits dont elle est sujet ou locutrice.
    const faits = await tx.fait.findMany({
      where: {
        statut: { not: "efface" },
        OR: [
          { contactSujetId: { in: contactIds } },
          { contactLocuteurId: { in: contactIds } },
          { participantLocuteurId: { in: participantIds } },
        ],
      },
      select: { id: true, rencontreId: true },
    });
    const faitIds = faits.map((f) => f.id);
    // Contenu, journaux, cases pré-remplies et liens : l'aide partagée.
    await viderFaits(tx, faitIds, parAdminId, motif);

    // 3. Les comptes rendus des rencontres où elle a parlé ou été citée.
    const rencontreIds = [
      ...new Set([
        ...participants.map((p) => p.rencontreId),
        ...faits.map((f) => f.rencontreId).filter((id): id is string => id !== null),
      ]),
    ];
    const seuleInterlocutrice = await rencontresOuSeuleVoixClient(
      tx,
      rencontreIds,
      new Set(participantIds),
    );
    const aReecrire = rencontreIds.filter((rid) => !seuleInterlocutrice.includes(rid));

    // 1 bis. Là où elle était la SEULE voix côté client, les segments de la
    //    piste client encore non attribués sont forcément les siens.
    const enregistrementsSeule = await tx.enregistrement.findMany({
      where: { rencontreId: { in: seuleInterlocutrice } },
      select: { id: true },
    });
    const transcriptionsSeule = await tx.transcription.findMany({
      where: { enregistrementId: { in: enregistrementsSeule.map((e) => e.id) } },
      select: { id: true },
    });
    const ouNonAttribues = {
      transcriptionId: { in: transcriptionsSeule.map((t) => t.id) },
      piste: "client" as const,
      participantId: null,
    };
    const segmentsNonAttribues = await tx.transcriptionSegment.findMany({
      where: ouNonAttribues,
      select: { transcriptionId: true, ordre: true },
    });
    await tx.transcriptionSegment.deleteMany({ where: ouNonAttribues });
    const segments = [...segmentsAttribues, ...segmentsNonAttribues];
    await journaliserEffacements(
      tx,
      "transcription_segments",
      segments.map((s) => `${s.transcriptionId}:${s.ordre}`),
      motif,
    );

    const crSupprimes = await tx.compteRendu.findMany({
      where: { rencontreId: { in: seuleInterlocutrice } },
      select: { id: true },
    });
    await tx.compteRendu.deleteMany({ where: { rencontreId: { in: seuleInterlocutrice } } });
    await journaliserEffacements(
      tx,
      "comptes_rendus",
      crSupprimes.map((c) => c.id),
      motif,
    );
    const crVides = await tx.compteRendu.findMany({
      where: { rencontreId: { in: aReecrire }, statut: { not: "a_regenerer" } },
      select: { id: true, rencontreId: true },
    });
    // ⛔ Vidés, et une réécriture SANS la personne est programmée (PR 6) : P5
    // relit les faits restants, jamais la transcription — ses faits sont vidés
    // ci-dessus.
    await mettreARegenerer(tx, crVides, motif);

    // 4-5. Les questions qu'on lui a adressées (vidées, jamais supprimées : un
    //    fait peut les citer comme source — clé RESTRICT), ses e-mails de suivi
    //    (corps pré-rempli vidé avant que le lien ne parte), ses rôles dans les
    //    projets. Fonction partagée avec le rejeu.
    const questions = await effacerCeQuiSuitLesPersonnes(tx, contactIds);

    // 6. Son nom : pseudonymisé dans ses participations et dans la fiche.
    const personnes = await pseudonymiserPersonnes(tx, participantIds, contactIds);
    await journaliserEffacements(tx, "client_contacts", contactIds, motif);

    return {
      personnes,
      segments: segments.length,
      faits: faitIds.length,
      comptesRendusARegenerer: crVides.length,
      comptesRendusSupprimes: crSupprimes.length,
      questions,
    };
  });

  // 7. Ses adresses EN DERNIER : si la transaction ci-dessus avait échoué, une
  //    nouvelle demande la retrouverait encore par elles.
  await prisma.clientContactAdresse.deleteMany({ where: { contactId: { in: contactIds } } });

  return resultat;
}

/**
 * Programme la RÉÉCRITURE (P5) de comptes rendus vidés (`a_regenerer`) : le
 * worker en produira une nouvelle version depuis les faits RESTANTS de leur
 * rencontre — jamais depuis la transcription.
 */
async function programmerReecritures(
  tx: Prisma.TransactionClient,
  comptesRendus: ReadonlyArray<{ readonly id: string; readonly rencontreId: string }>,
): Promise<void> {
  for (const cr of comptesRendus) {
    await planifierDans(tx, cr.rencontreId, {
      etape: "rediger",
      compteRenduId: cr.id,
      reinitialiser: true,
    });
  }
}

export interface RetraitAccordResultat {
  readonly segments: number;
  readonly comptesRendus: number;
  readonly faits: number;
  readonly comptesRendusARegenerer: number;
  readonly etapesAnnulees: number;
}

/**
 * RETRAIT DE L'ACCORD APRÈS L'APPEL (décision B2 ; plan §3.15) — « Le client
 * retire son accord pour ce rendez-vous ».
 *
 * En UNE transaction, sous le drapeau d'effacement :
 *   · les segments de transcription sont supprimés (les transcriptions
 *     restent, écartées, sans parole) ;
 *   · TOUTES les versions du compte rendu sont supprimées ;
 *   · les faits de la rencontre sont vidés et passent `efface` (le journal
 *     reste) ; les cases pré-remplies depuis eux sont vidées ; les liens des
 *     autres faits vers eux sont retirés ;
 *   · les comptes rendus SUIVANTS du même client passent `a_regenerer` (ils
 *     ont pu reprendre ces faits) et une réécriture est programmée ;
 *   · les étapes en cours ou à venir de la rencontre sont ANNULÉES (une étape
 *     déjà en vol n'écrira rien : son écriture finale vérifie le retrait) ;
 *   · un `EnregistrementConsentement(retrait)` et les `EffacementJournal`
 *     (motif `retrait`) sont écrits.
 *
 * Ce qui RESTE : la PREUVE INITIALE de l'accord (art. 17(3)(e) : elle établit
 * que l'enregistrement était licite), les devis et e-mails déjà émis.
 *
 * Le son est supprimé de R2 par l'étape `purger_audio`, programmée dans la
 * même transaction (le worker la prend dans les minutes qui suivent).
 */
export async function retirerAccordRencontre(
  rencontreId: string,
  parAdminId: string,
  options: { readonly db?: OuvreurDeTransaction; readonly maintenant?: Date } = {},
): Promise<RetraitAccordResultat> {
  const maintenant = options.maintenant ?? new Date();
  return executerSousDrapeauEffacement(options.db ?? prisma, async (tx) => {
    const rencontre = await tx.rencontre.findUnique({
      where: { id: rencontreId },
      select: { id: true, clientId: true, debutPrevu: true, debutReel: true, createdAt: true },
    });
    if (!rencontre) throw new Error("Rendez-vous introuvable.");

    // 1. La parole transcrite.
    const enregistrements = await tx.enregistrement.findMany({
      where: { rencontreId },
      select: { id: true },
    });
    const transcriptions = await tx.transcription.findMany({
      where: { enregistrementId: { in: enregistrements.map((e) => e.id) } },
      select: { id: true },
    });
    const transcriptionIds = transcriptions.map((t) => t.id);
    const segments = await tx.transcriptionSegment.findMany({
      where: { transcriptionId: { in: transcriptionIds } },
      select: { transcriptionId: true, ordre: true },
    });
    await tx.transcriptionSegment.deleteMany({
      where: { transcriptionId: { in: transcriptionIds } },
    });
    await tx.transcription.updateMany({
      where: { id: { in: transcriptionIds } },
      data: { statut: "ecartee", segmentsSupprimesLe: maintenant },
    });
    await journaliserEffacements(
      tx,
      "transcription_segments",
      segments.map((s) => `${s.transcriptionId}:${s.ordre}`),
      "retrait",
    );

    // 2. Les faits de la rencontre (contenu vidé, journal gardé).
    const faits = await tx.fait.findMany({
      where: { rencontreId, statut: { not: "efface" } },
      select: { id: true },
    });
    const faitIds = faits.map((f) => f.id);
    await viderFaits(tx, faitIds, parAdminId, "retrait");

    // 3. Toutes les versions du compte rendu.
    const crs = await tx.compteRendu.findMany({ where: { rencontreId }, select: { id: true } });
    await tx.compteRendu.deleteMany({ where: { rencontreId } });
    await journaliserEffacements(
      tx,
      "comptes_rendus",
      crs.map((c) => c.id),
      "retrait",
    );

    // 4. Les comptes rendus SUIVANTS du client : vidés, réécriture programmée.
    const debut = rencontre.debutReel ?? rencontre.debutPrevu ?? rencontre.createdAt;
    const suivants =
      rencontre.clientId === null
        ? []
        : await tx.compteRendu.findMany({
            where: {
              statut: { in: ["brouillon", "a_valider", "valide"] },
              rencontre: {
                clientId: rencontre.clientId,
                id: { not: rencontreId },
                OR: [{ debutReel: { gt: debut } }, { debutReel: null, debutPrevu: { gt: debut } }],
              },
            },
            select: { id: true, rencontreId: true },
          });
    await mettreARegenerer(tx, suivants, "retrait");

    // 5. Les étapes de la rencontre : annulées ; le son part par `purger_audio`.
    const annulees = await tx.traitementVisio.updateMany({
      where: { rencontreId, statut: { in: ["a_faire", "en_cours", "suspendu"] } },
      data: { statut: "annule", verrouJusqua: null },
    });
    await planifierDans(tx, rencontreId, {
      etape: "purger_audio",
      compteRenduId: null,
      reinitialiser: true,
    });
    await tx.enregistrement.updateMany({
      where: {
        rencontreId,
        statut: { notIn: [...ETATS_ENREGISTREMENT_ACTIFS] },
      },
      data: { statut: "abandonne" },
    });

    // 6. La trace du retrait. La PREUVE INITIALE n'est pas touchée.
    await tx.enregistrementConsentement.create({
      data: {
        rencontreId,
        enregistrementId: null,
        type: "retrait",
        versionTexte: "retrait-apres-appel-v1",
        declareParId: parAdminId,
        survenuLe: maintenant,
      },
    });

    return {
      segments: segments.length,
      comptesRendus: crs.length,
      faits: faitIds.length,
      comptesRendusARegenerer: suivants.length,
      etapesAnnulees: annulees.count,
    };
  });
}

/**
 * Vide les CITATIONS des faits constatés avant `avant` (conservation des
 * citations, ADR 0056). L'énoncé reste : c'est la phrase mot pour mot qui part.
 */
export async function purgerCitations(avant: Date): Promise<{ readonly faits: number }> {
  return executerSousDrapeauEffacement(prisma, async (tx) => {
    const cibles = await tx.fait.findMany({
      where: {
        constateLe: { lt: avant },
        OR: [{ citation: { not: null } }, { confirmationCitation: { not: null } }],
      },
      select: { id: true },
    });
    const ids = cibles.map((c) => c.id);
    await tx.fait.updateMany({
      where: { id: { in: ids } },
      data: { citation: null, confirmationCitation: null },
    });
    await journaliserEffacements(tx, "faits_citation", ids, "conservation");
    return { faits: ids.length };
  });
}

/**
 * Vide le contenu des faits REJETÉS avant `avant` (plan §3.15 : « contenu des
 * faits `rejete` vidé à la validation ou à 30 jours »).
 */
export async function viderFaitsRejetes(avant: Date): Promise<{ readonly faits: number }> {
  return executerSousDrapeauEffacement(prisma, async (tx) => {
    const cibles = await tx.fait.findMany({
      where: { statut: "rejete", createdAt: { lt: avant }, NOT: { enonce: "" } },
      select: { id: true },
    });
    const ids = cibles.map((c) => c.id);
    await tx.fait.updateMany({ where: { id: { in: ids } }, data: FAIT_CONTENU_VIDE });
    await journaliserEffacements(tx, "faits", ids, "conservation");
    return { faits: ids.length };
  });
}

export interface PurgePiloteResultat {
  readonly rencontres: number;
  readonly faits: number;
  readonly projets: number;
  readonly personnes: number;
  readonly preuvesAccord: number;
}

/**
 * Supprime les données du PILOTE : tout ce qui est rattaché à une fiche
 * inscrite dans `clients_test_interne`, et toute rencontre marquée
 * `estTestInterne`. La fiche fictive elle-même reste (Will l'a créée ; elle
 * resservira).
 *
 * L'ordre imposé par les clés vit dans `supprimerDonneesPilote`, que le rejeu
 * après restauration reprend telle quelle.
 */
export async function purgerPilote(): Promise<PurgePiloteResultat> {
  const fiches = await prisma.clientTestInterne.findMany({ select: { clientId: true } });
  const clientIds = fiches.map((f) => f.clientId);

  return executerSousDrapeauEffacement(prisma, async (tx) => {
    const rencontres = await tx.rencontre.findMany({
      where: { OR: [{ estTestInterne: true }, { clientId: { in: clientIds } }] },
      select: { id: true },
    });
    const rencontreIds = rencontres.map((r) => r.id);

    const projets = await tx.projet.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true },
    });
    const personnes = await tx.clientContact.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true },
    });
    const { faits, preuvesAccord, documentIds } = await supprimerDonneesPilote(tx, {
      clientIds,
      rencontreIds,
      projetIds: projets.map((p) => p.id),
      contactIds: personnes.map((p) => p.id),
      documentIds: [],
    });

    await journaliserEffacements(tx, "rencontres", rencontreIds, "pilote");
    // ADR 0063 — journalisés pour que le rejeu après restauration les resupprime.
    await journaliserEffacements(tx, "documents_projet", documentIds, "pilote");
    await journaliserEffacements(
      tx,
      "projets",
      projets.map((p) => p.id),
      "pilote",
    );
    await journaliserEffacements(
      tx,
      "client_contacts",
      personnes.map((p) => p.id),
      "pilote",
    );

    return {
      rencontres: rencontreIds.length,
      faits,
      projets: projets.length,
      personnes: personnes.length,
      preuvesAccord,
    };
  });
}

/**
 * Ce que l'effacement art. 17 laisse, dans le dossier client, et pourquoi.
 * Déclaré plutôt que tu : la garde
 * `tests/unit/ci/les-tables-du-dossier-client-suivent-la-personne.spec.ts`
 * accepte un modèle `rgpd: dossier-client` soit parce que ce module le mute,
 * soit parce qu'il figure ici avec son motif.
 */
export const EXCEPTIONS_EFFACEMENT_DOSSIER: ReadonlyArray<{
  readonly modele: string;
  readonly motif: string;
}> = [
  {
    modele: "EnregistrementConsentement",
    motif:
      "preuve que l'enregistrement était licite (art. 17(3)(e)) ; conservée jusqu'à la fin " +
      "du dossier + 5 ans, puis purgée (ADR 0056). Supprimée avec les données du pilote.",
  },
  {
    // ADR 0063 — aucune colonne ne rattache un document à une personne :
    // l'effacement ciblé par adresse ne peut pas savoir quelle pièce la cite.
    modele: "DocumentProjet",
    motif:
      "pièce d'un projet d'entreprise, sans lien à une personne par une colonne ; jamais " +
      "supprimée automatiquement (ordre permanent), SAUF avec son projet par la purge des " +
      "données du pilote (fiches de test) et son rejeu, sous le drapeau d'effacement, " +
      "journalisée (`documents_projet`). Une demande qui vise une pièce précise est traitée " +
      "à la main, sous le même drapeau — seule voie que la base admet.",
  },
  {
    modele: "DocumentProjetContenu",
    motif:
      "les octets d'une pièce de `DocumentProjet` : même règle que la pièce (supprimés avant " +
      "elle par la purge du pilote).",
  },
  {
    // Candidatures, lot L5b (relecture sécurité, 2026-10-08).
    modele: "FichierPartage",
    motif:
      "fichier renvoyé par un candidat par son lien privé (`origine = personne`) : objet du " +
      "stockage puis ligne effacés avec sa candidature par `effacerCandidaturesPour` " +
      "(`candidature-rgpd.ts`, appelé par la même route) via " +
      "`effacerFichiersRenvoyesCandidature` ; s'il ne peut pas l'être, la candidature est " +
      "conservée et signalée, jamais annoncée effacée. Les fichiers de l'équipe ne portent " +
      "rien sur une personne.",
  },
  {
    // Candidatures, lot L3 (2026-10-08).
    modele: "JobApplicationInboundReply",
    motif:
      "réponse par e-mail d'un candidat : effacée avec sa candidature par " +
      "`effacerCandidaturesPour` (`candidature-rgpd.ts`, appelé par la même route), " +
      "par la cascade du dossier ET par l'empreinte de l'adresse.",
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// CONSERVATION CODÉE DU DOSSIER CLIENT (chantier visio, PR 8 ; B1, ADR 0056)
//
// 🛑 Depuis le 2026-10-07 (Will : « coupe tous les effacements »), ces
// fonctions ne sont PLUS planifiées : `retention-purge-worker.ts` ne les
// appelle plus (garde `aucun-effacement-automatique-de-personnes.spec.ts`).
// Elles restent ici, inchangées, sans appelant automatique (seul module qui
// pose le drapeau d'effacement). Les échéances sont calculées par
// `src/server/visio/conservation.ts` à partir de `CONSERVATION_VISIO`, les
// durées que la notice publique écrit en toutes lettres.
//
// 🔑 AUCUNE PIÈCE LÉGALE N'EST TOUCHÉE : devis, factures, conventions et
// e-mails émis ne sont LUS que comme ancres de date (garde
// `src/content/__tests__/une-piece-qualiopi-n-est-jamais-purgee.spec.ts`).
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Supprime les SEGMENTS de transcription des enregistrements commencés avant
 * `avant` (12 mois). Le compte rendu validé et les faits restent : c'est la
 * transcription intégrale, qui porte le plus de paroles, qui part la première.
 */
export async function purgerSegmentsAnciens(
  avant: Date,
): Promise<{ readonly segments: number; readonly transcriptions: number }> {
  return executerSousDrapeauEffacement(prisma, async (tx) => {
    const transcriptions = await tx.transcription.findMany({
      where: { segmentsSupprimesLe: null, enregistrement: { debut: { lt: avant } } },
      select: { id: true },
    });
    const ids = transcriptions.map((t) => t.id);
    if (ids.length === 0) return { segments: 0, transcriptions: 0 };
    const segments = await tx.transcriptionSegment.findMany({
      where: { transcriptionId: { in: ids } },
      select: { transcriptionId: true, ordre: true },
    });
    await tx.transcriptionSegment.deleteMany({ where: { transcriptionId: { in: ids } } });
    await tx.transcription.updateMany({
      where: { id: { in: ids } },
      data: { segmentsSupprimesLe: new Date() },
    });
    await journaliserEffacements(
      tx,
      "transcription_segments",
      segments.map((s) => `${s.transcriptionId}:${s.ordre}`),
      "conservation",
    );
    return { segments: segments.length, transcriptions: ids.length };
  });
}

/**
 * Supprime les versions REMPLACÉES ou REJETÉES d'un compte rendu créées avant
 * `avant` (90 jours). La version validée n'est jamais visée. Les faits qui la
 * citaient perdent le lien (clé `SetNull`), pas leur contenu.
 */
export async function purgerVersionsComptesRendus(
  avant: Date,
): Promise<{ readonly comptesRendus: number }> {
  return executerSousDrapeauEffacement(prisma, async (tx) => {
    const cibles = await tx.compteRendu.findMany({
      where: { statut: { in: ["remplace", "rejete"] }, createdAt: { lt: avant } },
      select: { id: true },
    });
    const ids = cibles.map((c) => c.id);
    await tx.compteRendu.deleteMany({ where: { id: { in: ids } } });
    await journaliserEffacements(tx, "comptes_rendus", ids, "conservation");
    return { comptesRendus: ids.length };
  });
}

export interface PurgeDossiersResultat {
  /** Fiches dont la conservation est échue. */
  readonly fiches: number;
  /** Rencontres jamais rattachées, échues. */
  readonly rencontresOrphelines: number;
  readonly faits: number;
  readonly comptesRendus: number;
  readonly questions: number;
  readonly emailsSuivi: number;
}

const PURGE_DOSSIERS_VIDE: PurgeDossiersResultat = {
  fiches: 0,
  rencontresOrphelines: 0,
  faits: 0,
  comptesRendus: 0,
  questions: 0,
  emailsSuivi: 0,
};

/** Échéance de conservation de chaque fiche qui a un dossier (lecture seule). */
export async function lireEcheancesDesFiches(): Promise<Map<string, Date | null>> {
  const [rencontres, tenues, faits, factures, devis, fusions] = await Promise.all([
    prisma.rencontre.groupBy({
      by: ["clientId"],
      where: { clientId: { not: null } },
      _max: { debutPrevu: true, debutReel: true, createdAt: true },
    }),
    prisma.rencontre.groupBy({
      by: ["clientId"],
      where: { clientId: { not: null }, statut: "tenu" },
      _max: { debutPrevu: true, debutReel: true },
    }),
    prisma.fait.groupBy({
      by: ["clientId"],
      where: { clientId: { not: null } },
      _max: { constateLe: true },
    }),
    prisma.factureFormation.groupBy({
      by: ["clientId"],
      where: { clientId: { not: null }, emiseAt: { not: null } },
      _max: { emiseAt: true },
    }),
    prisma.devis.groupBy({
      by: ["clientId"],
      where: { acceptedAt: { not: null } },
      _max: { acceptedAt: true },
    }),
    prisma.clientFusion.findMany({
      where: { defaiteLe: null },
      select: { absorbeId: true, absorbantId: true },
    }),
  ]);
  const max = (...d: ReadonlyArray<Date | null | undefined>): Date | null =>
    d.reduce<Date | null>((m, x) => (x && (!m || x > m) ? x : m), null);

  const vide: AncresDossier = {
    derniereRencontre: null,
    derniereRencontreTenue: null,
    dernierFait: null,
    derniereFacture: null,
    dernierDevisAccepte: null,
  };
  const ancres = new Map<string, AncresDossier>();
  const maj = (id: string | null, patch: Partial<AncresDossier>): void => {
    if (!id) return;
    ancres.set(id, { ...(ancres.get(id) ?? vide), ...patch });
  };
  for (const r of rencontres)
    maj(r.clientId, {
      derniereRencontre: max(r._max.debutReel, r._max.debutPrevu, r._max.createdAt),
    });
  for (const r of tenues)
    maj(r.clientId, { derniereRencontreTenue: max(r._max.debutReel, r._max.debutPrevu) });
  for (const f of faits) maj(f.clientId, { dernierFait: f._max.constateLe });
  // Facture et devis ne comptent que pour une fiche qui A un dossier (rencontre
  // ou fait) : une fiche de facturation sans dossier n'a rien à purger ici.
  for (const f of factures)
    if (f.clientId && ancres.has(f.clientId)) maj(f.clientId, { derniereFacture: f._max.emiseAt });
  for (const d of devis)
    if (ancres.has(d.clientId)) maj(d.clientId, { dernierDevisAccepte: d._max.acceptedAt });

  const propres = new Map<string, Date | null>();
  for (const [id, a] of ancres) propres.set(id, finConservationDossier(a));
  const absorbeePar = new Map(fusions.map((f) => [f.absorbeId, f.absorbantId]));
  return echeancesAvecFusions(propres, absorbeePar);
}

/** Vide le dossier de fiches et de rencontres données, sous le drapeau. */
async function viderDossier(
  tx: Prisma.TransactionClient,
  clientIds: readonly string[],
  rencontreIds: readonly string[],
): Promise<Omit<PurgeDossiersResultat, "fiches" | "rencontresOrphelines">> {
  // 1. Les faits d'abord (ils retiennent les questions par une clé RESTRICT) :
  //    contenu vidé, statut `efface` — le journal de chaque fait reste.
  const faits = await tx.fait.findMany({
    where: {
      statut: { not: "efface" },
      OR: [{ clientId: { in: [...clientIds] } }, { rencontreId: { in: [...rencontreIds] } }],
    },
    select: { id: true },
  });
  const faitIds = faits.map((f) => f.id);
  await tx.fait.updateMany({
    where: { id: { in: faitIds } },
    data: { ...FAIT_CONTENU_VIDE, statut: "efface" },
  });
  await journaliserFaitsEffaces(tx, faitIds, null);
  await journaliserEffacements(tx, "faits", faitIds, "conservation");
  await tx.preRemplissage.updateMany({
    where: { faitId: { in: faitIds } },
    data: PRE_REMPLISSAGE_VIDE,
  });

  // 2. Les questionnaires : texte et réponse vidés (une question peut rester
  //    citée comme source d'un fait vidé — la ligne demeure).
  const questionnaires = await tx.questionnaireCadrage.findMany({
    where: { clientId: { in: [...clientIds] } },
    select: { id: true },
  });
  const questions = await tx.questionnaireQuestion.updateMany({
    where: { questionnaireId: { in: questionnaires.map((q) => q.id) }, NOT: { texte: "" } },
    data: QUESTION_VIDEE,
  });

  // 3. Les e-mails de suivi : corps pré-rempli vidé, lien supprimé (le
  //    message envoyé vit dans `email_outbox`, sous sa propre conservation).
  const emails = await tx.emailSuivi.findMany({
    where: { rencontreId: { in: [...rencontreIds] } },
    select: { id: true },
  });
  const emailIds = emails.map((e) => e.id);
  await tx.preRemplissage.updateMany({
    where: { cible: "email_suivi", cibleId: { in: emailIds } },
    data: PRE_REMPLISSAGE_VIDE,
  });
  await tx.emailSuivi.deleteMany({ where: { id: { in: emailIds } } });

  // 4. Les comptes rendus, toutes versions. Les citations sont dans les faits,
  //    vidés au 1 : elles partent avec le compte rendu.
  const comptesRendus = await tx.compteRendu.findMany({
    where: { rencontreId: { in: [...rencontreIds] } },
    select: { id: true },
  });
  const crIds = comptesRendus.map((c) => c.id);
  await tx.compteRendu.deleteMany({ where: { id: { in: crIds } } });
  await journaliserEffacements(tx, "comptes_rendus", crIds, "conservation");

  return {
    faits: faitIds.length,
    comptesRendus: crIds.length,
    questions: questions.count,
    emailsSuivi: emailIds.length,
  };
}

/**
 * Efface le contenu des dossiers dont la conservation est ÉCHUE à
 * `maintenant` : prospect 3 ans, client 5 ans, fiche absorbée ancrée sur
 * l'absorbante, rencontre jamais rattachée à sa date + 3 ans.
 *
 * Ce qui reste : la fiche entreprise et les personnes (régies par
 * l'effacement art. 17 et la relation commerciale), les journaux, les
 * rencontres elles-mêmes (dates, participants) et les preuves d'accord —
 * supprimées ensemble 5 ans plus tard par `purgerPreuvesAccordEchues`.
 */
export async function purgerDossiersVisioEchus(maintenant: Date): Promise<PurgeDossiersResultat> {
  const echeances = await lireEcheancesDesFiches();
  const echus = [...echeances]
    .filter(([, fin]) => fin !== null && fin.getTime() <= maintenant.getTime())
    .map(([id]) => id);

  const orphelines = await prisma.rencontre.findMany({
    where: { clientId: null },
    select: { id: true, debutPrevu: true, debutReel: true, createdAt: true },
  });
  const orphelinesEchues = orphelines
    .filter(
      (r) =>
        finConservationRencontreOrpheline(r.debutReel ?? r.debutPrevu ?? r.createdAt).getTime() <=
        maintenant.getTime(),
    )
    .map((r) => r.id);

  if (echus.length === 0 && orphelinesEchues.length === 0) return PURGE_DOSSIERS_VIDE;

  return executerSousDrapeauEffacement(prisma, async (tx) => {
    const rencontresDesFiches = await tx.rencontre.findMany({
      where: { clientId: { in: echus } },
      select: { id: true },
    });
    const r = await viderDossier(tx, echus, [
      ...rencontresDesFiches.map((x) => x.id),
      ...orphelinesEchues,
    ]);
    return { fiches: echus.length, rencontresOrphelines: orphelinesEchues.length, ...r };
  });
}

/**
 * Supprime les PREUVES D'ACCORD dont la conservation est échue : fin du
 * dossier + 5 ans (art. 17(3)(e) : elles établissent que l'enregistrement
 * était licite, et se gardent tant qu'une réclamation peut naître).
 *
 * - `enregistrement_consentements` : ancrées sur la fiche de leur rencontre,
 *   ou sur la rencontre elle-même si elle n'a jamais été rattachée ;
 * - `consent_events` « enregistrement-visio-annonce » : ces lignes ne portent
 *   qu'une empreinte d'adresse, sans lien vers une rencontre. On retient la
 *   durée la PLUS LONGUE possible (client : 5 ans + 5 ans après l'annonce),
 *   jamais la plus courte : purger trop tôt détruirait une preuve dont on
 *   peut avoir besoin (angle mort déclaré : un prospect voit sa preuve gardée
 *   jusqu'à 2 ans de plus que sa durée) ;
 * - RGPD-02 (vérification finale du 30/09) : la RENCONTRE elle-même, à la même
 *   échéance, avec ou sans preuve. Son titre et ses participants (nom affiché,
 *   empreinte d'adresse) restaient sans limite ; ses participants, son suivi
 *   et ses enregistrements partent en cascade (clés `ON DELETE CASCADE`), ses
 *   faits déjà vidés perdent le lien (`SET NULL`). Journalisée (`rencontres`,
 *   `conservation`) pour le rejeu après restauration. Test
 *   `la-fin-de-conservation-efface-la-rencontre-et-ses-participants`.
 */
export async function purgerPreuvesAccordEchues(maintenant: Date): Promise<{
  readonly preuves: number;
  readonly annonces: number;
  readonly rencontres: number;
}> {
  const echeances = await lireEcheancesDesFiches();
  const preuves = await prisma.enregistrementConsentement.findMany({
    select: { id: true, rencontreId: true, survenuLe: true },
  });
  const rencontres = await prisma.rencontre.findMany({
    select: { id: true, clientId: true, debutPrevu: true, debutReel: true, createdAt: true },
  });
  const parRencontre = new Map(rencontres.map((r) => [r.id, r]));

  /** Échéance des preuves d'une rencontre : fin de son dossier + 5 ans (`null` : aucune). */
  const finDesPreuves = (r: (typeof rencontres)[number] | undefined, repli: Date): Date | null => {
    const finDossier = r?.clientId
      ? (echeances.get(r.clientId) ?? null)
      : finConservationRencontreOrpheline(r ? (r.debutReel ?? r.debutPrevu ?? r.createdAt) : repli);
    return finDossier === null ? null : finConservationPreuve(finDossier);
  };
  const echue = (fin: Date | null): boolean =>
    fin !== null && fin.getTime() <= maintenant.getTime();

  const aSupprimer = preuves
    .filter((p) => echue(finDesPreuves(parRencontre.get(p.rencontreId), p.survenuLe)))
    .map((p) => p.id);
  const rencontresEchues = rencontres
    .filter((r) => echue(finDesPreuves(r, r.createdAt)))
    .map((r) => r.id);

  const limiteAnnonces = plusAns(
    maintenant,
    -(CONSERVATION_VISIO.clientAns + CONSERVATION_VISIO.preuvesApresDossierAns),
  );

  return executerSousDrapeauEffacement(prisma, async (tx) => {
    const p = await tx.enregistrementConsentement.deleteMany({ where: { id: { in: aSupprimer } } });
    const a = await tx.consentEvent.deleteMany({
      where: {
        formRef: CONSENT_FORM_REFS.enregistrementVisioAnnonce,
        occurredAt: { lt: limiteAnnonces },
      },
    });
    const r = await tx.rencontre.deleteMany({ where: { id: { in: rencontresEchues } } });
    await journaliserEffacements(tx, "rencontres", rencontresEchues, "conservation");
    return { preuves: p.count, annonces: a.count, rencontres: r.count };
  });
}

export interface RejeuResultat {
  /** Lignes du journal lues. */
  readonly lues: number;
  /** Cibles encore présentes (restaurées) : ré-effacées, ou à ré-effacer à blanc. */
  readonly reappliquees: number;
}

/** Motifs pour lesquels l'effacement d'un compte rendu a TOUJOURS été une suppression. */
const MOTIFS_SUPPRESSION_COMPTE_RENDU: ReadonlySet<MotifEffacement> = new Set<MotifEffacement>([
  "conservation",
  "pilote",
]);

/**
 * REJOUE le journal des effacements après une restauration de la base.
 *
 * Une sauvegarde prise avant un effacement ramène la personne ; sans ce rejeu,
 * elle réapparaîtrait en silence. Chaque ligne est réappliquée comme
 * l'effacement d'origine l'a faite (vider, pseudonymiser ou supprimer), de
 * façon IDEMPOTENTE : une cible déjà effacée ne compte pas.
 *
 * Comptes rendus : l'opération d'origine se lit dans le motif.
 *   · `conservation` (versions à 90 jours, dossier échu) et `pilote` : ils
 *     avaient été SUPPRIMÉS, ils le sont de nouveau ;
 *   · `art17`, `art17_cible`, `retrait` : supprimés si la personne effacée
 *     était la SEULE interlocutrice côté client, sinon vidés et passés
 *     `a_regenerer` — même règle (`rencontresOuSeuleVoixClient`) et mêmes
 *     données (`COMPTE_RENDU_A_REGENERER`) que `effacerCibleParAdresses`.
 *
 * Personnes effacées (art. 17) : on refait aussi ce qui ne se journalise pas
 * ligne à ligne mais se retrouve à partir d'elles, par les MÊMES fonctions que
 * l'effacement : `effacerCeQuiSuitLesPersonnes` (questions, e-mails de suivi,
 * rôles dans les projets) et `pseudonymiserPersonnes` (participations, fiche),
 * puis leurs adresses.
 *
 * Rencontres journalisées `conservation` (fin des preuves, RGPD-02) :
 * supprimées de nouveau, leurs participants et enregistrements en cascade.
 *
 * Pilote : `supprimerDonneesPilote`, la fonction de `purgerPilote`, sur les
 * rencontres, projets et personnes journalisés `pilote` et sur les fiches
 * inscrites dans `clients_test_interne` (faits par fiche ET par rencontre,
 * questionnaires par fiche, preuves d'accord par rencontre).
 *
 * ANGLES MORTS DÉCLARÉS (repris dans R33) :
 *   · une participation SANS fiche personne (rendez-vous « à classer »,
 *     retrouvée à l'origine par sa seule empreinte d'adresse) n'est pas
 *     journalisée : son nom affiché revient. Ses segments et ses faits, eux,
 *     sont journalisés et repartent ; un compte rendu dont elle était la seule
 *     voix est alors VIDÉ au lieu d'être supprimé (aucun contenu ne revient) ;
 *   · les questions et e-mails de suivi vidés par la fin de conservation d'un
 *     dossier ne sont pas journalisés : c'est la purge de nuit
 *     (`purgerDossiersVisioEchus`), qui recalcule les mêmes échéances sur les
 *     dates restaurées, qui les ré-efface ;
 *   · une purge du pilote qui n'a trouvé ni rencontre, ni projet, ni personne
 *     n'a laissé aucune ligne au journal : ses faits et questionnaires ne sont
 *     pas rejoués (données de test : relancer `purgerPilote` suffit).
 *
 * `appliquer = false` (défaut du script) : compte seulement, n'écrit rien.
 * Procédure : `docs/runbooks/R33-disaster-recovery-cold-start.md`, étape
 * « Rejouer les effacements » ; script `scripts/rgpd-rejouer-effacements.ts`.
 */
export async function rejouerEffacements(
  options: { readonly appliquer?: boolean } = {},
): Promise<RejeuResultat> {
  const lignes = await prisma.effacementJournal.findMany({
    orderBy: { le: "asc" },
    select: { tableCible: true, ligneId: true, motif: true },
  });
  const ids = (cible: CibleEffacement): string[] => [
    ...new Set(lignes.filter((l) => l.tableCible === cible).map((l) => l.ligneId)),
  ];
  const pilote = new Set(lignes.filter((l) => l.motif === "pilote").map((l) => l.ligneId));
  const faits = ids("faits");
  const citations = ids("faits_citation");
  const segments = ids("transcription_segments").map((l) => {
    const [transcriptionId = "", ordre = ""] = l.split(":");
    return { transcriptionId, ordre: Number(ordre) };
  });
  const comptesRendus = ids("comptes_rendus");
  const crSupprimesALOrigine = new Set(
    lignes
      .filter(
        (l) => l.tableCible === "comptes_rendus" && MOTIFS_SUPPRESSION_COMPTE_RENDU.has(l.motif),
      )
      .map((l) => l.ligneId),
  );
  const crToujoursSupprimes = comptesRendus.filter((id) => crSupprimesALOrigine.has(id));
  const crDesPersonnes = comptesRendus.filter((id) => !crSupprimesALOrigine.has(id));
  const contacts = ids("client_contacts");
  const rencontresPilote = ids("rencontres").filter((id) => pilote.has(id));
  // RGPD-02 : rencontres supprimées à la fin de conservation de leurs preuves.
  // Filtrées sur LEUR motif, pas sur « pas pilote » : un motif ajouté demain
  // pour la table `rencontres` ne serait pas rejoué comme une échéance.
  const conservation = new Set(
    lignes
      .filter((l) => l.tableCible === "rencontres" && l.motif === "conservation")
      .map((l) => l.ligneId),
  );
  const rencontresEchues = ids("rencontres").filter((id) => conservation.has(id));
  const projetsPilote = ids("projets").filter((id) => pilote.has(id));
  const documentsPilote = ids("documents_projet").filter((id) => pilote.has(id));
  const contactsPilote = contacts.filter((id) => pilote.has(id));
  const contactsEffaces = contacts.filter((id) => !pilote.has(id));
  const unePurgePiloteAEuLieu =
    rencontresPilote.length + projetsPilote.length + contactsPilote.length > 0;

  type Lecteur = Pick<
    Prisma.TransactionClient,
    | "fait"
    | "transcriptionSegment"
    | "compteRendu"
    | "clientContact"
    | "clientTestInterne"
    | "rencontre"
    | "projet"
    | "documentProjet"
    | "rencontreParticipant"
    | "questionnaireCadrage"
    | "questionnaireQuestion"
    | "emailSuivi"
    | "projetContact"
    | "enregistrementConsentement"
  >;

  /** Périmètre du pilote : celui de `purgerPilote`, rencontres/projets/personnes lus au journal. */
  const perimetrePilote = async (db: Lecteur): Promise<PerimetrePilote> => ({
    clientIds: unePurgePiloteAEuLieu
      ? (await db.clientTestInterne.findMany({ select: { clientId: true } })).map((f) => f.clientId)
      : [],
    rencontreIds: rencontresPilote,
    projetIds: projetsPilote,
    contactIds: contactsPilote,
    documentIds: documentsPilote,
  });

  /** Participations des personnes effacées (celles qui portent leur fiche). */
  const participationsEffacees = async (db: Lecteur): Promise<string[]> =>
    (
      await db.rencontreParticipant.findMany({
        where: { contactId: { in: contactsEffaces } },
        select: { id: true },
      })
    ).map((p) => p.id);

  /** Comptes rendus art. 17 / retrait : à supprimer (seule voix client) ou à vider. */
  const trierComptesRendus = async (
    db: Lecteur,
  ): Promise<{ readonly supprimer: string[]; readonly vider: string[] }> => {
    const presents = await db.compteRendu.findMany({
      where: { id: { in: crDesPersonnes } },
      select: { id: true, rencontreId: true },
    });
    const seule = new Set(
      await rencontresOuSeuleVoixClient(
        db,
        [...new Set(presents.map((c) => c.rencontreId))],
        new Set(await participationsEffacees(db)),
      ),
    );
    return {
      supprimer: presents.filter((c) => seule.has(c.rencontreId)).map((c) => c.id),
      vider: presents.filter((c) => !seule.has(c.rencontreId)).map((c) => c.id),
    };
  };

  const compter = async (db: Lecteur): Promise<number> => {
    const cr = await trierComptesRendus(db);
    const p = await perimetrePilote(db);
    const questionnaires = (
      await db.questionnaireCadrage.findMany({
        where: { contactDestinataireId: { in: contactsEffaces } },
        select: { id: true },
      })
    ).map((q) => q.id);
    const nombres = await Promise.all([
      db.fait.count({ where: { id: { in: faits }, statut: { not: "efface" } } }),
      db.fait.count({
        where: {
          id: { in: citations },
          OR: [{ citation: { not: null } }, { confirmationCitation: { not: null } }],
        },
      }),
      segments.length === 0 ? 0 : db.transcriptionSegment.count({ where: { OR: segments } }),
      db.compteRendu.count({ where: { id: { in: crToujoursSupprimes } } }),
      cr.supprimer.length,
      db.compteRendu.count({
        where: { id: { in: cr.vider }, NOT: { contenu: COMPTE_RENDU_A_REGENERER.contenu } },
      }),
      db.clientContact.count({
        where: { id: { in: contactsEffaces }, NOT: { nom: CONTACT_PSEUDONYMISE.nom } },
      }),
      db.rencontreParticipant.count({
        where: {
          contactId: { in: contactsEffaces },
          NOT: { nomAffiche: PARTICIPANT_PSEUDONYMISE.nomAffiche },
        },
      }),
      db.questionnaireQuestion.count({
        where: { questionnaireId: { in: questionnaires }, NOT: { texte: QUESTION_VIDEE.texte } },
      }),
      db.emailSuivi.count({ where: { contactId: { in: contactsEffaces } } }),
      db.projetContact.count({ where: { contactId: { in: contactsEffaces } } }),
      // Pilote : exactement ce que `supprimerDonneesPilote` supprime.
      db.fait.count({
        where: {
          OR: [
            { clientId: { in: [...p.clientIds] } },
            { rencontreId: { in: [...p.rencontreIds] } },
          ],
        },
      }),
      db.enregistrementConsentement.count({
        where: { rencontreId: { in: [...p.rencontreIds] } },
      }),
      db.questionnaireCadrage.count({ where: { clientId: { in: [...p.clientIds] } } }),
      db.rencontre.count({ where: { id: { in: [...p.rencontreIds] } } }),
      db.documentProjet.count({
        where: {
          OR: [{ projetId: { in: [...p.projetIds] } }, { id: { in: [...p.documentIds] } }],
        },
      }),
      db.projet.count({ where: { id: { in: [...p.projetIds] } } }),
      db.clientContact.count({ where: { id: { in: [...p.contactIds] } } }),
      db.rencontre.count({ where: { id: { in: rencontresEchues } } }),
    ]);
    return nombres.reduce((a, b) => a + b, 0);
  };

  if (!options.appliquer) return { lues: lignes.length, reappliquees: await compter(prisma) };

  return executerSousDrapeauEffacement(prisma, async (tx) => {
    const reappliquees = await compter(tx);
    const cr = await trierComptesRendus(tx);
    const perimetre = await perimetrePilote(tx);
    const participantIds = await participationsEffacees(tx);
    await tx.fait.updateMany({
      where: { id: { in: faits }, statut: { not: "efface" } },
      data: { ...FAIT_CONTENU_VIDE, statut: "efface" },
    });
    await tx.fait.updateMany({
      where: { id: { in: citations } },
      data: { citation: null, confirmationCitation: null },
    });
    if (segments.length > 0) await tx.transcriptionSegment.deleteMany({ where: { OR: segments } });
    // Comptes rendus : l'opération d'origine, lue dans le motif (voir plus haut).
    await tx.compteRendu.deleteMany({
      where: { id: { in: [...crToujoursSupprimes, ...cr.supprimer] } },
    });
    await tx.compteRendu.updateMany({
      where: { id: { in: cr.vider }, NOT: { contenu: COMPTE_RENDU_A_REGENERER.contenu } },
      data: COMPTE_RENDU_A_REGENERER,
    });
    // Données du pilote : la fonction de `purgerPilote`, telle quelle.
    await supprimerDonneesPilote(tx, perimetre);
    // Fin de conservation (RGPD-02) : la rencontre part, le reste en cascade.
    await tx.rencontre.deleteMany({ where: { id: { in: rencontresEchues } } });
    // Personnes effacées (art. 17) : les fonctions de `effacerCibleParAdresses`.
    await effacerCeQuiSuitLesPersonnes(tx, contactsEffaces);
    await pseudonymiserPersonnes(tx, participantIds, contactsEffaces);
    await tx.clientContactAdresse.deleteMany({ where: { contactId: { in: contactsEffaces } } });
    return { lues: lignes.length, reappliquees };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// RÉSEAU D'APPORTEURS — démarrage manuel (2026-10-05)
//
// · Personne PRÉSENTÉE : ses coordonnées sont remplacées par le marqueur d'effacement ;
//   la présentation reste (entreprise, SIREN, dates), car elle fonde le droit à
//   commission de l'apporteur.
// · APPORTEUR : les octets de ses pièces sont supprimés. S'il a un contrat contresigné
//   ou des commissions, son identité de facturation est CONSERVÉE (contrat, relevés et
//   autofactures : art. L.123-22 du code de commerce, art. 17(3)(b)) ; sinon, toutes
//   ses données personnelles sont effacées et son dossier est fermé.
// ═════════════════════════════════════════════════════════════════════════════

export interface EraseReseauApporteurResult {
  apporteur: "aucun" | "efface" | "conserve_obligation_legale";
  presentationsAnonymisees: number;
}

export async function eraseReseauApporteurForEmail(
  email: string,
): Promise<EraseReseauApporteurResult> {
  const empreinte = hashEmailForLookup(email);
  if (!empreinte) return { apporteur: "aucun", presentationsAnonymisees: 0 };
  const presentations = await prisma.presentationEntreprise.updateMany({
    where: { personneEmailHash: empreinte },
    data: {
      personneNom: ERASED_PLACEHOLDER,
      personneEmail: ERASED_PLACEHOLDER,
      personneTelephone: null,
      personneFonction: null,
      personneEmailHash: null,
      besoin: null,
    },
  });
  const a = await prisma.apporteurReseau.findUnique({
    where: { emailHash: empreinte },
    select: {
      id: true,
      signeParSocieteAt: true,
      contratCle: true,
      contratSigneCle: true,
      _count: { select: { commissions: true } },
    },
  });
  if (!a) return { apporteur: "aucun", presentationsAnonymisees: presentations.count };
  await prisma.pieceApporteurContenu.deleteMany({ where: { piece: { apporteurId: a.id } } });
  await prisma.pieceApporteur.updateMany({
    where: { apporteurId: a.id },
    data: { nomFichier: ERASED_PLACEHOLDER, purgeeAt: new Date() },
  });
  // Contresigné = date ET PDF signé référencé (posés ensemble, à la fin de la contresignature) :
  // une contresignature interrompue ne fait jamais conserver un dossier. Un contrat résilié
  // après contresignature reste conservé (obligation légale), d'où le PDF et non le statut.
  const conserver =
    (a.signeParSocieteAt !== null && a.contratSigneCle !== null) || a._count.commissions > 0;
  if (conserver) {
    await prisma.apporteurReseau.update({
      where: { id: a.id },
      data: { telephone: null, noteInterne: null, versionLien: { increment: 1 } },
    });
    return {
      apporteur: "conserve_obligation_legale",
      presentationsAnonymisees: presentations.count,
    };
  }
  // Dossier NON conservé par obligation légale : les PDF signés (nom tapé, identité du
  // contrat) quittent aussi R2. Une panne de R2 ne bloque pas l'effacement : elle est
  // signalée (sans donnée personnelle) et les clés sont tout de même retirées de la base.
  for (const cle of [a.contratCle, a.contratSigneCle]) {
    if (!cle) continue;
    try {
      const { deleteFromR2 } = await import("@/lib/r2-storage");
      await deleteFromR2(cle);
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "rgpd-erase", step: "pdf-apporteur-r2" } });
    }
  }
  await prisma.apporteurReseau.update({
    where: { id: a.id },
    data: {
      contratCle: null,
      contratSha256: null,
      contratSigneCle: null,
      contratSigneSha256: null,
      prenom: ERASED_PLACEHOLDER,
      nom: ERASED_PLACEHOLDER,
      email: ERASED_PLACEHOLDER,
      emailHash: `erased:${a.id}`,
      telephone: null,
      iban: null,
      adresse: null,
      noteInterne: null,
      dernierMessage: null,
      signatureApporteur: PrismaRuntime.DbNull,
      statut: "refuse",
      versionLien: { increment: 1 },
    },
  });
  return { apporteur: "efface", presentationsAnonymisees: presentations.count };
}
