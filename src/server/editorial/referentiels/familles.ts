/**
 * Console éditoriale — familles d'assets et spécifications de plateforme.
 *
 * Module PUR : aucun import `next`/prisma.
 *
 * Les familles sont ce que la colonne `format` du dossier importé désigne
 * (§6). Elles servent trois choses : déduire le `statutAsset` initial d'une
 * publication, porter les objectifs par format (§3), et rattacher les specs.
 *
 * ⚠️ Les specs ne sont PAS montrées à l'écran au lot 0 (§1 ter) : elles
 * servent à la VÉRIFICATION, pas à la décoration. Elles sont pourtant semées
 * dès maintenant, parce que la règle `spec-plateforme` les lit et qu'une règle
 * dont le référentiel est vide est une règle qui ne garde rien.
 */

export interface AmorcageFamille {
  slug: string;
  nom: string;
  type: "video" | "carrousel" | "image" | "photo" | "audio" | "document";
  dureeMinSec: number | null;
  dureeMaxSec: number | null;
  description: string;
  /**
   * Écritures rencontrées dans la colonne `format` du CSV, en minuscules et
   * sans accent. L'import s'appuie dessus. Une écriture inconnue n'invente
   * PAS une famille : elle part en erreur de ligne, avec son détail.
   */
  aliasImport: readonly string[];
}

/**
 * Format sans aucun asset à produire : la publication est du texte seul et
 * son `statutAsset` naît à `non_requis`. Ce n'est pas une famille — une
 * famille sans type d'asset n'aurait pas de sens.
 */
export const ALIAS_TEXTE_SEUL: readonly string[] = [
  "texte",
  "texte seul",
  "post texte",
  "text",
  "aucun",
  "",
] as const;

export const ED_FAMILLES: readonly AmorcageFamille[] = [
  {
    slug: "carrousel",
    nom: "Carrousel",
    type: "carrousel",
    dureeMinSec: null,
    dureeMaxSec: null,
    description: "Document à pages multiples, feuilleté dans le fil.",
    aliasImport: ["carrousel", "carousel", "pdf carrousel", "slides"],
  },
  {
    slug: "image-unique",
    nom: "Image unique",
    type: "image",
    dureeMinSec: null,
    dureeMaxSec: null,
    description: "Visuel unique — schéma, citation, capture.",
    // « texte + cover », « multi-images » et « 2 photos » viennent du dossier
    // LinkedIn Q4 : ces trois écritures désignent un visuel à produire (leur
    // colonne `production` vaut « visuel »), pas un post de texte nu. Sans
    // elles, 14 lignes du CSV partaient en erreur et bloquaient TOUT l'import.
    aliasImport: [
      "image",
      "image unique",
      "visuel",
      "infographie",
      "texte + cover",
      "multi-images",
      "multi images",
      "2 photos",
    ],
  },
  {
    slug: "photo-williams",
    nom: "Photo Williams",
    type: "photo",
    dureeMinSec: null,
    dureeMaxSec: null,
    description:
      "Photographie de Williams. Distincte de l'image : la colonne `photo_will` du " +
      "dossier importé lui est propre et crée son propre asset.",
    aliasImport: ["photo", "photo will", "portrait"],
  },
  {
    slug: "video-courte",
    nom: "Vidéo courte",
    type: "video",
    dureeMinSec: 15,
    dureeMaxSec: 90,
    description: "Prise de parole brève, tournée pour le fil.",
    aliasImport: ["video", "video courte", "vidéo", "clip"],
  },
  {
    slug: "short-vertical",
    nom: "Short vertical",
    type: "video",
    dureeMinSec: 15,
    dureeMaxSec: 60,
    description:
      "Format vertical dérivé d'un épisode. C'est le dérivé le plus produit : " +
      "32 shorts pour un épisode de 58 minutes (§5).",
    aliasImport: ["short", "shorts", "vertical", "reel", "reels"],
  },
  {
    slug: "extrait-video",
    nom: "Extrait vidéo",
    type: "video",
    dureeMinSec: 60,
    dureeMaxSec: 300,
    description: "Séquence tirée d'un épisode, au format du fil.",
    aliasImport: ["extrait", "extrait video", "sequence"],
  },
  {
    slug: "episode-podcast",
    nom: "Épisode de podcast",
    type: "video",
    dureeMinSec: 900,
    dureeMaxSec: 5400,
    description:
      "L'entretien intégral, tourné chez un dirigeant. Son master est livré ; " +
      "ses rushes ne passent JAMAIS par l'outil (§5).",
    aliasImport: ["episode", "podcast", "episode podcast", "entretien"],
  },
  {
    slug: "document-pdf",
    nom: "Document PDF",
    type: "document",
    dureeMinSec: null,
    dureeMaxSec: null,
    description: "Guide ou livre blanc téléchargeable.",
    aliasImport: ["document", "pdf", "guide", "livre blanc"],
  },
  {
    slug: "audio-podcast",
    nom: "Audio de podcast",
    type: "audio",
    dureeMinSec: 900,
    dureeMaxSec: 5400,
    description: "Piste audio seule, pour les plateformes d'écoute.",
    aliasImport: ["audio", "audio podcast"],
  },
] as const;

