// Réponses écrites à la main (demandes, candidatures) : chargeur en LECTURE SEULE (lot I3-1).
//
// Registre des sources : `demande` (`SubmissionReply`, droit `peutConsulter`, comme la page
// d'une demande) et `candidature` (`JobApplicationReply`, droit `peutOuvrirDossierCandidat`).
// Une source de plus (e-mails manuels, lot I4) s'ajoute ICI, au registre, jamais par un `if`.
//
// ⛔ Règles de données de personnes :
//  · le droit de la source est vérifié AVANT toute lecture en base ;
//  · une LISTE ne sélectionne jamais `bodyHtml` ni `bodyText` ;
//  · `toEmail` est chiffré : aucune égalité ni `contains` SQL dessus. Une adresse COMPLÈTE se
//    cherche par l'empreinte de la fiche (`contactEmailHash` / `emailHash`) ; un morceau
//    d'adresse ne s'applique pas, et le résultat le dit (`rechercheNonApplicable`) ;
//  · le HTML et le texte d'une réponse enregistrée sortent TOUJOURS masqués
//    (`masquerSecretsEmail`) : le HTML stocké porte le vrai lien d'opposition ;
//  · rien n'est journalisé (ni adresse, ni corps, ni jeton).

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { extrairePreEntete } from "@/lib/email/apercu-lecteur";
import { enveloppeExpedition } from "@/lib/email/enveloppe";
import { peutConsulter, peutOuvrirDossierCandidat } from "@/server/auth/habilitations";

export type SourceReponse = "demande" | "candidature";
export type StatutReponse = "en_attente" | "envoye" | "rebond" | "indesirable" | "echec";

export const TAILLE_PAGE = 50;
export const PAGES_MAX = 20;

export const LIBELLE_STATUT_REPONSE: Readonly<Record<StatutReponse, string>> = {
  en_attente: "En attente d'envoi",
  envoye: "Envoyé",
  rebond: "Rebond",
  indesirable: "Signalé comme indésirable",
  echec: "Échec",
};

/** `pending` → en attente ; `sent` et `delivered` → envoyé ; `bounced` → rebond ; etc. */
const STATUT_DE_BASE: Readonly<Record<string, StatutReponse>> = {
  pending: "en_attente",
  sent: "envoye",
  delivered: "envoye",
  bounced: "rebond",
  complained: "indesirable",
  failed: "echec",
};

const VALEURS_DE_BASE: Readonly<Record<StatutReponse, readonly string[]>> = {
  en_attente: ["pending"],
  envoye: ["sent", "delivered"],
  rebond: ["bounced"],
  indesirable: ["complained"],
  echec: ["failed"],
};

function statutDe(brut: string): StatutReponse {
  return STATUT_DE_BASE[brut] ?? "echec";
}

interface SourceReponseDef {
  habilite(role: string | null | undefined): boolean;
}

const REGISTRE: Readonly<Record<SourceReponse, SourceReponseDef>> = Object.freeze({
  demande: { habilite: peutConsulter },
  candidature: { habilite: peutOuvrirDossierCandidat },
});

function definition(source: string): SourceReponseDef | null {
  return Object.prototype.hasOwnProperty.call(REGISTRE, source)
    ? (REGISTRE[source as SourceReponse] ?? null)
    : null;
}

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

function adresseClaire(chiffree: string | null): string {
  if (chiffree === null) return "";
  try {
    return decryptPii(chiffree);
  } catch {
    return "(adresse illisible)";
  }
}

export interface FiltresReponses {
  /** Adresse complète (empreinte) ; tout autre texte est ignoré et signalé. */
  recherche?: string | undefined;
  statut?: StatutReponse | undefined;
  depuis?: Date | undefined;
  jusqua?: Date | undefined;
  page?: number | undefined;
}

export interface LigneReponse {
  source: SourceReponse;
  id: string;
  /** Demande ou candidature à laquelle la réponse est faite. */
  parentId: string;
  sujet: string;
  destinataire: string;
  statut: StatutReponse;
  date: Date;
  auteur: string;
}

