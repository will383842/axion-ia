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
const estEnfile = (v: VerdictEnfilage): boolean =>
  v.enqueued === true || v.garePourValidation === true;

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
  enfiler: (payload: Record<string, unknown>) => Promise<R>;
}): Promise<ResultatEnvoi<R>> {
  const { ligne, payload, acteur, enfiler } = input;
  const marqueur = lireMarqueur(payload);

  // Lignes anciennes et autres gabarits : INCHANGÉ.
  if (marqueur === null) return { type: "envoi", res: await enfiler(payload) };

  if (
    "invalide" in marqueur ||
    ligne.template !== GABARIT_DEVIS_ENVOI ||
    ligne.entityId !== marqueur.devisId
  ) {
    return refus(MSG_INCOHERENT);
  }

  return marqueur.nature === "devis-premier-envoi"
    ? premierEnvoi({ ligne, payload, acteur, enfiler, marqueur })
    : renvoi({ ligne, payload, enfiler, marqueur });
}

// ── devis-premier-envoi ─────────────────────────────────────────────────────

async function premierEnvoi<R extends VerdictEnfilage>(a: {
  ligne: LigneALEnvoi;
  payload: Record<string, unknown>;
  acteur: { session: AdminSession };
  enfiler: (payload: Record<string, unknown>) => Promise<R>;
  marqueur: Extract<MarqueurLienALEnvoi, { nature: "devis-premier-envoi" }>;
}): Promise<ResultatEnvoi<R>> {
  const { ligne, payload, acteur, enfiler, marqueur } = a;
  // État visible depuis le `catch` : ce qui est déjà produit, donc ce qu'il faut défaire.
  const etat: {
    tokenId: string | null;
    verdict: R | null;
    numero: string;
  } = { tokenId: null, verdict: null, numero: "" };

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
            select: { id: true, clientId: true, type: true },
          });
          if (piece === null || piece.clientId !== devis.clientId || piece.type !== "devis") {
            return refus(MSG_PIECE);
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
          } catch (err) {
            if (err instanceof TokenDocumentError) return refus(err.message);
            signaler("lienALEnvoi.jeton", err);
            return refus(MSG_JETON);
          }

          // (d) Enfilage : dernier effet externe, AVANT toute écriture.
          const verdict = await enfiler(payloadPourEnvoi(payload, `${base}${token}`));
          if (!estEnfile(verdict)) {
            await revoquerLeJeton(etat.tokenId);
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
      // L'e-mail est parti (ou attend sa validation) : on ne relance JAMAIS (l'approbation
      // remettrait la ligne en attente et l'e-mail repartirait). Le jeton reste valable.
      alerterApresEnfilage(etat.numero, err);
      return { type: "envoi", res: etat.verdict };
    }
    if (err instanceof EnvoiOccupe) throw err;
    // Exception AVANT ou PENDANT l'enfilage : rien n'est parti.
    if (etat.tokenId !== null) await revoquerLeJeton(etat.tokenId);
    throw err;
  }
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

/** Texte repris de `sendDevisAction` ; ni adresse, ni lien. Ne lève jamais. */
function alerterApresEnfilage(numero: string, cause: unknown): void {
  try {
    signaler("lienALEnvoi.apres_enfilage", cause);
    Sentry.captureMessage(
      `Devis ${numero} : courriel enfilé mais devis non marqué envoyé. Le lien de signature reçu par le client ne retrouvera pas le devis : renvoyer le devis depuis sa fiche.`,
      { level: "error", tags: { action: "lienALEnvoi.apres_enfilage_message" } },
    );
    sendTelegram({
      tag: "AUTO",
      body: `🔴 Devis ${numero} : le courriel est parti mais le devis n'a PAS été marqué envoyé. Le lien de signature reçu par le client ne retrouvera pas le devis : renvoyer le devis depuis sa fiche.`,
    }).catch(() => {});
  } catch {
    // Une alerte qui échoue ne remonte pas : l'e-mail est parti.
  }
}

// ── devis-renvoi ────────────────────────────────────────────────────────────

async function renvoi<R extends VerdictEnfilage>(a: {
  ligne: LigneALEnvoi;
  payload: Record<string, unknown>;
  enfiler: (payload: Record<string, unknown>) => Promise<R>;
  marqueur: Extract<MarqueurLienALEnvoi, { nature: "devis-renvoi" }>;
}): Promise<ResultatEnvoi<R>> {
  const { ligne, payload, enfiler, marqueur } = a;

  const devis = await prisma.devis.findUnique({
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
  if (devis.documentGenereId !== marqueur.documentGenereId) return refus(MSG_PIECE_DIFFERENTE);
  // Le client a déjà signé : plus de lien à émettre (filtre existant).
  if ((await prisma.devis.count({ where: { id: devis.id, ...pasSigneParLeClient } })) === 0) {
    return refus(MSG_SIGNE);
  }
  if (devis.offre !== null && devis.offre !== undefined && !(await formulesActives())) {
    return refus(MSG_FORMULES);
  }

  // URL de base AVANT le jeton : créer le jeton révoque l'ancien lien.
  const base = publicUrl("/fr/portail/signer/").toString();
  let url: string;
  try {
    const { token } = await creerTokenDocument({
      documentGenereId: marqueur.documentGenereId,
      partie: "client",
      signataireNom: devis.client.contactNom ?? devis.client.raisonSociale,
      signataireEmail: ligne.recipient,
      signataireQualite: devis.client.contactFonction,
      borneMetier: devis.dateValidite,
    });
    url = `${base}${token}`;
  } catch (err) {
    if (err instanceof TokenDocumentError) return refus(err.message);
    signaler("lienALEnvoi.jeton_renvoi", err);
    return refus(MSG_JETON);
  }

  let verdict: R;
  try {
    verdict = await enfiler(payloadPourEnvoi(payload, url));
  } catch (err) {
    await rendreAncienLien(url);
    throw err;
  }
  if (!estEnfile(verdict)) await rendreAncienLien(url);
  return { type: "envoi", res: verdict };
}

/** L'ancien lien redevient vivant ; JAMAIS le mode « supprimer ». Ne lève jamais. */
async function rendreAncienLien(url: string): Promise<void> {
  try {
    await rendreLienPrecedent(url, "revoquer");
  } catch (err) {
    signaler("lienALEnvoi.rendre_lien", err);
  }
}
