/**
 * Lien de signature créé À L'ENVOI — MODULE NON BRANCHÉ (lot B2, PR 1 : aucun appelant).
 *
 * But : le lien ne naît que lorsque l'e-mail part (approbation de la corbeille), et non plus
 * quand on clique « Envoyer au client ». La ligne garée porte alors un MARQUEUR, sans identité,
 * sans URL, sans jeton ; c'est ici que le jeton est créé, juste avant l'enfilage.
 *
 * Marqueur (contrat interne, v1), clé de payload `lienSignatureALEnvoi`, jamais rendue par un
 * gabarit, retirée avant l'enfilage : `v`, `nature`, `documentGenereId`, `partie`, `devisId`,
 * et (premier envoi seulement) `devisUpdatedAt` (ISO) et `pdfCle`.
 *
 * L'enveloppe est faite pour un envoi qui PART VRAIMENT : un verdict « garé pour validation » est
 * traité comme « non parti » (jeton révoqué, ancien lien rendu, devis non marqué envoyé).
 *
 * ⛔ Aucune URL, aucun jeton, aucune adresse dans les journaux, Sentry, Telegram ni messages
 * d'erreur. Aucune erreur brute d'un appel qui a vu le payload n'est journalisée. Aucune erreur
 * postérieure à l'enfilage ne remonte (l'e-mail est parti : on alerte, on ne relance pas).
 */

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/public-url";
import { sendTelegram } from "@/lib/telegram";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { marquerDevisEnvoye } from "@/server/qualiopi/devis/marquer-devis-envoye";
import { pasSigneParLeClient } from "@/server/qualiopi/devis/pas-signe-par-le-client";
import {
  MSG_VERSION_REMPLACEE_ACCEPTEE,
  versionRemplaceeBloqueEmission,
  VersionRemplaceeSigneeEntreTempsError,
} from "@/server/qualiopi/devis/version-remplacee";
import { rendreLienPrecedent } from "./lien-precedent";
import { creerTokenDocument, revoquerJetonPrecis, TokenDocumentError } from "./token-document";

export const CLE_MARQUEUR = "lienSignatureALEnvoi" as const;
/** Gabarit du courriel d'envoi ET de renvoi d'un devis (même nom que `sendDevisAction`). */
const GABARIT_DEVIS_ENVOI = "devis-envoi";

const MSG_INCOHERENT = "E-mail incohérent : refusez-le et renvoyez depuis le devis.";
const MSG_MODIFIE = "Le devis a été modifié depuis : refusez cet e-mail et renvoyez le devis.";
const MSG_INTROUVABLE = "Devis introuvable : refusez cet e-mail et renvoyez depuis le devis.";
const MSG_PAS_BROUILLON =
  "Le devis n'est plus en brouillon : refusez cet e-mail et vérifiez son état depuis le devis.";
const MSG_PAS_ENVOYE =
  "Le devis n'est plus au statut « envoyé » : refusez cet e-mail et vérifiez son état depuis le devis.";
const MSG_FORMULES =
  "Les devis à formules sont désactivés dans la configuration : refusez cet e-mail.";
const MSG_PIECE =
  "La pièce du devis est absente ou ne correspond plus : refusez cet e-mail et renvoyez depuis le devis.";
const MSG_PIECE_DIFFERENTE =
  "La pièce du devis a changé : refusez cet e-mail et renvoyez depuis le devis.";
const MSG_SIGNE = "Le client a déjà signé ce devis : refusez cet e-mail.";
/** Clé R2 d'un PDF de devis : `documents/<année à 4 chiffres>/devis/<numéro de la pièce>.pdf`
 *  (même construction que `generateDocument` et `sendDevisAction`). */
const FORME_CLE_PDF = /^documents\/\d{4}\/devis\/([^/]+)\.pdf$/;
const cleDevisValide = (cle: string, numeroPiece: unknown): boolean => {
  const m = FORME_CLE_PDF.exec(cle);
  return (
    m !== null && typeof numeroPiece === "string" && numeroPiece !== "" && m[1] === numeroPiece
  );
};

const MSG_JETON = "Le lien de signature n'a pas pu être créé : refusez cet e-mail et réessayez.";

