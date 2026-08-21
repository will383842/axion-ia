import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

type EyebrowVariant =
  "default" | "primary" | "purple" | "orange" | "green" | "pink" | "yellow" | "red";

interface EyebrowProps extends Omit<ComponentPropsWithoutRef<"p">, "title"> {
  variant?: EyebrowVariant;
}

// Uppercase label 12.8-15px, weight 500-600, tracking ~1.5px (Design.md §3).
// `variant` lets each module pick its accent (axionia-design module-color mapping).
const variantClasses: Record<EyebrowVariant, string> = {
  default: "text-fg-muted",
  primary: "text-primary",
  purple: "text-accent-purple",
  // 🔴 a11y 2026-08-21 — un eyebrow est du texte à 0,8 rem : il lui faut 4,50:1.
  // Mesuré sur le fond du site, la famille `accent-*` est faite pour des FONDS et
  // des ORNEMENTS, pas pour du texte. Ratios relevés, seuil AA = 4,50 :
  //   purple 5,02 ✅ · red 4,07 ❌ · pink 2,97 ❌ · orange 2,69 ❌
  //   green 1,84 ❌ · yellow 1,75 ❌
  //
  // `orange` et `green` pointent désormais sur les jetons que ces deux modules
  // utilisent RÉELLEMENT ailleurs — la page de design le disait déjà elle-même,
  // son libellé de démonstration porte « green / sage ». `--color-warning` (4,61)
  // et `--color-sage` (5,28 — déjà assombri pour AA par un sprint précédent)
  // passent tous deux.
  orange: "text-warning",
  green: "text-sage",
  // ⚠️ Ces trois-là restent sur des accents qui ÉCHOUENT AA. Aucun appelant dans
  // le produit aujourd'hui (vérifié : seules la page de design et un test les
  // instancient). Les faire pointer ailleurs serait inventer une couleur de
  // module qui n'existe pas — mieux vaut que le prochain qui veut s'en servir
  // lise ce commentaire d'abord.
  pink: "text-accent-pink",
  yellow: "text-accent-yellow",
  red: "text-accent-red",
};

export function Eyebrow({ variant = "default", className, children, ...rest }: EyebrowProps) {
  return (
    <p
      className={cn(
        "text-[0.8rem] leading-tight font-semibold tracking-[0.1em] uppercase",
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </p>
  );
}
