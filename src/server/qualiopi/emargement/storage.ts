/**
 * Qualiopi T13 — Stockage de l'image de signature.
 *
 * 🔴 CE MODULE LÈVE. C'est sa raison d'être (oubli O5 du plan).
 *
 * Le précédent maison `storeAndSignPdf` / `storeAndSignCsv` retourne `null` quand
 * R2 n'est pas configuré, et l'appelant continue : acceptable pour une URL de
 * confort, inacceptable ici. Une signature dont l'image n'a pas été écrite est
 * une preuve qui n'existe pas — le stagiaire aurait vu « signé », le contrôle ne
 * trouverait rien. Il n'y a pas de demi-succès possible : soit l'objet est écrit
 * et son empreinte connue, soit la signature ne doit PAS être enregistrée.
 *
 * Cette exigence est aussi ce qui impose l'ordre : écrire l'image d'ABORD,
 * insérer la ligne ENSUITE. Un objet R2 orphelin (écrit puis transaction
 * annulée) est un déchet ; une ligne sans objet est un mensonge.
 *
 * ⚠️ Sentry est absent de tout le domaine Qualiopi (0 occurrence avant ce
 * fichier). Un échec de stockage est précisément ce qu'on ne peut pas se
 * permettre de découvrir dans six mois, à l'audit.
 *
 * ## RGPD — pourquoi la ré-encodage n'est pas cosmétique
 *
 * La CNIL qualifie la « dynamique de tracé » (pression, timing, inclinaison) de
 * caractéristique biométrique COMPORTEMENTALE, donc art. 9 : interdiction de
 * principe. Le tracé rasterisé, lui, reste une donnée personnelle ordinaire
 * (art. 6). Le client a déjà l'obligation d'écarter `pressure` / `timeStamp` /
 * `tiltX` / `tiltY` avant transmission, mais une promesse côté client n'est pas
 * une garantie : un PNG peut transporter ces mêmes données dans un chunk `tEXt`
 * ou `iTXt` ajouté par un appelant malveillant ou négligent.
 *
 * Le passage par `sharp` re-encode les pixels et ne recopie AUCUNE métadonnée
 * (aucun `withMetadata()` ici, volontairement) : ce qui sort est le tracé, et
 * rien d'autre. C'est la frontière art. 6 / art. 9 rendue exécutable côté
 * serveur, pas seulement documentée.
 *
 * Node runtime (sharp + R2).
 */

import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import * as Sentry from "@sentry/nextjs";
import { isR2Configured, uploadToR2, deleteFromR2, existsInR2 } from "@/lib/r2-storage";
import { parisDateISO } from "@/server/qualiopi/presence/time";

/** Types acceptés en ENTRÉE. Le PNG du canvas, le JPEG d'une photo de feuille papier. */
const MIMES_ENTREE_ACCEPTES = new Set(["image/png", "image/jpeg"]);

/**
 * Formats réellement acceptés, tels que RECONNUS PAR LE DÉCODEUR.
 *
 * ⚠️ Distinct de `MIMES_ENTREE_ACCEPTES` — et c'est tout l'intérêt. Le type d'une
 * data-URL est DÉCLARÉ par le client : `data:image/png;base64,<octets SVG>` est
 * trivial à fabriquer. Sans recoupement, refuser `image/svg+xml` dans l'en-tête
 * ne refuse rien du tout, et on rasteriserait du SVG non fiable via librsvg
 * depuis une route publique atteinte par simple jeton.
 */
const FORMATS_DECODES_ACCEPTES = new Set(["png", "jpeg"]);

/** Type de SORTIE, toujours. Un seul format à relire dans cinq ans. */
export const MIME_SIGNATURE = "image/png";

/**
 * Plafond de l'image décodée AVANT normalisation (2 Mio).
 *
 * Un tracé de canvas pèse quelques kilo-octets ; une photo de feuille papier
 * quelques centaines. 2 Mio laisse passer les deux et arrête un envoi qui n'est
 * pas une signature.
 */
export const TAILLE_MAX_ENTREE_OCTETS = 2 * 1024 * 1024;

/** Garde-fous de décodage : une image « décompression-bombe » ne doit pas passer. */
const LIMITES_SHARP = { limitInputPixels: 40_000_000, sequentialRead: true } as const;

