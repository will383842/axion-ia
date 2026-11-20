/**
 * Lien de signature créé À L'ENVOI — branché par `approuverEmailAction` (corbeille d'e-mails).
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
import {
  DELAI_CONNEXION_FILE_MS,
  DELAI_LECTURE_FILE_MS,
  DELAI_MISE_EN_FILE_OUTBOX_MS,
  MiseEnFileIncertaine,
} from "@/server/email/outbox-en-cours";
import { publicUrl } from "@/lib/public-url";
import { sendTelegram } from "@/lib/telegram";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { offreDevisV1 } from "@/server/qualiopi/devis/offre-devis";
import { refusReglesFormules } from "@/server/qualiopi/devis/regles-commerciales";
import { marquerDevisEnvoye } from "@/server/qualiopi/devis/marquer-devis-envoye";
import { pasSigneParLeClient } from "@/server/qualiopi/devis/pas-signe-par-le-client";
import {
  MSG_VERSION_REMPLACEE_ACCEPTEE,
  versionRemplaceeBloqueEmission,
  VersionRemplaceeSigneeEntreTempsError,
} from "@/server/qualiopi/devis/version-remplacee";
import { ligneDuLien, rendreLienPrecedent } from "./lien-precedent";
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
  /** OUT-1 : la tâche de cet envoi existait déjà, rien n'a été ajouté. */
  dejaEnFile?: boolean;
  /**
   * OUT-1 : avec `dejaEnFile`, le lien de signature que porte la tâche en file. Lu ici puis RETIRÉ
   * du verdict rendu : il vaut signature, il n'est jamais journalisé ni rendu à l'appelant.
   */
  urlEnFile?: string;
}

/** OUT-1 : réponse de la sonde « l'envoi est-il déjà fait ? » — le verdict et le lien de la tâche. */
export interface SondeDejaFait<R extends VerdictEnfilage = VerdictEnfilage> {
  verdict: R;
  urlEnFile: string | null;
}

/** Le verdict sans le lien de la tâche (qui ne doit jamais circuler plus loin). */
function sansLien<R extends VerdictEnfilage>(v: R): R {
  const { urlEnFile: _retire, ...reste } = v;
  void _retire;
  return reste as unknown as R;
}

/**
 * OUT-1 — le lien que porte la tâche en file est-il celui de CETTE pièce, partie client, encore
 * vivant ? Sans cela on ne sait pas que l'e-mail porte un lien qui fonctionne (une relance de la
 * pièce l'a peut-être révoqué entre deux tentatives). Une lecture qui échoue vaut « non ». Ni
 * l'URL ni le jeton ne sont journalisés.
 */
async function lienEnFileVivant(
  url: string | null | undefined,
  documentGenereId: string,
): Promise<boolean> {
  if (typeof url !== "string") return false;
  try {
    const ligne = await ligneDuLien(url);
    return (
      ligne !== null &&
      ligne.documentGenereId === documentGenereId &&
      ligne.partie === "client" &&
      ligne.revokedAt === null
    );
  } catch {
    return false;
  }
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

const MSG_ENVOI_DEJA_EN_FILE = "Un envoi de ce devis est déjà en file.";

/** Le verrou d'envoi de ce devis est déjà pris (autre clic, remise en main propre…). */
export class EnvoiOccupe extends Error {
  constructor() {
    super("envoi du devis déjà en cours");
    this.name = "EnvoiOccupe";
  }
}

/** Délai de la transaction qui enfile (Prisma la ferme au-delà : le verrou consultatif tombe). */
const TIMEOUT_TRANSACTION_ENVOI_MS = 60_000;

// OUT-1 : la mise en file doit tenir dans la transaction, sinon Prisma la ferme pendant que l'ajout
// est encore en vol. Somme RÉELLE du pire cas, étape par étape (lue par
// `lien-a-l-envoi-delai-file.spec.ts`) :
//   sonde externe (`sonder` : connexion + lecture)             10 s
//   sonde interne d'`enqueueEmail` (connexion + lecture)        10 s
//   retrait d'une tâche échouée                                   5 s
//   journal (lecture + écriture en base)                          5 s
//   ajout, jamais moins de                                       10 s
//   relecture de la charge après l'ajout                          5 s
//   marge                                                         5 s
const BUDGET_ENVOI_REEL_MS =
  DELAI_CONNEXION_FILE_MS +
  DELAI_LECTURE_FILE_MS +
  (DELAI_CONNEXION_FILE_MS + DELAI_LECTURE_FILE_MS) +
  DELAI_LECTURE_FILE_MS +
  5_000 +
  (DELAI_MISE_EN_FILE_OUTBOX_MS - DELAI_CONNEXION_FILE_MS - DELAI_LECTURE_FILE_MS) +
  DELAI_LECTURE_FILE_MS +
  5_000;
if (BUDGET_ENVOI_REEL_MS >= TIMEOUT_TRANSACTION_ENVOI_MS) {
  throw new Error("lien-a-l-envoi : le budget de mise en file dépasse la transaction");
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
  /** OUT-1 : sonde « l'envoi est-il déjà fait ? », appelée sous le verrou, AVANT tout jeton. */
  sonder?: () => Promise<SondeDejaFait<R> | null>;
}): Promise<ResultatEnvoi<R>> {
  const { ligne, payload, acteur, enfiler, sonder } = input;
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
    ? premierEnvoi({ ligne, payload, acteur, enfiler, marqueur, sonder })
    : renvoi({ ligne, payload, acteur, enfiler, marqueur, sonder });
}

