/**
 * Pièces jointes du formulaire de contact — envoi DIRECT vers R2, contrôle,
 * rangement (2026-10-15, refonte « fichiers lourds » : 25 Mo par fichier,
 * 50 Mo au total).
 *
 * 🔑 Le fichier ne traverse JAMAIS le serveur Next. Ni la Server Action, ni le
 * proxy, ni Cloudflare côté site n'en voient un octet : un VPS n'a pas à tenir
 * 50 Mo en mémoire par visiteur, et `bodySizeLimit` reste à sa valeur d'avant.
 *
 * Le circuit, en quatre temps :
 *   1. `lireAnnoncePiecesJointes` — le formulaire ANNONCE nom et taille de
 *      chaque fichier. Contrôle rapide (nombre, taille, extension).
 *   2. `ouvrirEnvoisPiecesJointes` — APRÈS la limite de fréquence, le leurre,
 *      Turnstile et l'écriture de la demande : une ligne `attendue` par fichier,
 *      une clé TEMPORAIRE tirée au hasard par le serveur, une URL `PUT` signée
 *      (10 min, longueur exacte imposée) et un jeton d'envoi. Le navigateur ne
 *      choisit ni la clé, ni la taille, ni le compartiment.
 *   3. Le navigateur envoie chaque fichier sur son URL.
 *   4. `finaliserPiecesJointes` — sur présentation du jeton : taille réelle
 *      (`HEAD`), signature (début du fichier par `Range`), répertoire central
 *      d'un Office récent (par `Range`), puis un passage en flux pour
 *      l'antivirus et l'empreinte. Accepté → copié sous la clé définitive (à
 *      `ETag` constant) ; refusé → supprimé. L'objet temporaire est supprimé
 *      dans les deux cas.
 *
 * Une ligne n'est contrôlée qu'UNE fois : le passage `attendue` → `controle`
 * est atomique (`updateMany`), et l'objet n'est jamais relu après. Un second
 * `PUT` sur la même URL ne produit qu'un objet orphelin, que personne ne lit et
 * que le nettoyage retire à 24 h.
 *
 * 🔑 Aucune demande n'est perdue à cause d'un fichier : la demande est en base
 * AVANT qu'une seule URL soit délivrée, et toute panne ici se lit « pièce non
 * reçue », jamais « demande refusée ».
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import {
  ObjetR2Modifie,
  copierObjetR2,
  deleteFromR2,
  enteteObjetR2,
  fluxObjetGeneralR2,
  isR2Configured,
  lirePlageObjetR2,
  listerObjetsR2,
  signerEnvoiDirectR2,
} from "@/lib/r2-storage";
import {
  CHAMP_PIECES_ANNONCEES,
  MESSAGES_PIECES_JOINTES,
  NOMBRE_MAX_PIECES,
  ScruteurPieceJointe,
  TAILLE_ENTETE_ANALYSEE,
  TAILLE_FIN_ZIP_ANALYSEE,
  TAILLE_MAX_PIECE_OCTETS,
  TAILLE_MAX_REPERTOIRE_ZIP,
  TYPE_ENVOI_PIECE_JOINTE,
  analyserEntetePieceJointe,
  analyserRepertoirePieceJointe,
  assainirNomPieceJointe,
  controlerListePiecesJointes,
  demandeRepertoireZip,
  formatDepuisExtension,
  localiserRepertoireZip,
  nomsRepertoireZip,
  type FormatPieceJointe,
  type MotifRefus,
} from "@/lib/contact/pieces-jointes";
import { analyserFlux, type VerdictAntivirus } from "@/server/careers/clamav";

/** Préfixe des objets pas encore contrôlés. Rien d'autre ne s'y range. */
export const PREFIXE_TEMPORAIRE = "contact/pieces-temporaires/";
/** Durée de vie d'une URL d'envoi. Le délai court au DÉBUT du `PUT`, pas à sa fin. */
export const TTL_URL_ENVOI_S = 10 * 60;
/** Une ligne restée `attendue` au-delà : envoi abandonné, le nettoyage la reprend. */
export const DELAI_ABANDON_MS = 60 * 60 * 1000;
/** Un objet temporaire plus vieux est supprimé, quoi qu'il arrive. */
export const DELAI_NETTOYAGE_TEMPORAIRES_MS = 24 * 60 * 60 * 1000;
/** Délai de l'antivirus par fichier. Au-delà, la pièce passe « non vérifiée ». */
const DELAI_ANTIVIRUS_MS = 20_000;

