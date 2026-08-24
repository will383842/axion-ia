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
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";
import { envoyerPositionnement } from "@/server/qualiopi/notifications/notifications-service";
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
  | "trop_de_tentatives";

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
});

const entreeContresignatureSchema = z.object({
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

/**
 * Conséquence métier d'une pièce INTÉGRALEMENT signée.
 *
 * 🔴 Séparée de l'écriture de la preuve, et jamais l'inverse : la preuve est la
 * source, le statut commercial n'en est qu'une conséquence. Les mêler ferait
 * dépendre l'enregistrement d'une signature du succès d'une mise à jour
 * commerciale — une panne sur la seconde perdrait la première.
 *
 * ⚠️ N'échoue JAMAIS bruyamment.
 */
/**
 * Pièces dont la conclusion ENGAGE l'action de formation.
 *
 * C'est le moment exact où le positionnement doit partir : avant, on ne sait
 * pas encore si l'action aura lieu ; après, c'est un oubli qui coûte
 * l'indicateur 8. Le devis n'y figure pas — un accord commercial n'engage pas
 * encore une formation.
 */
const PIECES_QUI_ENGAGENT_LACTION: ReadonlySet<string> = new Set([
  "convention",
  "convention_tripartite",
  "contrat",
]);

/**
 * Envoie le questionnaire de positionnement à TOUS les stagiaires de la session
 * dès que la pièce qui engage l'action est intégralement signée (ind. 8).
 *
 * 🔴 Demandé par Will le 2026-08-15, après le premier dossier réel : « ça ne
 * pourrait pas devenir automatique pour qu'il n'y ait pas d'oubli ? ». Sur ce
 * dossier, le positionnement n'est parti que parce qu'on l'a cherché la veille
 * de la formation. Aucun cron ne le portait, aucune alerte ne le réclamait.
 *
 * ⚠️ IDEMPOTENT par `envoyeAt: null` : re-signer, ou repasser par ce chemin,
 * ne renvoie rien. C'est la garde qui autorise à l'appeler sans réfléchir.
 *
 * ⚠️ FAIL-SOFT, par stagiaire ET globalement : une panne d'e-mail ne doit
 * JAMAIS annuler une signature déjà écrite et chaînée. Le rattrapage manuel
 * (« Envoyer au stagiaire ») reste disponible, et la relance J+3 prend le
 * relais.
 */
async function declencherPositionnement(documentGenereId: string): Promise<void> {
  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: { sessionId: true },
  });
  if (piece?.sessionId == null) return;

  const questionnaires = await prisma.questionnaire.findMany({
    where: {
      type: "positionnement",
      envoyeAt: null,
      reponduAt: null,
      enrollment: { sessionId: piece.sessionId },
    },
    select: { id: true },
  });

  for (const q of questionnaires) {
    try {
      // 🔴 2026-08-24 — LE COMMENTAIRE CI-DESSOUS ÉTAIT JUSTE, ET L'APPEL FAUX.
      //
      // `envoyerPositionnement` n'écrit pas la trace — l'appelant la pose, comme
      // le fait l'envoi manuel. Sans elle, impossible de distinguer « jamais
      // envoyé » de « envoyé, sans réponse », et la relance J+3 ne partirait
      // jamais. Tout cela reste vrai.
      //
      // Mais l'appel jetait son booléen. `envoyerPositionnement` rend `false`
      // sans lever sur cinq chemins (stub, déjà répondu, stagiaire sans adresse,
      // file indisponible, garage en corbeille de validation) : le `catch` ne
      // voit aucun d'eux, et la trace était posée pour un courrier jamais parti.
      // Ce qui suit la signature d'une convention est précisément le document
      // qu'un certificateur demandera — poser sa date sans l'envoi produit une
      // preuve fausse.
      //
      // 🔑 Ne rien écrire est le bon comportement : le cron du positionnement
      // sélectionne sur `envoyeAt: null` et reprendra ce questionnaire.
      // Cliquet : `notifications/__tests__/appelant-ne-jette-pas-le-booleen-denvoi.spec.ts`.
      if (!(await envoyerPositionnement(q.id))) {
        console.error(
          `[declencherPositionnement] NON ENVOYÉ — questionnaire ${q.id} laissé ` +
            "sans trace, candidat au rattrapage par le cron `positionnement`",
        );
        continue;
      }
      await prisma.questionnaire.update({
        where: { id: q.id },
        data: { envoyeAt: new Date() },
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { action: "declencherPositionnement" },
        extra: { documentGenereId, questionnaireId: q.id },
      });
    }
  }
}

