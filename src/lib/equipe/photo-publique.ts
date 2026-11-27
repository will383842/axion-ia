/**
 * Règle UNIQUE d'affichage de la vraie photo d'un collaborateur. Pure : aucun accès base.
 *
 * La photo réelle n'est montrée que si la fiche est publiée, de type « reelle », avec un
 * consentement photo enregistré et sans demande d'effacement. Sinon : avatar à initiales.
 * La route qui sert les images applique la même règle (jamais de variante servie hors règle).
 *
 * ⚠️ Afficher ces URLs avec `<img>` ou `<Image unoptimized>`, JAMAIS via l'optimiseur `/_next/image` :
 * il garde ses copies un an (`minimumCacheTTL`) et survivrait à un retrait de photo.
 */
export interface PhotoPubliqueEntree {
  readonly status: string;
  readonly photoKind: string;
  readonly photoConsentAt: Date | null;
  readonly erasureRequestedAt: Date | null;
  readonly photoUrl256: string | null;
  readonly photoUrl1024: string | null;
}

export function photoAffichable(m: PhotoPubliqueEntree): boolean {
  return (
    m.status === "publie" &&
    m.photoKind === "reelle" &&
    m.photoConsentAt !== null &&
    m.erasureRequestedAt === null
  );
}

export function urlPhotoPublique(m: PhotoPubliqueEntree, taille: 256 | 1024): string | null {
  if (!photoAffichable(m)) return null;
  const url = taille === 256 ? m.photoUrl256 : m.photoUrl1024;
  return url !== null && url !== "" ? url : null;
}