export type Antivirus = (
  flux: AsyncIterable<Uint8Array>,
  delaiMs: number,
) => Promise<VerdictAntivirus>;

// ---- 1. L'annonce ----------------------------------------------------------

export interface PieceAnnoncee {
  readonly nom: string;
  readonly taille: number;
  readonly format: FormatPieceJointe;
}

export interface AnnoncePiecesJointes {
  /** Les fichiers acceptés à l'annonce (vide si refus). */
  readonly pieces: ReadonlyArray<PieceAnnoncee>;
  /** Nombre de fichiers annoncés, acceptés ou non. */
  readonly nombre: number;
  /** Le premier refus, ou `null`. */
  readonly refus: string | null;
}

/**
 * L'annonce des fichiers (`[{ nom, taille }]` en JSON). Sans annonce : rien ne
 * change. Une annonce illisible ou hors limites ne fait PAS échouer la demande :
 * ses fichiers seront « non reçus ».
 */
export function lireAnnoncePiecesJointes(formData: FormData): AnnoncePiecesJointes {
  const brut = formData.get(CHAMP_PIECES_ANNONCEES);
  if (typeof brut !== "string" || brut.length === 0) return { pieces: [], nombre: 0, refus: null };
  let liste: unknown;
  try {
    liste = brut.length <= 4096 ? JSON.parse(brut) : null;
  } catch {
    liste = null;
  }
  if (!Array.isArray(liste)) {
    return { pieces: [], nombre: 1, refus: MESSAGES_PIECES_JOINTES.nombre };
  }
  const nombre = Math.min(liste.length, 10);
  if (liste.length === 0) return { pieces: [], nombre: 0, refus: null };
  const pieces: PieceAnnoncee[] = [];
  for (const e of liste.slice(0, NOMBRE_MAX_PIECES + 1)) {
    const nom = (e as { nom?: unknown })?.nom;
    const taille = (e as { taille?: unknown })?.taille;
    if (typeof nom !== "string" || nom.length > 255 || !Number.isSafeInteger(taille)) {
      return { pieces: [], nombre, refus: MESSAGES_PIECES_JOINTES.nombre };
    }
    const propre = assainirNomPieceJointe(nom);
    const format = formatDepuisExtension(propre);
    pieces.push({ nom: propre, taille: taille as number, format: format ?? "txt" });
  }
  const refus =
    liste.length > NOMBRE_MAX_PIECES
      ? MESSAGES_PIECES_JOINTES.nombre
      : controlerListePiecesJointes(pieces.map((p) => ({ name: p.nom, size: p.taille })));
  return refus ? { pieces: [], nombre, refus } : { pieces, nombre, refus: null };
}

// ---- 2. Les URL d'envoi ----------------------------------------------------

/** Clé TEMPORAIRE : le jour, un identifiant aléatoire. Ni nom, ni extension, ni demande. */
export function cleTemporairePieceJointe(maintenant: Date): string {
  return `${PREFIXE_TEMPORAIRE}${maintenant.toISOString().slice(0, 10)}/${randomUUID()}`;
}

/** Clé DÉFINITIVE : année, demande, identifiant aléatoire. Le nom fourni n'y entre pas. */
export function clePieceJointe(
  submissionId: string,
  format: FormatPieceJointe,
  date: Date,
): string {
  return `contact/pieces-jointes/${date.getUTCFullYear()}/${submissionId}/${randomUUID()}.${format}`;
}

export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export interface EnvoiPieceJointe {
  /** Identifiant de la pièce : le navigateur s'en sert pour lire son issue. */
  readonly id: string;
  readonly url: string;
  readonly taille: number;
}

export interface EnvoisOuverts {
  /** Jeton d'envoi, rendu au navigateur ; seule son empreinte est en base. */
  readonly jeton: string;
  /** Dans l'ordre de l'annonce. */
  readonly envois: ReadonlyArray<EnvoiPieceJointe>;
}

