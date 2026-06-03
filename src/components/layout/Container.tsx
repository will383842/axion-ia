import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

interface ContainerProps<T extends ElementType = "div"> {
  as?: T;
  className?: string | undefined;
  children: ReactNode;
}

// Editorial v3 container: max-w 1366, responsive padding progressif
// 16/24/40/64. Plus aéré sur grands écrans tout en restant cadré (pas
// pleine largeur). Mobile-first.
//
// SSOT largeur — 2026-06-03 (audit responsive). Le cap est passé de 1520 →
// 1366 px : 1520 laissait le contenu quasi bord-à-bord sur un MacBook 14″
// (1512 px CSS) → rendu peu premium + bascule visuelle « plein écran 14″ /
// marges 16″ » (le seuil 1520 tombait pile entre 1512 et 1728). À 1366, le
// 14″ ET le 16″ ont des marges latérales élégantes et cohérentes (fin de la
// bascule). Header (`Header.tsx`) et Footer (`Footer.tsx`) wrappent leur
// contenu interne sur CE MÊME cap + cette MÊME rampe de gouttières → bords
// gauche/droit parfaitement alignés header/contenu/footer à tous les
// breakpoints. Toute divergence de largeur (skeletons `loading.tsx`, etc.)
// doit s'aligner ici.
export function Container<T extends ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: ContainerProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof ContainerProps<T>>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={cn("mx-auto w-full max-w-[1366px] px-4 sm:px-6 lg:px-10 xl:px-16", className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
