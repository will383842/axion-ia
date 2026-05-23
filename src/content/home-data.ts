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
}

// ─── LOGOS CLIENTS ─────────────────────────────────────────────────────────
// 17 marques pour lesquelles Will (CEO Axion-IA) a obtenu l'accord écrit
// d'affichage en tant que clients. 8 logos officiels Wikimedia + 9 wordmarks
// textuels en attente des SVG officiels de chaque marque (à remplacer un par
// un dans `public/logos/clients/` quand fournis).
//
// Width/height = dimensions du viewBox SVG (anti-CLS). Tous sont sous
// `public/logos/clients/{slug}.svg`.
export const CLIENT_LOGOS: ClientLogo[] = [
  { slug: "leclerc", name: "E.Leclerc", src: "/logos/clients/leclerc.svg", width: 200, height: 60 },
  {
    slug: "intermarche",
    name: "Intermarché",
    src: "/logos/clients/intermarche.svg",
    width: 200,
    height: 38,
  },
  { slug: "point-p", name: "Point P", src: "/logos/clients/point-p.svg", width: 200, height: 53 },
  { slug: "gedimat", name: "Gedimat", src: "/logos/clients/gedimat.svg", width: 200, height: 53 },
  { slug: "renault", name: "Renault", src: "/logos/clients/renault.svg", width: 180, height: 60 },
  {
    slug: "volkswagen",
    name: "Volkswagen",
    src: "/logos/clients/volkswagen.svg",
    width: 60,
    height: 60,
  },
  {
    slug: "ad-auto",
    name: "AD Auto Distribution",
    src: "/logos/clients/ad-auto.svg",
    width: 200,
    height: 53,
  },
  { slug: "axa", name: "AXA", src: "/logos/clients/axa.svg", width: 80, height: 60 },
  {
    slug: "generali",
    name: "Generali",
    src: "/logos/clients/generali.svg",
    width: 220,
    height: 40,
  },
  { slug: "iad", name: "IAD", src: "/logos/clients/iad.svg", width: 160, height: 53 },
  { slug: "safti", name: "SAFTI", src: "/logos/clients/safti.svg", width: 200, height: 53 },
  {
    slug: "pharmacie-lafayette",
    name: "Pharmacie Lafayette",
    src: "/logos/clients/pharmacie-lafayette.svg",
    width: 220,
    height: 53,
  },
  { slug: "ecf", name: "ECF", src: "/logos/clients/ecf.svg", width: 160, height: 53 },
  { slug: "krys", name: "Krys", src: "/logos/clients/krys.svg", width: 180, height: 53 },
  {
    slug: "jardiland",
    name: "Jardiland",
    src: "/logos/clients/jardiland.svg",
    width: 200,
    height: 53,
  },
  {
    slug: "la-poste",
    name: "La Poste",
    src: "/logos/clients/la-poste.svg",
    width: 180,
    height: 60,
  },
  {
    slug: "intersport",
    name: "Intersport",
    src: "/logos/clients/intersport.svg",
    width: 240,
    height: 26,
  },
];

// ─── VIDÉOS TÉMOIGNAGES ────────────────────────────────────────────────────
// Section conditionnelle (blueprint §10) : si tableau vide → section masquée
// dans la home. Will fournira les youtubeId + thumbnail au fur et à mesure
// que les vidéos seront tournées. Format recommandé : 60-90 s, profils
// contrastés (1 TPE + 1 PME + 1 ETI ou 3 secteurs différents).
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
// Tags affichés sous les 4 segments cible (TPE/PME/ETI/Grande). Sert au
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