/**
 * Une ligne `attendue` et une URL `PUT` par fichier annoncé. À n'appeler
 * qu'APRÈS les contrôles de l'action et l'écriture de la demande. Lève si la
 * table ou R2 ne répondent pas : l'appelant compte alors les pièces « non
 * reçues », et la demande reste.
 */
export async function ouvrirEnvoisPiecesJointes(
  submissionId: string,
  pieces: ReadonlyArray<PieceAnnoncee>,
  maintenant: Date = new Date(),
): Promise<EnvoisOuverts> {
  const jeton = randomBytes(32).toString("base64url");
  const jetonHash = empreinteJeton(jeton);
  const lignes = pieces.map((p) => ({
    id: randomUUID(),
    submissionId,
    nomFichier: p.nom,
    format: p.format,
    tailleOctets: p.taille,
    cleStockage: cleTemporairePieceJointe(maintenant),
    statut: "attendue",
    jetonHash,
  }));
  // Signer d'abord (calcul hors ligne) : aucune ligne écrite pour une URL impossible.
  const urls = await Promise.all(
    lignes.map((l) =>
      signerEnvoiDirectR2(l.cleStockage, l.tailleOctets, TYPE_ENVOI_PIECE_JOINTE, TTL_URL_ENVOI_S),
    ),
  );
  await prisma.submissionAttachment.createMany({ data: lignes });
  return {
    jeton,
    envois: lignes.map((l, i) => ({ id: l.id, url: urls[i]!, taille: l.tailleOctets })),
  };
}

// ---- 4. Le contrôle --------------------------------------------------------

interface LigneAControler {
  readonly id: string;
  readonly submissionId: string;
  readonly nomFichier: string;
  readonly format: string;
  readonly tailleOctets: number;
  readonly cleStockage: string;
  readonly createdAt: Date;
}

export type VerdictObjet =
  | {
      readonly statut: "recue";
      readonly format: FormatPieceJointe;
      readonly mime: string;
      readonly etag: string;
      readonly sha256: string;
      readonly antivirus: "sain" | "non_verifie";
    }
  | { readonly statut: "refusee"; readonly motif: MotifRefus | "taille" | "infecte" }
  | { readonly statut: "non_recue" };

/** Lit le flux complet une fois : empreinte, et contrôles qui demandent tout le fichier. */
async function parcourir(
  cle: string,
  etag: string,
  format: FormatPieceJointe,
  antivirus: Antivirus | null,
): Promise<{
  sha256: string;
  lus: number;
  scruteur: ScruteurPieceJointe;
  verdict: VerdictAntivirus | null;
}> {
  const source = await fluxObjetGeneralR2(cle, etag);
  const hash = createHash("sha256");
  const scruteur = new ScruteurPieceJointe(format);
  let lus = 0;
  async function* observe(): AsyncGenerator<Uint8Array> {
    for await (const m of source) {
      hash.update(m);
      scruteur.pousser(m);
      lus += m.byteLength;
      yield m;
    }
  }
  let verdict: VerdictAntivirus | null = null;
  if (antivirus) {
    verdict = await antivirus(observe(), DELAI_ANTIVIRUS_MS).catch((): VerdictAntivirus => ({
      issue: "indisponible",
      raison: "erreur",
    }));
  } else {
    for await (const _ of observe()) {
      // lecture seule : empreinte et scruteur
    }
  }
  // Un antivirus muet n'a rien lu : le flux est refermé, l'appelant relit.
  (source as { destroy?: () => void }).destroy?.();
  return { sha256: hash.digest("hex"), lus, scruteur, verdict };
}

/**
 * Le contrôle d'UN objet temporaire. Ne modifie rien : rend un verdict.
 * `ObjetR2Modifie` (l'objet a changé entre deux lectures) se lit « refusé ».
 */
