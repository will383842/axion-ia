/**
 * Pièces jointes des e-mails écrits à la main (lot I4, fiche F7).
 *
 * Même circuit que le formulaire de contact : le fichier ne traverse JAMAIS le serveur Next. Le
 * navigateur l'envoie sur une URL `PUT` signée (longueur exacte, 30 minutes), sous une clé TEMPORAIRE
 * tirée par le serveur ; la fin d'envoi, sur présentation du jeton, relit l'objet
 * (`verifierObjetTemporaire`, réutilisée sans modification : taille, signature, macros, antivirus)
 * puis le copie sous sa clé définitive.
 *
 * 🔑 AUCUNE SUPPRESSION, nulle part dans ce module (règle du fondateur). Un objet refusé est COPIÉ sous
 * `emails-manuels/refusees/` (jamais servi), la ligne garde son statut et pointe vers cette copie ; les
 * objets temporaires restent où ils sont. Tout ménage est une décision écrite du fondateur. C'est
 * volontairement différent du circuit de contact. Garde de source : le test du module.
 *
 * 🔑 Une pièce n'est jointe que si son statut est `acceptee` ET que l'antivirus a dit « sain ».
 * Antivirus muet : la ligne revient à `attendue` (on peut réessayer), rien n'est copié ni joint.
 *
 * 🔑 F7 ne CRÉE PLUS de brouillon : elle n'accepte qu'un `emailManuelId` existant (le calcul du
 * destinataire et l'écriture de la ligne appartiennent à F6). Chaque fonction est cloisonnée par
 * auteur : seul `ecrit_par_id` agit sur son brouillon, sans exception (pas même le fondateur).
 * Limites et statut sont lus SOUS VERROU (`SELECT … FOR UPDATE` sur la ligne de l'e-mail, le même
 * que l'effacement RGPD : ordre e-mail puis pièces), et rangés sous verrou à la fin (Temps 3).
 *
 * Chaque fonction exposée contrôle l'acte `ecrire_email_manuel` CÔTÉ SERVEUR : le bouton masqué n'est
 * qu'un confort. Les droits passent par `peutEngager`, jamais par une liste de rôles recopiée.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { env } from "@/env";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { OBJET_EMAIL_MANUEL_EFFACE } from "@/lib/rgpd-erase";
import {
  ObjetR2Modifie,
  copierObjetR2,
  enteteObjetR2,
  signerEnvoiDirectR2,
} from "@/lib/r2-storage";
import { TYPE_ENVOI_PIECE_JOINTE } from "@/lib/contact/pieces-jointes";
import {
  EXPIRATION_ATTENDUE_MS,
  EXPIRATION_CONTROLE_MS,
  MESSAGES_PIECES_EMAIL,
  NOMBRE_MAX_PIECES_EMAIL,
  PLAFOND_OCTETS_24H_PAR_ADMIN,
  assainirNomPieceJointeEmail,
  controlerAnnonceEmail,
  estFormatSortant,
  formatSortantDepuisNom,
  prefixesStockageEmail,
  type FormatSortant,
} from "@/lib/email-manuel/pieces-jointes";
import { peutEngager } from "@/server/auth/habilitations";
import { verifierObjetTemporaire, type Antivirus } from "@/server/contact/pieces-jointes";
import { analyserFlux } from "@/server/careers/clamav";
import type { Prisma } from "../../../prisma/generated/client";

type Tx = Prisma.TransactionClient;

/** Objets pas encore contrôlés. */
export const PREFIXE_TEMPORAIRE_EMAIL = "emails-manuels/temporaire/";
/** Objets refusés : conservés, jamais servis, jamais supprimés. */
export const PREFIXE_REFUSEES_EMAIL = "emails-manuels/refusees/";
/** Durée de vie d'une URL d'envoi : le délai court au début du `PUT`. */
export const TTL_URL_ENVOI_EMAIL_S = 30 * 60;
/** 30 ouvertures d'envois par heure et par administrateur. */
export const LIMITE_OUVERTURES_PAR_HEURE = 30;