export interface AmorcageSpec {
  plateforme: "linkedin" | "youtube" | "facebook" | "instagram" | "tiktok" | "email" | "site";
  familleSlug: string;
  ratio: string;
  dureeMinSec: number | null;
  dureeMaxSec: number | null;
  poidsMaxMo: number | null;
  sousTitresIncrust: boolean;
  zoneSecuriteHaut: number | null;
  zoneSecuriteBas: number | null;
  note: string;
}

export const ED_SPECS_PLATEFORME: readonly AmorcageSpec[] = [
  {
    plateforme: "linkedin",
    familleSlug: "video-courte",
    ratio: "1:1",
    dureeMinSec: 3,
    dureeMaxSec: 600,
    poidsMaxMo: 5120,
    sousTitresIncrust: true,
    zoneSecuriteHaut: 120,
    zoneSecuriteBas: 180,
    note: "Le carré consomme plus de hauteur de fil que le 16:9 et se lit sans le son.",
  },
  {
    plateforme: "linkedin",
    familleSlug: "carrousel",
    ratio: "4:5",
    dureeMinSec: null,
    dureeMaxSec: null,
    poidsMaxMo: 100,
    sousTitresIncrust: false,
    zoneSecuriteHaut: 80,
    zoneSecuriteBas: 80,
    note: "300 pages au maximum côté plateforme ; en pratique 8 à 12 sont lues.",
  },
  {
    plateforme: "linkedin",
    familleSlug: "image-unique",
    ratio: "4:5",
    dureeMinSec: null,
    dureeMaxSec: null,
    poidsMaxMo: 10,
    sousTitresIncrust: false,
    zoneSecuriteHaut: 0,
    zoneSecuriteBas: 0,
    note: "Le 4:5 occupe la hauteur maximale autorisée dans le fil.",
  },
  {
    plateforme: "linkedin",
    familleSlug: "document-pdf",
    ratio: "4:5",
    dureeMinSec: null,
    dureeMaxSec: null,
    poidsMaxMo: 100,
    sousTitresIncrust: false,
    zoneSecuriteHaut: null,
    zoneSecuriteBas: null,
    note: "",
  },
  {
    plateforme: "youtube",
    familleSlug: "episode-podcast",
    ratio: "16:9",
    dureeMinSec: 900,
    dureeMaxSec: 43200,
    poidsMaxMo: 262144,
    sousTitresIncrust: false,
    zoneSecuriteHaut: null,
    zoneSecuriteBas: null,
    note: "Sous-titres en piste séparée, jamais incrustés sur l'épisode long.",
  },
  {
    plateforme: "youtube",
    familleSlug: "short-vertical",
    ratio: "9:16",
    dureeMinSec: 1,
    dureeMaxSec: 60,
    poidsMaxMo: 2048,
    sousTitresIncrust: true,
    zoneSecuriteHaut: 180,
    zoneSecuriteBas: 320,
    note: "Au-delà de 60 s, YouTube ne le traite plus comme un Short mais comme une vidéo.",
  },
  {
    plateforme: "instagram",
    familleSlug: "short-vertical",
    ratio: "9:16",
    dureeMinSec: 3,
    dureeMaxSec: 90,
    poidsMaxMo: 4096,
    sousTitresIncrust: true,
    zoneSecuriteHaut: 220,
    zoneSecuriteBas: 420,
    note: "Zone basse large : l'interface recouvre le bas du cadre.",
  },
  {
    plateforme: "tiktok",
    familleSlug: "short-vertical",
    ratio: "9:16",
    dureeMinSec: 3,
    dureeMaxSec: 600,
    poidsMaxMo: 4096,
    sousTitresIncrust: true,
    zoneSecuriteHaut: 200,
    zoneSecuriteBas: 480,
    note: "Emplacement réservé — aucune intégration au lot 0 (§1 bis, compte reporté).",
  },
  {
    plateforme: "facebook",
    familleSlug: "video-courte",
    ratio: "4:5",
    dureeMinSec: 3,
    dureeMaxSec: 1200,
    poidsMaxMo: 4096,
    sousTitresIncrust: true,
    zoneSecuriteHaut: 120,
    zoneSecuriteBas: 200,
    note: "",
  },
] as const;