export async function verifierObjetTemporaire(
  ligne: Pick<LigneAControler, "nomFichier" | "tailleOctets" | "cleStockage">,
  antivirus: Antivirus = analyserFlux,
): Promise<VerdictObjet> {
  const { nomFichier: nom, cleStockage: cle } = ligne;
  try {
    const tete = await enteteObjetR2(cle);
    if (!tete) return { statut: "non_recue" };
    // La longueur était signée : un écart veut dire qu'on ne parle pas du même fichier.
    if (tete.taille !== ligne.tailleOctets || tete.taille > TAILLE_MAX_PIECE_OCTETS) {
      return { statut: "refusee", motif: "taille" };
    }
    const debut = await lirePlageObjetR2(cle, `bytes=0-${TAILLE_ENTETE_ANALYSEE - 1}`, tete.etag);
    const entete = analyserEntetePieceJointe(nom, debut);
    if (!entete.ok) return { statut: "refusee", motif: entete.motif };

    if (demandeRepertoireZip(entete.format)) {
      const lgFin = Math.min(TAILLE_FIN_ZIP_ANALYSEE, tete.taille);
      const fin = await lirePlageObjetR2(cle, `bytes=-${lgFin}`, tete.etag);
      const plage = localiserRepertoireZip(fin, tete.taille);
      let noms: string[] | null = null;
      if (plage && plage.taille <= TAILLE_MAX_REPERTOIRE_ZIP) {
        const decalageFin = tete.taille - fin.length;
        const repertoire =
          plage.debut >= decalageFin
            ? fin.subarray(plage.debut - decalageFin, plage.debut - decalageFin + plage.taille)
            : await lirePlageObjetR2(
                cle,
                `bytes=${plage.debut}-${plage.debut + plage.taille - 1}`,
                tete.etag,
              );
        noms = nomsRepertoireZip(repertoire);
      }
      const r = analyserRepertoirePieceJointe(nom, entete.format, noms);
      if (!r.ok) return { statut: "refusee", motif: r.motif };
    }

    let lecture = await parcourir(cle, tete.etag, entete.format, antivirus);
    if (lecture.verdict?.issue === "infecte") return { statut: "refusee", motif: "infecte" };
    if (lecture.lus !== tete.taille) {
      // Antivirus muet ou arrêté en route : seconde lecture, pour l'empreinte seule.
      lecture = {
        ...(await parcourir(cle, tete.etag, entete.format, null)),
        verdict: lecture.verdict,
      };
    }
    if (lecture.lus !== tete.taille) return { statut: "non_recue" };
    const final = lecture.scruteur.verdict(nom);
    if (!final.ok) return { statut: "refusee", motif: final.motif };
    return {
      statut: "recue",
      format: entete.format,
      mime: entete.mime,
      etag: tete.etag,
      sha256: lecture.sha256,
      antivirus: lecture.verdict?.issue === "sain" ? "sain" : "non_verifie",
    };
  } catch (err) {
    if (err instanceof ObjetR2Modifie) return { statut: "refusee", motif: "contenu" };
    throw err;
  }
}

async function supprimerSansBruit(cle: string): Promise<void> {
  try {
    await deleteFromR2(cle);
  } catch (err) {
    // Un objet temporaire qui résiste : le nettoyage des 24 h le reprend.
    Sentry.captureException(err, { tags: { step: "pieces-jointes", motif: "suppression" } });
  }
}

/** Contrôle une ligne passée `controle`, puis la range (reçue, refusée ou non reçue). */
async function controlerEtRanger(ligne: LigneAControler, antivirus: Antivirus): Promise<void> {
  let verdict: VerdictObjet;
  try {
    verdict = await verifierObjetTemporaire(ligne, antivirus);
  } catch (err) {
    Sentry.captureException(err, { tags: { step: "pieces-jointes", motif: "controle" } });
    verdict = { statut: "non_recue" };
  }

  if (verdict.statut === "recue") {
    const definitive = clePieceJointe(ligne.submissionId, verdict.format, ligne.createdAt);
    try {
      await copierObjetR2(ligne.cleStockage, definitive, verdict.etag, verdict.mime);
      await prisma.submissionAttachment.update({
        where: { id: ligne.id },
        data: {
          statut: "recue",
          cleStockage: definitive,
          format: verdict.format,
          sha256: verdict.sha256,
          antivirus: verdict.antivirus,
        },
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { step: "pieces-jointes", motif: "rangement" } });
      const refus = err instanceof ObjetR2Modifie;
      await prisma.submissionAttachment
        .update({
          where: { id: ligne.id },
          data: refus ? { statut: "refusee", motifRefus: "contenu" } : { statut: "non_recue" },
        })
        .catch(() => undefined);
      await supprimerSansBruit(definitive);
    }
  } else {
    await prisma.submissionAttachment.update({
      where: { id: ligne.id },
      data:
        verdict.statut === "refusee"
          ? { statut: "refusee", motifRefus: verdict.motif }
          : { statut: "non_recue" },
    });
  }
  await supprimerSansBruit(ligne.cleStockage);
}