const OPTIONS_TRANSACTION = { timeout: 10_000, maxWait: 5_000 } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JETON = /^[A-Za-z0-9_-]{43}$/;

export interface ActeurEmailManuel {
  readonly id: string;
  readonly role: string | null | undefined;
}

export type Refus =
  | "acte"
  | "eteint"
  | "debit"
  | "annonce"
  | "inconnu"
  | "deja_parti"
  | "neutralise"
  | "plafond"
  | "indisponible";

export interface Echec {
  readonly ok: false;
  readonly refus: Refus;
  readonly message: string;
}

const MESSAGE_ACTE = "Vous n'avez pas le droit d'écrire des e-mails depuis la console.";
const MESSAGE_INCONNU = "E-mail introuvable.";
const MESSAGE_DEJA_PARTI = "Cet e-mail est déjà parti : on ne peut plus lui ajouter de fichier.";

function echec(refus: Refus, message: string): Echec {
  return { ok: false, refus, message };
}

function acteAutorise(acteur: ActeurEmailManuel): boolean {
  return peutEngager(acteur.role, "ecrire_email_manuel");
}

function actif(): boolean {
  return env.EMAIL_MANUEL_ACTIF === "true";
}

const idValide = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

const schemaPiece = z.object({
  nom: z.string().min(1).max(255),
  taille: z.number(),
});

/** Valide l'annonce : rend les pièces nettoyées, ou l'échec. Aucun accès réseau ni base. */
function validerAnnonce(
  brut: unknown,
): { ok: true; pieces: Array<{ nom: string; taille: number }> } | Echec {
  if (!Array.isArray(brut) || brut.length === 0) return echec("annonce", "Aucun fichier annoncé.");
  if (brut.length > NOMBRE_MAX_PIECES_EMAIL) return echec("annonce", MESSAGES_PIECES_EMAIL.nombre);
  const pieces: Array<{ nom: string; taille: number }> = [];
  for (const p of brut) {
    const r = schemaPiece.safeParse(p);
    if (!r.success) return echec("annonce", "Fichier annoncé invalide.");
    pieces.push({ nom: assainirNomPieceJointeEmail(r.data.nom), taille: r.data.taille });
  }
  return { ok: true, pieces };
}

/** Ce que le verrou rend de la ligne de l'e-mail. */
interface LigneEmail {
  readonly id: string;
  readonly statut: string;
  readonly ecrit_par_id: string | null;
  readonly objet: string;
}

/** Verrou de la ligne de l'e-mail (même requête que l'effacement RGPD : e-mail, puis pièces). */
async function verrouillerEmail(tx: Tx, id: string): Promise<LigneEmail | undefined> {
  const lignes = await tx.$queryRaw<LigneEmail[]>`
    SELECT id, statut, ecrit_par_id, objet FROM "emails_manuels" WHERE id = ${id}::uuid FOR UPDATE`;
  return lignes[0];
}

