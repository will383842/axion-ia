/**
 * Canal A — signature d'une PIÈCE contractuelle par lien public, et
 * contresignature de l'organisme.
 *
 * Vaut pour les huit circuits du SSOT (`parties-requises.ts`). Ce module ne
 * connaît AUCUNE matrice : il lit le circuit, il ne le décide pas.
 *
 * ## Pourquoi ce module existe sous cette forme
 *
 * Jusqu'au 2026-07-29, le devis partait sur le canal fournisseur : le client
 * recevait un PDF détaillé et signait, dans DocuSeal, un document SÉPARÉ à trois
 * champs. Il lisait un document et en signait un autre. Les cinq autres pièces
 * contractuelles, elles, n'avaient AUCUNE signature électronique —
 * `src/server/qualiopi/` n'appelait jamais DocuSeal : `fournisseur` décrivait
 * une intention, pas un branchement.
 *
 * La voie corrective du plan (§III.3) — template DocuSeal éphémère par pièce via
 * `POST /api/templates/pdf` — est IMPOSSIBLE : l'endpoint n'existe pas sur
 * l'instance de production (fonctionnalité Pro ; 404 vérifié contre le conteneur
 * v2.5.3). Voir ADR 0037.
 *
 * ➡️ Les huit circuits signent désormais LA PIÈCE ELLE-MÊME, celle dont
 * l'empreinte est scellée dans `document_hash_sha256`. Une seule source de
 * vérité.
 *
 * ## 🔴 Ce que ce module ne fait PAS, et ne doit jamais faire
 *
 * Il n'accepte **aucune identité** de l'appelant. Nom, adresse et qualité du
 * signataire ont été figés à l'ÉMISSION du lien, côté serveur, depuis la fiche
 * de la partie. `signerDocument` les relit dans la ligne de jeton.
 *
 * Accepter un nom du formulaire produirait une signature dont l'identité serait
 * exactement ce que le porteur du lien a bien voulu déclarer — et un lien se
 * transfère. C'est la faille déjà corrigée deux fois sur ce dépôt.
 *
 * ⚠️ `signerPieceParJetonAction` est PUBLIQUE : aucune session. Sa seule garde
 * est le jeton, et cette garde est revérifiée par `signerDocument` lui-même, qui
 * ne fait confiance à aucun appelant — celui-ci compris.
 */

"use server";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { apresSignature } from "@/server/qualiopi/documents/signature/apres-signature";
import { contexteRequete } from "@/server/qualiopi/documents/signature/contexte-requete";
import {
  signerDocument,
  type RefusSignatureDocument,
} from "@/server/qualiopi/documents/signature/document-signature-service";
import type { PartieSignataire } from "@/server/qualiopi/documents/signature/document-signature-hash";
import { peutSignerPourOrganisme } from "@/server/qualiopi/documents/signature/garde-engagement";
import {
  codeRequis,
  masquerAdresse,
  memeAdresse,
  objectionContratCadre,
} from "@/server/qualiopi/documents/signature/contrat-cadre-signature";
import { verifierCodeSignature } from "@/server/qualiopi/documents/signature/code-signature";
import { CONSENTEMENT_VERSION_DOCUMENT_CODE } from "@/server/qualiopi/documents/signature/mentions-document";
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { envoyerCodeSignature } from "@/server/qualiopi/formateurs-independants/code-signature-envoi";
import { objectionContresignatureContratCadre } from "@/server/qualiopi/formateurs-independants/garde-contresignature-contrat-cadre";
import { objectionLettreMissionPerimee } from "@/server/qualiopi/formateurs-independants/lettre-mission-perimee";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";

/**
 * Plafonds repris À L'IDENTIQUE d'`emargement-public.ts`.
 *
 * ⚠️ Volontairement pas plus généreux : une pièce contractuelle se signe UNE
 * fois, là où un stagiaire signe plusieurs demi-journées avec le même lien. Si
 * l'un des deux devait être plus serré, ce serait celui-ci.
 */
