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
 * Chaque fonction exposée contrôle l'acte `ecrire_email_manuel` CÔTÉ SERVEUR : le bouton masqué n'est
 * qu'un confort. Les droits passent par `peutEngager`, jamais par une liste de rôles recopiée.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  ObjetR2Modifie,
  copierObjetR2,
  enteteObjetR2,
  signerEnvoiDirectR2,
} from "@/lib/r2-storage";
import { TYPE_ENVOI_PIECE_JOINTE } from "@/lib/contact/pieces-jointes";
import {
  MESSAGES_PIECES_EMAIL,
  assainirNomPieceJointeEmail,
  controlerAnnonceEmail,
  formatSortantDepuisNom,
  type FormatSortant,
} from "@/lib/email-manuel/pieces-jointes";
import { peutEngager } from "@/server/auth/habilitations";
import { verifierObjetTemporaire, type Antivirus } from "@/server/contact/pieces-jointes";
import { analyserFlux } from "@/server/careers/clamav";

/** Objets pas encore contrôlés. */
export const PREFIXE_TEMPORAIRE_EMAIL = "emails-manuels/temporaire/";
/** Objets refusés : conservés, jamais servis, jamais supprimés. */
export const PREFIXE_REFUSEES_EMAIL = "emails-manuels/refusees/";
/** Durée de vie d'une URL d'envoi : le délai court au début du `PUT`. */
export const TTL_URL_ENVOI_EMAIL_S = 30 * 60;
/** 30 ouvertures d'envois par heure et par administrateur. */
export const LIMITE_OUVERTURES_PAR_HEURE = 30;

const TYPES_ENTITE: ReadonlySet<string> = new Set([
  "Client",
  "ClientContact",
  "CalendlyEvent",
  "ApporteurReseau",
  "Trainer",
  "Trainee",
]);

export interface ActeurEmailManuel {
  readonly id: string;
  readonly role: string | null | undefined;
}

export type Refus =
  "acte" | "debit" | "annonce" | "brouillon" | "inconnu" | "deja_parti" | "indisponible";

export interface Echec {
  readonly ok: false;
  readonly refus: Refus;
  readonly message: string;
}

const MESSAGE_ACTE = "Vous n'avez pas le droit d'écrire des e-mails depuis la console.";

function echec(refus: Refus, message: string): Echec {
  return { ok: false, refus, message };
}

function acteAutorise(acteur: ActeurEmailManuel): boolean {
  return peutEngager(acteur.role, "ecrire_email_manuel");
}

/** Ce qu'il faut pour créer la ligne `brouillon` quand l'e-mail n'existe pas encore (fournis par F6). */
export interface BrouillonACreer {
  readonly cleIdempotence: string;
  readonly entiteType: string;
  readonly entiteId: string;
  readonly clientId?: string | null;
  readonly contactId?: string | null;
  /** `encryptPii(adresse)` : jamais l'adresse en clair. */
  readonly destinataireChiffre: string;
  /** `hashEmailForLookup(normalizeEmail(adresse))`. */
  readonly destinataireHash: string;
  readonly destinataireNom?: string | null;
  readonly expediteurNom: string;
  readonly ecritParNom: string;
}

function brouillonValide(b: BrouillonACreer): boolean {
  return (
    b.cleIdempotence.length >= 8 &&
    b.cleIdempotence.length <= 64 &&
    TYPES_ENTITE.has(b.entiteType) &&
    b.entiteId.length > 0 &&
    b.entiteId.length <= 64 &&
    /^[0-9a-f]{64}$/.test(b.destinataireHash) &&
    b.destinataireChiffre.length > 0 &&
    b.expediteurNom.length > 0 &&
    b.expediteurNom.length <= 80 &&
    b.ecritParNom.length > 0
  );
}

