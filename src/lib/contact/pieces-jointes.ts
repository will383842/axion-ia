/**
 * Pièces jointes du formulaire de contact unifié (décision de Will, 2026-10-15).
 *
 * Origine : le 29/09, un organisme public a écrit « avec le cahier des charges
 * en pièce jointe » — le formulaire n'acceptait aucun fichier, le document
 * n'est jamais arrivé.
 *
 * Module PUR (aucun import d'exécution), IMPORTÉ PAR LE NAVIGATEUR : il ne porte
 * que les limites, la liste `accept`, les messages et le contrôle rapide
 * (nombre, taille, extension). Tout ce qui lit des OCTETS (signatures, macros,
 * répertoire ZIP, scruteur) est dans `server/contact/octets-pieces-jointes` :
 * ne l'y remettez pas, chaque octet de ce fichier part dans le JS de /contact.
 * Le type MIME annoncé par le navigateur n'est jamais lu : il se fabrique.
 */

/** 3 fichiers au plus. */
export const NOMBRE_MAX_PIECES = 3;
/**
 * 25 Mo par fichier, 50 Mo au total (décision de Will, 2026-10-15 : les cahiers
 * des charges avec plans ou photos dépassent souvent 10 Mo).
 *
 * 🔑 Ces fichiers ne traversent NI la Server Action, NI le proxy, NI Cloudflare
 * côté site : le navigateur les envoie DIRECTEMENT au compartiment R2, sur une
 * URL signée qui impose la longueur exacte (`server/contact/pieces-jointes.ts`).
 * `next.config.ts` (`bodySizeLimit`, `proxyClientMaxBodySize`) n'a donc pas à
 * suivre ces chiffres — et ne doit pas les suivre.
 */
export const TAILLE_MAX_PIECE_OCTETS = 25 * 1024 * 1024;
export const TAILLE_MAX_TOTALE_OCTETS = 50 * 1024 * 1024;

/** Champ du `FormData` qui ANNONCE les fichiers (nom et taille, jamais le contenu). */
export const CHAMP_PIECES_ANNONCEES = "piecesAnnoncees";

/**
 * Type envoyé par le navigateur sur l'URL signée, et signé avec elle. Neutre
 * exprès : le type RÉEL est celui que reconnaît le contrôle des octets, posé à
 * la copie vers la clé définitive.
 */
export const TYPE_ENVOI_PIECE_JOINTE = "application/octet-stream";

/** Adresse donnée à la personne quand un fichier ne peut pas passer par le formulaire. */
export const ADRESSE_PIECES_JOINTES = "contact@axion-ia.com";

export type FormatPieceJointe =
  | "pdf"
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "ppt"
  | "pptx"
  | "odt"
  | "txt"
  | "csv"
  | "png"
  | "jpg"
  | "zip";

interface DescriptionFormat {
  readonly mime: string;
  readonly extensions: ReadonlyArray<string>;
}

export const FORMATS_PIECE_JOINTE: Readonly<Record<FormatPieceJointe, DescriptionFormat>> = {
  pdf: { mime: "application/pdf", extensions: ["pdf"] },
  doc: { mime: "application/msword", extensions: ["doc"] },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
  },
  xls: { mime: "application/vnd.ms-excel", extensions: ["xls"] },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
  },
  ppt: { mime: "application/vnd.ms-powerpoint", extensions: ["ppt"] },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extensions: ["pptx"],
  },
  odt: { mime: "application/vnd.oasis.opendocument.text", extensions: ["odt"] },
  txt: { mime: "text/plain", extensions: ["txt"] },
  csv: { mime: "text/csv", extensions: ["csv"] },
  png: { mime: "image/png", extensions: ["png"] },
  jpg: { mime: "image/jpeg", extensions: ["jpg", "jpeg"] },
  // Archive : signature contrôlée, JAMAIS ouverte par le serveur ni servie au
  // navigateur (téléchargement neutre `application/octet-stream` seulement).
  zip: { mime: "application/zip", extensions: ["zip"] },
};

/**
 * Les formats qu'on ouvre avec prudence (fiche console) : un tableur peut
 * porter des formules qui appellent l'extérieur, une archive peut contenir
 * n'importe quoi. Le serveur n'en a lu que la signature.
 */
export const FORMATS_A_OUVRIR_AVEC_PRUDENCE: ReadonlySet<string> = /* @__PURE__ */ new Set([
  "csv",
  "xls",
  "xlsx",
  "zip",
]);

/** Pour l'attribut `accept` (confort : le serveur revérifie tout). */
export const ACCEPT_PIECES_JOINTES = Object.values(FORMATS_PIECE_JOINTE)
  .flatMap((f) => f.extensions.map((e) => `.${e}`))
  .join(",");

const PHRASE_TROP_LOURD =
  `Fichier trop lourd : envoyez-le par e-mail à ${ADRESSE_PIECES_JOINTES} ` +
  "ou avec un lien de partage (WeTransfer, Drive) dans votre message.";

