/**
 * Canal A — le CLIENT signe son devis depuis un lien public à jeton.
 *
 * Premier consommateur du porteur `signataire_jeton`, et le premier circuit du
 * dépôt où un tiers NON authentifié appose une signature d'engagement.
 *
 * ## Pourquoi ce circuit existe sous cette forme
 *
 * Jusqu'au 2026-07-29, le devis partait sur le canal fournisseur : le client
 * recevait par e-mail un PDF détaillé — lignes, quantités, prix unitaires, TVA,
 * totaux — et signait dans DocuSeal un document SÉPARÉ ne portant que trois
 * champs (`devis_number`, `amount_ht`, `valid_until`). Il lisait donc un
 * document et en signait un autre. Un bon pour accord qui ne désigne pas son
 * objet est juridiquement fragile.
 *
 * La voie corrective prévue au plan (§III.3) — un template DocuSeal éphémère par
 * pièce, via `POST /api/templates/pdf` — s'est révélée IMPOSSIBLE : l'endpoint
 * n'existe pas sur l'instance de production (v2.5.3, image open-source), il est
 * réservé aux offres Pro. Vérifié contre le conteneur réel, pas contre la doc.
 *
 * Ici, la signature porte sur le PDF RÉEL, celui dont l'empreinte est scellée
 * dans `document_hash_sha256`. Une seule source de vérité.
 *
 * ## 🔴 Ce que cette action ne fait PAS, et ne doit jamais faire
 *
 * Elle n'accepte **aucune identité** de l'appelant. Le nom, l'adresse et la
 * qualité du signataire ont été figés à l'ÉMISSION du lien, côté serveur, depuis
 * la fiche client. `signerDocument` les relit dans la ligne de jeton.
 *
 * Accepter un nom du formulaire produirait une signature dont l'identité serait
 * exactement ce que le porteur du lien a bien voulu déclarer — et le lien peut
 * être transféré. C'est la faille déjà corrigée deux fois sur ce dépôt.
 *
 * ⚠️ Cette action est PUBLIQUE : aucune session, aucun `requireAdminWrite`. Sa
 * seule garde est le jeton, et cette garde est revérifiée par `signerDocument`
 * lui-même — qui ne fait confiance à aucun appelant, celui-ci compris.
 */

