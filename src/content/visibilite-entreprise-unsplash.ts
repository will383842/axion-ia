// Photos Unsplash réelles conformes CGU (free-tier, download-trigger §6, attribution
// via <UnsplashCredit>). Curées via curate-visibilite-entreprise-unsplash.mjs puis
// LOCALISÉES en AVIF sous /public/illustrations/visibilite via
// localize-visibilite-unsplash.mjs (servies depuis axion-ia.com → indexables Google
// Images sous notre domaine + référencées dans page-images.ts pour le sitemap).
export interface VisibiliteUnsplashImage {
  readonly slot: string;
  readonly label: string;
  readonly photoId: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly src: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
}

export const VISIBILITE_UNSPLASH: readonly VisibiliteUnsplashImage[] = [
  {
    slot: "hero",
    label: "Vos équipes mises en lumière",
    photoId: "376KN_ISplE",
    width: 1600,
    height: 1067,
    alt: "man in white dress shirt sitting beside woman in black long sleeve shirt",
    src: "/illustrations/visibilite/equipe-entreprise-mise-en-lumiere-visibilite-axion-ia.avif",
    photographer: "krakenimages",
    photographerUrl: "https://unsplash.com/@krakenimages",
    photoUrl: "https://unsplash.com/photos/376KN_ISplE",
  },
  {
    slot: "podcast",
    label: "Podcast dirigeant ou collaborateur",
    photoId: "c1ZN57GfDB0",
    width: 1600,
    height: 1067,
    alt: "macro photography of silver and black studio microphone condenser",
    src: "/illustrations/visibilite/podcast-dirigeant-entreprise-visibilite-axion-ia.avif",
    photographer: "Jonathan Velasquez",
    photographerUrl: "https://unsplash.com/@jonathanvez",
    photoUrl: "https://unsplash.com/photos/c1ZN57GfDB0",
  },
  {
    slot: "interview",
    label: "Interviews des participants",
    photoId: "PkS3hCZmYts",
    width: 1600,
    height: 1099,
    alt: "man wearing headset",
    src: "/illustrations/visibilite/interview-participant-entreprise-visibilite-axion-ia.avif",
    photographer: "Austin Distel",
    photographerUrl: "https://unsplash.com/@austindistel",
    photoUrl: "https://unsplash.com/photos/PkS3hCZmYts",
  },
  {
    slot: "page",
    label: "Page dédiée sur axion-ia.com",
    photoId: "Px3iBXV-4TU",
    width: 1600,
    height: 924,
    alt: "turned on MacBook Pro beside gray mug",
    src: "/illustrations/visibilite/page-dediee-entreprise-secteur-visibilite-axion-ia.avif",
    photographer: "Igor Miske",
    photographerUrl: "https://unsplash.com/@igormiske",
    photoUrl: "https://unsplash.com/photos/Px3iBXV-4TU",
  },
  {
    slot: "backlink",
    label: "Backlink dofollow — autorité SEO",
    photoId: "hpjSkU2UYSU",
    width: 1600,
    height: 1140,
    alt: "laptop computer on glass-top table",
    src: "/illustrations/visibilite/backlink-dofollow-autorite-seo-visibilite-axion-ia.avif",
    photographer: "Carlos Muza",
    photographerUrl: "https://unsplash.com/@kmuza",
    photoUrl: "https://unsplash.com/photos/hpjSkU2UYSU",
  },
  {
    slot: "linkedin",
    label: "Relais LinkedIn",
    photoId: "FPt10LXK0cg",
    width: 1600,
    height: 1067,
    alt: "person holding black phone",
    src: "/illustrations/visibilite/relais-linkedin-entreprise-visibilite-axion-ia.avif",
    photographer: "ROBIN WORRALL",
    photographerUrl: "https://unsplash.com/@robin_rednine",
    photoUrl: "https://unsplash.com/photos/FPt10LXK0cg",
  },
  {
    slot: "notoriete",
    label: "Notoriété et confiance",
    photoId: "n95VMLxqM2I",
    width: 1600,
    height: 1068,
    alt: "two people shaking hands",
    src: "/illustrations/visibilite/notoriete-confiance-entreprise-visibilite-axion-ia.avif",
    photographer: "Cytonn Photography",
    photographerUrl: "https://unsplash.com/@cytonn_photography",
    photoUrl: "https://unsplash.com/photos/n95VMLxqM2I",
  },
] as const;
