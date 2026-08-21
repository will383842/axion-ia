/**
 * Console éditoriale — le stockage des médias (§5, critères 3 à 5 du lot 1).
 *
 * Module PUR : chemins, empreintes, validation. Aucune écriture disque ici —
 * elle vit dans l'action, qui n'est pas testable sans système de fichiers.
 * Tout ce qui DÉCIDE est ici, et se teste en une milliseconde.
 *
 * ── 🔴 La règle du §5, qui évite le mur ───────────────────────────────────
 *
 * > « Les rushes ne passent JAMAIS par l'outil. »
 *
 * Un épisode de podcast pèse ~90 Go en rushes, ~12 Go en livré. Sur un an,
 * 2,2 To contre 290 Go. Un outil qui hébergerait les rushes deviendrait
 * ingérable au sixième épisode. `emplacementExterne` désigne le volume de
 * montage ; `cheminObjet` ne porte QUE le livré.
 *
 * D'où le plafond de taille ci-dessous : il n'est pas une contrainte
 * technique, c'est la matérialisation de cette règle. Un fichier de 3 Go qui
 * arrive ici est un rush qui s'est trompé de porte.
 *
 * ── Le choix de volume, tranché par défaut ────────────────────────────────
 *
 * `EDITORIAL_STORAGE_PATH`, volume DÉDIÉ — et non celui de la banque
 * d'images, qui mélangerait deux domaines aux cycles de vie différents. Le
 * défaut suit la convention du dépôt : `/var/data/<domaine>` en production,
 * `public/<segment>` en développement pour que les fichiers soient servis
 * sans route dédiée.
 */

import path from "node:path";
import crypto from "node:crypto";

/** Segment public sous lequel les médias sont servis en développement. */
export const SEGMENT_URL = "/editorial-media";

/**
 * Racine de stockage.
 *
 * ⚠️ `?.trim() ||` et NON `??` — piège déjà documenté dans `image-bank` :
 * une variable DÉFINIE mais VIDE (le cas courant quand on déclare la clé sans
 * valeur dans un panneau de configuration) n'est pas `null`, donc `??` la
 * laisse passer et la racine devient la chaîne vide. Tous les fichiers
 * atterriraient alors à la racine du disque.
 */
export function racineStockage(): string {
  if (process.env.NODE_ENV === "production") {
    return process.env.EDITORIAL_STORAGE_PATH?.trim() || "/var/data/editorial-media";
  }
  return `public${SEGMENT_URL}`;
}

/** Types acceptés, par extension canonique. */
export const TYPES_ACCEPTES: Record<string, { extension: string; famille: string }> = {
  "image/jpeg": { extension: "jpg", famille: "image" },
  "image/png": { extension: "png", famille: "image" },
  "image/webp": { extension: "webp", famille: "image" },
  "image/avif": { extension: "avif", famille: "image" },
  "image/gif": { extension: "gif", famille: "image" },
  "application/pdf": { extension: "pdf", famille: "document" },
  "video/mp4": { extension: "mp4", famille: "video" },
  "video/quicktime": { extension: "mov", famille: "video" },
  "video/webm": { extension: "webm", famille: "video" },
  "audio/mpeg": { extension: "mp3", famille: "audio" },
  "audio/wav": { extension: "wav", famille: "audio" },
};

/**
 * Plafond de taille, par famille.
 *
 * Volontairement BAS pour la vidéo : 500 Mo laisse passer un extrait ou un
 * short, pas un rush 4K multipiste. C'est le §5 rendu exécutable — le refus
 * dit d'ailleurs où le fichier doit aller à la place.
 */
export const PLAFONDS_MO: Record<string, number> = {
  image: 25,
  document: 100,
  video: 500,
  audio: 200,
};

export interface VerdictFichier {
  accepte: boolean;
  /** Message citant la règle. Vide si accepté. */
  message: string;
  extension?: string;
  famille?: string;
}

/**
 * Le fichier est-il recevable ?
 *
 * Le refus **dit pourquoi et quoi faire** : un « type non supporté » sec
 * laisse l'utilisateur deviner, et il réessaiera trois fois avec le même
 * fichier.
 */
