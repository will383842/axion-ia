import * as React from "react";
import { cn } from "@/lib/utils";

// Editorial v3 — radius-xl 20px, border sand-doux, hover terracotta + shadow
// douce. Padding plus généreux (p-7) pour respiration éditoriale.
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "border-border bg-paper hover:border-border-strong rounded-xl border shadow-subtle transition duration-200 hover:shadow-card",
          className,
        )}
        {...rest}
      />
    );
  },
);

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("space-y-2 p-7", className)} {...rest} />;
  },
);

/**
 * GEO-124 (audit GEO/AEO 2026-08-14) — niveau de titre RENDU CONFIGURABLE.
 *
 * `CardTitle` etait fige en `<h3>`. Sur les pages ou les cartes suivent
 * directement le `<h1>` sans `<h2>` intermediaire, l'outline sautait un niveau
 * (`h1 -> h3`) : un lecteur d'ecran et un extracteur de plan y voient une
 * section manquante.
 *
 * `as` est OPTIONNEL et vaut `h3` : les usages existants ne bougent pas d'un
 * pixel ni d'une balise. Seules les pages qui ont besoin de fermer leur outline
 * passent `as="h2"`. La taille reste imposee par les classes, pas par la
 * balise — aucun changement visuel.
 */
export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }
>(function CardTitle({ className, as: Tag = "h3", ...rest }, ref) {
  return (
    <Tag
      ref={ref}
      className={cn("text-fg text-xl leading-tight font-semibold tracking-tight", className)}
      {...rest}
    />
  );
});

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...rest }, ref) {
  return (
    <p
      ref={ref}
      className={cn("text-fg-soft text-sm leading-relaxed", className)}
      {...rest}
    />
  );
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("p-7 pt-0", className)} {...rest} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("flex items-center p-7 pt-0", className)} {...rest} />;
  },
);