/** Largeur de normalisation. Au-delà, on stocke du bruit de capteur, pas du tracé. */
const LARGEUR_MAX = 1200;
const HAUTEUR_MAX = 800;

export type EchecStockage =
  | "r2_absent"
  | "charge_utile_invalide"
  | "type_non_supporte"
  | "trop_volumineux"
  | "image_illisible"
  | "collision_de_cle"
  | "upload_echoue"
  | "suppression_echouee";

/**
 * Échec de stockage d'une signature. Porte un `motif` machine pour que
 * l'appelant distingue « le stagiaire a envoyé n'importe quoi » (400) de
 * « notre stockage est cassé » (500) — les deux ne se traitent pas pareil.
 */
export class SignatureStockageError extends Error {
  readonly motif: EchecStockage;
  /** True si la faute est côté client : l'appelant doit répondre 4xx, pas 5xx. */
  readonly imputableAuClient: boolean;

  constructor(motif: EchecStockage, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SignatureStockageError";
    this.motif = motif;
    this.imputableAuClient =
      motif === "charge_utile_invalide" ||
      motif === "type_non_supporte" ||
      motif === "trop_volumineux" ||
      motif === "image_illisible";
  }
}

export interface ImageSignatureStockee {
  /** Clé R2. Immuable : une correction crée un NOUVEL objet, n'écrase jamais l'ancien. */
  key: string;
  /** SHA-256 hex de l'objet RÉELLEMENT écrit — c'est lui qui entre dans le tuple signé. */
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  /** Identifiant partagé avec la ligne de signature : la clé R2 en dérive. */
  id: string;
}

/** Famille d'objet, pour ranger R2 lisiblement à l'audit. */
export type GenreSignature = "signatures" | "contresignatures";

/**
 * Décode une data-URL `data:image/png;base64,…`.
 *
 * ⚠️ Ce filtre ne porte que sur le type DÉCLARÉ, et un type déclaré ne prouve
 * rien : il écarte `data:image/svg+xml` mais laisse évidemment passer
 * `data:image/png;base64,<octets SVG>`. Le refus qui compte est celui de
 * `normaliserImageSignature`, qui recoupe le format réellement décodé. Ne pas
 * lire cette fonction comme une défense.
 */
export function decoderDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const separateur = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || separateur === -1) {
    throw new SignatureStockageError(
      "charge_utile_invalide",
      "La signature transmise n'est pas une data-URL.",
    );
  }
  const entete = dataUrl.slice(5, separateur);
  if (!entete.endsWith(";base64")) {
    throw new SignatureStockageError(
      "charge_utile_invalide",
      "La signature transmise n'est pas encodée en base64.",
    );
  }
  const mime = entete.slice(0, -";base64".length).toLowerCase();
  if (!MIMES_ENTREE_ACCEPTES.has(mime)) {
    throw new SignatureStockageError(
      "type_non_supporte",
      `Type d'image non accepté pour une signature : ${mime}.`,
    );
  }

  // Plafond estimé AVANT de décoder : `Buffer.from(…, "base64")` allouerait
  // sinon la totalité en mémoire pour la refuser juste après. Le base64 pèse
  // 4/3 de l'octet utile.
  const octetsEstimes = ((dataUrl.length - separateur - 1) * 3) / 4;
  if (octetsEstimes > TAILLE_MAX_ENTREE_OCTETS) {
    throw new SignatureStockageError(
      "trop_volumineux",
      `Image de signature trop volumineuse (maximum ${TAILLE_MAX_ENTREE_OCTETS} octets).`,
    );
  }

  const buffer = Buffer.from(dataUrl.slice(separateur + 1), "base64");
  if (buffer.byteLength === 0) {
    throw new SignatureStockageError("charge_utile_invalide", "Image de signature vide.");
  }
  if (buffer.byteLength > TAILLE_MAX_ENTREE_OCTETS) {
    throw new SignatureStockageError(
      "trop_volumineux",
      `Image de signature trop volumineuse (${buffer.byteLength} octets, maximum ${TAILLE_MAX_ENTREE_OCTETS}).`,
    );
  }
  return { mime, buffer };
}