"use server";

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendTelegram } from "@/lib/telegram";
import {
  signerDocument,
  type RefusSignatureDocument,
} from "@/server/qualiopi/documents/signature/document-signature-service";
import type { PartieSignataire } from "@/server/qualiopi/documents/signature/document-signature-hash";
import { partiesRequisesPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";

/**
 * 🔴 Les parties attendues viennent du SSOT, jamais d'une liste locale.
 *
 * Une liste écrite ici divergerait un jour de celle d'un autre circuit, en
 * silence : le devis passerait `signee` sur la seule signature du client, et le
 * dossier afficherait « devis accepté » sur un devis que l'organisme n'a jamais
 * contresigné.
 */
const PARTIES_DEVIS: readonly PartieSignataire[] = partiesRequisesPour("devis") ?? [];

/**
 * Plafonds repris À L'IDENTIQUE d'`emargement-public.ts`.
 *
 * ⚠️ Volontairement pas plus généreux : un devis se signe UNE fois, là où un
 * stagiaire signe plusieurs demi-journées avec le même lien. Si l'un des deux
 * devait être plus serré, ce serait celui-ci.
 */
const LIMITE_PAR_JETON = { limit: 12, windowSec: 60 } as const;
const LIMITE_PAR_IP = { limit: 600, windowSec: 60 } as const;

export type RefusSignatureDevis =
  | RefusSignatureDocument
  | "lien_invalide"
  | "lien_expire"
  | "lien_revoque"
  | "requete_invalide"
  | "stockage"
  /** Le lien est valide, mais le devis n'est plus en cours (refusé, accepté, remplacé). */
  | "devis_non_signable"
  | "trop_de_tentatives";

export type ResultatSignatureDevis =
  | { ok: true; signatureId: string; statutSignature: "partielle" | "signee" }
  | { ok: false; raison: RefusSignatureDevis; message: string };

/**
 * ⚠️ Le jeton authentifie le porteur, mais ses autres arguments ne sont pas
 * authentifiés pour autant.
 *
 * `methode` entre dans le tuple HACHÉ : une valeur hors énumération y serait
 * scellée définitivement.
 *
 * ⚠️ `papier_scanne` est ABSENTE de cette énumération, et c'est délibéré : elle
 * signifie « l'organisme verse au dossier une pièce signée à la main », ce qui
 * relève du porteur `reversement_papier` et d'une action d'administration. La
 * proposer ici laisserait un client déclarer lui-même avoir signé sur papier,
 * sans que personne dans l'organisme n'atteste ce reversement.
 */
const entreeSchema = z.object({
  token: z.string().min(1).max(4000),
  methode: z.enum(["trace", "confirmation_accessible"]),
  imageDataUrl: z.string().max(3_000_000).optional(),
});

/** Contresignature de l'organisme : pas de jeton, la session fait foi. */
const contresignatureSchema = z.object({
  documentGenereId: z.string().uuid(),
  methode: z.enum(["trace", "confirmation_accessible"]),
  imageDataUrl: z.string().max(3_000_000).optional(),
});

/** Empreintes de contexte, hors tuple haché donc effaçables (RGPD art. 17). */
async function contexteRequete(): Promise<{
  ipHash: string | null;
  userAgentSha256: string | null;
}> {
  const entetes = await headers();
  const ipBrute =
    entetes.get("cf-connecting-ip") ??
    entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const ua = entetes.get("user-agent");
  return {
    ipHash: hashIp(ipBrute),
    // ⚠️ `typeof !== "string"` et non `=== null` : `Headers.get()` rend
    // `string | null` d'après la spec, mais tout ce qui rend `undefined` ferait
    // lever `createHash().update(undefined)` — c'est-à-dire qu'un en-tête
    // manquant ferait échouer une SIGNATURE. Le coût de la robustesse est nul,
    // celui de la panne ne l'est pas.
    userAgentSha256: typeof ua !== "string" ? null : createHash("sha256").update(ua).digest("hex"),
  };
}

/**
 * Traduit une panne de stockage en refus exploitable.
 *
 * 🔴 `storeSignatureImage` LÈVE quand R2 est absent ou l'écriture ratée : une
 * signature dont l'image n'a pas été écrite est une preuve qui n'existe pas.
 * L'appelant doit REFUSER, jamais simuler.
 */
function refusStockage(err: SignatureStockageError): ResultatSignatureDevis {
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
  { raison: RefusSignatureDevis; message: string }
> = {
  signature_invalide: {
    raison: "lien_invalide",
    message: "Ce lien de signature n'est pas valide.",
  },
  inconnu: {
    raison: "lien_invalide",
    message: "Ce lien de signature n'est pas valide.",
  },
  expire: {
    raison: "lien_expire",
    message:
      "Ce lien de signature a expiré. Le devis n'est peut-être plus valable : demandez-en un nouveau à votre interlocuteur.",
  },
  revoque: {
    raison: "lien_revoque",
    message:
      "Ce lien a été désactivé, généralement parce qu'une version révisée du devis vous a été adressée. Utilisez le lien le plus récent.",
  },
};

/**
 * Le client appose son « bon pour accord » sur le devis.
 *
 * Ne met PAS le devis à `accepte` : cette action écrit une preuve, elle ne
 * décide pas d'un statut commercial. La bascule est dérivée séparément, une fois
 * TOUTES les parties requises signataires — voir `accepterDevisSurSignature`.
 */
export async function signerDevisParJetonAction(input: {
  token: string;
  methode: "trace" | "confirmation_accessible";
  imageDataUrl?: string;
}): Promise<ResultatSignatureDevis> {
  const parse = entreeSchema.safeParse(input);
  if (!parse.success) {
    return {
      ok: false,
      raison: "requete_invalide",
      message: "Cette demande n'est pas valide. Rechargez la page.",
    };
  }
  const donnees = parse.data;

  // ── Rate-limit, AVANT tout travail coûteux ──
  //
  // 🔴 Cette action est PUBLIQUE et écrit sur R2 une image pouvant peser
  // jusqu'à 3 Mo, avant même d'ouvrir la transaction. Sans plafond, quiconque
  // détient un lien valide peut la marteler et faire écrire autant d'objets.
  // `emargement-public.ts` — le seul autre point de signature non authentifié du
  // dépôt — pose exactement les deux mêmes bornes ; ne pas les reprendre ici
  // laisserait la porte la plus récente moins gardée que la plus ancienne.
  //
  // ⚠️ Plafond PAR JETON, qu'aucun nombre de signataires ne dilue, ET par IP.
  const empreinteJeton = createHash("sha256").update(donnees.token).digest("hex");
  const parJeton = await checkRateLimit(`devis:sig:${empreinteJeton}`, LIMITE_PAR_JETON);
  if (!parJeton.allowed) {
    return {
      ok: false,
      raison: "trop_de_tentatives",
      message: "Trop de tentatives. Patientez une minute avant de réessayer.",
    };
  }

  // Contexte résolu ICI, une seule fois : il sert au plafond par IP puis à la
  // ligne de preuve. Le recalculer deux fois lirait deux fois les en-têtes pour
  // le même résultat.
  const contexte = await contexteRequete();
  if (contexte.ipHash !== null) {
    const parIp = await checkRateLimit(`devis:ip:${contexte.ipHash}`, LIMITE_PAR_IP);
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

  // 🔴 Le lien ne peut signer QU'au titre que l'émission lui a donné. Le service
  // le revérifie, et ce contrôle-ci n'est pas pour autant redondant : il refuse
  // tôt, avec un message qui a du sens pour le client.
  if (!PARTIES_DEVIS.includes(verif.partie)) {
    Sentry.captureException(new Error("Jeton de devis portant une partie hors du circuit"), {
      tags: { action: "signerDevisParJetonAction:partie_hors_circuit" },
      extra: { partie: verif.partie },
    });
    return {
      ok: false,
      raison: "partie_non_attendue",
      message: "Ce lien ne permet pas de signer cette pièce.",
    };
  }

  // 🔴 LE DEVIS EST-IL ENCORE SIGNABLE ? Garde SERVEUR, et elle manquait.
  //
  // `lireDevisASigner` calcule bien `statutBloquant`, mais il n'est consommé que
  // par la PAGE. Or la page ne protège rien : cette action est appelable depuis
  // un onglet resté ouvert, ou directement. Le trou était concret —
  // `declineDevisAction` pose `statut: "refuse"` sans toucher au jeton : le lien
  // du client survivait au refus, et sa signature se serait inscrite, chaînée et
  // scellée, sur un devis refusé. `accepterDevisSurSignature` ne l'aurait même
  // pas rattrapé (il ne bascule que depuis `envoye`), laissant une pièce signée
  // face à un CRM qui dit « refusé », et une preuve qu'on ne peut plus retirer
  // que par révocation explicite.
  //
  // C'est le même raisonnement que celui déjà écrit sur le garde 0 € : « le
  // garde côté formulaire ne protège rien ».
  const devisCourant = await prisma.devis.findFirst({
    where: { documentGenereId: verif.documentGenereId },
    select: { statut: true, numero: true },
  });
  if (devisCourant === null) {
    return { ok: false, raison: "piece_introuvable", message: "Devis introuvable." };
  }
  if (devisCourant.statut !== "envoye") {
    // Message différencié : « déjà accepté » rassure, « n'est plus en cours »
    // oriente vers l'interlocuteur. Aucun des deux n'apprend rien à qui ne
    // détient pas déjà un lien valide.
    return {
      ok: false,
      raison: "devis_non_signable",
      message:
        devisCourant.statut === "accepte" || devisCourant.statut === "transforme_convention"
          ? "Ce devis a déjà fait l'objet d'un accord. Aucune nouvelle signature n'est nécessaire."
          : "Ce devis n'est plus en cours : il a été retiré, refusé ou remplacé. Contactez votre interlocuteur pour en recevoir un nouveau.",
    };
  }

  try {
    const res = await signerDocument({
      documentGenereId: verif.documentGenereId,
      porteur: {
        type: "signataire_jeton",
        tokenId: verif.tokenId,
        partie: verif.partie,
      },
      methode: donnees.methode,
      partiesRequises: PARTIES_DEVIS,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...contexte,
    });
    if (!res.ok) return res;

    // La pièce est-elle désormais conclue ? Si oui, le devis suit.
    if (res.statutSignature === "signee") {
      await accepterDevisSurSignature(verif.documentGenereId);
    }

    // 🔴 PRÉVENIR. Sans cette alerte, un client signe et PERSONNE ne le sait.
    //
    // Le devis reste alors `partielle` indéfiniment : il attend la
    // contresignature de l'organisme, qui ne viendra pas puisque rien ne l'a
    // signalée. Le client, lui, a signé et attend son exemplaire contresigné.
    // C'est une panne silencieuse du circuit commercial, exactement de la même
    // famille que le F4 corrigé le 2026-07-26 — « une panne de signature doit
    // REMONTER ».
    //
    // ⚠️ Aucune donnée personnelle dans le corps : Telegram est un canal tiers.
    // Le numéro de devis suffit à agir. `.catch()` obligatoire — une panne
    // Telegram ne doit jamais annuler une signature déjà écrite et chaînée.
    sendTelegram({
      tag: "AUTO",
      body:
        res.statutSignature === "signee"
          ? `✅ Devis ${devisCourant.numero} : signé par le client ET contresigné — passé en « accepté ».`
          : `✍️ Devis ${devisCourant.numero} : le client vient de signer. À CONTRESIGNER dans la console pour conclure.`,
    }).catch(() => {});

    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "signerDevisParJetonAction" } });
    throw err;
  }
}

