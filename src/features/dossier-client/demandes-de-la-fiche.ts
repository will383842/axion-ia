import "server-only";

/**
 * « DEMANDES REÇUES » d'une fiche client : l'historique des demandes écrites faites par le
 * formulaire de contact (le message reçu, l'accusé de réception automatique, les réponses de
 * l'équipe). LECTURE SEULE : aucune écriture, aucun envoi.
 *
 * ## Quelles demandes
 *
 * 1. celles que `fiche-demande.ts` a reliées à la fiche (`Submission.ficheClientId`), fiches
 *    absorbées par une fusion comprises (`fichesCouvertes`) ;
 * 2. puis celles dont l'empreinte exacte d'adresse (`contactEmailHash`) est celle de la fiche et qui
 *    ne sont reliées à AUCUNE autre fiche.
 *
 * Seuls les types de demande qui créent une fiche (`TYPES_DEMANDE_AVEC_FICHE`, le prédicat de
 * `fiche-demande.ts`) sont lus : un autre type (recrutement, presse, partenariat…) est écarté
 * dans la requête même, son message n'est jamais chargé. Plafond : 20 demandes.
 *
 * ## Droit
 *
 * Régime A2 : sans le droit sur les échanges (`peutVoirLesEchanges`), AUCUNE requête n'est
 * émise. Le texte d'un message, d'un accusé ou d'une réponse n'est jamais journalisé ; l'adresse
 * du destinataire n'est jamais rendue (elle ne sert qu'à retrouver l'accusé). Jamais de `bodyHtml`.
 *
 * ## Pannes
 *
 * Trois sources (messages, accusés, réponses) : l'une en panne le dit (`pannes`) et ne masque
 * pas les autres.
 */

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  lireAccusesMessages,
  type AccuseMessage,
} from "@/features/admin-submissions/accuse-reception";
import { UNIFIED_TYPE_LABELS } from "@/features/admin-submissions/type-labels";
import { datePremiereCopie, raisonSansCopie } from "@/features/admin-emails/detail";
import { fichesCouvertes } from "@/features/questionnaire-preaudit/de-la-fiche";
import type { EmailLogStatus } from "../../../prisma/generated/client";
import { estDemandeAvecFiche, TYPES_DEMANDE_AVEC_FICHE } from "./fiche-demande";
import { peutVoirLesEchanges } from "./roles-echanges";
import type { EchangeDuFil } from "./fil-des-echanges";

/** Combien de demandes au plus. */
export const PLAFOND_DEMANDES = 20;
const TEXTE_MAX = 4000;

export interface AccuseDeLaDemande {
  readonly etat: AccuseMessage["etat"];
  readonly date: Date | null;
  readonly emailLogId: string | null;
  readonly sujet: string | null;
  /** Le texte de l'accusé tel qu'il est parti, ou `null` (copie absente : voir `raisonSansCopie`). */
  readonly texte: string | null;
  readonly raisonSansCopie: string | null;
  readonly motif: string | null;
  readonly absenceVoulue: string | null;
}

export interface ReponseDeLaDemande {
  readonly id: string;
  readonly date: Date;
  readonly auteur: string;
  readonly sujet: string;
  readonly texte: string | null;
  readonly etat: string;
}

export interface DemandeDeLaFiche {
  readonly id: string;
  readonly date: Date;
  readonly typeLibelle: string;
  readonly message: string | null;
  readonly accuse: AccuseDeLaDemande | null;
  readonly reponses: ReadonlyArray<ReponseDeLaDemande>;
}

export interface DemandesLues {
  readonly demandes: ReadonlyArray<DemandeDeLaFiche>;
  readonly plafondAtteint: boolean;
  readonly pannes: { messages: boolean; accuses: boolean; reponses: boolean };
}

const VIDE: DemandesLues = {
  demandes: [],
  plafondAtteint: false,
  pannes: { messages: false, accuses: false, reponses: false },
};

const STATUT_ENVOI: Readonly<Record<AccuseMessage["etat"], EmailLogStatus>> = {
  envoye: "sent",
  rebond: "bounced",
  echec: "failed",
  annule: "cancelled",
  en_attente: "pending",
  absent: "pending",
};

const LIBELLE_ETAT_REPONSE: Readonly<Record<string, string>> = {
  pending: "en file",
  sent: "envoyée",
  delivered: "remise",
  bounced: "rebond",
  complained: "signalée comme indésirable",
  failed: "échec d'envoi",
};

function champ(details: unknown, cle: string): unknown {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  return (details as Record<string, unknown>)[cle];
}