const LIMITE_PAR_JETON = { limit: 12, windowSec: 60 } as const;
const LIMITE_PAR_IP = { limit: 600, windowSec: 60 } as const;
/**
 * Demande de code (contrat-cadre v3) : simple frein au martèlement d'un lien. Les
 * plafonds d'ÉMISSION (2 min, 3/h par pièce, 5/h par formateur) sont ceux de l'envoi
 * S6b, comptés sur les codes réellement émis : un clic « trop tôt » n'en consomme aucun.
 */
const LIMITE_CODE_PAR_JETON = { limit: 10, windowSec: 600 } as const;

export type RefusSignaturePiece =
  | RefusSignatureDocument
  | "lien_invalide"
  | "lien_expire"
  | "lien_revoque"
  | "requete_invalide"
  | "stockage"
  /** Le type de pièce ne figure pas au SSOT : elle ne se signe pas. */
  | "piece_non_signable"
  /** Le lien est valide, mais la pièce n'est plus en état d'être signée. */
  | "piece_non_signable_maintenant"
  | "role_insuffisant"
  | "trop_de_tentatives"
  /** Contrat-cadre v3 : la signature exige le code reçu par e-mail (lot L7c). */
  | "code_requis"
  | "code_refuse"
  | "code_indisponible";

export type ResultatSignaturePiece =
  | { ok: true; signatureId: string; statutSignature: "partielle" | "signee" }
  | { ok: false; raison: RefusSignaturePiece; message: string };

/**
 * ⚠️ Le jeton authentifie le porteur, pas ses autres arguments.
 *
 * `methode` entre dans le tuple HACHÉ : une valeur hors énumération y serait
 * scellée définitivement.
 *
 * ⚠️ `papier_scanne` est ABSENTE, et c'est délibéré : elle signifie
 * « l'organisme verse au dossier une pièce signée à la main », ce qui relève du
 * porteur `reversement_papier` et d'une action d'administration. La proposer ici
 * laisserait un tiers déclarer lui-même avoir signé sur papier, sans que
 * personne dans l'organisme n'atteste ce reversement.
 */