/**
 * Re-encode le tracé en PNG nu : redimensionné si besoin, SANS aucune métadonnée.
 *
 * Trois gestes, dans cet ordre, et aucun n'est décoratif :
 *
 * 1. **Recoupement du format RÉEL** avec ce que le décodeur reconnaît, et non
 *    avec le type que le client a bien voulu déclarer (cf.
 *    `FORMATS_DECODES_ACCEPTES`). C'est ici, et nulle part ailleurs, qu'un SVG
 *    déguisé en `image/png` est arrêté.
 * 2. **`rotate()` sans argument = auto-orientation.** Indispensable pour le
 *    repli papier (D11) : tout téléphone pose `Orientation=6` ou `8` dans l'EXIF,
 *    et `sharp` SUPPRIME cet EXIF sans l'APPLIQUER. Sans ce geste, la photo de la
 *    feuille signée est archivée couchée — définitivement, le marqueur ayant
 *    disparu — et le redimensionnement travaillerait sur le mauvais axe.
 * 3. **`withoutEnlargement`** : agrandir un tracé de 300 px n'ajoute pas
 *    d'information, seulement du poids à conserver cinq ans.
 */
export async function normaliserImageSignature(entree: Buffer): Promise<Buffer> {
  const image = sharp(entree, LIMITES_SHARP);

  let format: string | undefined;
  try {
    format = (await image.metadata()).format;
  } catch (err) {
    throw new SignatureStockageError(
      "image_illisible",
      "Image de signature illisible ou corrompue.",
      { cause: err },
    );
  }

  if (format === undefined || !FORMATS_DECODES_ACCEPTES.has(format)) {
    throw new SignatureStockageError(
      "type_non_supporte",
      `Le contenu transmis n'est pas une image PNG ou JPEG (format détecté : ${format ?? "inconnu"}).`,
    );
  }

  try {
    return await image
      .rotate()
      .resize({ width: LARGEUR_MAX, height: HAUTEUR_MAX, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (err) {
    throw new SignatureStockageError(
      "image_illisible",
      "Image de signature illisible ou corrompue.",
      { cause: err },
    );
  }
}

/**
 * Clé R2 d'une image de signature.
 *
 * Partitionnée par année pour que les règles de cycle de vie R2 et la purge
 * RGPD des cinq ans puissent travailler par préfixe, sans lister le bucket.
 *
 * ⚠️ L'année est celle du calendrier de PARIS, jamais UTC. Une signature apposée
 * le 1ᵉʳ janvier à 00 h 30 (Paris) tombe le 31 décembre en UTC : rangée sur le
 * mauvais préfixe, son image serait purgée une année entière avant l'échéance
 * des cinq ans. Tout le reste du domaine présence raisonne déjà en heure de
 * Paris (`presence/time.ts`).
 */
export function cleImageSignature(genre: GenreSignature, annee: number, id: string): string {
  return `emargement/${annee}/${genre}/${id}.png`;
}

/** Année civile PARIS d'un instant. */
function anneeParis(d: Date): number {
  return Number(parisDateISO(d).slice(0, 4));
}

/** Un identifiant de clé R2 doit être un UUID : rien d'autre ne doit pouvoir composer un chemin. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Écrit l'image de signature sur R2 et retourne son empreinte.
 *
 * 🔴 LÈVE toujours en cas d'échec — voir l'en-tête du fichier. Ne jamais
 * l'envelopper dans un `catch` qui poursuit : l'appelant doit refuser
 * d'enregistrer la signature.
 *
 * L'empreinte porte sur le buffer NORMALISÉ, celui qui part réellement sur R2.
 * Hacher l'entrée brute rendrait la vérification impossible : l'objet relu ne
 * correspondrait jamais à son hash.
 *
 * @param dataUrl  Charge utile `data:image/png;base64,…` produite par le client.
 * @param genre    Range l'objet dans R2 (stagiaire ou formateur).
 * @param signeAt  Détermine l'année de partition, en calendrier PARIS — pas
 *                 `new Date()`, pour qu'un archivage tardif ne range pas une
 *                 signature sous l'année où on l'a traitée.
 * @param id       UUID de la future ligne. Fourni par l'appelant, qui le
 *                 réutilise comme clé primaire : sans cela, l'objet et la ligne
 *                 seraient rattachés par rien. Refusé s'il n'est pas un UUID —
 *                 rien d'autre ne doit pouvoir composer un chemin R2.
 */
export async function storeSignatureImage(input: {
  dataUrl: string;
  genre: GenreSignature;
  signeAt: Date;
  id?: string;
}): Promise<ImageSignatureStockee> {
  // Validation d'abord : inutile de constater l'absence de R2 si la charge utile
  // n'est de toute façon pas une image.
  const { buffer: brut } = decoderDataUrl(input.dataUrl);
  const normalise = await normaliserImageSignature(brut);

  if (!isR2Configured()) {
    // ⚠️ Le précédent maison retourne `null` ici. Pas nous : sans stockage, la
    // preuve n'existe pas, et la seule issue honnête est de refuser la signature.
    const err = new SignatureStockageError(
      "r2_absent",
      "Stockage R2 non configuré : impossible d'enregistrer une signature sans conserver son image.",
    );
    Sentry.captureException(err, { tags: { action: "storeSignatureImage:r2_absent" } });
    throw err;
  }

  const id = input.id ?? randomUUID();
  if (!UUID_RE.test(id)) {
    throw new SignatureStockageError(
      "charge_utile_invalide",
      "L'identifiant d'une image de signature doit être un UUID.",
    );
  }
  const key = cleImageSignature(input.genre, anneeParis(input.signeAt), id);
  const sha256 = createHash("sha256").update(normalise).digest("hex");

  // 🔴 `PutObject` ÉCRASE. Sans ce garde-fou, un appelant qui retente après un
  // échec d'insertion en base — avec le même identifiant, ce qui est le
  // comportement naturel d'une reprise — remplacerait l'objet d'une signature
  // déjà enregistrée. Son `signatureSha256`, scellé dans `selfHash` et présenté
  // comme « le seul moyen de détecter une substitution », ne correspondrait plus
  // à l'octet stocké. Et `verifierChaine` ne relit jamais R2 : la substitution
  // serait définitive ET indétectable.
  if (await existsInR2(key)) {
    const err = new SignatureStockageError(
      "collision_de_cle",
      "Une image de signature existe déjà sous cette clé : l'écraser détruirait une preuve.",
    );
    Sentry.captureException(err, {
      tags: { action: "storeSignatureImage:collision" },
      extra: { key },
    });
    throw err;
  }

  try {
    await uploadToR2(key, normalise, MIME_SIGNATURE, {
      // Métadonnées d'OBJET R2 (hors image) : permettent de recouper un objet
      // isolé avec sa ligne sans requête, si la base venait à manquer.
      sha256,
      signeAt: input.signeAt.toISOString(),
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "storeSignatureImage:upload" },
      extra: { key, sizeBytes: normalise.byteLength },
    });
    throw new SignatureStockageError(
      "upload_echoue",
      "Échec de l'écriture de l'image de signature sur le stockage.",
      { cause: err },
    );
  }

  return { key, sha256, mimeType: MIME_SIGNATURE, sizeBytes: normalise.byteLength, id };
}

/**
 * Supprime l'image d'une signature (purge RGPD, oubli O2).
 *
 * ⚠️ Ne supprime QUE l'image. La ligne de preuve survit : l'effacement porte sur
 * la donnée personnelle qu'est le tracé, pas sur le fait — opposable et fondé sur
 * une obligation légale — qu'une présence a été attestée. `imagePurgeeAt` garde
 * la trace de l'opération, et le `selfHash` reste vérifiable pour tout ce qui
 * n'est pas l'image.
 *
 * Lève si la suppression échoue : un effacement RGPD qu'on croit fait alors qu'il
 * ne l'est pas est pire que pas d'effacement du tout. R2 est idempotent sur une
 * clé absente, donc re-purger ne lève pas.
 */
export async function supprimerImageSignature(key: string): Promise<void> {
  if (!isR2Configured()) {
    const err = new SignatureStockageError(
      "r2_absent",
      "Stockage R2 non configuré : purge de l'image de signature impossible.",
    );
    Sentry.captureException(err, { tags: { action: "supprimerImageSignature:r2_absent" } });
    throw err;
  }
  try {
    await deleteFromR2(key);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "supprimerImageSignature" },
      extra: { key },
    });
    throw new SignatureStockageError(
      "suppression_echouee",
      "Échec de la suppression de l'image de signature sur le stockage.",
      { cause: err },
    );
  }
}