const SELECTION_CONTROLE = {
  id: true,
  submissionId: true,
  nomFichier: true,
  format: true,
  tailleOctets: true,
  cleStockage: true,
  createdAt: true,
} as const;

export interface IssuePiece {
  readonly id: string;
  readonly statut: "recue" | "refusee" | "non_recue" | "en_cours";
  /** Le message à montrer à la personne, si la pièce n'est pas reçue. */
  readonly message?: string;
}

function messageRefus(nom: string, motif: string | null): string {
  switch (motif) {
    case "format":
      return MESSAGES_PIECES_JOINTES.format(nom);
    case "macros":
      return MESSAGES_PIECES_JOINTES.macros(nom);
    case "contenu":
      return MESSAGES_PIECES_JOINTES.contenu(nom);
    case "infecte":
      return MESSAGES_PIECES_JOINTES.infecte(nom);
    default:
      return MESSAGES_PIECES_JOINTES.nonRecue(nom);
  }
}

export function issueDeLigne(l: {
  id: string;
  nomFichier: string;
  statut: string;
  motifRefus: string | null;
}): IssuePiece {
  if (l.statut === "recue") return { id: l.id, statut: "recue" };
  if (l.statut === "refusee") {
    return { id: l.id, statut: "refusee", message: messageRefus(l.nomFichier, l.motifRefus) };
  }
  if (l.statut === "non_recue") {
    return {
      id: l.id,
      statut: "non_recue",
      message: MESSAGES_PIECES_JOINTES.nonRecue(l.nomFichier),
    };
  }
  return { id: l.id, statut: "en_cours" };
}

export interface BilanFinalisation {
  readonly pieces: ReadonlyArray<IssuePiece>;
  /** `true` si CET appel a contrôlé les pièces (donc doit faire partir l'accusé). */
  readonly controlees: boolean;
}

/**
 * Fin d'envoi, sur présentation du jeton. Idempotent : un second appel rend
 * l'issue déjà rangée sans rien relire.
 */
export async function finaliserPiecesJointes(
  submissionId: string,
  jeton: string,
  antivirus: Antivirus = analyserFlux,
): Promise<BilanFinalisation> {
  const jetonHash = empreinteJeton(jeton);
  const pris = await prisma.submissionAttachment.updateMany({
    where: { submissionId, jetonHash, statut: "attendue" },
    data: { statut: "controle" },
  });
  if (pris.count > 0) {
    const lignes = await prisma.submissionAttachment.findMany({
      where: { submissionId, jetonHash, statut: "controle" },
      select: SELECTION_CONTROLE,
    });
    await Promise.all(lignes.map((l) => controlerEtRanger(l, antivirus)));
  }
  const toutes = await prisma.submissionAttachment.findMany({
    where: { submissionId, jetonHash },
    select: { id: true, nomFichier: true, statut: true, motifRefus: true },
  });
  return { pieces: toutes.map(issueDeLigne), controlees: pris.count > 0 };
}

// ---- Nettoyage (tâche horaire du worker) ------------------------------------

export interface BilanNettoyage {
  /** Demandes dont les envois abandonnés ont été repris (et l'accusé envoyé). */
  readonly demandesReprises: number;
  readonly temporairesSupprimes: number;
}

/**
 * La passe horaire :
 *   1. les lignes `controle` depuis plus d'une heure (contrôle interrompu) →
 *      `non_recue` ;
 *   2. les lignes `attendue` depuis plus d'une heure (onglet fermé, fin d'envoi
 *      jamais arrivée) → contrôlées comme le navigateur l'aurait demandé —
 *      l'objet a pu arriver —, puis l'accusé différé part ;
 *   3. les objets du préfixe temporaire de plus de 24 h → supprimés. Ce ne
 *      sont que des fichiers jamais acceptés : une pièce reçue a déjà quitté
 *      ce préfixe.
 */