// ─────────────────────────────────────────────────────────────────────────────
// Marqueur
// ─────────────────────────────────────────────────────────────────────────────

const commun = {
  v: z.literal(1),
  documentGenereId: z.string().min(1),
  partie: z.literal("client"),
  devisId: z.string().min(1),
};
const marqueurSchema = z.discriminatedUnion("nature", [
  z
    .object({
      ...commun,
      nature: z.literal("devis-premier-envoi"),
      devisUpdatedAt: z.string().datetime(),
      pdfCle: z.string().min(1),
    })
    .strict(),
  z.object({ ...commun, nature: z.literal("devis-renvoi") }).strict(),
]);

export type MarqueurLienALEnvoi = z.infer<typeof marqueurSchema>;

/** Absent : `null`. Présent mais mal formé : `{ invalide: true }` (donne un refus). */
export function lireMarqueur(payload: unknown): MarqueurLienALEnvoi | { invalide: true } | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const brut = (payload as Record<string, unknown>)[CLE_MARQUEUR];
  if (brut === undefined) return null;
  const r = marqueurSchema.safeParse(brut);
  return r.success ? r.data : { invalide: true };
}

/** Payload final : sans marqueur, avec le lien posé sous `signatureUrl` (ou `lien`). */
export function payloadPourEnvoi(
  payload: Record<string, unknown>,
  url: string,
  cle: "signatureUrl" | "lien" = "signatureUrl",
): Record<string, unknown> {
  const { [CLE_MARQUEUR]: _retire, ...reste } = payload;
  void _retire;
  return { ...reste, [cle]: url };
}

// ─────────────────────────────────────────────────────────────────────────────
// Envoi
// ─────────────────────────────────────────────────────────────────────────────

/** Verdict de `enqueueEmail`, rendu tel quel. */
export interface VerdictEnfilage {
  enqueued: boolean;
  garePourValidation?: boolean;
  outboxId?: string;
  retenu?: string;
  corbeilleIndisponible?: boolean;
  essaiBloque?: boolean;
}

export type ResultatEnvoi<R = VerdictEnfilage> =
  { type: "envoi"; res: R } | { type: "refus"; motif: string };

export interface LigneALEnvoi {
  id: string;
  template: string;
  recipient: string;
  entityType: string;
  entityId: string;
}

/** Le verrou d'envoi de ce devis est déjà pris (autre clic, remise en main propre…). */
export class EnvoiOccupe extends Error {
  constructor() {
    super("envoi du devis déjà en cours");
    this.name = "EnvoiOccupe";
  }
}

const refus = (motif: string): ResultatEnvoi<never> => ({ type: "refus", motif });
/** « Garé pour validation » n'est PAS parti : l'enveloppe ne sert qu'un envoi réel. */
const estEnfile = (v: VerdictEnfilage): boolean => v.enqueued === true;

/**
 * Remplace l'erreur brute de `enfiler` (qui peut porter le jeton ou l'adresse) : message fixe,
 * et `cause` ne porte QUE le nom de la classe d'origine, jamais son message.
 */
export class EnvoiNonParti extends Error {
  constructor(origine: unknown) {
    super("envoi non parti");
    this.name = "EnvoiNonParti";
    this.cause = origine instanceof Error ? origine.name : "inconnue";
  }
}

type Enfiler<R> = (payload: Record<string, unknown>, recipient: string) => Promise<R>;

/** Jamais l'erreur brute : seule sa classe, sous un message fixe. */
function signaler(action: string, cause: unknown): void {
  Sentry.captureException(new Error(`lien-a-l-envoi : ${action}`), {
    tags: { action, cause: cause instanceof Error ? cause.name : "inconnue" },
  });
}

export async function envoyerAvecLienALEnvoi<R extends VerdictEnfilage = VerdictEnfilage>(input: {
  ligne: LigneALEnvoi;
  payload: Record<string, unknown>;
  acteur: { session: AdminSession };
  enfiler: Enfiler<R>;
}): Promise<ResultatEnvoi<R>> {
  const { ligne, payload, acteur, enfiler } = input;
  const marqueur = lireMarqueur(payload);

  // Lignes anciennes et autres gabarits : INCHANGÉ.
  if (marqueur === null) return { type: "envoi", res: await enfiler(payload, ligne.recipient) };

  if (
    "invalide" in marqueur ||
    ligne.template !== GABARIT_DEVIS_ENVOI ||
    ligne.entityType !== "Devis" ||
    ligne.entityId !== marqueur.devisId
  ) {
    return refus(MSG_INCOHERENT);
  }

  return marqueur.nature === "devis-premier-envoi"
    ? premierEnvoi({ ligne, payload, acteur, enfiler, marqueur })
    : renvoi({ ligne, payload, acteur, enfiler, marqueur });
}