export function empreinteJetonEmail(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/** Clé TEMPORAIRE : le dossier de l'e-mail, un identifiant aléatoire. Ni nom, ni extension. */
export function cleTemporaireEmail(emailManuelId: string): string {
  return `${prefixesStockageEmail(emailManuelId)[1]}${randomUUID()}`;
}

/** Clé DÉFINITIVE : l'e-mail, un identifiant aléatoire, le format reconnu. */
export function cleDefinitiveEmail(emailManuelId: string, format: string): string {
  return `${prefixesStockageEmail(emailManuelId)[0]}${randomUUID()}.${format}`;
}

/** Clé de l'objet refusé, mis à l'écart. */
function cleRefusee(emailManuelId: string): string {
  return `${prefixesStockageEmail(emailManuelId)[2]}${randomUUID()}`;
}

/**
 * Règle d'expiration, SANS suppression, à appeler sous le verrou de l'e-mail : une ligne `attendue`
 * de plus de 60 min, ou `controle` de plus de 75 min, passe `non_recue`.
 */
export async function expirerPiecesAbandonnees(
  tx: Tx,
  emailManuelId: string,
  maintenant: Date,
): Promise<void> {
  await tx.emailManuelPieceJointe.updateMany({
    where: {
      emailManuelId,
      statut: "attendue",
      creeLe: { lt: new Date(maintenant.getTime() - EXPIRATION_ATTENDUE_MS) },
    },
    data: { statut: "non_recue" },
  });
  await tx.emailManuelPieceJointe.updateMany({
    where: {
      emailManuelId,
      statut: "controle",
      creeLe: { lt: new Date(maintenant.getTime() - EXPIRATION_CONTROLE_MS) },
    },
    data: { statut: "non_recue" },
  });
}

// ---- 1. Ouvrir les envois ---------------------------------------------------

export interface PieceAnnonceeEmail {
  readonly nom: string;
  readonly taille: number;
}

export interface EnvoiOuvert {
  readonly id: string;
  readonly nomFichier: string;
  readonly url: string;
  readonly taille: number;
}

export type ResultatOuverture =
  | {
      readonly ok: true;
      readonly emailManuelId: string;
      /** Rendu au navigateur ; seule son empreinte est en base. */
      readonly jeton: string;
      readonly envois: ReadonlyArray<EnvoiOuvert>;
    }
  | Echec;

const STATUTS_QUI_COMPTENT = ["attendue", "controle", "acceptee"];

/**
 * Une ligne `attendue` et une URL `PUT` par fichier annoncé, sur un e-mail EXISTANT dont l'acteur est
 * l'auteur. Limites, statut et plafond sont contrôlés sous le verrou de la ligne de l'e-mail : deux
 * ouvertures simultanées se suivent. Le navigateur ne choisit ni la clé, ni le compartiment, ni le
 * format (déduit du nom, puis revérifié sur les octets à la fin d'envoi).
 */
export async function ouvrirEnvoisPiecesJointesEmail(
  entree: {
    readonly acteur: ActeurEmailManuel;
    readonly pieces: ReadonlyArray<PieceAnnonceeEmail>;
    readonly emailManuelId: string;
  },
  maintenant: Date = new Date(),
): Promise<ResultatOuverture> {
  const { acteur } = entree;
  // Validation d'abord : une entrée invalide ne fait aucun appel Prisma, R2 ou de débit.
  if (!idValide(acteur?.id) || !idValide(entree.emailManuelId)) {
    return echec("inconnu", MESSAGE_INCONNU);
  }
  const annonce = validerAnnonce(entree.pieces);
  if (!annonce.ok) return annonce;
  const { pieces } = annonce;
  const emailManuelId = entree.emailManuelId;

  if (!acteAutorise(acteur)) return echec("acte", MESSAGE_ACTE);
  if (!actif()) return echec("eteint", MESSAGES_PIECES_EMAIL.eteint);

  const debit = await checkRateLimit(`email-manuel:pj:${acteur.id}`, {
    limit: LIMITE_OUVERTURES_PAR_HEURE,
    windowSec: 3600,
    surPanne: "refuser",
  });
  if (!debit.allowed) {
    return echec("debit", "Trop d'envois de fichiers en peu de temps : réessayez plus tard.");
  }

  // Premier contrôle sans rien lire en base (le plus fréquent : format, taille, nombre).
  const refusRapide = controlerAnnonceEmail(pieces);
  if (refusRapide) return echec("annonce", refusRapide);
  const formats: FormatSortant[] = pieces.map((p) => formatSortantDepuisNom(p.nom)!);

  return prisma.$transaction(async (tx): Promise<ResultatOuverture> => {
    const e = await verrouillerEmail(tx, emailManuelId);
    if (!e || e.ecrit_par_id !== acteur.id) return echec("inconnu", MESSAGE_INCONNU);
    if (e.statut !== "brouillon") return echec("deja_parti", MESSAGE_DEJA_PARTI);
    if (e.objet === OBJET_EMAIL_MANUEL_EFFACE) {
      return echec("neutralise", MESSAGES_PIECES_EMAIL.neutralise);
    }
    await expirerPiecesAbandonnees(tx, emailManuelId, maintenant);

    // Limites cumulées : les pièces déjà annoncées sur cet e-mail comptent.
    const existantes = await tx.emailManuelPieceJointe.findMany({
      where: { emailManuelId, statut: { in: STATUTS_QUI_COMPTENT } },
      select: { tailleOctets: true },
    });
    const refus = controlerAnnonceEmail(pieces, {
      nombre: existantes.length,
      octets: existantes.reduce((t, l) => t + l.tailleOctets, 0),
    });
    if (refus) return echec("annonce", refus);

    // Plafond de stockage : tout ce que l'auteur a créé depuis 24 h, quel que soit le statut.
    const jour = await tx.emailManuelPieceJointe.aggregate({
      _sum: { tailleOctets: true },
      where: {
        creeLe: { gte: new Date(maintenant.getTime() - 86_400_000) },
        emailManuel: { ecritParId: acteur.id },
      },
    });
    const annonces = pieces.reduce((t, p) => t + p.taille, 0);
    if ((jour._sum.tailleOctets ?? 0) + annonces > PLAFOND_OCTETS_24H_PAR_ADMIN) {
      return echec("plafond", MESSAGES_PIECES_EMAIL.plafond);
    }

    const jeton = randomBytes(32).toString("base64url");
    const jetonHash = empreinteJetonEmail(jeton);
    const lignes = pieces.map((p, i) => ({
      id: randomUUID(),
      emailManuelId,
      nomFichier: p.nom,
      format: formats[i]!,
      tailleOctets: p.taille,
      cleStockage: cleTemporaireEmail(emailManuelId),
      statut: "attendue",
      jetonHash,
      creeLe: maintenant,
    }));
    // Signer après tous les contrôles (calcul hors ligne) : aucune URL pour un refus, aucune ligne
    // écrite pour une URL impossible.
    let urls: string[];
    try {
      urls = await Promise.all(
        lignes.map((l) =>
          signerEnvoiDirectR2(
            l.cleStockage,
            l.tailleOctets,
            TYPE_ENVOI_PIECE_JOINTE,
            TTL_URL_ENVOI_EMAIL_S,
          ),
        ),
      );
    } catch (err) {
      Sentry.captureException(err, { tags: { step: "email-manuel-pj", motif: "signature" } });
      return echec("indisponible", "Envoi de fichiers indisponible, réessayez.");
    }
    await tx.emailManuelPieceJointe.createMany({ data: lignes });
    return {
      ok: true,
      emailManuelId,
      jeton,
      envois: lignes.map((l, i) => ({
        id: l.id,
        nomFichier: l.nomFichier,
        url: urls[i]!,
        taille: l.tailleOctets,
      })),
    };
  }, OPTIONS_TRANSACTION);
}

// ---- 2. Finaliser -----------------------------------------------------------

export type StatutPiece = "acceptee" | "refusee" | "non_recue" | "antivirus_indisponible";

export interface IssuePieceEmail {
  readonly id: string;
  readonly nomFichier: string;
  readonly statut: StatutPiece | "en_cours";
  readonly message?: string;
}

export type ResultatFinalisation =
  | {
      readonly ok: true;
      readonly pieces: ReadonlyArray<IssuePieceEmail>;
      /** `true` si CET appel a contrôlé les pièces ; `false` : jeton déjà utilisé, sans effet. */
      readonly controlees: boolean;
    }
  | Echec;

interface LigneControlee {
  readonly id: string;
  readonly nomFichier: string;
  readonly format: string;
  readonly tailleOctets: number;
  readonly cleStockage: string;
}

function messageDeRefus(nom: string, motif: string | null): string {
  switch (motif) {
    case "format":
      return MESSAGES_PIECES_EMAIL.format(nom);
    case "macros":
      return MESSAGES_PIECES_EMAIL.macros(nom);
    case "contenu":
      return MESSAGES_PIECES_EMAIL.contenu(nom);
    case "infecte":
      return MESSAGES_PIECES_EMAIL.infecte(nom);
    case "taille":
      return MESSAGES_PIECES_EMAIL.taille(nom);
    case "envoi_parti":
      return MESSAGES_PIECES_EMAIL.envoiParti(nom);
    default:
      return MESSAGES_PIECES_EMAIL.nonRecue(nom);
  }
}

/**
 * Met l'objet refusé à l'écart : COPIE sous `emails-manuels/refusees/`, la ligne pointe dessus.
 * Rien n'est supprimé, ni l'objet temporaire ni la copie. Best-effort : si la copie échoue, la ligne
 * garde sa clé temporaire (l'objet y reste, jamais servi).
 */
async function mettreDeCoteRefusee(
  emailManuelId: string,
  ligne: LigneControlee,
  motif: string,
): Promise<void> {
  let cle = ligne.cleStockage;
  try {
    const tete = await enteteObjetR2(ligne.cleStockage);
    if (tete) {
      const destination = cleRefusee(emailManuelId);
      await copierObjetR2(ligne.cleStockage, destination, tete.etag, TYPE_ENVOI_PIECE_JOINTE);
      cle = destination;
    }
  } catch (err) {
    if (!(err instanceof ObjetR2Modifie)) {
      Sentry.captureException(err, { tags: { step: "email-manuel-pj", motif: "mise-a-l-ecart" } });
    }
  }
  // Conditionnel : une ligne expirée pendant le contrôle ne redevient pas « refusee ».
  await prisma.emailManuelPieceJointe.updateMany({
    where: { id: ligne.id, statut: "controle" },
    data: { statut: "refusee", motifRefus: motif, cleStockage: cle },
  });
}

/** Contrôle UNE ligne passée `controle`, puis la range. Rend son issue. */
async function controlerEtRanger(
  emailManuelId: string,
  ligne: LigneControlee,
  antivirus: Antivirus,
): Promise<StatutPiece> {
  const remettreAttendue = async (): Promise<void> => {
    await prisma.emailManuelPieceJointe.updateMany({
      where: { id: ligne.id, statut: "controle" },
      data: { statut: "attendue" },
    });
  };

  let verdict: Awaited<ReturnType<typeof verifierObjetTemporaire>>;
  try {
    verdict = await verifierObjetTemporaire(ligne, antivirus);
  } catch (err) {
    // Panne de lecture : rien n'est jugé, on peut réessayer.
    Sentry.captureException(err, { tags: { step: "email-manuel-pj", motif: "controle" } });
    await remettreAttendue();
    return "antivirus_indisponible";
  }

  if (verdict.statut === "non_recue") {
    await prisma.emailManuelPieceJointe.updateMany({
      where: { id: ligne.id, statut: "controle" },
      data: { statut: "non_recue" },
    });
    return "non_recue";
  }
  if (verdict.statut === "refusee") {
    await mettreDeCoteRefusee(emailManuelId, ligne, verdict.motif);
    return "refusee";
  }
  // Reçue : jamais jointe sans un « sain » explicite.
  if (verdict.antivirus !== "sain") {
    await remettreAttendue();
    return "antivirus_indisponible";
  }
  // Le format est recontrôlé à l'acceptation (la liste des formats sortants est plus étroite).
  if (!estFormatSortant(verdict.format)) {
    await mettreDeCoteRefusee(emailManuelId, ligne, "format");
    return "refusee";
  }
  // Lecture simple : évite une copie inutile. Ce n'est PAS la garantie (c'est le Temps 3).
  const avant = await prisma.emailManuel.findFirst({
    where: { id: emailManuelId },
    select: { statut: true },
  });
  if (!avant || avant.statut !== "brouillon") {
    return rangerEnvoiParti(ligne);
  }
  const definitive = cleDefinitiveEmail(emailManuelId, verdict.format);
  try {
    await copierObjetR2(ligne.cleStockage, definitive, verdict.etag, verdict.mime);
  } catch (err) {
    if (err instanceof ObjetR2Modifie) {
      await mettreDeCoteRefusee(emailManuelId, ligne, "contenu");
      return "refusee";
    }
    Sentry.captureException(err, { tags: { step: "email-manuel-pj", motif: "rangement" } });
    await remettreAttendue();
    return "antivirus_indisponible";
  }
  // Temps 3 : rangement sous le verrou de l'e-mail, qui relit le statut. Un e-mail parti entre-temps
  // n'accepte plus rien : la ligne est refusée (clé temporaire gardée, traçable), jamais acceptée.
  return prisma.$transaction(async (tx): Promise<StatutPiece> => {
    const [e] = await tx.$queryRaw<{ statut: string }[]>`
      SELECT statut FROM "emails_manuels" WHERE id = ${emailManuelId}::uuid FOR UPDATE`;
    if (!e || e.statut !== "brouillon") {
      const r = await tx.emailManuelPieceJointe.updateMany({
        where: { id: ligne.id, statut: "controle" },
        data: { statut: "refusee", motifRefus: "envoi_parti" },
      });
      return r.count ? "refusee" : "non_recue";
    }
    const r = await tx.emailManuelPieceJointe.updateMany({
      where: { id: ligne.id, statut: "controle" },
      data: {
        statut: "acceptee",
        cleStockage: definitive,
        format: verdict.format,
        sha256: verdict.sha256,
        antivirus: "sain",
      },
    });
    return r.count ? "acceptee" : "non_recue";
  }, OPTIONS_TRANSACTION);
}

async function rangerEnvoiParti(ligne: LigneControlee): Promise<StatutPiece> {
  const r = await prisma.emailManuelPieceJointe.updateMany({
    where: { id: ligne.id, statut: "controle" },
    data: { statut: "refusee", motifRefus: "envoi_parti" },
  });
  return r.count ? "refusee" : "non_recue";
}

function issueDeLigne(l: {
  id: string;
  nomFichier: string;
  statut: string;
  motifRefus: string | null;
}): IssuePieceEmail {
  if (l.statut === "acceptee") return { id: l.id, nomFichier: l.nomFichier, statut: "acceptee" };
  if (l.statut === "refusee") {
    return {
      id: l.id,
      nomFichier: l.nomFichier,
      statut: "refusee",
      message: messageDeRefus(l.nomFichier, l.motifRefus),
    };
  }
  if (l.statut === "non_recue") {
    return {
      id: l.id,
      nomFichier: l.nomFichier,
      statut: "non_recue",
      message: MESSAGES_PIECES_EMAIL.nonRecue(l.nomFichier),
    };
  }
  return { id: l.id, nomFichier: l.nomFichier, statut: "en_cours" };
}

/**
 * Fin d'envoi, sur présentation du jeton, en trois temps : (1) transaction courte sous verrou
 * (auteur, brouillon, expiration, prise `attendue` → `controle`) ; (2) contrôle hors transaction ;
 * (3) rangement de chaque ligne sous verrou, qui relit le statut. Un jeton rejoué (ou un second
 * appel simultané) ne prend rien et rend l'issue déjà rangée.
 */
export async function finaliserPiecesJointesEmail(
  entree: {
    readonly acteur: ActeurEmailManuel;
    readonly emailManuelId: string;
    readonly jeton: string;
  },
  deps: { readonly antivirus?: Antivirus } = {},
  maintenant: Date = new Date(),
): Promise<ResultatFinalisation> {
  const { acteur, emailManuelId } = entree;
  if (!idValide(acteur?.id) || !idValide(emailManuelId)) {
    return echec("inconnu", MESSAGE_INCONNU);
  }
  if (typeof entree.jeton !== "string" || !JETON.test(entree.jeton)) {
    return echec("inconnu", MESSAGE_INCONNU);
  }
  if (!acteAutorise(acteur)) return echec("acte", MESSAGE_ACTE);
  if (!actif()) return echec("eteint", MESSAGES_PIECES_EMAIL.eteint);
  const antivirus = deps.antivirus ?? analyserFlux;
  const jetonHash = empreinteJetonEmail(entree.jeton);

  // Temps 1 : court, sous verrou.
  const pris = await prisma.$transaction(async (tx): Promise<Echec | { count: number }> => {
    const e = await verrouillerEmail(tx, emailManuelId);
    if (!e || e.ecrit_par_id !== acteur.id) return echec("inconnu", MESSAGE_INCONNU);
    if (e.statut !== "brouillon") return echec("deja_parti", MESSAGE_DEJA_PARTI);
    await expirerPiecesAbandonnees(tx, emailManuelId, maintenant);
    return tx.emailManuelPieceJointe.updateMany({
      where: {
        emailManuelId,
        jetonHash,
        statut: "attendue",
        creeLe: { gte: new Date(maintenant.getTime() - EXPIRATION_ATTENDUE_MS) },
      },
      data: { statut: "controle" },
    });
  }, OPTIONS_TRANSACTION);
  if ("ok" in pris) return pris;

  // Temps 2 : hors transaction, chaque ligne protégée.
  const muettes = new Set<string>();
  if (pris.count > 0) {
    const lignes = await prisma.emailManuelPieceJointe.findMany({
      where: { emailManuelId, jetonHash, statut: "controle" },
    });
    const issues = await Promise.allSettled(
      lignes.map((l) => controlerEtRanger(emailManuelId, l, antivirus)),
    );
    for (const [i, issue] of issues.entries()) {
      const l = lignes[i]!;
      if (issue.status === "fulfilled") {
        if (issue.value === "antivirus_indisponible") muettes.add(l.id);
        continue;
      }
      // Exception pendant le rangement : la ligne revient « attendue », on peut réessayer.
      Sentry.captureException(issue.reason, {
        tags: { step: "email-manuel-pj", motif: "rangement-exception" },
      });
      muettes.add(l.id);
      try {
        await prisma.emailManuelPieceJointe.updateMany({
          where: { id: l.id, statut: "controle" },
          data: { statut: "attendue" },
        });
      } catch (err) {
        Sentry.captureException(err, { tags: { step: "email-manuel-pj", motif: "remise" } });
      }
    }
  }
  const toutes = await prisma.emailManuelPieceJointe.findMany({
    where: { emailManuelId, jetonHash },
  });
  return {
    ok: true,
    controlees: pris.count > 0,
    pieces: toutes.map((l) =>
      muettes.has(l.id)
        ? {
            id: l.id,
            nomFichier: l.nomFichier,
            statut: "antivirus_indisponible" as const,
            message: MESSAGES_PIECES_EMAIL.antivirusIndisponible(l.nomFichier),
          }
        : issueDeLigne(l),
    ),
  };
}

// ---- 3. Lister --------------------------------------------------------------

export interface PieceListee {
  readonly id: string;
  readonly nomFichier: string;
  readonly format: string;
  readonly tailleOctets: number;
  readonly statut: string;
  readonly motifRefus: string | null;
  readonly antivirus: string | null;
  /** Vrai seulement si `acceptee` ET antivirus « sain » : la seule condition pour joindre. */
  readonly joignable: boolean;
}

/** Les pièces d'un e-mail. Ni la clé de stockage ni l'empreinte du jeton ne sortent. */
export async function listerPiecesJointesEmail(entree: {
  readonly acteur: ActeurEmailManuel;
  readonly emailManuelId: string;
}): Promise<{ readonly ok: true; readonly pieces: ReadonlyArray<PieceListee> } | Echec> {
  if (!idValide(entree.acteur?.id) || !idValide(entree.emailManuelId)) {
    return echec("inconnu", MESSAGE_INCONNU);
  }
  if (!acteAutorise(entree.acteur)) return echec("acte", MESSAGE_ACTE);
  const e = await prisma.emailManuel.findFirst({
    where: { id: entree.emailManuelId, ecritParId: entree.acteur.id },
    select: { id: true },
  });
  if (!e) return echec("inconnu", MESSAGE_INCONNU);
  const lignes = await prisma.emailManuelPieceJointe.findMany({
    where: { emailManuelId: entree.emailManuelId },
    orderBy: { creeLe: "asc" },
  });
  return {
    ok: true,
    pieces: lignes.map((l) => ({
      id: l.id,
      nomFichier: l.nomFichier,
      format: l.format,
      tailleOctets: l.tailleOctets,
      statut: l.statut,
      motifRefus: l.motifRefus,
      antivirus: l.antivirus,
      joignable: l.statut === "acceptee" && l.antivirus === "sain",
    })),
  };
}