function tronque(texte: string | null | undefined): string | null {
  const t = (texte ?? "").trim();
  if (t === "") return null;
  return t.length > TEXTE_MAX ? `${t.slice(0, TEXTE_MAX - 1)}…` : t;
}

/** Sans journaliser le détail : il pourrait porter du texte de personne. */
function enPanne(source: string, e: unknown): void {
  console.warn(
    `[demandes-de-la-fiche] source illisible : ${source}`,
    e instanceof Error ? e.name : "",
  );
}

function adresseLisible(valeur: string): string {
  try {
    const clair = decryptPii(valeur);
    return isDecryptedEmailUsable(clair) ? clair : "";
  } catch {
    return "";
  }
}

interface LigneMessage {
  readonly id: string;
  readonly type: string;
  readonly source: string | null;
  readonly submittedAt: Date;
  readonly deletedAt: Date | null;
  readonly contactEmail: string;
  readonly details: unknown;
}

async function lireMessages(clientId: string): Promise<LigneMessage[]> {
  const couvertes = await fichesCouvertes(clientId);
  const fiche = await prisma.client.findUnique({
    where: { id: clientId },
    select: { contactEmail: true },
  });
  const empreinte = hashEmailForLookup(fiche?.contactEmail);
  const lignes = (await prisma.submission.findMany({
    where: {
      deletedAt: null,
      archivedAt: null,
      // Le type est filtré ICI : un message d'un autre type n'est jamais chargé.
      OR: TYPES_DEMANDE_AVEC_FICHE.map((t) => ({ details: { path: ["unifiedType"], equals: t } })),
      AND: [
        {
          OR: [
            { ficheClientId: { in: couvertes } },
            ...(empreinte !== null ? [{ contactEmailHash: empreinte, ficheClientId: null }] : []),
          ],
        },
      ],
    },
    orderBy: { submittedAt: "desc" },
    take: PLAFOND_DEMANDES + 1,
    select: {
      id: true,
      type: true,
      source: true,
      submittedAt: true,
      deletedAt: true,
      contactEmail: true,
      details: true,
    },
  })) as LigneMessage[];
  // Le prédicat de `fiche-demande.ts` juge ensuite (apporteur, captcha non passé, corbeille).
  return lignes
    .filter((l) => estDemandeAvecFiche(l))
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
}

async function lireAccuses(
  messages: ReadonlyArray<LigneMessage>,
): Promise<Map<string, AccuseDeLaDemande>> {
  const accuses = await lireAccusesMessages(
    messages.map((m) => ({
      id: m.id,
      contactEmail: adresseLisible(m.contactEmail),
      submittedAt: m.submittedAt,
      origine:
        typeof champ(m.details, "origine") === "string"
          ? (champ(m.details, "origine") as string)
          : null,
    })),
  );
  const ids = [...accuses.values()].map((a) => a.emailLogId).filter((x): x is string => !!x);
  const copies =
    ids.length === 0
      ? []
      : await prisma.emailLogContent.findMany({
          where: { emailLogId: { in: ids } },
          select: { emailLogId: true, subject: true, text: true },
        });
  const parLog = new Map(copies.map((c) => [c.emailLogId, c]));
  const sansCopie = [...accuses.values()].some((a) => a.emailLogId && !parLog.has(a.emailLogId));
  const premiere = sansCopie ? await datePremiereCopie() : null;

  const resultat = new Map<string, AccuseDeLaDemande>();
  for (const [id, a] of accuses) {
    const copie = a.emailLogId ? parLog.get(a.emailLogId) : undefined;
    resultat.set(id, {
      etat: a.etat,
      date: a.date,
      emailLogId: a.emailLogId ?? null,
      sujet: copie?.subject ?? null,
      texte: tronque(copie?.text),
      raisonSansCopie:
        a.emailLogId && !copie
          ? raisonSansCopie(
              {
                status: STATUT_ENVOI[a.etat],
                sentAt: a.etat === "envoye" ? a.date : null,
                createdAt: a.date ?? new Date(0),
              },
              premiere,
            ).phrase
          : null,
      motif: a.motif,
      absenceVoulue: a.absenceVoulue,
    });
  }
  return resultat;
}

