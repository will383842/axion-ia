// Correctif P0 audit UX 2026-08 — aucune miniature nulle part dans la console
// image-bank (vue d'ensemble, bibliothèque, fiche détail affichaient toutes un
// carré gris `.admin-image-placeholder`, sur ~200+ images choisies à l'aveugle
// par titre/slug).
//
// `<img>` natif volontairement (pas next/image) : la console admin n'utilise
// nulle part next/image (pas de `remotePatterns` configurés pour le CDN admin,
// cf. `next.config.ts` — seul `images.unsplash.com` y figure pour les
// témoignages publics). Un `<img>` lazy suffit pour des vignettes de liste.
//
// Le LQIP (base64, `lqipDataUri` généré par le pipeline Sharp) sert de fond
// flou pendant le chargement — même conteneur/aspect-ratio que le placeholder
// gris qu'il remplace, donc aucun décalage de mise en page (CLS) à l'arrivée.

interface AdminImageThumbProps {
  /** URL résolue (cf. `resolveAdminThumbSrc`) ou `null` → repli placeholder gris. */
  src: string | null;
  alt: string;
  lqip?: string | null;
  /** Fiche détail (aspect 3/2, plus grande) vs cartes de liste (4/3). */
  large?: boolean;
  /** `true` = chargement eager (image au-dessus de la ligne de flottaison, fiche détail). */
  priority?: boolean;
}

export function AdminImageThumb({
  src,
  alt,
  lqip,
  large,
  priority,
}: AdminImageThumbProps): React.ReactElement {
  // join(" ") plutôt qu'un template literal : le tri de classes du formatter
  // supprime un espace de tête à l'intérieur d'une chaîne conditionnelle, ce
  // qui collait les deux classes en une seule classe inexistante.
  if (!src) {
    return (
      <div
        className={["admin-image-placeholder", large ? "admin-image-placeholder-large" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={["admin-image-thumb", large ? "admin-image-thumb-large" : ""]
        .filter(Boolean)
        .join(" ")}
      style={lqip ? { backgroundImage: `url(${lqip})` } : undefined}
    >
      <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" />
    </div>
  );
}