export function empreinteJetonEmail(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/** Clé TEMPORAIRE : le jour, un identifiant aléatoire. Ni nom, ni extension, ni e-mail. */
export function cleTemporaireEmail(maintenant: Date): string {
  return `${PREFIXE_TEMPORAIRE_EMAIL}${maintenant.toISOString().slice(0, 10)}/${randomUUID()}`;
}

/** Clé DÉFINITIVE : l'e-mail, un identifiant aléatoire, le format reconnu. */
export function cleDefinitiveEmail(emailManuelId: string, format: string): string {
  return `emails-manuels/${emailManuelId}/${randomUUID()}.${format}`;
}

/** Clé de l'objet refusé, mis à l'écart. */
function cleRefusee(emailManuelId: string): string {
  return `${PREFIXE_REFUSEES_EMAIL}${emailManuelId}/${randomUUID()}`;
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
 * Une ligne `attendue` et une URL `PUT` par fichier annoncé. L'e-mail est désigné par son identifiant,
 * ou créé en `brouillon` (une seule fois par clé d'idempotence). Le navigateur ne choisit ni la clé, ni
 * le compartiment, ni le format (déduit du nom, puis revérifié sur les octets à la fin d'envoi).
 */
export async function ouvrirEnvoisPiecesJointesEmail(
  entree: {
    readonly acteur: ActeurEmailManuel;
    readonly pieces: ReadonlyArray<PieceAnnonceeEmail>;
  } & ({ readonly emailManuelId: string } | { readonly brouillon: BrouillonACreer }),
  maintenant: Date = new Date(),
): Promise<ResultatOuverture> {
  const { acteur } = entree;
  if (!acteAutorise(acteur)) return echec("acte", MESSAGE_ACTE);

  // Annonce reconstruite champ par champ : rien d'autre que nom et taille n'est lu.
  const pieces = entree.pieces.map((p) => ({
    nom: assainirNomPieceJointeEmail(String(p.nom ?? "")),
    taille: p.taille,
  }));
  if (pieces.length === 0) return echec("annonce", "Aucun fichier annoncé.");
  const formats: FormatSortant[] = [];
  for (const p of pieces) {
    const f = formatSortantDepuisNom(p.nom);
    if (f) formats.push(f);
  }

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

  let emailManuelId: string;
  if ("emailManuelId" in entree) {
    const e = await prisma.emailManuel.findUnique({
      where: { id: entree.emailManuelId },
      select: { id: true, statut: true },
    });
    if (!e) return echec("inconnu", "E-mail introuvable.");
    if (e.statut !== "brouillon") {
      return echec(
        "deja_parti",
        "Cet e-mail est déjà parti : on ne peut plus lui ajouter de fichier.",
      );
    }
    emailManuelId = e.id;
  } else {
    const b = entree.brouillon;
    if (!brouillonValide(b)) return echec("brouillon", "Brouillon invalide.");
    let e = await prisma.emailManuel.findUnique({
      where: { cleIdempotence: b.cleIdempotence },
      select: { id: true, statut: true },
    });
    if (!e) {
      try {
        e = await prisma.emailManuel.create({
          data: {
            cleIdempotence: b.cleIdempotence,
            entiteType: b.entiteType,
            entiteId: b.entiteId,
            clientId: b.clientId ?? null,
            contactId: b.contactId ?? null,
            destinataireChiffre: b.destinataireChiffre,
            destinataireHash: b.destinataireHash,
            destinataireNom: b.destinataireNom ?? null,
            expediteurNom: b.expediteurNom,
            objet: "",
            corpsSource: "",
            statut: "brouillon",
            ecritParId: acteur.id,
            ecritParNom: b.ecritParNom,
          },
          select: { id: true, statut: true },
        });
      } catch (err) {
        // Double clic : l'autre appel a créé la ligne entre-temps.
        e = await prisma.emailManuel.findUnique({
          where: { cleIdempotence: b.cleIdempotence },
          select: { id: true, statut: true },
        });
        if (!e) throw err;
      }
    }
    if (e.statut !== "brouillon") {
      return echec(
        "deja_parti",
        "Cet e-mail est déjà parti : on ne peut plus lui ajouter de fichier.",
      );
    }
    emailManuelId = e.id;
  }

  // Limites cumulées : les pièces déjà annoncées sur cet e-mail comptent.
  const existantes = await prisma.emailManuelPieceJointe.findMany({
    where: { emailManuelId, statut: { in: STATUTS_QUI_COMPTENT } },
    select: { tailleOctets: true },
  });
  const refus = controlerAnnonceEmail(pieces, {
    nombre: existantes.length,
    octets: existantes.reduce((t, l) => t + l.tailleOctets, 0),
  });
  if (refus) return echec("annonce", refus);

  const jeton = randomBytes(32).toString("base64url");
  const jetonHash = empreinteJetonEmail(jeton);
  const lignes = pieces.map((p, i) => ({
    id: randomUUID(),
    emailManuelId,
    nomFichier: p.nom,
    format: formats[i]!,
    tailleOctets: p.taille,
    cleStockage: cleTemporaireEmail(maintenant),
    statut: "attendue",
    jetonHash,
  }));
  // Signer d'abord (calcul hors ligne) : aucune ligne écrite pour une URL impossible.
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
  await prisma.emailManuelPieceJointe.createMany({ data: lignes });
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
  await prisma.emailManuelPieceJointe.update({
    where: { id: ligne.id },
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
    await prisma.emailManuelPieceJointe.update({
      where: { id: ligne.id },
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
    await prisma.emailManuelPieceJointe.update({
      where: { id: ligne.id },
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
  await prisma.emailManuelPieceJointe.update({
    where: { id: ligne.id },
    data: {
      statut: "acceptee",
      cleStockage: definitive,
      format: verdict.format,
      sha256: verdict.sha256,
      antivirus: "sain",
    },
  });
  return "acceptee";
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
 * Fin d'envoi, sur présentation du jeton. Le passage `attendue` → `controle` est atomique : un jeton
 * rejoué (ou un second appel simultané) ne contrôle rien et rend l'issue déjà rangée.
 */
export async function finaliserPiecesJointesEmail(
  entree: {
    readonly acteur: ActeurEmailManuel;
    readonly emailManuelId: string;
    readonly jeton: string;
  },
  deps: { readonly antivirus?: Antivirus } = {},
): Promise<ResultatFinalisation> {
  if (!acteAutorise(entree.acteur)) return echec("acte", MESSAGE_ACTE);
  const antivirus = deps.antivirus ?? analyserFlux;
  const { emailManuelId } = entree;
  const jetonHash = empreinteJetonEmail(entree.jeton);

  const pris = await prisma.emailManuelPieceJointe.updateMany({
    where: { emailManuelId, jetonHash, statut: "attendue" },
    data: { statut: "controle" },
  });
  let muettes = new Set<string>();
  if (pris.count > 0) {
    const lignes = await prisma.emailManuelPieceJointe.findMany({
      where: { emailManuelId, jetonHash, statut: "controle" },
    });
    const issues = await Promise.all(
      lignes.map(
        async (l) => [l.id, await controlerEtRanger(emailManuelId, l, antivirus)] as const,
      ),
    );
    muettes = new Set(issues.filter(([, s]) => s === "antivirus_indisponible").map(([id]) => id));
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
  if (!acteAutorise(entree.acteur)) return echec("acte", MESSAGE_ACTE);
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