async function lireReponses(
  ids: ReadonlyArray<string>,
): Promise<Map<string, ReponseDeLaDemande[]>> {
  const lignes = await prisma.submissionReply.findMany({
    where: { submissionId: { in: [...ids] } },
    orderBy: { repliedAt: "asc" },
    take: 200,
    // Jamais `bodyHtml`.
    select: {
      id: true,
      submissionId: true,
      repliedByName: true,
      repliedAt: true,
      subject: true,
      bodyText: true,
      deliveryStatus: true,
    },
  });
  const parDemande = new Map<string, ReponseDeLaDemande[]>();
  for (const r of lignes) {
    const liste = parDemande.get(r.submissionId) ?? [];
    liste.push({
      id: r.id,
      date: r.repliedAt,
      auteur: r.repliedByName,
      sujet: r.subject,
      texte: tronque(r.bodyText),
      etat: LIBELLE_ETAT_REPONSE[r.deliveryStatus] ?? r.deliveryStatus,
    });
    parDemande.set(r.submissionId, liste);
  }
  return parDemande;
}

function libelleType(details: unknown, dbType: string): string {
  const u = champ(details, "unifiedType");
  return (typeof u === "string" ? UNIFIED_TYPE_LABELS[u] : undefined) ?? dbType;
}

async function lireBrut(clientId: string, role: string | null | undefined): Promise<DemandesLues> {
  // Régime A2 : le rôle est jugé AVANT toute requête.
  if (!peutVoirLesEchanges(role)) return VIDE;
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return VIDE;

  const pannes = { messages: false, accuses: false, reponses: false };
  let lignes: LigneMessage[] = [];
  try {
    lignes = await lireMessages(clientId);
  } catch (e) {
    pannes.messages = true;
    enPanne("messages", e);
    return { demandes: [], plafondAtteint: false, pannes };
  }
  const plafondAtteint = lignes.length > PLAFOND_DEMANDES;
  const messages = lignes.slice(0, PLAFOND_DEMANDES);
  if (messages.length === 0) return { demandes: [], plafondAtteint, pannes };

  const [accuses, reponses] = await Promise.all([
    lireAccuses(messages).catch((e: unknown) => {
      pannes.accuses = true;
      enPanne("accusés", e);
      return new Map<string, AccuseDeLaDemande>();
    }),
    lireReponses(messages.map((m) => m.id)).catch((e: unknown) => {
      pannes.reponses = true;
      enPanne("réponses", e);
      return new Map<string, ReponseDeLaDemande[]>();
    }),
  ]);

  const demandes = messages.map((m): DemandeDeLaFiche => {
    const texte = champ(m.details, "message");
    return {
      id: m.id,
      date: m.submittedAt,
      typeLibelle: libelleType(m.details, m.type),
      message: typeof texte === "string" ? tronque(texte) : null,
      accuse: accuses.get(m.id) ?? null,
      reponses: reponses.get(m.id) ?? [],
    };
  });
  return { demandes, plafondAtteint, pannes };
}

/** Une seule lecture par requête (la fiche, le fil et le bandeau peuvent la demander tous). */
export const lireDemandesDeLaFiche = cache(lireBrut);

/**
 * Les demandes, accusés et réponses sous la forme du fil des échanges : SANS corps (titre = libellé
 * du type ou objet), jamais comptés comme e-mails du journal. Un accusé automatique a son propre
 * genre `accuse` : il n'est jamais confondu avec une réponse (`reponse`, envoyée par l'équipe).
 */
export function demandesEnEchanges(lu: DemandesLues): EchangeDuFil[] {
  const fil: EchangeDuFil[] = [];
  for (const d of lu.demandes) {
    fil.push({
      cle: `demande:${d.id}`,
      genre: "demande",
      date: d.date,
      titre: `Demande reçue : ${d.typeLibelle}`,
      etat: "Reçue",
      lien: null,
    });
    if (d.accuse && d.accuse.etat !== "absent") {
      fil.push({
        cle: `accuse:${d.id}`,
        genre: "accuse",
        date: d.accuse.date ?? d.date,
        titre: "Accusé de réception automatique",
        etat: LIBELLE_ETAT_ACCUSE[d.accuse.etat],
        lien: null,
      });
    }
    for (const r of d.reponses) {
      fil.push({
        cle: `reponse:${r.id}`,
        genre: "reponse",
        date: r.date,
        titre: "Réponse de l'équipe",
        etat: `Réponse ${r.etat}`,
        lien: null,
      });
    }
  }
  return fil;
}

export const LIBELLE_ETAT_ACCUSE: Readonly<Record<AccuseMessage["etat"], string>> = {
  envoye: "Envoyé",
  en_attente: "En file",
  echec: "Échec d'envoi",
  rebond: "Rebond",
  annule: "Annulé",
  absent: "Aucun accusé",
};