export function validerFichier(typeMime: string, tailleOctets: number): VerdictFichier {
  const type = TYPES_ACCEPTES[typeMime];
  if (!type) {
    return {
      accepte: false,
      message:
        `Type « ${typeMime || "inconnu"} » non accepté. ` +
        `Formats reçus : ${[...new Set(Object.values(TYPES_ACCEPTES).map((t) => t.extension))].join(", ")}.`,
    };
  }

  const plafondMo = PLAFONDS_MO[type.famille] ?? 100;
  const tailleMo = tailleOctets / (1024 * 1024);
  if (tailleMo > plafondMo) {
    return {
      accepte: false,
      message:
        `Fichier de ${tailleMo.toFixed(0)} Mo pour un plafond de ${plafondMo} Mo. ` +
        (type.famille === "video"
          ? "Les rushes ne passent jamais par l'outil (§5) : renseignez plutôt " +
            "l'emplacement externe, qui désigne le volume de montage."
          : "Compressez le fichier avant de le déposer."),
    };
  }

  return { accepte: true, message: "", extension: type.extension, famille: type.famille };
}

/**
 * Empreinte du contenu — c'est elle qui détecte un doublon (critère 5).
 *
 * SHA-256 du CONTENU, pas du nom : « visuel-final.png » et
 * « visuel-final-2.png » identiques au bit près sont le même fichier, et le
 * critère dit « déposer deux fois le même fichier SIGNALE un doublon au lieu
 * de le dupliquer ». Un nom ne prouve rien.
 */
export function empreinte(contenu: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(contenu).digest("hex");
}

/**
 * Chemin de rangement d'un asset.
 *
 * Rangé par empreinte, en deux niveaux (`ab/cd…`) : un dossier plat de dix
 * mille fichiers devient illisible et lent à parcourir, et c'est la
 * convention de tous les stockages adressés par contenu.
 */
export function cheminRelatif(empreinteHex: string, extension: string): string {
  const a = empreinteHex.slice(0, 2);
  const b = empreinteHex.slice(2, 4);
  return `${a}/${b}/${empreinteHex}.${extension}`;
}

/** Chemin absolu sur le disque. */
export function cheminAbsolu(relatif: string): string {
  return path.join(racineStockage(), relatif);
}

/** URL publique servie au navigateur. */
export function urlPublique(relatif: string): string {
  return `${SEGMENT_URL}/${relatif}`;
}

/** Chemin de la vignette associée. */
export function cheminVignette(empreinteHex: string): string {
  const a = empreinteHex.slice(0, 2);
  const b = empreinteHex.slice(2, 4);
  return `${a}/${b}/${empreinteHex}-vignette.webp`;
}

/**
 * Nom lisible d'une archive de publication — critère 3.
 *
 * > « Une publication portant trois images télécharge une archive `.zip`
 * >   NOMMÉE LISIBLEMENT. »
 *
 * `pub-04-devis.zip` se retrouve dans un dossier de téléchargements ;
 * `archive.zip` non. On préfixe donc par la référence d'import quand elle
 * existe, et on ajoute quelques mots du titre.
 */
export function nomArchive(refImport: string | null, titre: string): string {
  const motsDuTitre = titre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 4)
    .join("-");

  // La référence d'import est le repère le plus court et le plus sûr :
  // « linkedin-2026-q4-04 » devient « pub-04 ».
  const numero = refImport?.match(/(\d+)$/)?.[1];
  const prefixe = numero ? `pub-${numero}` : "publication";

  return `${prefixe}${motsDuTitre ? `-${motsDuTitre}` : ""}.zip`;
}

/**
 * Nom d'un fichier À L'INTÉRIEUR de l'archive.
 *
 * Numéroté dans l'ordre d'affichage : celui qui décompresse retrouve l'ordre
 * voulu pour le carrousel, ce que l'empreinte SHA-256 ne dirait pas.
 */
export function nomDansArchive(ordre: number, libelle: string, extension: string): string {
  const propre = libelle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${String(ordre + 1).padStart(2, "0")}-${propre || "media"}.${extension}`;
}