// ── devis-premier-envoi ─────────────────────────────────────────────────────

async function premierEnvoi<R extends VerdictEnfilage>(a: {
  ligne: LigneALEnvoi;
  payload: Record<string, unknown>;
  acteur: { session: AdminSession };
  enfiler: Enfiler<R>;
  marqueur: Extract<MarqueurLienALEnvoi, { nature: "devis-premier-envoi" }>;
}): Promise<ResultatEnvoi<R>> {
  const { ligne, payload, acteur, enfiler, marqueur } = a;
  // État visible depuis le `catch` : ce qui est déjà produit, donc ce qu'il faut défaire.
  const etat: {
    tokenId: string | null;
    url: string | null;
    verdict: R | null;
    numero: string;
  } = { tokenId: null, url: null, verdict: null, numero: "" };

  try {
    return await prisma
      .$transaction(
        async (tx): Promise<ResultatEnvoi<R>> => {
          // (a) Verrou non bloquant, MÊME clé que `sendDevisAction` et la remise en main propre.
          const [verrou] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext(${"devis.envoi:" + marqueur.devisId})) AS locked
        `;
          if (!verrou?.locked) throw new EnvoiOccupe();

          // (b) Relecture + gardes, AVANT tout jeton.
          const devis = await tx.devis.findUnique({
            where: { id: marqueur.devisId },
            select: {
              id: true,
              numero: true,
              clientId: true,
              statut: true,
              updatedAt: true,
              offre: true,
              replacesDevisId: true,
              replacesDevis: { select: { statut: true, documentGenereId: true } },
              dateValidite: true,
              client: { select: { raisonSociale: true, contactNom: true, contactFonction: true } },
            },
          });
          if (!devis) return refus(MSG_INTROUVABLE);
          etat.numero = devis.numero;
          if (devis.statut !== "brouillon") return refus(MSG_PAS_BROUILLON);
          if (devis.updatedAt.getTime() !== new Date(marqueur.devisUpdatedAt).getTime()) {
            return refus(MSG_MODIFIE);
          }
          if (
            await versionRemplaceeBloqueEmission(tx, {
              replacesDevisId: devis.replacesDevisId,
              statutRemplace: devis.replacesDevis?.statut,
            })
          ) {
            return refus(MSG_VERSION_REMPLACEE_ACCEPTEE);
          }
          if (devis.offre !== null && devis.offre !== undefined && !(await formulesActives())) {
            return refus(MSG_FORMULES);
          }
          const piece = await tx.documentGenere.findUnique({
            where: { id: marqueur.documentGenereId },
            select: { id: true, clientId: true, type: true, numero: true },
          });
          if (piece === null || piece.clientId !== devis.clientId || piece.type !== "devis") {
            return refus(MSG_PIECE);
          }
          // Défense en profondeur contre un marqueur forgé : la pièce n'est désignée par aucun
          // AUTRE devis, et la clé PDF est celle de CETTE pièce.
          const autreDevis = await tx.devis.findFirst({
            where: { documentGenereId: piece.id, NOT: { id: devis.id } },
            select: { id: true },
          });
          if (autreDevis !== null || !cleDevisValide(marqueur.pdfCle, piece.numero)) {
            return refus(MSG_INCOHERENT);
          }

          // (c) URL de base AVANT le jeton (si elle lève, aucun jeton n'existe).
          const base = publicUrl("/fr/portail/signer/").toString();
          let token: string;
          try {
            const cree = await creerTokenDocument({
              documentGenereId: piece.id,
              partie: "client",
              signataireNom: devis.client.contactNom ?? devis.client.raisonSociale,
              // L'adresse où part réellement l'e-mail.
              signataireEmail: ligne.recipient,
              signataireQualite: devis.client.contactFonction,
              borneMetier: devis.dateValidite,
            });
            token = cree.token;
            etat.tokenId = cree.tokenId;
            etat.url = `${base}${token}`;
          } catch (err) {
            if (err instanceof TokenDocumentError) return refus(err.message);
            signaler("lienALEnvoi.jeton", err);
            return refus(MSG_JETON);
          }

          // (d) Enfilage : dernier effet externe, AVANT toute écriture.
          let verdict: R;
          try {
            verdict = await enfiler(payloadPourEnvoi(payload, `${base}${token}`), ligne.recipient);
          } catch (err) {
            throw new EnvoiNonParti(err);
          }
          if (!estEnfile(verdict)) {
            // Le jeton neuf a pu révoquer un lien vivant plus ancien : on le rend.
            await annulerLeJeton(etat.tokenId, etat.url);
            // Défait : le `catch` (échec de commit) ne doit pas le défaire une seconde fois
            // (fausse alerte `ancien_lien_non_rendu`, ligne remise à valider à tort).
            etat.tokenId = null;
            return { type: "envoi", res: verdict };
          }
          etat.verdict = verdict;

          // (e) Écritures dans le MÊME tx.
          await marquerDevisEnvoye(tx, {
            devisId: devis.id,
            clientId: devis.clientId,
            numero: devis.numero,
            updatedAt: devis.updatedAt,
            pdfCle: marqueur.pdfCle,
            documentGenereId: piece.id,
            replacesDevisId: devis.replacesDevisId,
            replacesDevis: devis.replacesDevis,
          });
          return { type: "envoi", res: verdict };
        },
        { maxWait: 5_000, timeout: 60_000 },
      )
      .then(async (r) => {
        if (r.type === "envoi" && etat.verdict !== null) await journaliserEnvoi(acteur, marqueur);
        return r;
      });
  } catch (err) {
    if (etat.verdict !== null) {
      // L'e-mail est parti : on ne relance JAMAIS (l'approbation
      // remettrait la ligne en attente et l'e-mail repartirait). Le jeton reste valable.
      await traiterEchecApresEnfilage({
        acteur,
        devisId: marqueur.devisId,
        numero: etat.numero,
        cause: err,
      });
      return { type: "envoi", res: etat.verdict };
    }
    if (err instanceof EnvoiOccupe) throw err;
    // Exception AVANT ou PENDANT l'enfilage : rien n'est parti.
    await annulerLeJeton(etat.tokenId, etat.url);
    // Jamais l'erreur brute : elle peut avoir vu le payload (jeton, adresse).
    throw err instanceof EnvoiNonParti ? err : new EnvoiNonParti(err);
  }
}

/** Rien n'est parti : rend l'ancien lien (mode « revoquer ») ou, à défaut, révoque le jeton neuf. */
async function annulerLeJeton(tokenId: string | null, url: string | null): Promise<void> {
  if (tokenId === null) return;
  if (url === null) return revoquerLeJeton(tokenId);
  await rendreAncienLien(url, tokenId);
}

async function revoquerLeJeton(tokenId: string | null): Promise<void> {
  if (tokenId === null) return;
  try {
    await revoquerJetonPrecis({ tokenId, motif: "Envoi annulé : rien n'est parti" });
  } catch (err) {
    signaler("lienALEnvoi.revocation", err);
  }
}

async function journaliserEnvoi(
  acteur: { session: AdminSession },
  marqueur: Extract<MarqueurLienALEnvoi, { nature: "devis-premier-envoi" }>,
): Promise<void> {
  try {
    await logQualiopiActivity({
      action: "qualiopi.devis.send",
      targetType: "Devis",
      targetId: marqueur.devisId,
      // ⚠️ Ni l'URL, ni le jeton, ni l'adresse : le lien vaut signature.
      changes: {
        statut: "envoye",
        lienSignatureEmis: true,
        documentGenereId: marqueur.documentGenereId,
      },
      session: acteur.session,
    });
  } catch (err) {
    signaler("lienALEnvoi.journal", err);
  }
}

/** Trace du nouveau lien émis au renvoi. Ni URL, ni jeton, ni adresse ; ne lève jamais. */
async function journaliserRenvoi(
  acteur: { session: AdminSession },
  marqueur: Extract<MarqueurLienALEnvoi, { nature: "devis-renvoi" }>,
): Promise<void> {
  try {
    await logQualiopiActivity({
      action: "qualiopi.devis.renvoi",
      targetType: "Devis",
      targetId: marqueur.devisId,
      changes: { lienSignatureEmis: true, documentGenereId: marqueur.documentGenereId },
      session: acteur.session,
    });
  } catch (err) {
    signaler("lienALEnvoi.journal_renvoi", err);
  }
}

/**
 * Les écritures ont échoué APRÈS l'enfilage : alerte (texte repris de `sendDevisAction`, ni
 * adresse ni lien) et trace de journal `qualiopi.devis.send_refuse` / `apres_courriel`. Ne lève
 * jamais : l'e-mail est parti.
 */
async function traiterEchecApresEnfilage(a: {
  acteur: { session: AdminSession };
  devisId: string;
  numero: string;
  cause: unknown;
}): Promise<void> {
  const causeAlerte =
    a.cause instanceof VersionRemplaceeSigneeEntreTempsError
      ? " Cause : version précédente signée entre-temps."
      : "";
  try {
    signaler("lienALEnvoi.apres_enfilage", a.cause);
    Sentry.captureMessage(
      `Devis ${a.numero} : courriel enfilé mais devis non marqué envoyé. Le lien de signature reçu par le client ne retrouvera pas le devis : renvoyer le devis depuis sa fiche.${causeAlerte}`,
      { level: "error", tags: { action: "lienALEnvoi.apres_enfilage_message" } },
    );
    sendTelegram({
      tag: "AUTO",
      body: `🔴 Devis ${a.numero} : le courriel est parti mais le devis n'a PAS été marqué envoyé. Le lien de signature reçu par le client ne retrouvera pas le devis : renvoyer le devis depuis sa fiche.${causeAlerte}`,
    }).catch(() => {});
  } catch {
    // Une alerte qui échoue ne remonte pas : l'e-mail est parti.
  }
  try {
    await logQualiopiActivity({
      action: "qualiopi.devis.send_refuse",
      targetType: "Devis",
      targetId: a.devisId,
      // Le MOTIF seulement : ni adresse, ni lien, ni jeton.
      changes: { motif: "apres_courriel" },
      session: a.acteur.session,
    });
  } catch (err) {
    signaler("lienALEnvoi.journal_refus", err);
  }
}