/**
 * Passe le devis en `accepte` quand sa pièce est intégralement signée.
 *
 * 🔴 Séparé de l'écriture de la preuve, et jamais l'inverse : la preuve est la
 * source, le statut commercial n'en est qu'une conséquence. Les mêler ferait
 * dépendre l'enregistrement d'une signature du succès d'une mise à jour
 * commerciale — une panne sur la seconde perdrait la première.
 *
 * ⚠️ `updateMany` avec garde sur le statut : un devis déjà `accepte`,
 * `transforme_convention` ou `expire` ne doit pas être rétrogradé. Le
 * `sentAt`/`acceptedAt` d'origine reste celui du premier passage.
 *
 * ⚠️ N'échoue JAMAIS bruyamment : une bascule de statut ratée ne doit pas
 * annuler une signature déjà écrite et déjà chaînée.
 */
async function accepterDevisSurSignature(documentGenereId: string): Promise<void> {
  try {
    await prisma.devis.updateMany({
      where: { documentGenereId, statut: "envoye" },
      data: { statut: "accepte", acceptedAt: new Date() },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "accepterDevisSurSignature" },
      extra: { documentGenereId },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contresignature de l'organisme (canal B — admin authentifié)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'organisme CONCLUT le devis en le contresignant.
 *
 * 🔴 Sans cette action, le circuit ne peut jamais se terminer. Le SSOT déclare
 * deux parties (`client`, `axionia`) : tant que la seconde manque,
 * `signerDocument` dérive `partielle`, le devis reste `envoye`, et la pièce
 * afficherait indéfiniment un « bon pour accord » que l'organisme n'a pas
 * accepté. Une signature côté client seul n'est pas un contrat.
 *
 * ⚠️ `requireAdminWrite` admet `editor`, et `signerDocument` ne l'admet PAS —
 * conclure un engagement commercial engage l'organisme. On refuse donc ICI, avec
 * un message qui dit pourquoi, plutôt que de laisser remonter un
 * `identite_non_resolvable` que personne ne saurait interpréter.
 *
 * ⚠️ L'ORDRE compte : le SSOT place `axionia` en DERNIER, et ce n'est pas
 * décoratif — l'organisme contresigne ce que le client a accepté. Contresigner
 * avant le client produirait une chaîne dont l'ordre contredit la séquence
 * contractuelle. On refuse explicitement plutôt que de laisser faire.
 */
export async function contresignerDevisAction(input: {
  documentGenereId: string;
  methode: "trace" | "confirmation_accessible";
  imageDataUrl?: string;
}): Promise<ResultatSignatureDevis> {
  const session = await requireAdminWrite();
  if (session.role !== "super_admin" && session.role !== "admin") {
    return {
      ok: false,
      raison: "porteur_non_autorise",
      message:
        "Contresigner un devis engage l'organisme : seuls un administrateur ou le dirigeant peuvent le faire.",
    };
  }

  const parse = contresignatureSchema.safeParse(input);
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
    select: { type: true, numero: true },
  });
  if (piece === null || piece.type !== "devis") {
    return { ok: false, raison: "piece_introuvable", message: "Devis introuvable." };
  }

  // 🔴 Le client d'abord. Voir l'en-tête : l'organisme conclut, il n'ouvre pas.
  const clientASigne = await prisma.documentSignature.count({
    where: { documentGenereId: donnees.documentGenereId, partie: "client", revokedAt: null },
  });
  if (clientASigne === 0) {
    return {
      ok: false,
      raison: "partie_non_attendue",
      message:
        "Le client n'a pas encore donné son accord : l'organisme contresigne ce que le client a accepté, jamais l'inverse. Attendez sa signature, ou versez au dossier le devis qu'il vous a retourné signé.",
    };
  }

  try {
    const res = await signerDocument({
      documentGenereId: donnees.documentGenereId,
      porteur: {
        type: "organisme_authentifie",
        adminId: session.userId,
        partie: "axionia",
      },
      methode: donnees.methode,
      partiesRequises: PARTIES_DEVIS,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...(await contexteRequete()),
    });
    if (!res.ok) return res;

    if (res.statutSignature === "signee") {
      await accepterDevisSurSignature(donnees.documentGenereId);
    }

    await logQualiopiActivity({
      action: "qualiopi.devis.contresignature",
      targetType: "DocumentSignature",
      targetId: res.signatureId,
      changes: {
        documentGenereId: donnees.documentGenereId,
        numero: piece.numero,
        statutSignature: res.statutSignature,
      },
      session,
    });

    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "contresignerDevisAction" } });
    throw err;
  }
}