async function consequenceSignatureComplete(type: string, documentGenereId: string): Promise<void> {
  if (PIECES_QUI_ENGAGENT_LACTION.has(type)) {
    // Encapsulé : `declencherPositionnement` capture déjà par stagiaire, mais
    // une panne AVANT la boucle (lecture de la pièce) remonterait ici et
    // ferait échouer une signature valide.
    try {
      await declencherPositionnement(documentGenereId);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { action: "consequenceSignatureComplete:positionnement" },
        extra: { documentGenereId, type },
      });
    }
    return;
  }
  if (type !== "devis") return;
  try {
    // ⚠️ `updateMany` avec garde sur le statut : un devis déjà `accepte` ou
    // `transforme_convention` ne doit pas être rétrogradé. `expire` est INCLUS
    // depuis le cron devis-expiration (06:45) : validité échue à minuit,
    // client qui signe à 06:00, webhook traité à 06:50 → la preuve de
    // signature était écrite mais le devis restait « expiré » et
    // createSessionAction le refusait sans explication. Une signature
    // intégrale vaut accord, même reçue après l'échéance.
    await prisma.devis.updateMany({
      where: { documentGenereId, statut: { in: ["envoye", "expire"] } },
      data: { statut: "accepte", acceptedAt: new Date() },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "consequenceSignatureComplete" },
      extra: { documentGenereId, type },
    });
  }
}

/**
 * Parties requises qui n'ont pas encore signé.
 *
 * 🔴 Sert l'ALERTE, et ce n'est pas cosmétique : « pièce incomplète » n'apprend
 * rien, « reste à signer : axionia » dit quoi faire. C'était tout l'objet du
 * correctif F15 — une signature reçue que personne ne remarque laisse la pièce
 * en attente indéfiniment, pendant que le signataire attend son exemplaire.
 *
 * ⚠️ Lue APRÈS l'écriture, donc la signature qu'on vient de poser en est déjà
 * exclue.
 */
async function partiesManquantes(
  documentGenereId: string,
  requises: readonly PartieSignataire[],
): Promise<string[]> {
  const posees = await prisma.documentSignature.findMany({
    where: { documentGenereId, revokedAt: null },
    select: { partie: true },
  });
  const vues = new Set(posees.map((p) => p.partie));
  return requises.filter((p) => !vues.has(p));
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
}): Promise<ResultatSignaturePiece> {
  const parse = entreeJetonSchema.safeParse(input);
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
    select: { type: true, numero: true },
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

  const objection = await objectionMetier(piece.type, verif.documentGenereId);
  if (objection !== null) {
    return { ok: false, raison: "piece_non_signable_maintenant", message: objection.message };
  }

  try {
    const res = await signerDocument({
      documentGenereId: verif.documentGenereId,
      porteur: { type: "signataire_jeton", tokenId: verif.tokenId, partie: verif.partie },
      methode: donnees.methode,
      partiesRequises: circuit.parties,
      ...(donnees.imageDataUrl === undefined ? {} : { imageDataUrl: donnees.imageDataUrl }),
      ...contexte,
    });
    if (!res.ok) return res;

    if (res.statutSignature === "signee") {
      await consequenceSignatureComplete(piece.type, verif.documentGenereId);
    }

    // 🔴 PRÉVENIR. Sans cette alerte, une partie signe et PERSONNE ne le sait.
    //
    // La pièce reste alors `partielle` indéfiniment : elle attend la
    // contresignature de l'organisme, qui ne viendra pas puisque rien ne l'a
    // signalée. Le signataire, lui, attend son exemplaire contresigné. C'est une
    // panne silencieuse, de la même famille que le F4 corrigé le 2026-07-26 —
    // « une panne de signature doit REMONTER ».
    //
    // ⚠️ Aucune donnée personnelle : Telegram est un canal tiers. Le numéro de
    // pièce suffit à agir. `.catch()` — une panne Telegram ne doit jamais
    // annuler une signature déjà écrite et chaînée.
    sendTelegram({
      tag: "AUTO",
      body:
        res.statutSignature === "signee"
          ? `✅ ${circuit.libelle} ${piece.numero} : intégralement signée.`
          : `✍️ ${circuit.libelle} ${piece.numero} : signature reçue (${verif.partie}). Reste à signer : ${(await partiesManquantes(verif.documentGenereId, circuit.parties)).join(", ")}.`,
    }).catch(() => {});

    return { ok: true, signatureId: res.signatureId, statutSignature: res.statutSignature };
  } catch (err) {
    if (err instanceof SignatureStockageError) return refusStockage(err);
    Sentry.captureException(err, { tags: { action: "signerPieceParJetonAction" } });
    throw err;
  }
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
  if (session.role !== "super_admin" && session.role !== "admin") {
    return {
      ok: false,
      raison: "role_insuffisant",
      message:
        "Signer une pièce contractuelle engage l'organisme : seuls un administrateur ou le dirigeant peuvent le faire.",
    };
  }

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
    select: { type: true, numero: true },
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

  const objection = await objectionMetier(piece.type, donnees.documentGenereId);
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

    if (res.statutSignature === "signee") {
      await consequenceSignatureComplete(piece.type, donnees.documentGenereId);
    }

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