// ── devis-renvoi ────────────────────────────────────────────────────────────

async function renvoi<R extends VerdictEnfilage>(a: {
  ligne: LigneALEnvoi;
  payload: Record<string, unknown>;
  acteur: { session: AdminSession };
  enfiler: Enfiler<R>;
  marqueur: Extract<MarqueurLienALEnvoi, { nature: "devis-renvoi" }>;
}): Promise<ResultatEnvoi<R>> {
  const { ligne, payload, enfiler, marqueur, acteur } = a;
  // État visible depuis le `catch` : ce qui est déjà produit, donc ce qu'il faut défaire.
  const etat: { tokenId: string | null; url: string | null; verdict: R | null } = {
    tokenId: null,
    url: null,
    verdict: null,
  };

  try {
    const res = await prisma.$transaction(
      async (tx): Promise<ResultatEnvoi<R>> => {
        // (a) Verrou non bloquant, MÊME clé que `premierEnvoi`, `sendDevisAction` et la remise en
        // main propre : sans lui, deux lignes de renvoi approuvées ensemble créeraient deux
        // jetons (le second révoque le premier) et enverraient deux e-mails.
        const [verrou] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext(${"devis.envoi:" + marqueur.devisId})) AS locked
        `;
        if (!verrou?.locked) throw new EnvoiOccupe();

        // (b) Relecture + gardes DANS le tx, APRÈS le verrou, AVANT tout jeton.
        const devis = await tx.devis.findUnique({
          where: { id: marqueur.devisId },
          select: {
            id: true,
            statut: true,
            offre: true,
            documentGenereId: true,
            dateValidite: true,
            client: { select: { raisonSociale: true, contactNom: true, contactFonction: true } },
          },
        });
        if (!devis) return refus(MSG_INTROUVABLE);
        if (devis.statut !== "envoye") return refus(MSG_PAS_ENVOYE);
        if (devis.documentGenereId !== marqueur.documentGenereId) {
          return refus(MSG_PIECE_DIFFERENTE);
        }
        // Le client a déjà signé : plus de lien à émettre (filtre existant).
        if ((await tx.devis.count({ where: { id: devis.id, ...pasSigneParLeClient } })) === 0) {
          return refus(MSG_SIGNE);
        }
        if (devis.offre !== null && devis.offre !== undefined && !(await formulesActives())) {
          return refus(MSG_FORMULES);
        }

        // (c) URL de base AVANT le jeton : créer le jeton révoque l'ancien lien.
        const base = publicUrl("/fr/portail/signer/").toString();
        try {
          const cree = await creerTokenDocument({
            documentGenereId: marqueur.documentGenereId,
            partie: "client",
            signataireNom: devis.client.contactNom ?? devis.client.raisonSociale,
            // L'adresse où part réellement l'e-mail.
            signataireEmail: ligne.recipient,
            signataireQualite: devis.client.contactFonction,
            borneMetier: devis.dateValidite,
          });
          etat.url = `${base}${cree.token}`;
          etat.tokenId = cree.tokenId;
        } catch (err) {
          if (err instanceof TokenDocumentError) return refus(err.message);
          signaler("lienALEnvoi.jeton_renvoi", err);
          return refus(MSG_JETON);
        }

        // (d) Enfilage : dernier effet externe.
        let verdict: R;
        try {
          verdict = await enfiler(payloadPourEnvoi(payload, etat.url), ligne.recipient);
        } catch (err) {
          throw new EnvoiNonParti(err);
        }
        if (!estEnfile(verdict)) {
          await annulerLeJeton(etat.tokenId, etat.url);
          // Défait : pas de seconde annulation depuis le `catch` (échec de commit).
          etat.tokenId = null;
          return { type: "envoi", res: verdict };
        }
        etat.verdict = verdict;
        return { type: "envoi", res: verdict };
      },
      { maxWait: 5_000, timeout: 60_000 },
    );
    if (etat.verdict !== null) await journaliserRenvoi(acteur, marqueur);
    return res;
  } catch (err) {
    if (etat.verdict !== null) {
      // L'e-mail est parti (échec de fin de transaction) : on alerte, on ne relance JAMAIS, et
      // le nouveau jeton reste valable (il est dans l'e-mail).
      try {
        signaler("lienALEnvoi.renvoi_apres_enfilage", err);
        Sentry.captureMessage(
          "Renvoi de devis : courriel enfilé mais la transaction de fin a échoué. Vérifier le lien de signature du devis depuis sa fiche.",
          { level: "error", tags: { action: "lienALEnvoi.renvoi_apres_enfilage_message" } },
        );
      } catch {
        // Une alerte qui échoue ne remonte pas : l'e-mail est parti.
      }
      await journaliserRenvoi(acteur, marqueur);
      return { type: "envoi", res: etat.verdict };
    }
    if (err instanceof EnvoiOccupe) throw err;
    // Rien n'est parti : le jeton neuf (s'il existe) est défait, l'ancien lien rendu.
    await annulerLeJeton(etat.tokenId, etat.url);
    throw err instanceof EnvoiNonParti ? err : new EnvoiNonParti(err);
  }
}

/**
 * L'ancien lien redevient vivant ; JAMAIS le mode « supprimer ». Si rien n'a pu être rendu
 * (`false`, ou exception), le jeton NEUF ne doit pas rester vivant alors que rien n'est parti :
 * il est révoqué par son identifiant. Ne lève jamais.
 */
async function rendreAncienLien(url: string, tokenId: string): Promise<void> {
  try {
    const rendu = await rendreLienPrecedent(url, "revoquer");
    if (rendu === false) {
      // Le client peut n'avoir plus aucun lien valable : l'équipe doit le savoir.
      signaler("lienALEnvoi.ancien_lien_non_rendu", undefined);
      await revoquerLeJeton(tokenId);
    }
  } catch (err) {
    signaler("lienALEnvoi.rendre_lien", err);
    await revoquerLeJeton(tokenId);
  }
}
