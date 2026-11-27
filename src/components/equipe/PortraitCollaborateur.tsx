import Image from "next/image";
import type { FichePublique } from "@/lib/equipe";
import { AvatarInitiales } from "./AvatarInitiales";

/**
 * Vraie photo seulement si elle porte un consentement daté ; sinon avatar à initiales.
 * Le conteneur `aspect-square` réserve la place : CLS 0.
 */
export function PortraitCollaborateur({
  fiche,
  sizes = "(min-width: 1024px) 420px, 240px",
  priority = false,
  className,
  decoratif = false,
}: {
  fiche: Pick<FichePublique, "nom" | "initiales" | "categorie" | "photo">;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Nom écrit à côté : photo `alt=""`, avatar masqué aux lecteurs d'écran. */
  decoratif?: boolean;
}) {
  const photo =
    fiche.photo?.src && !Number.isNaN(Date.parse(fiche.photo.consentementLe ?? ""))
      ? fiche.photo
      : null;
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-3xl${className ? ` ${className}` : ""}`}
    >
      {photo ? (
        <Image
          src={photo.src}
          alt={decoratif ? "" : photo.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <AvatarInitiales
          initiales={fiche.initiales}
          nom={fiche.nom}
          categorie={fiche.categorie}
          decoratif={decoratif}
        />
      )}
    </div>
  );
}
