// ─── TYPES — source de vérité pour LogosMarquee + VideoTestimonials ───
// Définis ici (et non dans `src/components/home/`) pour respecter la frontière
// de modules : `content/` ne doit jamais importer de `components/`. Les
// composants importent ces types depuis `@/content/home-data`.
export interface ClientLogo {
  /** Slug stable utilisé comme key + data-attribute pour analytics. */
  slug: string;
  /** Nom complet utilisé dans alt + aria. */
  name: string;
  /** Chemin public absolu (SVG préféré pour grayscale lossless). */
  src: string;
  /** Largeur intrinsèque (anti-CLS). */
  width?: number;
  /** Hauteur intrinsèque (anti-CLS). */
  height?: number;
}

export interface VideoTestimonial {
  slug: string;
  title: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  /** YouTube ID (utiliser youtube-nocookie.com pour réduire tracking). */
  youtubeId: string;
  /** Thumbnail custom — sinon fallback YouTube auto thumb. */
  thumbnail?: string;
  /** Durée ISO 8601 (PT1M28S). Sert au JSON-LD VideoObject. */
  duration?: string;
  /**
   * Date de publication ISO 8601 (YYYY-MM-DD). REQUIS pour signal AEO de
   * fraîcheur honnête vs date de build dynamique (cf. audit AEO 2026-05-24).
   */
  datePublished: string;
}

// ─── LOGOS CLIENTS ─────────────────────────────────────────────────────────
// VIDE depuis le 2026-10-09 : les 16 marques affichées jusque-là ont été
// retirées après un message de la DGCCRF (décision de Will), avec leurs SVG.
// L'ancienne liste reste lisible dans l'historique git de ce fichier.
//
// Pour remettre un logo : un client RÉEL ayant donné son accord écrit, son SVG
// dans `public/logos/clients/{slug}.svg`, une entrée ci-dessous, puis allumer
// `LOGOS_CLIENTS_AFFICHES` (src/content/preuves-sociales.ts).
// Width/height = dimensions du viewBox SVG (anti-CLS) ; hauteur de référence
// 60 px pour que tous les logos soient réduits au même facteur.
// Exemple : { slug: "acme", name: "Acme", src: "/logos/clients/acme.svg", width: 180, height: 60 },
export const CLIENT_LOGOS: ClientLogo[] = [];

// ─── VIDÉOS TÉMOIGNAGES ────────────────────────────────────────────────────
// Section conditionnelle (blueprint §10) : si tableau vide → section masquée
// dans la home. Will fournira les youtubeId + thumbnail au fur et à mesure
// que les vidéos seront tournées. Format recommandé : 60-90 s, profils
// contrastés (1 PME + 1 ETI + 1 grand groupe ou 3 secteurs différents).
export const VIDEO_TESTIMONIALS: VideoTestimonial[] = [
  // Exemple structure (décommenter et remplir quand la vidéo sera prête) :
  // {
  //   slug: "forges-du-sud",
  //   title: "Témoignage Marie-Christine Leroy — Forges du Sud",
  //   quote: "En 6 semaines, on a divisé par 3 le temps de traitement de nos devis.",
  //   author: "Marie-Christine Leroy",
  //   role: "Directrice Opérationnelle",
  //   company: "Groupe Forges du Sud",
  //   youtubeId: "XXXXXXXXXXX",
  //   duration: "PT1M28S",
  // },
];

// ─── SECTEURS D'ACTIVITÉ ───────────────────────────────────────────────────
// Tags affichés sous les 3 segments cible (PME/ETI/grands groupes). Sert au
// signal AEO "Axion-IA intervient dans tous les secteurs" + indexation
// LLM des entités sectorielles. Ordre = pertinence business observée.
export const SECTORS = [
  "Industrie",
  "Retail & e-commerce",
  "Santé & pharmacie",
  "Finance & assurance",
  "RH & recrutement",
  "Logistique & transport",
  "Immobilier",
  "Conseil & services",
  "Éducation & formation",
  "Juridique",
  "BTP & construction",
  "Agroalimentaire",
  "Automobile",
  "Tourisme & hôtellerie",
  "Médias & édition",
  "Énergie",
] as const;