// ── devis-premier-envoi ─────────────────────────────────────────────────────

async function premierEnvoi<R extends VerdictEnfilage>(a: {
  ligne: LigneALEnvoi;
  payload: Record<string, unknown>;
  acteur: { session: AdminSession };
  enfiler: Enfiler<R>;
  sonder: (() => Promise<SondeDejaFait<R> | null>) | undefined;
  marqueur: Extract<MarqueurLienALEnvoi, { nature: "devis-premier-envoi" }>;
}): Promise<ResultatEnvoi<R>> {
  const { ligne, payload, acteur, enfiler, marqueur, sonder } = a;
  // État visible depuis le `catch` : ce qui est déjà produit, donc ce qu'il faut défaire.
  const etat: {
    tokenId: string | null;
    url: string | null;
    verdict: R | null;
    numero: string;
    /** Aucun lien neuf n'a été émis : l'envoi était déjà fait ou en file (pas de journal « lien émis »). */
    dejaFait: boolean;
    /** L'envoi existe mais son lien n'est pas vérifié : pas de marquage, alerte au numéro. */
    alerteSansMarquage: boolean;
  } = {
    tokenId: null,
    url: null,
    verdict: null,
    numero: "",
    dejaFait: false,
    alerteSansMarquage: false,
  };

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
              client: {
                select: {
                  raisonSociale: true,
                  contactNom: true,
                  contactFonction: true,
                  type: true,
                },
              },
            },
          });
          if (!devis) return refus(MSG_INTROUVABLE);
          etat.numero = devis.numero;
          // OUT-1 — envoi déjà fait ou en file : AUCUN jeton forgé (il révoquerait le lien que
          // porte l'e-mail déjà en file). ⚠️ Le chemin « Relancer » de la pièce (`emettreLienSignature`)
          // ne regarde pas `emailDevisEnAttente` et ne prend pas ce verrou : un autre jeton a pu
          // être créé entre deux tentatives. Le devis n'est donc marqué envoyé que si le lien que
          // porte la tâche est VÉRIFIÉ (cette pièce, partie client, non révoqué) ET si le devis est
          // resté tel que le marqueur le décrit ; sinon aucune écriture, alerte au numéro, refus.
          const deja = sonder ? await sonder() : null;
          if (deja) {
            etat.dejaFait = true;
            // Déjà marqué envoyé (autre chemin) : ni écriture ni alerte.
            if (devis.statut === "envoye") return { type: "envoi", res: sansLien(deja.verdict) };
            if (!(await lienEnFileVivant(deja.urlEnFile, marqueur.documentGenereId))) {
              etat.alerteSansMarquage = true;
              return refus(MSG_ENVOI_DEJA_EN_FILE);
            }
            etat.verdict = sansLien(deja.verdict);
            if (
              devis.statut === "brouillon" &&
              devis.updatedAt.getTime() === new Date(marqueur.devisUpdatedAt).getTime()
            ) {
              await marquerDevisEnvoye(tx, {
                devisId: devis.id,
                clientId: devis.clientId,
                numero: devis.numero,
                updatedAt: devis.updatedAt,
                pdfCle: marqueur.pdfCle,
                documentGenereId: marqueur.documentGenereId,
                replacesDevisId: devis.replacesDevisId,
                replacesDevis: devis.replacesDevis,
              });
            } else {
              throw new Error("deja_fait_devis_non_conforme");
            }
            return { type: "envoi", res: etat.verdict };
          }
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
          if (
            devis.offre !== null &&
            devis.offre !== undefined &&
            !(await formulesActives(undefined, { clientId: devis.clientId, tx }))
          ) {
            return refus(MSG_FORMULES);
          }
          // Règles commerciales D4/D6 à l'APPROBATION : un devis mis en attente avant leur mise
          // en ligne, ou un client passé en particulier pendant l'attente, ne doit pas partir.
          // (Le chemin de RENVOI ne les applique pas : un devis déjà émis reste tel quel.)
          if (devis.offre !== null && devis.offre !== undefined) {
            const o = offreDevisV1.safeParse(devis.offre);
            if (o.success) {
              const m = refusReglesFormules(o.data, devis.client.type);
              if (m) return refus(m);
            }
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
            // OUT-1 : issue inconnue, l'e-mail est peut-être parti : telle quelle, sans « non parti ».
            if (err instanceof MiseEnFileIncertaine) throw err;
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
          // OUT-1 (filet) : la tâche existait malgré la sonde (ajout tardif d'une tentative
          // précédente). Le jeton neuf n'est dans aucun e-mail : on le défait et on rend l'ancien
          // lien, puis on VÉRIFIE que le lien de la tâche est vivant avant de marquer le devis.
          if (verdict.dejaEnFile === true) {
            const urlEnFile = verdict.urlEnFile;
            verdict = sansLien(verdict);
            await annulerLeJeton(etat.tokenId, etat.url);
            etat.tokenId = null;
            etat.dejaFait = true;
            if (!(await lienEnFileVivant(urlEnFile, piece.id))) {
              etat.alerteSansMarquage = true;
              return refus(MSG_ENVOI_DEJA_EN_FILE);
            }
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
        { maxWait: 5_000, timeout: TIMEOUT_TRANSACTION_ENVOI_MS },
      )
      .then(async (r) => {
        // Aucun lien neuf émis (envoi déjà fait) : pas de journal « lien émis ».
        if (r.type === "envoi" && etat.verdict !== null && !etat.dejaFait) {
          await journaliserEnvoi(acteur, marqueur);
        }
        // Envoi existant dont le lien n'est pas vérifié : le devis n'est pas marqué, on alerte.
        if (r.type === "refus" && etat.alerteSansMarquage) {
          await traiterEchecApresEnfilage({
            acteur,
            devisId: marqueur.devisId,
            numero: etat.numero,
            cause: new Error("deja_fait_lien_non_verifie"),
          });
        }
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
    // OUT-1 : issue inconnue. Le lien a pu partir : on ne révoque PAS le jeton, on ne le défait pas.
    if (err instanceof MiseEnFileIncertaine) throw err;
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
  sonder: (() => Promise<SondeDejaFait<R> | null>) | undefined;
  marqueur: Extract<MarqueurLienALEnvoi, { nature: "devis-renvoi" }>;
}): Promise<ResultatEnvoi<R>> {
  const { ligne, payload, enfiler, marqueur, acteur, sonder } = a;
  // État visible depuis le `catch` : ce qui est déjà produit, donc ce qu'il faut défaire.
  const etat: {
    tokenId: string | null;
    url: string | null;
    verdict: R | null;
    /** Aucun lien neuf émis (envoi déjà fait) : ni journal « lien émis » ni alerte de fin de transaction. */
    dejaFait: boolean;
  } = { tokenId: null, url: null, verdict: null, dejaFait: false };

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

        // OUT-1 — envoi déjà fait ou en file : aucun jeton, aucune écriture (le devis est déjà
        // `envoye`, rien à marquer), aucun journal de renvoi (aucun lien neuf n'existe).
        const deja = sonder ? await sonder() : null;
        if (deja) {
          etat.dejaFait = true;
          etat.verdict = sansLien(deja.verdict);
          return { type: "envoi", res: etat.verdict };
        }

        // (b) Relecture + gardes DANS le tx, APRÈS le verrou, AVANT tout jeton.
        const devis = await tx.devis.findUnique({
          where: { id: marqueur.devisId },
          select: {
            id: true,
            clientId: true,
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
        if (
          devis.offre !== null &&
          devis.offre !== undefined &&
          !(await formulesActives(undefined, { clientId: devis.clientId, tx }))
        ) {
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
          if (err instanceof MiseEnFileIncertaine) throw err;
          throw new EnvoiNonParti(err);
        }
        if (!estEnfile(verdict)) {
          await annulerLeJeton(etat.tokenId, etat.url);
          // Défait : pas de seconde annulation depuis le `catch` (échec de commit).
          etat.tokenId = null;
          return { type: "envoi", res: verdict };
        }
        // OUT-1 (filet) : la tâche existait malgré la sonde : le jeton neuf n'est dans aucun e-mail.
        if (verdict.dejaEnFile === true) {
          verdict = sansLien(verdict);
          await annulerLeJeton(etat.tokenId, etat.url);
          etat.tokenId = null;
          etat.dejaFait = true;
        }
        etat.verdict = verdict;
        return { type: "envoi", res: verdict };
      },
      { maxWait: 5_000, timeout: TIMEOUT_TRANSACTION_ENVOI_MS },
    );
    if (etat.verdict !== null && !etat.dejaFait) await journaliserRenvoi(acteur, marqueur);
    return res;
  } catch (err) {
    if (etat.verdict !== null && etat.dejaFait) {
      // Envoi déjà fait : rien n'a été écrit, aucun lien neuf. Ni alerte ni journal.
      return { type: "envoi", res: etat.verdict };
    }
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
    // OUT-1 : issue inconnue. Le lien a pu partir : on ne révoque PAS le jeton, on ne le défait pas.
    if (err instanceof MiseEnFileIncertaine) throw err;
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
