"use client";
// use-client: IntersectionObserver runs in the browser only.

import * as React from "react";

interface FadeInOnViewProps {
  children: React.ReactNode;
  /** Optional delay in ms before the fade-in begins. */
  delay?: number;
  className?: string;
}

// P-410 — Remplace `motion/react` (Framer Motion v11, ~30 KB gz) par
// IntersectionObserver natif + transition CSS. Mêmes signaux UX (fade +
// 8 px translate, durée 400 ms, easing custom, once-only, margin
// -10/-10) mais 0 KB shipped. `prefers-reduced-motion` est déjà géré
// globalement par `globals.css` (rule `@media reduce` qui force
// `transition-duration: 0ms`), pas besoin de hook React dédié.
//
// Cumul : `FadeInOnView` est utilisé sur ~16 pages × 4 562 SSG → suppression
// de motion = −30 KB gz × millions de page-views/an.
export function FadeInOnView({ children, delay = 0, className }: FadeInOnViewProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  // 2026-05-23 — Stratégie « progressive enhancement » : la section est
  // VISIBLE par défaut (opacity 1). L'IntersectionObserver est utilisé
  // uniquement pour déclencher l'animation d'entrée sur les machines
  // suffisamment réactives. Si JS bloque / IO ne déclenche pas (CPU
  // saturé, navigateur strict, prefers-reduced-motion) → le contenu reste
  // visible. Garantit zéro section invisible quelle que soit la
  // performance du client.
  //
  // Avant : useState(false) → SSR rendait opacity 0, hydration restait à 0,
  // sections invisibles tant que IO ne firait pas. Sous charge CPU (dev
  // server + tests parallèles), Will voyait des sections vides.
  const [animated, setAnimated] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setAnimated(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 1,
        transform: animated ? "translate3d(0, 0, 0)" : "translate3d(0, 8px, 0)",
        transition:
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "none"
            : `transform 400ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: animated ? "auto" : "transform",
      }}
    >
      {children}
    </div>
  );
}
