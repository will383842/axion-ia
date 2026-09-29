// VIDÉOS DÉPOSÉES PAR LE CANDIDAT — les règles, PURES (Will, 2026-09-28).
//
// Importé par la page publique (client) ET par les routes : aucune dépendance
// serveur ici. Les limites sont dites au candidat telles qu'elles sont
// appliquées — une seule définition.

export const VIDEOS_MAX = 3;
export const VIDEO_OCTETS_MAX = 200 * 1024 * 1024; // 200 Mo
/**
 * Taille d'un morceau d'envoi. Cloudflare refuse un corps de plus de 100 Mo, et
 * le `proxy` de Next borne ce qu'il met en mémoire : 4 Mo passent partout, et
 * un morceau perdu sur une connexion mobile se renvoie vite.
 */
export const VIDEO_MORCEAU_OCTETS = 4 * 1024 * 1024;

export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"] as const;
export const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm";

export type StatutVideo = "envoi" | "analyse" | "disponible" | "rejetee";

export function extensionAutorisee(nom: string): boolean {
  const n = nom.toLowerCase();
  return VIDEO_EXTENSIONS.some((e) => n.endsWith(e));
}

/** Nombre de morceaux attendus pour une taille donnée. */
export function nombreDeMorceaux(taille: number): number {
  return Math.max(1, Math.ceil(taille / VIDEO_MORCEAU_OCTETS));
}

/**
 * Le format RÉEL d'après les premiers octets — jamais d'après le nom ni le type
 * déclaré par le navigateur, que n'importe qui choisit.
 *  · MP4 / MOV / M4V : « ftyp » aux octets 4 à 7 (famille ISO BMFF) ;
 *  · WebM / Matroska : signature EBML 1A 45 DF A3.
 * `null` : ce n'est pas une vidéo que nous acceptons.
 */
export function formatReel(
  debut: Uint8Array,
): "video/mp4" | "video/quicktime" | "video/webm" | null {
  if (
    debut.length >= 12 &&
    debut[4] === 0x66 &&
    debut[5] === 0x74 &&
    debut[6] === 0x79 &&
    debut[7] === 0x70
  ) {
    const marque = String.fromCharCode(debut[8]!, debut[9]!, debut[10]!, debut[11]!);
    return marque === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (
    debut.length >= 4 &&
    debut[0] === 0x1a &&
    debut[1] === 0x45 &&
    debut[2] === 0xdf &&
    debut[3] === 0xa3
  ) {
    return "video/webm";
  }
  return null;
}

/** Nom affiché, nettoyé (jamais utilisé comme chemin disque). */
export function nomAffichable(nom: string): string {
  const n = nom.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " ").trim();
  return (n || "video").slice(0, 200);
}

export function tailleLisible(octets: number): string {
  return octets >= 1024 * 1024
    ? `${(octets / (1024 * 1024)).toFixed(octets >= 10 * 1024 * 1024 ? 0 : 1).replace(".", ",")} Mo`
    : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}