export async function nettoyerPiecesJointesContact(
  maintenant: Date = new Date(),
  deps: {
    antivirus?: Antivirus;
    accuse?: (submissionId: string) => Promise<unknown>;
  } = {},
): Promise<BilanNettoyage> {
  if (!isR2Configured()) return { demandesReprises: 0, temporairesSupprimes: 0 };
  const antivirus = deps.antivirus ?? analyserFlux;
  const accuse =
    deps.accuse ??
    (async (id: string) => (await import("./accuse-contact")).envoyerAccuseDiffere(id));
  const limite = new Date(maintenant.getTime() - DELAI_ABANDON_MS);

  const bloquees = await prisma.submissionAttachment.findMany({
    where: { statut: "controle", createdAt: { lt: limite } },
    select: { id: true, submissionId: true },
    take: 200,
  });
  if (bloquees.length > 0) {
    await prisma.submissionAttachment.updateMany({
      where: { id: { in: bloquees.map((b) => b.id) }, statut: "controle" },
      data: { statut: "non_recue" },
    });
  }

  const abandonnees = await prisma.submissionAttachment.findMany({
    where: { statut: "attendue", createdAt: { lt: limite } },
    select: { submissionId: true },
    distinct: ["submissionId"],
    take: 50,
  });
  const reprises = new Set(bloquees.map((b) => b.submissionId));
  for (const { submissionId } of abandonnees) {
    const pris = await prisma.submissionAttachment.updateMany({
      where: { submissionId, statut: "attendue", createdAt: { lt: limite } },
      data: { statut: "controle" },
    });
    if (pris.count === 0) continue;
    const lignes = await prisma.submissionAttachment.findMany({
      where: { submissionId, statut: "controle" },
      select: SELECTION_CONTROLE,
    });
    await Promise.all(lignes.map((l) => controlerEtRanger(l, antivirus)));
    reprises.add(submissionId);
  }
  for (const id of reprises) {
    try {
      await accuse(id);
    } catch (err) {
      Sentry.captureException(err, { tags: { step: "pieces-jointes", motif: "accuse-differe" } });
    }
  }

  let temporairesSupprimes = 0;
  const seuil = maintenant.getTime() - DELAI_NETTOYAGE_TEMPORAIRES_MS;
  let suite: string | undefined;
  for (let page = 0; page < 20; page++) {
    const r = await listerObjetsR2(PREFIXE_TEMPORAIRE, suite);
    for (const o of r.objets) {
      if (!o.cle.startsWith(PREFIXE_TEMPORAIRE)) continue;
      if (o.modifieLe && o.modifieLe.getTime() < seuil) {
        await supprimerSansBruit(o.cle);
        temporairesSupprimes += 1;
      }
    }
    if (!r.suite) break;
    suite = r.suite;
  }
  return { demandesReprises: reprises.size, temporairesSupprimes };
}

// ---- Console et effacements -------------------------------------------------

/**
 * Les pièces d'une demande, pour la fiche admin. Rend `[]` si la table n'est
 * pas lisible (migration pas encore jouée) : la fiche s'affiche quand même.
 */
export async function listerPiecesJointes(submissionId: string): Promise<
  ReadonlyArray<{
    id: string;
    nomFichier: string;
    format: string;
    tailleOctets: number;
    statut: string;
    motifRefus: string | null;
    antivirus: string | null;
    createdAt: Date;
  }>
> {
  try {
    return await prisma.submissionAttachment.findMany({
      where: { submissionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nomFichier: true,
        format: true,
        tailleOctets: true,
        statut: true,
        motifRefus: true,
        antivirus: true,
        createdAt: true,
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { step: "pieces-jointes", motif: "lecture" } });
    return [];
  }
}

/**
 * Les clés R2 des pièces d'une demande — lues AVANT de la supprimer. Toutes les
 * lignes, quel que soit leur statut : une clé encore temporaire désigne un
 * objet que la personne a pu envoyer.
 */
export async function clesPiecesJointes(submissionId: string): Promise<string[]> {
  try {
    const lignes = await prisma.submissionAttachment.findMany({
      where: { submissionId },
      select: { cleStockage: true },
    });
    return lignes.map((l) => l.cleStockage);
  } catch {
    return [];
  }
}

/** Retire des objets R2 (après la suppression de leurs lignes). Best-effort. */
export async function supprimerObjetsPiecesJointes(cles: ReadonlyArray<string>): Promise<void> {
  for (const cle of cles) await supprimerSansBruit(cle);
}