export interface ListeReponses {
  lignes: LigneReponse[];
  page: number;
  /** Vrai si la page demandée dépassait 20 : elle a été ramenée à 20. */
  pageBornee: boolean;
  /** Nombre de réponses (avec les filtres), sur les sources lisibles par le rôle. */
  total: number;
  /** Vrai si la recherche n'était pas une adresse complète : elle n'a PAS été appliquée. */
  rechercheNonApplicable: boolean;
}

const ADRESSE_COMPLETE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELECT_LISTE = {
  id: true,
  repliedAt: true,
  repliedByName: true,
  toEmail: true,
  subject: true,
  deliveryStatus: true,
} as const;

/**
 * Liste fusionnée, par date décroissante, des réponses écrites à la main que ce rôle peut lire.
 * Pagination : on lit `page × 50` lignes de CHAQUE source, on fusionne, on coupe. Bornée à 20.
 */
export async function listerReponsesManuelles(
  filtres: FiltresReponses,
  role: string | null | undefined,
): Promise<ListeReponses> {
  const demandee = Number.isFinite(filtres.page) ? Math.max(1, Math.floor(filtres.page!)) : 1;
  const page = Math.min(demandee, PAGES_MAX);
  const vide: ListeReponses = {
    lignes: [],
    page,
    pageBornee: demandee > PAGES_MAX,
    total: 0,
    rechercheNonApplicable: false,
  };

  const demandes = definition("demande")!.habilite(role);
  const candidatures = definition("candidature")!.habilite(role);
  if ((!demandes && !candidatures) || estStub()) return vide;

  const texte = filtres.recherche?.trim() ?? "";
  let empreinte: string | null = null;
  let rechercheNonApplicable = false;
  if (texte !== "") {
    if (ADRESSE_COMPLETE.test(texte)) empreinte = hashEmailForLookup(texte);
    else rechercheNonApplicable = true;
  }

  const valeurs = filtres.statut ? VALEURS_DE_BASE[filtres.statut] : undefined;
  const fenetre =
    filtres.depuis || filtres.jusqua
      ? {
          repliedAt: {
            ...(filtres.depuis ? { gte: filtres.depuis } : {}),
            ...(filtres.jusqua ? { lte: filtres.jusqua } : {}),
          },
        }
      : {};
  const commun = (statutsAdmis: readonly string[]) => ({
    ...fenetre,
    ...(valeurs ? { deliveryStatus: { in: valeurs.filter((v) => statutsAdmis.includes(v)) } } : {}),
  });

  const whereDemande = {
    ...commun(["pending", "sent", "delivered", "bounced", "complained", "failed"]),
    ...(empreinte ? { submission: { contactEmailHash: empreinte } } : {}),
  };
  const whereCandidat = {
    ...commun(["pending", "sent", "bounced", "failed"]),
    ...(empreinte ? { application: { emailHash: empreinte } } : {}),
  };
  const take = page * TAILLE_PAGE;
  const ordre = { repliedAt: "desc" } as const;

  const [lignesDemande, lignesCandidat, nDemande, nCandidat] = await Promise.all([
    demandes
      ? prisma.submissionReply.findMany({
          where: whereDemande as never,
          orderBy: ordre,
          take,
          select: { ...SELECT_LISTE, submissionId: true },
        })
      : Promise.resolve([]),
    candidatures
      ? prisma.jobApplicationReply.findMany({
          where: whereCandidat as never,
          orderBy: ordre,
          take,
          select: { ...SELECT_LISTE, applicationId: true },
        })
      : Promise.resolve([]),
    demandes ? prisma.submissionReply.count({ where: whereDemande as never }) : Promise.resolve(0),
    candidatures
      ? prisma.jobApplicationReply.count({ where: whereCandidat as never })
      : Promise.resolve(0),
  ]);

  const toutes: LigneReponse[] = [
    ...lignesDemande.map((l): LigneReponse => ({
      source: "demande",
      id: l.id,
      parentId: l.submissionId,
      sujet: l.subject,
      destinataire: adresseClaire(l.toEmail),
      statut: statutDe(l.deliveryStatus),
      date: l.repliedAt,
      auteur: l.repliedByName,
    })),
    ...lignesCandidat.map((l): LigneReponse => ({
      source: "candidature",
      id: l.id,
      parentId: l.applicationId,
      sujet: l.subject,
      destinataire: adresseClaire(l.toEmail),
      statut: statutDe(l.deliveryStatus),
      date: l.repliedAt,
      auteur: l.repliedByName,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    lignes: toutes.slice((page - 1) * TAILLE_PAGE, page * TAILLE_PAGE),
    page,
    pageBornee: demandee > PAGES_MAX,
    total: nDemande + nCandidat,
    rechercheNonApplicable,
  };
}

export interface ReponseLue {
  source: SourceReponse;
  id: string;
  parentId: string;
  /** Fiche client de la demande (les candidatures n'en ont pas). */
  ficheClientId: string | null;
  sujet: string;
  destinataire: string;
  de: string;
  repondreA: string;
  /** HTML MASQUÉ (jeton d'opposition, liens personnels). */
  html: string;
  /** Texte MASQUÉ. */
  texte: string;
  preEntete: string;
  statut: StatutReponse;
  date: Date;
  envoyeLe: Date | null;
  echecLe: Date | null;
  /** Motif d'erreur tel que gardé par le worker. */
  erreur: string | null;
  auteur: string;
  /** « Note interne, jamais envoyée ». */
  noteInterne: string | null;
}

/**
 * Une réponse, prête pour `LecteurEmail`. `null` : source inconnue, rôle sans droit
 * (vérifié AVANT la base), identifiant inconnu, ou build.
 */
export async function lireReponseManuelle(
  source: string,
  id: string,
  role: string | null | undefined,
): Promise<ReponseLue | null> {
  const def = definition(source);
  if (!def || !def.habilite(role) || estStub()) return null;

  const enveloppe = enveloppeExpedition();
  const commun = (l: {
    id: string;
    repliedAt: Date;
    repliedByName: string;
    toEmail: string | null;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    deliveryStatus: string;
    sentAt: Date | null;
    failedAt: Date | null;
    errorMsg: string | null;
    internalNote: string | null;
  }) => {
    const m = masquerSecretsEmail({ subject: l.subject, html: l.bodyHtml, text: l.bodyText });
    return {
      id: l.id,
      sujet: m.subject,
      destinataire: adresseClaire(l.toEmail),
      de: enveloppe.from,
      repondreA: enveloppe.replyTo,
      html: m.html,
      texte: m.text,
      preEntete: extrairePreEntete(m.html),
      statut: statutDe(l.deliveryStatus),
      date: l.repliedAt,
      envoyeLe: l.sentAt,
      echecLe: l.failedAt,
      erreur: l.errorMsg,
      auteur: l.repliedByName,
      noteInterne: l.internalNote,
    };
  };

  if (source === "demande") {
    const l = await prisma.submissionReply.findUnique({
      where: { id },
      select: {
        id: true,
        submissionId: true,
        repliedAt: true,
        repliedByName: true,
        toEmail: true,
        subject: true,
        bodyHtml: true,
        bodyText: true,
        deliveryStatus: true,
        sentAt: true,
        failedAt: true,
        errorMsg: true,
        internalNote: true,
        submission: { select: { ficheClientId: true } },
      },
    });
    if (!l) return null;
    return {
      source: "demande",
      parentId: l.submissionId,
      ficheClientId: l.submission?.ficheClientId ?? null,
      ...commun(l),
    };
  }

  const l = await prisma.jobApplicationReply.findUnique({
    where: { id },
    select: {
      id: true,
      applicationId: true,
      repliedAt: true,
      repliedByName: true,
      toEmail: true,
      subject: true,
      bodyHtml: true,
      bodyText: true,
      deliveryStatus: true,
      sentAt: true,
      failedAt: true,
      errorMsg: true,
      internalNote: true,
    },
  });
  if (!l) return null;
  return { source: "candidature", parentId: l.applicationId, ficheClientId: null, ...commun(l) };
}