/** Les messages, au caractère près : ils s'affichent tels quels à la personne. */
export const MESSAGES_PIECES_JOINTES = {
  nombre: `${NOMBRE_MAX_PIECES} fichiers au maximum.`,
  vide: (nom: string) => `« ${nom} » est vide.`,
  taille: (nom: string) => `« ${nom} » dépasse 25 Mo. ${PHRASE_TROP_LOURD}`,
  total: `Les pièces jointes dépassent 50 Mo au total. ${PHRASE_TROP_LOURD}`,
  format: (nom: string) =>
    `« ${nom} » : format non accepté. Formats acceptés : PDF, Word, Excel, PowerPoint, ODT, TXT, CSV, PNG, JPG, ZIP.`,
  macros: (nom: string) =>
    `« ${nom} » contient des macros : enregistrez-le sans macros (.docx, .xlsx, .pptx) puis réessayez.`,
  contenu: (nom: string) =>
    `« ${nom} » ne correspond pas à son extension : ce fichier ne peut pas être accepté.`,
  infecte: (nom: string) => `« ${nom} » a été refusé par notre antivirus.`,
  nonRecue: (nom: string) =>
    `« ${nom} » : pièce non reçue. Envoyez-la à ${ADRESSE_PIECES_JOINTES} en rappelant la référence ci-dessous.`,
} as const;

/** Extensions refusées nommément : un message clair vaut mieux que « format non accepté ». */
export const EXTENSIONS_MACROS = new Set([
  "docm",
  "dotm",
  "xlsm",
  "xltm",
  "xlsb",
  "pptm",
  "potm",
  "ppsm",
]);

/** L'extension d'un nom, sans le point, en minuscules, ou `null`. */
export function extensionPieceJointe(nom: string): string | null {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(nom.trim());
  return m ? m[1]!.toLowerCase() : null;
}

/** Le format désigné par l'extension, ou `null` (hors liste). */
export function formatDepuisExtension(nom: string): FormatPieceJointe | null {
  const ext = extensionPieceJointe(nom);
  if (!ext) return null;
  for (const [format, d] of Object.entries(FORMATS_PIECE_JOINTE) as Array<
    [FormatPieceJointe, DescriptionFormat]
  >) {
    if (d.extensions.includes(ext)) return format;
  }
  return null;
}

/**
 * Nom de fichier assaini : jamais de chemin, de caractère de contrôle ni de
 * caractère réservé ; 120 caractères au plus, extension en minuscules gardée.
 * Le nom ne sert qu'à l'AFFICHAGE et au téléchargement : la clé de stockage,
 * elle, est tirée au hasard et n'en reprend rien.
 */
export function assainirNomPieceJointe(nom: string): string {
  const base = (nom.split(/[/\\]/).pop() ?? "").normalize("NFC");
  const ext = extensionPieceJointe(base);
  const sansExt = ext ? base.slice(0, -(ext.length + 1)) : base;
  const propre = sansExt
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[^\p{L}\p{N} ._()'-]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/_+/g, "_")
    .replace(/^[.\s_-]+|[.\s_]+$/g, "")
    .slice(0, 110)
    .trim();
  const tronc = propre || "piece-jointe";
  return ext ? `${tronc}.${ext}` : tronc;
}

/** « 18 Ko », « 1,4 Mo ». */
export function tailleLisiblePieceJointe(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  const mo = octets / (1024 * 1024);
  return `${mo.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

// ---- Contrôle rapide (navigateur ET serveur) --------------------------------

export interface FichierAnnonce {
  readonly name: string;
  readonly size: number;
}

/**
 * Nombre, taille, extension — sans lire un octet. Rend le PREMIER message
 * d'erreur, ou `null`. Le navigateur s'en sert pour prévenir avant l'envoi ; le
 * serveur le rejoue, puis lit les octets (`server/contact/octets-pieces-jointes`).
 */
export function controlerListePiecesJointes(
  fichiers: ReadonlyArray<FichierAnnonce>,
): string | null {
  if (fichiers.length > NOMBRE_MAX_PIECES) return MESSAGES_PIECES_JOINTES.nombre;
  let total = 0;
  for (const f of fichiers) {
    const ext = extensionPieceJointe(f.name);
    if (ext && EXTENSIONS_MACROS.has(ext)) return MESSAGES_PIECES_JOINTES.macros(f.name);
    if (!formatDepuisExtension(f.name)) return MESSAGES_PIECES_JOINTES.format(f.name);
    if (f.size <= 0) return MESSAGES_PIECES_JOINTES.vide(f.name);
    if (f.size > TAILLE_MAX_PIECE_OCTETS) return MESSAGES_PIECES_JOINTES.taille(f.name);
    total += f.size;
  }
  if (total > TAILLE_MAX_TOTALE_OCTETS) return MESSAGES_PIECES_JOINTES.total;
  return null;
}