const entreeJetonSchema = z.object({
  token: z.string().min(1).max(4000),
  methode: z.enum(["trace", "confirmation_accessible"]),
  imageDataUrl: z.string().max(3_000_000).optional(),
  /** Code à usage unique — exigé pour le seul contrat-cadre v3 (lot L7c). */
  code: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

const entreeContresignatureSchema = z.object({
  documentGenereId: z.string().uuid(),
  methode: z.enum(["trace", "confirmation_accessible"]),
  imageDataUrl: z.string().max(3_000_000).optional(),
});

/**
 * Traduit une panne de stockage en refus exploitable.
 *
 * 🔴 `storeSignatureImage` LÈVE quand R2 est absent ou l'écriture ratée : une
 * signature dont l'image n'a pas été écrite est une preuve qui n'existe pas.
 * L'appelant doit REFUSER, jamais simuler.
 */
function refusStockage(err: SignatureStockageError): ResultatSignaturePiece {
  return {
    ok: false,
    raison: "stockage",
    message: err.imputableAuClient
      ? err.message
      : "Votre signature n'a pas pu être enregistrée. Réessayez ; si le problème persiste, prévenez votre interlocuteur.",
  };
}

const REFUS_JETON: Record<
  "signature_invalide" | "inconnu" | "expire" | "revoque",
  { raison: RefusSignaturePiece; message: string }
> = {
  signature_invalide: {
    raison: "lien_invalide",
    message: "Ce lien de signature n'est pas valide.",
  },
  inconnu: { raison: "lien_invalide", message: "Ce lien de signature n'est pas valide." },
  expire: {
    raison: "lien_expire",
    message: "Ce lien de signature a expiré. Demandez-en un nouveau à votre interlocuteur.",
  },
  revoque: {
    raison: "lien_revoque",
    message:
      "Ce lien a été désactivé, généralement parce qu'une version révisée de la pièce vous a été adressée. Utilisez le lien le plus récent.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Spécificités par type de pièce — isolées ICI, et nulle part ailleurs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Une pièce peut être hors d'état d'être signée pour des raisons qui ne
 * regardent QUE son circuit métier.
 *
 * 🔴 Le devis en est le cas d'école, et c'est un trou réel trouvé en
 * vérification le 2026-07-30 : `declineDevisAction` posait `statut: "refuse"`
 * sans toucher au jeton, et rien ici ne regardait le statut — seule la PAGE le
 * faisait. Or une page ne protège rien : l'action est appelable depuis un onglet
 * resté ouvert. La signature se serait inscrite, chaînée et scellée sur un devis
 * refusé.
 *
 * ⚠️ Rendre `null` = « rien à objecter ». Les autres pièces n'ont pas
 * aujourd'hui de statut propre qui interdirait la signature ; le jour où l'une
 * en aura un, c'est ICI qu'il se déclare, pas dans le corps de l'action.
 */
async function objectionMetier(
  type: string,
  documentGenereId: string,
): Promise<{ message: string } | null> {
  if (type !== "devis") return null;

  const devis = await prisma.devis.findFirst({
    where: { documentGenereId },
    select: { statut: true },
  });
  if (devis === null) return { message: "Devis introuvable." };
  if (devis.statut === "envoye") return null;

  return {
    message:
      devis.statut === "accepte" || devis.statut === "transforme_convention"
        ? "Ce devis a déjà fait l'objet d'un accord. Aucune nouvelle signature n'est nécessaire."
        : "Ce devis n'est plus en cours : il a été retiré, refusé ou remplacé. Contactez votre interlocuteur pour en recevoir un nouveau.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Canal A — le tiers signe depuis son lien
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Une partie appose sa signature sur une pièce, depuis son lien nominatif.
 *
 * Ne décide d'aucun statut commercial : elle écrit une preuve. La conséquence
 * est dérivée séparément, une fois TOUTES les parties requises signataires.
 */
export async function signerPieceParJetonAction(input: {
  token: string;
  methode: "trace" | "confirmation_accessible";
  imageDataUrl?: string;
  code?: string;
}): Promise<ResultatSignaturePiece> {
  const parse = entreeJetonSchema.safeParse(input);
  if (!parse.success) {
    return {
      ok: false,
      raison: parse.error.issues.some((i) => i.path[0] === "code")
        ? "code_refuse"
        : "requete_invalide",
      message: parse.error.issues.some((i) => i.path[0] === "code")
        ? MESSAGE_CODE_FORMAT
        : "Cette demande n'est pas valide. Rechargez la page.",
    };
  }
  const donnees = parse.data;

  // ── Rate-limit, AVANT tout travail coûteux ──
  //
  // 🔴 Action PUBLIQUE écrivant sur R2 une image pouvant peser jusqu'à 3 Mo,
  // avant même d'ouvrir la transaction. Sans plafond, quiconque détient un lien
  // valide peut la marteler. `emargement-public.ts` — le seul autre point de
  // signature non authentifié du dépôt — pose exactement les deux mêmes bornes.
  //
  // ⚠️ La clé porte l'EMPREINTE du jeton, jamais le jeton : une clé de cache
  // contenant le clair le rendrait lisible, c'est-à-dire signable.
  const empreinteJeton = createHash("sha256").update(donnees.token).digest("hex");
  const parJeton = await checkRateLimit(`piece:sig:${empreinteJeton}`, LIMITE_PAR_JETON);
  if (!parJeton.allowed) {
    return {
      ok: false,
      raison: "trop_de_tentatives",
      message: "Trop de tentatives. Patientez une minute avant de réessayer.",
    };
  }

  // Contexte résolu ICI, une seule fois : il sert au plafond par IP puis à la
  // ligne de preuve.
  const contexte = await contexteRequete();
  if (contexte.ipHash !== null) {
    const parIp = await checkRateLimit(`piece:ip:${contexte.ipHash}`, LIMITE_PAR_IP);
    if (!parIp.allowed) {
      return {
        ok: false,
        raison: "trop_de_tentatives",
        message: "Trop de tentatives depuis ce réseau. Patientez une minute.",
      };
    }
  }

  const verif = await verifierTokenDocument(donnees.token);
  if (!verif.ok) {
    const m = REFUS_JETON[verif.raison];
    return { ok: false, raison: m.raison, message: m.message };
  }

  const piece = await prisma.documentGenere.findUnique({
    where: { id: verif.documentGenereId },
    select: { type: true, numero: true, metadata: true },
  });
  if (piece === null) {
    return { ok: false, raison: "piece_introuvable", message: "Pièce introuvable." };
  }

  // 🔴 Le circuit vient du SSOT, jamais d'une liste locale. Une liste écrite ici
  // divergerait un jour de celle d'un autre circuit, EN SILENCE : une pièce
  // déclarée à deux parties d'un côté et à trois de l'autre passerait `signee`
  // à deux signatures sur trois.
  const circuit = circuitPour(piece.type);
  if (circuit === null) {
    return { ok: false, raison: "piece_non_signable", message: "Cette pièce ne se signe pas." };
  }

  // Le lien ne peut signer QU'au titre que l'émission lui a donné. Le service le
  // revérifie ; ce contrôle-ci refuse plus tôt, avec un message qui a du sens.
  if (!circuit.parties.includes(verif.partie)) {
    Sentry.captureException(new Error("Jeton portant une partie hors du circuit de la pièce"), {
      tags: { action: "signerPieceParJetonAction:partie_hors_circuit" },
      extra: { partie: verif.partie, type: piece.type },
    });
    return {
      ok: false,
      raison: "partie_non_attendue",
      message: "Ce lien ne permet pas de signer cette pièce.",
    };
  }

  const objection = await objectionAvantSignature({
    documentGenereId: verif.documentGenereId,
    type: piece.type,
    metadata: piece.metadata,
    partie: verif.partie,
  });
  if (objection !== null) {
    return { ok: false, raison: "piece_non_signable_maintenant", message: objection.message };
  }

  // Contrat-cadre v3 : le code à usage unique est vérifié et CONSOMMÉ juste
  // avant l'écriture de la preuve. Sans code valide, rien n'est signé.
  const avecCode = codeRequis(piece.type, piece.metadata, verif.partie);
  if (avecCode) {
    if (donnees.code === undefined) {
      return {
        ok: false,
        raison: "code_requis",
        message: "Saisissez le code reçu par e-mail pour signer.",
      };
    }
    const v = await verifierCodeSignature({
      documentGenereId: verif.documentGenereId,
      partie: verif.partie,
      code: donnees.code,
    });
    if (!v.ok) return { ok: false, raison: "code_refuse", message: v.message };
  }

  try {
    const res = await signerDocument({
      documentGenereId: verif.documentGenereId,
      porteur: { type: "signataire_jeton", tokenId: verif.tokenId, partie: verif.partie },
      methode: donnees.methode,
      partiesRequises: circuit.parties,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(avecCode ? { consentementVersion: CONSENTEMENT_VERSION_DOCUMENT_CODE } : {}),
      ...contexte,
    });
    if (!res.ok) return res;

    // Remise, alerte « reste à signer », copie partielle et conséquences
    // métier : un seul après-signature pour les six actions (S6a).
    await apresSignature({
      documentGenereId: verif.documentGenereId,
      type: piece.type,
      numero: piece.numero,
      statutSignature: res.statutSignature,
      partie: verif.partie,
      acteur: { type: "signataire" },
      canal: "lien_a_jeton",
    });

    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "signerPieceParJetonAction" } });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrat-cadre v3 — le code à usage unique (F17), lot L7c
// ─────────────────────────────────────────────────────────────────────────────

const MESSAGE_CODE_FORMAT = "Le code se compose de 6 chiffres. Vérifiez-le et réessayez.";

export type ResultatDemandeCode =
  | { ok: true; destinataireMasque: string }
  | { ok: false; raison: RefusSignaturePiece; message: string };

/**
 * Envoie le code à usage unique qui permet de signer un contrat-cadre v3.
 *
 * 🔴 PUBLIQUE, gardée par le jeton seul — comme la signature elle-même.
 *  · le code part à l'adresse FIGÉE sur le lien, et seulement si elle est celle
 *    de la fiche du formateur : un lien transféré à une autre adresse ne reçoit
 *    rien ;
 *  · plafonds d'émission de l'envoi S6b (2 min, 3/h par pièce, 5/h par formateur) ;
 *  · aucun code tant que le registre ne CONFIRME pas l'entreprise active
 *    (`objectionContratCadre`, fermé par défaut) : on ne promet pas une
 *    signature qui serait refusée ;
 *  · le code n'est jamais rendu ni journalisé : il ne voyage que dans l'e-mail
 *    (scellé dans la file d'envoi, lot S6b).
 */
export async function demanderCodeSignatureAction(input: {
  token: string;
}): Promise<ResultatDemandeCode> {
  const token = typeof input?.token === "string" ? input.token : "";
  if (token === "" || token.length > 4000) {
    return {
      ok: false,
      raison: "requete_invalide",
      message: "Cette demande n'est pas valide. Rechargez la page.",
    };
  }

  const empreinteJeton = createHash("sha256").update(token).digest("hex");
  const parJeton = await checkRateLimit(`piece:code:${empreinteJeton}`, LIMITE_CODE_PAR_JETON);
  if (!parJeton.allowed) {
    return {
      ok: false,
      raison: "trop_de_tentatives",
      message:
        "Trop de demandes de code. Utilisez le plus récent reçu, ou réessayez dans quelques minutes.",
    };
  }
  const contexte = await contexteRequete();
  if (contexte.ipHash !== null) {
    const parIp = await checkRateLimit(`piece:ip:${contexte.ipHash}`, LIMITE_PAR_IP);
    if (!parIp.allowed) {
      return {
        ok: false,
        raison: "trop_de_tentatives",
        message: "Trop de tentatives depuis ce réseau. Patientez une minute.",
      };
    }
  }

  const verif = await verifierTokenDocument(token);
  if (!verif.ok) {
    const m = REFUS_JETON[verif.raison];
    return { ok: false, raison: m.raison, message: m.message };
  }

  const piece = await prisma.documentGenere.findUnique({
    where: { id: verif.documentGenereId },
    select: {
      type: true,
      metadata: true,
      trainerId: true,
      trainer: { select: { email: true, prenom: true } },
    },
  });
  if (piece === null) {
    return { ok: false, raison: "piece_introuvable", message: "Pièce introuvable." };
  }
  if (!codeRequis(piece.type, piece.metadata, verif.partie)) {
    return {
      ok: false,
      raison: "piece_non_signable",
      message: "Cette pièce se signe sans code.",
    };
  }

  // Un contrat v3 d'ORGANISME (sans fiche formateur) attend son propre circuit
  // (lot des organismes) : aucun code ne part, sans alerte trompeuse.
  if (piece.trainerId === null || piece.trainer === null) {
    return {
      ok: false,
      raison: "code_indisponible",
      message:
        "Cette pièce ne peut pas encore être signée en ligne. Contactez votre interlocuteur chez Axion-IA.",
    };
  }

  // L'adresse du lien doit être celle de la fiche : sinon, rien ne part.
  if (!memeAdresse(verif.signataireEmail, piece.trainer.email)) {
    Sentry.captureException(
      new Error("Code de signature demandé pour une adresse non concordante"),
      { tags: { action: "demanderCodeSignatureAction:adresse" } },
    );
    return {
      ok: false,
      raison: "code_indisponible",
      message:
        "Le code ne peut pas être envoyé à l'adresse de ce lien. Contactez votre interlocuteur chez Axion-IA : un nouveau lien vous sera adressé.",
    };
  }

  // 🔴 Aucun code sans entreprise CONFIRMÉE ACTIVE au registre (règle du
  // propriétaire) : même contrôle, fermé par défaut, que la signature elle-même.
  const objection = await objectionContratCadre({
    documentGenereId: verif.documentGenereId,
    type: piece.type,
    metadata: piece.metadata,
    partie: verif.partie,
  });
  if (objection !== null) {
    return { ok: false, raison: "piece_non_signable_maintenant", message: objection.message };
  }

  // L'envoi lui-même est celui du lot S6b (`envoyerCodeSignature`) : il relit la pièce
  // et la fiche, exige le texte F17 validé, borne les renvois (2 min, 3/h par pièce,
  // 5/h par formateur), scelle le code dans la file et ne le rend jamais ici.
  const envoi = await envoyerCodeSignature({
    documentGenereId: verif.documentGenereId,
    maintenant: new Date(),
  });
  if (!envoi.ok) {
    return {
      ok: false,
      raison:
        envoi.raison === "trop-tot" || envoi.raison === "trop-de-codes"
          ? "trop_de_tentatives"
          : "code_indisponible",
      // « Hors circuit » ici = fiche qui n'est plus celle d'un sous-traitant : l'écran
      // affiche un champ code, le message ne doit pas dire le contraire.
      message:
        envoi.raison === "piece-hors-circuit"
          ? "Le code ne peut pas vous être envoyé pour l'instant. Contactez votre interlocuteur chez Axion-IA."
          : envoi.message,
    };
  }

  return { ok: true, destinataireMasque: masquerAdresse(piece.trainer.email) };
}

/**
 * Ce qui s'oppose à l'écriture d'une signature : l'objection métier de la pièce,
 * puis celle du contrat-cadre v3.
 *
 * 🔴 Partie `axionia` : LA porte unique de contresignature du contrat-cadre d'un
 * formateur indépendant (`objectionContresignatureContratCadre` : version en
 * vigueur, signature du formateur, attestation URSSAF prouvée, pièces validées,
 * SIREN actif relu en direct sur le SIRET du contrat). Tous les chemins de
 * contresignature y passent : pièce, lot, écran W-4, et le jeton (que le moteur
 * refuse de toute façon pour `axionia`). Toute autre pièce : inchangé.
 */
async function objectionAvantSignature(input: {
  documentGenereId: string;
  type: string;
  metadata: unknown;
  partie: PartieSignataire;
  adminId?: string;
}): Promise<{ message: string } | null> {
  const metier = await objectionMetier(input.type, input.documentGenereId);
  if (metier !== null) return metier;
  // C4 — une lettre de mission périmée ne se signe plus, d'aucun côté.
  const perimee = await objectionLettreMissionPerimee(input);
  if (perimee !== null) return perimee;
  if (input.partie === "axionia") {
    return objectionContresignatureContratCadre({
      documentGenereId: input.documentGenereId,
      type: input.type,
      metadata: input.metadata,
      adminId: input.adminId ?? null,
    });
  }
  return objectionContratCadre({
    documentGenereId: input.documentGenereId,
    type: input.type,
    metadata: input.metadata,
    partie: input.partie,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Canal B — l'organisme signe, authentifié
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'organisme appose sa signature sur une pièce.
 *
 * 🔴 Sans cette action, aucun circuit ne peut se terminer. Tous déclarent
 * `axionia` parmi leurs parties : tant qu'elle manque, `signerDocument` dérive
 * `partielle`, et la pièce afficherait indéfiniment un engagement que
 * l'organisme n'a pas conclu.
 *
 * ⚠️ `requireAdminWrite` admet `editor`, et `signerDocument` ne l'admet PAS —
 * engager l'organisme n'est pas un droit d'édition. On refuse donc ICI, avec un
 * message qui dit pourquoi, plutôt que de laisser remonter un
 * `identite_non_resolvable` que personne ne saurait interpréter.
 *
 * ## 🔴 L'ORDRE du SSOT est respecté
 *
 * L'organisme CONCLUT : il contresigne ce que les autres ont accepté. La garde
 * est : **toutes les parties placées AVANT `axionia` dans la liste ordonnée**
 * ont signé. (2026-08-10 : le seul circuit où `axionia` figurait en premier —
 * le `protocole_afest` — a disparu avec le module AFEST, décision Will ; la
 * forme ordonnée de la garde reste, elle protège tout futur circuit où
 * l'organisme ne conclurait pas.)
 */
export async function contresignerPieceAction(input: {
  documentGenereId: string;
  methode: "trace" | "confirmation_accessible";
  imageDataUrl?: string;
}): Promise<ResultatSignaturePiece> {
  const session = await requireAdminWrite();
  if (!peutSignerPourOrganisme(session.role)) return { ...REFUS_ROLE_ORGANISME };
  return contresignerUne(session, input);
}

const REFUS_ROLE_ORGANISME = {
  ok: false,
  raison: "role_insuffisant",
  message:
    "Signer une pièce contractuelle engage l'organisme : seuls un administrateur ou le dirigeant peuvent le faire.",
} as const satisfies ResultatSignaturePiece;

/**
 * Contresignature d'UNE pièce, la session déjà gardée. Partagée par l'action
 * unitaire et l'action par lot : la garde d'ordre, l'objection métier, la
 * preuve et l'après-signature sont les mêmes, pièce par pièce.
 */
async function contresignerUne(
  session: AdminSession,
  input: {
    documentGenereId: string;
    methode: "trace" | "confirmation_accessible";
    imageDataUrl?: string;
  },
): Promise<ResultatSignaturePiece> {
  const parse = entreeContresignatureSchema.safeParse(input);
  if (!parse.success) {
    return {
      ok: false,
      raison: "requete_invalide",
      message: "Cette demande n'est pas valide. Rechargez la page.",
    };
  }
  const donnees = parse.data;

  const piece = await prisma.documentGenere.findUnique({
    where: { id: donnees.documentGenereId },
    select: { type: true, numero: true, metadata: true },
  });
  if (piece === null) {
    return { ok: false, raison: "piece_introuvable", message: "Pièce introuvable." };
  }

  const circuit = circuitPour(piece.type);
  if (circuit === null || !circuit.parties.includes("axionia")) {
    return {
      ok: false,
      raison: "piece_non_signable",
      message: "Cette pièce n'appelle pas de signature de l'organisme.",
    };
  }

  // Parties qui doivent avoir signé AVANT l'organisme — voir l'en-tête.
  const rang = circuit.parties.indexOf("axionia");
  const prealables: readonly PartieSignataire[] = circuit.parties.slice(0, rang);
  if (prealables.length > 0) {
    const posees = await prisma.documentSignature.findMany({
      where: {
        documentGenereId: donnees.documentGenereId,
        revokedAt: null,
        partie: { in: [...prealables] },
      },
      select: { partie: true },
    });
    const vues = new Set(posees.map((s) => s.partie));
    const manquantes = prealables.filter((p) => !vues.has(p));
    if (manquantes.length > 0) {
      return {
        ok: false,
        raison: "partie_non_attendue",
        message: `L'organisme conclut ce que les autres ont accepté : il manque encore ${manquantes.join(", ")}. Attendez leur signature, ou versez au dossier la pièce qu'ils vous ont retournée signée.`,
      };
    }
  }

  const objection = await objectionAvantSignature({
    documentGenereId: donnees.documentGenereId,
    type: piece.type,
    metadata: piece.metadata,
    partie: "axionia",
    adminId: session.userId,
  });
  if (objection !== null) {
    return { ok: false, raison: "piece_non_signable_maintenant", message: objection.message };
  }

  try {
    const res = await signerDocument({
      documentGenereId: donnees.documentGenereId,
      porteur: { type: "organisme_authentifie", adminId: session.userId, partie: "axionia" },
      methode: donnees.methode,
      partiesRequises: circuit.parties,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(await contexteRequete()),
    });
    if (!res.ok) return res;

    await apresSignature({
      documentGenereId: donnees.documentGenereId,
      type: piece.type,
      numero: piece.numero,
      statutSignature: res.statutSignature,
      partie: "axionia",
      acteur: { type: "administrateur", session },
    });

    await logQualiopiActivity({
      action: "qualiopi.piece.contresignature",
      targetType: "DocumentSignature",
      targetId: res.signatureId,
      changes: {
        documentGenereId: donnees.documentGenereId,
        numero: piece.numero,
        type: piece.type,
        statutSignature: res.statutSignature,
      },
      session,
    });

    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "contresignerPieceAction" } });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contresignature PAR LOT — S6a (i)
// ─────────────────────────────────────────────────────────────────────────────

/** Plafond d'un lot : au-delà, l'écran découpe. Borne le travail d'un appel. */
const TAILLE_MAX_LOT = 50;

export type ResultatLotContresignature =
  | {
      ok: true;
      resultats: ReadonlyArray<{ documentGenereId: string } & ResultatSignaturePiece>;
      signees: number;
      refusees: number;
    }
  | { ok: false; raison: "role_insuffisant" | "requete_invalide"; message: string };

const entreeLotSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(TAILLE_MAX_LOT),
  methode: z.enum(["trace", "confirmation_accessible"]),
  imageDataUrl: z.string().max(3_000_000).optional(),
});

/**
 * L'organisme contresigne PLUSIEURS pièces d'un même geste.
 *
 * 🔑 Une ligne de preuve PAR PIÈCE : chaque pièce passe par la contresignature
 * unitaire, avec ses gardes (ordre du circuit, objection métier) et son
 * après-signature. Un lot n'est pas une signature collective — c'est N
 * signatures, chacune scellée sur l'empreinte de SA pièce.
 *
 * ⚠️ Une pièce refusée ne bloque pas les autres : le résultat dit, pièce par
 * pièce, ce qui a été signé et pourquoi le reste ne l'a pas été. Une panne
 * inattendue sur une pièce est rendue comme un refus de cette pièce seule.
 */
export async function contresignerParLotAction(input: {
  ids: string[];
  methode: "trace" | "confirmation_accessible";
  imageDataUrl?: string;
}): Promise<ResultatLotContresignature> {
  const session = await requireAdminWrite();
  if (!peutSignerPourOrganisme(session.role)) {
    return { ok: false, raison: "role_insuffisant", message: REFUS_ROLE_ORGANISME.message };
  }
  const parse = entreeLotSchema.safeParse(input);
  if (!parse.success) {
    return {
      ok: false,
      raison: "requete_invalide",
      message: `Sélectionnez entre 1 et ${TAILLE_MAX_LOT} pièces.`,
    };
  }
  const { ids, methode, imageDataUrl } = parse.data;

  const resultats: Array<{ documentGenereId: string } & ResultatSignaturePiece> = [];
  // Séquentiel, et c'est voulu : la chaîne de hachage des signatures est
  // ordonnée, et un lot ne doit pas mettre N transactions en concurrence.
  for (const documentGenereId of [...new Set(ids)]) {
    let r: ResultatSignaturePiece;
    try {
      r = await contresignerUne(session, {
        documentGenereId,
        methode,
        ...(imageDataUrl === undefined ? {} : { imageDataUrl }),
      });
    } catch {
      r = {
        ok: false,
        raison: "stockage",
        message: "Cette pièce n'a pas pu être signée. Réessayez-la seule.",
      };
    }
    resultats.push({ documentGenereId, ...r });
  }
  const signees = resultats.filter((r) => r.ok).length;
  return { ok: true, resultats, signees, refusees: resultats.length - signees };
}
